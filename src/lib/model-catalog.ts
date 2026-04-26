import "server-only";

import { env } from "@/lib/env";
import type { MediaTask, ProviderId } from "@/lib/providers/types";

export type ModelTarget = {
  provider: ProviderId;
  model: string;
};

export type ModelOption = ModelTarget & {
  id: string;
  label: string;
  description: string;
  tasks: MediaTask[];
  configured: boolean;
  requiredEnv: string;
  defaultForTasks?: MediaTask[];
};

const providerLabels: Record<ProviderId, string> = {
  openai: "OpenAI",
  replicate: "Replicate",
};

function splitCsv(value: string | undefined, fallback: string[]) {
  const items = value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items && items.length > 0 ? items : fallback;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function option(input: Omit<ModelOption, "id">): ModelOption {
  return {
    ...input,
    id: `${input.provider}:${input.model}`,
  };
}

function defaultTasksForModel(model: string, defaults: Partial<Record<MediaTask, string>>) {
  const tasks = (Object.entries(defaults) as Array<[MediaTask, string | undefined]>)
    .filter(([, defaultModel]) => defaultModel === model)
    .map(([task]) => task);

  return tasks.length > 0 ? tasks : undefined;
}

function openAIOptions(): ModelOption[] {
  const imageModels = unique(
    splitCsv(env.OPENAI_IMAGE_MODELS, [
      "gpt-image-2",
      "gpt-image-1.5",
      "gpt-image-1-mini",
    ]),
  );
  const editModels = unique(splitCsv(env.OPENAI_EDIT_MODELS, imageModels));
  const videoModels = unique(
    splitCsv(env.OPENAI_VIDEO_MODELS, ["sora-2", "sora-2-pro"]),
  );
  const configured = Boolean(env.OPENAI_API_KEY);

  const imageAndEdit = unique([...imageModels, ...editModels]).map((model) =>
    option({
      provider: "openai",
      model,
      label: `${providerLabels.openai} · ${model}`,
      description: "OpenAI Image API",
      tasks: [
        ...(imageModels.includes(model) ? (["image"] as const) : []),
        ...(editModels.includes(model) ? (["edit"] as const) : []),
      ],
      configured,
      requiredEnv: "OPENAI_API_KEY",
      defaultForTasks: defaultTasksForModel(model, {
        image: imageModels[0],
        edit: editModels[0],
      }),
    }),
  );

  const videos = videoModels.map((model, index) =>
    option({
      provider: "openai",
      model,
      label: `${providerLabels.openai} · ${model}`,
      description: "OpenAI Sora Video API",
      tasks: ["video"],
      configured,
      requiredEnv: "OPENAI_API_KEY",
      defaultForTasks: index === 0 ? ["video"] : undefined,
    }),
  );

  return [...imageAndEdit, ...videos];
}

function replicateOptions(): ModelOption[] {
  const imageModels = unique(
    splitCsv(env.REPLICATE_IMAGE_MODELS, [env.REPLICATE_IMAGE_MODEL]),
  );
  const editModels = unique(
    splitCsv(env.REPLICATE_EDIT_MODELS, [env.REPLICATE_EDIT_MODEL]),
  );
  const videoModels = unique(
    splitCsv(env.REPLICATE_VIDEO_MODELS, [env.REPLICATE_VIDEO_MODEL]),
  );
  const configured = Boolean(env.REPLICATE_API_TOKEN);

  return [
    ...imageModels.map((model, index) =>
      option({
        provider: "replicate",
        model,
        label: `${providerLabels.replicate} · ${model}`,
        description: "Replicate text-to-image",
        tasks: ["image"],
        configured,
        requiredEnv: "REPLICATE_API_TOKEN",
        defaultForTasks: index === 0 ? ["image"] : undefined,
      }),
    ),
    ...editModels.map((model, index) =>
      option({
        provider: "replicate",
        model,
        label: `${providerLabels.replicate} · ${model}`,
        description: "Replicate image edit",
        tasks: ["edit"],
        configured,
        requiredEnv: "REPLICATE_API_TOKEN",
        defaultForTasks: index === 0 ? ["edit"] : undefined,
      }),
    ),
    ...videoModels.map((model, index) =>
      option({
        provider: "replicate",
        model,
        label: `${providerLabels.replicate} · ${model}`,
        description: "Replicate image-to-video",
        tasks: ["video"],
        configured,
        requiredEnv: "REPLICATE_API_TOKEN",
        defaultForTasks: index === 0 ? ["video"] : undefined,
      }),
    ),
  ];
}

export function listModelOptions(task?: MediaTask) {
  const options = [...openAIOptions(), ...replicateOptions()];

  if (!task) {
    return options;
  }

  return options.filter((model) => model.tasks.includes(task));
}

export function defaultTargetsForTask(task: MediaTask): ModelTarget[] {
  return listModelOptions(task)
    .filter((model) => model.configured && model.defaultForTasks?.includes(task))
    .map((model) => ({
      provider: model.provider,
      model: model.model,
    }));
}
