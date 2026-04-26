import "server-only";

const clean = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const env = {
  DATABASE_URL: clean(process.env.DATABASE_URL),
  OPENAI_API_KEY: clean(process.env.OPENAI_API_KEY),
  OPENAI_IMAGE_MODELS: clean(process.env.OPENAI_IMAGE_MODELS),
  OPENAI_EDIT_MODELS: clean(process.env.OPENAI_EDIT_MODELS),
  OPENAI_VIDEO_MODELS: clean(process.env.OPENAI_VIDEO_MODELS),
  REPLICATE_API_TOKEN: clean(process.env.REPLICATE_API_TOKEN),
  REPLICATE_IMAGE_MODELS: clean(process.env.REPLICATE_IMAGE_MODELS),
  REPLICATE_IMAGE_MODEL:
    clean(process.env.REPLICATE_IMAGE_MODEL) ?? "black-forest-labs/flux-schnell",
  REPLICATE_EDIT_MODELS: clean(process.env.REPLICATE_EDIT_MODELS),
  REPLICATE_EDIT_MODEL:
    clean(process.env.REPLICATE_EDIT_MODEL) ?? "qwen/qwen-image-edit-plus",
  REPLICATE_VIDEO_MODELS: clean(process.env.REPLICATE_VIDEO_MODELS),
  REPLICATE_VIDEO_MODEL:
    clean(process.env.REPLICATE_VIDEO_MODEL) ?? "wavespeedai/wan-2.1-i2v-480p",
  SUPABASE_URL: clean(process.env.SUPABASE_URL),
  SUPABASE_SERVICE_ROLE_KEY: clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  SUPABASE_STORAGE_BUCKET: clean(process.env.SUPABASE_STORAGE_BUCKET) ?? "media",
  NEXT_PUBLIC_APP_URL:
    clean(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000",
};

export function requireServerEnv(keys: Array<keyof typeof env>): void {
  const missing = keys.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}
