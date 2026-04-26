import "server-only";

import OpenAI, { toFile } from "openai";

import { env, requireServerEnv } from "@/lib/env";
import { persistBufferAsset } from "@/lib/storage";
import {
  assertSafeDataImageUrl,
  cleanMimeType,
  imageMimeTypes,
  safeFetchBuffer,
} from "@/lib/security";
import {
  type EditImageParams,
  type GenerateImageParams,
  type GenerateVideoParams,
  type HybridProvider,
  type MediaAsset,
  type ProviderResult,
} from "@/lib/providers/types";

const VIDEO_POLL_INTERVAL_MS = 10_000;
const VIDEO_TIMEOUT_MS = 10 * 60 * 1000;

let client: OpenAI | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getOpenAIClient() {
  requireServerEnv(["OPENAI_API_KEY"]);

  if (!client) {
    client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  return client;
}

function firstCsvValue(value: string | undefined) {
  return value
    ?.split(",")
    .map((item) => item.trim())
    .find(Boolean);
}

function withNegativePrompt(prompt: string, negativePrompt?: string) {
  if (!negativePrompt) {
    return prompt;
  }

  return `${prompt}\n\nAvoid the following: ${negativePrompt}`;
}

function withEditModePrompt(basePrompt: string, mode: EditImageParams["mode"]) {
  const modeHints: Record<EditImageParams["mode"], string> = {
    variation: "Generate a close variation while preserving the primary subject.",
    style: "Change the visual style but keep the core subject and composition.",
    background: "Update only the background while preserving the main foreground subject.",
  };

  return `${basePrompt}\n\n${modeHints[mode]}`;
}

function openAIImageModel(model?: string) {
  return model ?? firstCsvValue(env.OPENAI_IMAGE_MODELS) ?? "gpt-image-2";
}

function openAIEditModel(model?: string) {
  return model ?? firstCsvValue(env.OPENAI_EDIT_MODELS) ?? "gpt-image-2";
}

function openAIVideoModel(model?: string) {
  return model ?? firstCsvValue(env.OPENAI_VIDEO_MODELS) ?? "sora-2";
}

function openAIVideoSeconds(
  durationSeconds?: GenerateVideoParams["durationSeconds"],
): "4" | "8" | "12" {
  if (!durationSeconds || durationSeconds <= 5) {
    return "4";
  }

  if (durationSeconds <= 8) {
    return "8";
  }

  return "12";
}

function fileExtensionFromMimeType(mimeType: string) {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };

  return map[mimeType] ?? "png";
}

async function fileFromImageUrl(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    const { buffer, mimeType } = assertSafeDataImageUrl(imageUrl);
    return toFile(buffer, `input.${fileExtensionFromMimeType(mimeType)}`, {
      type: mimeType,
    });
  }

  const { buffer, mimeType } = await safeFetchBuffer(imageUrl, {
    allowedMimeTypes: imageMimeTypes(),
    maxBytes: 20 * 1024 * 1024,
  });

  return toFile(buffer, `input.${fileExtensionFromMimeType(mimeType)}`, {
    type: mimeType,
  });
}

async function assetFromBase64(input: {
  b64Json: string;
  mimeType: string;
  prefix: string;
  fileName?: string;
  durationSeconds?: GenerateVideoParams["durationSeconds"];
}): Promise<MediaAsset> {
  const buffer = Buffer.from(input.b64Json, "base64");
  const url = await persistBufferAsset({
    buffer,
    mimeType: input.mimeType,
    prefix: input.prefix,
    fileName: input.fileName,
  });

  return {
    url,
    mimeType: input.mimeType,
    durationSeconds: input.durationSeconds,
  };
}

async function normalizeImageAssets(input: {
  data: Array<{ b64_json?: string; url?: string }>;
  prefix: string;
}): Promise<MediaAsset[]> {
  const assets = await Promise.all(
    input.data.map(async (item, index) => {
      if (item.b64_json) {
        return assetFromBase64({
          b64Json: item.b64_json,
          mimeType: "image/png",
          prefix: input.prefix,
          fileName: `${Date.now()}-${index}.png`,
        });
      }

      if (item.url) {
        return {
          url: item.url,
          mimeType: "image/png",
        } satisfies MediaAsset;
      }

      throw new Error("OpenAI returned an image without URL or base64 data.");
    }),
  );

  if (assets.length === 0) {
    throw new Error("OpenAI returned no image assets.");
  }

  return assets;
}

function videoErrorMessage(video: Awaited<ReturnType<OpenAI["videos"]["retrieve"]>>) {
  return video.error?.message ?? `Video generation failed with status '${video.status}'.`;
}

async function generateImage(params: GenerateImageParams): Promise<ProviderResult> {
  const openai = getOpenAIClient();
  const model = openAIImageModel(params.model);
  const response = await openai.images.generate({
    model,
    prompt: withNegativePrompt(params.prompt, params.negativePrompt),
    n: params.count,
    size: params.size ?? "1024x1024",
    output_format: "png",
    quality: "auto",
  });

  const assets = await normalizeImageAssets({
    data: response.data ?? [],
    prefix: "outputs/openai/image",
  });

  return {
    provider: "openai",
    model,
    assets,
  };
}

async function editImage(params: EditImageParams): Promise<ProviderResult> {
  const openai = getOpenAIClient();
  const model = openAIEditModel(params.model);
  const image = await fileFromImageUrl(params.imageUrl);
  const response = await openai.images.edit({
    model,
    image,
    prompt: withNegativePrompt(
      withEditModePrompt(params.prompt, params.mode),
      params.negativePrompt,
    ),
    size: params.size ?? "1024x1024",
    output_format: "png",
    quality: "auto",
  });

  const assets = await normalizeImageAssets({
    data: response.data ?? [],
    prefix: "outputs/openai/edit",
  });

  return {
    provider: "openai",
    model,
    assets,
  };
}

async function generateVideo(
  params: GenerateVideoParams,
): Promise<ProviderResult> {
  const openai = getOpenAIClient();
  const model = openAIVideoModel(params.model);
  let video = await openai.videos.create({
    model,
    prompt: params.prompt,
    input_reference: {
      image_url: params.imageUrl,
    },
    seconds: openAIVideoSeconds(params.durationSeconds),
    size: "1280x720",
  });

  const startedAt = Date.now();

  while (video.status === "queued" || video.status === "in_progress") {
    if (Date.now() - startedAt > VIDEO_TIMEOUT_MS) {
      throw new Error(
        `OpenAI video generation timed out after ${Math.round(VIDEO_TIMEOUT_MS / 1000)}s (id: ${video.id}).`,
      );
    }

    await sleep(VIDEO_POLL_INTERVAL_MS);
    video = await openai.videos.retrieve(video.id);
  }

  if (video.status !== "completed") {
    throw new Error(videoErrorMessage(video));
  }

  const content = await openai.videos.downloadContent(video.id);
  const mimeType = cleanMimeType(content.headers.get("content-type") ?? "video/mp4");
  const buffer = Buffer.from(await content.arrayBuffer());
  const url = await persistBufferAsset({
    buffer,
    mimeType,
    prefix: "outputs/openai/video",
    fileName: `${video.id}.mp4`,
    dataUrlFallback: false,
  });

  return {
    provider: "openai",
    model,
    assets: [
      {
        url,
        mimeType,
        durationSeconds: params.durationSeconds,
      },
    ],
  };
}

export const openAIProvider: HybridProvider = {
  id: "openai",
  generateImage,
  editImage,
  generateVideo,
};
