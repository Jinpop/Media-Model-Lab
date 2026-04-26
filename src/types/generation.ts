export type GenerationRecord = {
  id: string;
  type: "IMAGE" | "EDIT" | "VIDEO";
  prompt: string;
  negativePrompt: string | null;
  provider: "OPENAI" | "REPLICATE";
  model: string | null;
  inputAssetUrl: string | null;
  outputAssetUrl: string | null;
  status: "PENDING" | "COMPLETED" | "FAILED";
  errorMessage: string | null;
  createdAt: string;
};

export type GenerationResponse = {
  success: boolean;
  records: GenerationRecord[];
};
