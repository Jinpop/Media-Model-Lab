import "server-only";

import Replicate, { type FileOutput, type Prediction } from "replicate";

import { env, requireServerEnv } from "@/lib/env";
import { isStorageConfigured, persistRemoteAsset } from "@/lib/storage";
import {
  type EditImageParams,
  type GenerateImageParams,
  type GenerateVideoParams,
  type HybridProvider,
  type MediaAsset,
  type ProviderResult,
} from "@/lib/providers/types";

const POLL_INTERVAL_MS = 1500;
const PREDICTION_TIMEOUT_MS = 4 * 60 * 1000;

let client: Replicate | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getReplicateClient() {
  requireServerEnv(["REPLICATE_API_TOKEN"]);

  if (!client) {
    client = new Replicate({
      auth: env.REPLICATE_API_TOKEN,
      useFileOutput: false,
    });
  }

  return client;
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

function withDurationPrompt(
  prompt: string,
  durationSeconds?: GenerateVideoParams["durationSeconds"],
) {
  if (!durationSeconds) {
    return prompt;
  }

  return `${prompt}\n\nTarget clip duration: around ${durationSeconds} seconds.`;
}

function sizeToAspectRatio(size?: GenerateImageParams["size"]) {
  const map: Record<NonNullable<GenerateImageParams["size"]>, string> = {
    "1024x1024": "1:1",
    "1024x1536": "2:3",
    "1536x1024": "3:2",
  };

  return size ? map[size] : "1:1";
}

function isCandidateUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:");
}

function tryExtractUrlFromUnknown(value: unknown): string | null {
  if (typeof value === "string") {
    return isCandidateUrl(value) ? value : null;
  }

  if (value instanceof URL) {
    return value.toString();
  }

  if (value && typeof value === "object") {
    const asFileOutput = value as FileOutput;
    if (typeof asFileOutput.url === "function") {
      try {
        return asFileOutput.url().toString();
      } catch {
        // Fall through to other strategies.
      }
    }

    const asHrefObject = value as { href?: unknown; url?: unknown };
    if (typeof asHrefObject.href === "string" && isCandidateUrl(asHrefObject.href)) {
      return asHrefObject.href;
    }

    if (typeof asHrefObject.url === "string" && isCandidateUrl(asHrefObject.url)) {
      return asHrefObject.url;
    }
  }

  return null;
}

function collectUrls(payload: unknown, output = new Set<string>()): string[] {
  const direct = tryExtractUrlFromUnknown(payload);
  if (direct) {
    output.add(direct);
    return [...output];
  }

  if (Array.isArray(payload)) {
    payload.forEach((item) => {
      collectUrls(item, output);
    });

    return [...output];
  }

  if (payload && typeof payload === "object") {
    Object.values(payload).forEach((item) => {
      collectUrls(item, output);
    });
  }

  return [...output];
}

function predictionErrorMessage(prediction: Prediction): string {
  if (typeof prediction.error === "string") {
    return prediction.error;
  }

  if (prediction.error) {
    return JSON.stringify(prediction.error);
  }

  return prediction.logs ?? "Prediction failed without a detailed error message.";
}

async function createAndPollPrediction(input: {
  model: string;
  payload: Record<string, unknown>;
}) {
  const replicate = getReplicateClient();

  let prediction = await replicate.predictions.create({
    model: input.model,
    input: input.payload,
  });

  const startedAt = Date.now();

  while (
    prediction.status === "starting" ||
    prediction.status === "processing"
  ) {
    if (Date.now() - startedAt > PREDICTION_TIMEOUT_MS) {
      throw new Error(
        `Replicate prediction timed out after ${Math.round(PREDICTION_TIMEOUT_MS / 1000)}s (id: ${prediction.id}).`,
      );
    }

    await sleep(POLL_INTERVAL_MS);
    prediction = await replicate.predictions.get(prediction.id);
  }

  if (prediction.status !== "succeeded") {
    throw new Error(
      `Replicate prediction ${prediction.id} finished with status '${prediction.status}': ${predictionErrorMessage(prediction)}`,
    );
  }

  return prediction;
}

