import "server-only";

import dns from "node:dns/promises";
import net from "node:net";

export const MAX_INLINE_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_REMOTE_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_REMOTE_VIDEO_BYTES = 200 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "image/gif",
]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

export function cleanMimeType(mimeType: string | null | undefined) {
  return mimeType?.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

export function isAllowedImageMimeType(mimeType: string) {
  return IMAGE_MIME_TYPES.has(cleanMimeType(mimeType));
}

export function isAllowedVideoMimeType(mimeType: string) {
  return VIDEO_MIME_TYPES.has(cleanMimeType(mimeType));
}

function decodedBase64Length(base64: string) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/);
  if (!match) {
    throw new Error("Invalid data URL.");
  }

  const mimeType = cleanMimeType(match[1]);
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  const byteLength = isBase64
    ? decodedBase64Length(payload)
    : Buffer.byteLength(decodeURIComponent(payload), "utf8");
  const buffer = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");

  return {
    buffer,
    byteLength,
    mimeType,
  };
}

export function assertSafeDataImageUrl(dataUrl: string, maxBytes = MAX_INLINE_IMAGE_BYTES) {
  const parsed = parseDataUrl(dataUrl);

  if (!isAllowedImageMimeType(parsed.mimeType)) {
    throw new Error("Only PNG, JPEG, and WebP image inputs are supported.");
  }

  if (parsed.byteLength > maxBytes) {
    throw new Error(`Inline images must be ${Math.round(maxBytes / 1024 / 1024)}MB or smaller.`);
  }

  return parsed;
}

function isPrivateIPv4(address: string) {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIPv6(address: string) {
  const normalized = address.toLowerCase();

  if (normalized.startsWith("::ffff:")) {
    return isPrivateIPv4(normalized.replace("::ffff:", ""));
  }

  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isBlockedIPAddress(address: string) {
  const family = net.isIP(address);

  if (family === 4) {
    return isPrivateIPv4(address);
  }

  if (family === 6) {
    return isPrivateIPv6(address);
  }

  return true;
}

function assertSafeHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  if (
    BLOCKED_HOSTNAMES.has(normalized) ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  ) {
    throw new Error("Local or private URLs are not allowed.");
  }

  if (net.isIP(normalized) && isBlockedIPAddress(normalized)) {
    throw new Error("Local or private URLs are not allowed.");
  }
}

export function parseHttpsUrl(url: string) {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URLs with credentials are not allowed.");
  }

  assertSafeHostname(parsed.hostname);

  return parsed;
}

export async function assertPublicHttpsUrl(url: string) {
  const parsed = parseHttpsUrl(url);

  if (!net.isIP(parsed.hostname)) {
    const addresses = await dns.lookup(parsed.hostname, {
      all: true,
      verbatim: false,
    });

    if (addresses.length === 0 || addresses.some((item) => isBlockedIPAddress(item.address))) {
      throw new Error("Local or private URLs are not allowed.");
    }
  }

  return parsed.toString();
}

async function readResponseBuffer(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) {
    return Buffer.from(await response.arrayBuffer());
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    received += value.byteLength;
    if (received > maxBytes) {
      throw new Error(`Remote asset exceeds ${Math.round(maxBytes / 1024 / 1024)}MB.`);
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

export async function safeFetchBuffer(
  url: string,
  {
    allowedMimeTypes,
    maxBytes,
    timeoutMs = 15_000,
  }: {
    allowedMimeTypes: Set<string>;
    maxBytes: number;
    timeoutMs?: number;
  },
) {
  let currentUrl = await assertPublicHttpsUrl(url);

  for (let redirects = 0; redirects < 4; redirects += 1) {
    const response = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Remote asset redirect did not include a location.");
      }

      currentUrl = await assertPublicHttpsUrl(new URL(location, currentUrl).toString());
      continue;
    }

    if (!response.ok) {
      throw new Error(`Unable to download remote asset: ${response.status}`);
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (contentLength > maxBytes) {
      throw new Error(`Remote asset exceeds ${Math.round(maxBytes / 1024 / 1024)}MB.`);
    }

    const mimeType = cleanMimeType(response.headers.get("content-type"));
    if (!allowedMimeTypes.has(mimeType)) {
      throw new Error("Remote asset type is not supported.");
    }

    return {
      buffer: await readResponseBuffer(response, maxBytes),
      mimeType,
      url: currentUrl,
    };
  }

  throw new Error("Remote asset redirected too many times.");
}

export function imageMimeTypes() {
  return new Set(IMAGE_MIME_TYPES);
}

export function mediaMimeTypes() {
  return new Set([...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES]);
}
