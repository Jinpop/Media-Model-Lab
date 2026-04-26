import "server-only";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Too many requests. Please wait before trying again.");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function clientIdentifier(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "local";
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  return `${ip}:${userAgent.slice(0, 80)}`;
}

export function assertRateLimit(
  request: Request,
  {
    key,
    limit,
    windowMs,
  }: {
    key: string;
    limit: number;
    windowMs: number;
  },
) {
  const now = Date.now();
  const bucketKey = `${key}:${clientIdentifier(request)}`;
  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, {
      count: 1,
      resetAt: now + windowMs,
    });
    return;
  }

  current.count += 1;

  if (current.count > limit) {
    throw new RateLimitError(Math.ceil((current.resetAt - now) / 1000));
  }
}
