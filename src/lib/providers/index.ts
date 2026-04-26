import "server-only";

import { openAIProvider } from "@/lib/providers/openai-provider";
import { replicateProvider } from "@/lib/providers/replicate-provider";
import {
  type EditImageParams,
  type GenerateImageParams,
  type GenerateVideoParams,
  type HybridProvider,
  type ProviderId,
} from "@/lib/providers/types";

const providers: Record<ProviderId, HybridProvider> = {
  openai: openAIProvider,
  replicate: replicateProvider,
};

function getProvider(id: ProviderId): HybridProvider {
  const provider = providers[id];
  if (!provider) {
    throw new Error(`Unknown provider: ${id}`);
  }

  return provider;
}

export function listProviders() {
  return Object.values(providers).map((provider) => ({
    id: provider.id,
    supports: {
      generateImage: true,
      editImage: true,
      generateVideo: true,
    },
  }));
}

export async function generateImage(providerId: ProviderId, params: GenerateImageParams) {
  return getProvider(providerId).generateImage(params);
}

export async function editImage(providerId: ProviderId, params: EditImageParams) {
  return getProvider(providerId).editImage(params);
}

export async function generateVideo(
  providerId: ProviderId,
  params: GenerateVideoParams,
) {
  return getProvider(providerId).generateVideo(params);
}