function guessImageMimeType(url: string): string {
  if (url.includes(".jpg") || url.includes(".jpeg")) {
    return "image/jpeg";
  }

  if (url.includes(".webp")) {
    return "image/webp";
  }

  if (url.includes(".gif")) {
    return "image/gif";
  }

  return "image/png";
}

function guessVideoMimeType(url: string): string {
  if (url.includes(".webm")) {
    return "video/webm";
  }

  if (url.includes(".mov")) {
    return "video/quicktime";
  }

  if (url.includes(".gif")) {
    return "image/gif";
  }

  return "video/mp4";
}

async function persistOutputUrl(
  sourceUrl: string,
  prefix: string,
  fallbackMimeType: string,
) {
  if (!isStorageConfigured() || !sourceUrl.startsWith("http")) {
    return sourceUrl;
  }

  return persistRemoteAsset(sourceUrl, prefix, fallbackMimeType);
}

async function normalizePredictionAssets(input: {
  output: unknown;
  kind: "image" | "video";
  durationSeconds?: GenerateVideoParams["durationSeconds"];
}) {
  const urls = collectUrls(input.output);

  if (urls.length === 0) {
    throw new Error("Replicate returned no output URL.");
  }

  const assets: MediaAsset[] = await Promise.all(
    urls.map(async (url) => {
      if (input.kind === "video") {
        const mimeType = guessVideoMimeType(url);
        const stableUrl = await persistOutputUrl(
          url,
          "outputs/replicate/video",
          mimeType,
        );

        return {
          url: stableUrl,
          mimeType,
          durationSeconds: input.durationSeconds,
        } satisfies MediaAsset;
      }

      const mimeType = guessImageMimeType(url);
      const stableUrl = await persistOutputUrl(url, "outputs/replicate/image", mimeType);

      return {
        url: stableUrl,
        mimeType,
      } satisfies MediaAsset;
    }),
  );

  return assets;
}

async function generateImage(params: GenerateImageParams): Promise<ProviderResult> {
  const model = params.model ?? env.REPLICATE_IMAGE_MODEL;

  const prediction = await createAndPollPrediction({
    model,
    payload: {
      prompt: withNegativePrompt(params.prompt, params.negativePrompt),
      num_outputs: params.count,
      aspect_ratio: sizeToAspectRatio(params.size),
      output_format: "png",
    },
  });

  const assets = await normalizePredictionAssets({
    output: prediction.output,
    kind: "image",
  });

  return {
    provider: "replicate",
    model,
    assets,
    raw: prediction,
  };
}

async function editImage(params: EditImageParams): Promise<ProviderResult> {
  const model = params.model ?? env.REPLICATE_EDIT_MODEL;

  const prediction = await createAndPollPrediction({
    model,
    payload: {
      image: params.imageUrl,
      prompt: withNegativePrompt(
        withEditModePrompt(params.prompt, params.mode),
        params.negativePrompt,
      ),
    },
  });

  const assets = await normalizePredictionAssets({
    output: prediction.output,
    kind: "image",
  });

  return {
    provider: "replicate",
    model,
    assets,
    raw: prediction,
  };
}

async function generateVideo(
  params: GenerateVideoParams,
): Promise<ProviderResult> {
  const model = params.model ?? env.REPLICATE_VIDEO_MODEL;

  const prediction = await createAndPollPrediction({
    model,
    payload: {
      image: params.imageUrl,
      prompt: withDurationPrompt(params.prompt, params.durationSeconds),
    },
  });

  const assets = await normalizePredictionAssets({
    output: prediction.output,
    kind: "video",
    durationSeconds: params.durationSeconds,
  });

  return {
    provider: "replicate",
    model,
    assets,
    raw: prediction,
  };
}

export const replicateProvider: HybridProvider = {
  id: "replicate",
  generateImage,
  editImage,
  generateVideo,
};
