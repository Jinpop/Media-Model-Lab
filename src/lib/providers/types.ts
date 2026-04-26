export type ProviderId = "replicate" | "openai";

export type EditMode = "variation" | "style" | "background";

export type MediaTask = "image" | "edit" | "video";

export type MediaAsset = {
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

export type ProviderResult = {
  provider: ProviderId;
  model?: string;
  assets: MediaAsset[];
  raw?: unknown;
};

export type GenerateImageParams = {
  prompt: string;
  negativePrompt?: string;
  count: number;
  model?: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
};

export type EditImageParams = {
  imageUrl: string;
  prompt: string;
  mode: EditMode;
  negativePrompt?: string;
  model?: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
};

export type GenerateVideoParams = {
  imageUrl: string;
  prompt: string;
  durationSeconds?: 4 | 5 | 8 | 10 | 12;
  model?: string;
};

export interface HybridProvider {
  id: ProviderId;
  generateImage: (params: GenerateImageParams) => Promise<ProviderResult>;
  editImage: (params: EditImageParams) => Promise<ProviderResult>;
  generateVideo: (params: GenerateVideoParams) => Promise<ProviderResult>;
}
