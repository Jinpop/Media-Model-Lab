import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env, requireServerEnv } from "@/lib/env";
import { mediaMimeTypes, safeFetchBuffer } from "@/lib/security";

type UploadAssetParams = {
  buffer: Buffer;
  mimeType: string;
  prefix: string;
  fileName?: string;
};

type PersistBufferAssetParams = UploadAssetParams & {
  dataUrlFallback?: boolean;
};

function resolveExtension(mimeType: string): string {
  const normalizedMimeType = mimeType.split(";")[0]?.trim() ?? mimeType;
  const byMime: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
  };

  return byMime[normalizedMimeType] ?? "bin";
}

function safeFileName(fileName: string) {
  const normalized = fileName
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

  return normalized && normalized.length > 0 ? normalized : undefined;
}

function getSupabaseClient() {
  requireServerEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  return createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      persistSession: false,
    },
  });
}

export function isStorageConfigured() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function uploadBufferToStorage({
  buffer,
  mimeType,
  prefix,
  fileName,
}: UploadAssetParams) {
  if (!isStorageConfigured()) {
    throw new Error(
      "Supabase storage is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const supabase = getSupabaseClient();
  const extension = resolveExtension(mimeType);
  const safeName =
    safeFileName(fileName ?? "") ??
    `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  const path = `${prefix}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }

  const { data } = supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .getPublicUrl(path);

  if (!data.publicUrl) {
    throw new Error("Failed to resolve uploaded file URL.");
  }

  return {
    path,
    publicUrl: data.publicUrl,
  };
}

export function bufferToDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function persistBufferAsset({
  buffer,
  mimeType,
  prefix,
  fileName,
  dataUrlFallback = true,
}: PersistBufferAssetParams) {
  if (!isStorageConfigured()) {
    if (!dataUrlFallback) {
      throw new Error(
        "Supabase storage is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }

    return bufferToDataUrl(buffer, mimeType);
  }

  const { publicUrl } = await uploadBufferToStorage({
    buffer,
    mimeType,
    prefix,
    fileName,
  });

  return publicUrl;
}

export async function persistRemoteAsset(
  sourceUrl: string,
  prefix: string,
  fallbackMimeType: string,
) {
  if (!isStorageConfigured()) {
    return sourceUrl;
  }

  const allowedMimeTypes = mediaMimeTypes();
  allowedMimeTypes.add("application/octet-stream");

  const { buffer, mimeType } = await safeFetchBuffer(sourceUrl, {
    allowedMimeTypes,
    maxBytes: 200 * 1024 * 1024,
  });
  const resolvedMimeType =
    mimeType === "application/octet-stream" ? fallbackMimeType : mimeType;
  const { publicUrl } = await uploadBufferToStorage({
    buffer,
    mimeType: resolvedMimeType,
    prefix,
  });

  return publicUrl;
}
