import "server-only";

import {
  type Generation,
  GenerationStatus,
  GenerationType,
  Provider,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ProviderId, ProviderResult } from "@/lib/providers/types";

export type GenerationKind = "image" | "edit" | "video";

type SaveResultInput = {
  type: GenerationKind;
  provider: ProviderId;
  prompt: string;
  negativePrompt?: string;
  model?: string;
  inputAssetUrl?: string;
  settings?: Prisma.InputJsonValue;
  result: ProviderResult;
};

const providerMap: Record<ProviderId, Provider> = {
  openai: Provider.OPENAI,
  replicate: Provider.REPLICATE,
};

const MAX_STORED_DATA_URL_LENGTH = 2_500_000;

function storableAssetUrl(url: string | undefined) {
  if (!url) {
    return undefined;
  }

  if (url.startsWith("data:") && url.length > MAX_STORED_DATA_URL_LENGTH) {
    return undefined;
  }

  return url;
}

function generationTypeFromKind(kind: GenerationKind): GenerationType {
  switch (kind) {
    case "image":
      return GenerationType.IMAGE;
    case "edit":
      return GenerationType.EDIT;
    case "video":
      return GenerationType.VIDEO;
    default:
      throw new Error(`Unknown generation kind: ${kind}`);
  }
}

function normalizeSettings(
  settings: Prisma.InputJsonValue | undefined,
): Prisma.InputJsonObject {
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    return settings as Prisma.InputJsonObject;
  }

  return {};
}

export async function saveGenerationResult(
  input: SaveResultInput,
): Promise<Generation[]> {
  const type = generationTypeFromKind(input.type);
  const prismaProvider = providerMap[input.provider];
  const baseSettings = normalizeSettings(input.settings);

  return prisma.$transaction(
    input.result.assets.map((asset) =>
      prisma.generation.create({
        data: {
          type,
          prompt: input.prompt,
          negativePrompt: input.negativePrompt,
          provider: prismaProvider,
          model: input.model,
          inputAssetUrl: storableAssetUrl(input.inputAssetUrl),
          outputAssetUrl: storableAssetUrl(asset.url),
          status: GenerationStatus.COMPLETED,
          settings: {
            ...baseSettings,
            mimeType: asset.mimeType,
            width: asset.width,
            height: asset.height,
            durationSeconds: asset.durationSeconds,
          },
        },
      }),
    ),
  );
}

export async function saveGenerationFailure(input: {
  type: GenerationKind;
  provider: ProviderId;
  prompt: string;
  negativePrompt?: string;
  model?: string;
  inputAssetUrl?: string;
  settings?: Prisma.InputJsonValue;
  errorMessage: string;
}) {
  const type = generationTypeFromKind(input.type);
  const prismaProvider = providerMap[input.provider];

  await prisma.generation.create({
    data: {
      type,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      provider: prismaProvider,
      model: input.model,
      inputAssetUrl: storableAssetUrl(input.inputAssetUrl),
      status: GenerationStatus.FAILED,
      errorMessage: input.errorMessage,
      settings: input.settings,
    },
  });
}
