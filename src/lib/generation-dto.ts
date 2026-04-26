import "server-only";

import type { Generation } from "@prisma/client";

export function toHistoryItem(item: Generation) {
  return {
    id: item.id,
    type: item.type,
    prompt: item.prompt,
    negativePrompt: item.negativePrompt,
    provider: item.provider,
    model: item.model,
    inputAssetUrl: item.inputAssetUrl,
    outputAssetUrl: item.outputAssetUrl,
    status: item.status,
    errorMessage: item.errorMessage,
    createdAt: item.createdAt.toISOString(),
  };
}
