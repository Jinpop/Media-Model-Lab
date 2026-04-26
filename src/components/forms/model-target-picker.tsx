"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MediaTask, ProviderId } from "@/lib/providers/types";

export type SelectedModelTarget = {
  provider: ProviderId;
  model: string;
};

type ModelOption = SelectedModelTarget & {
  id: string;
  label: string;
  description: string;
  configured: boolean;
  requiredEnv: string;
  defaultForTasks?: MediaTask[];
};

type ModelsResponse = {
  success: boolean;
  models: ModelOption[];
};

function targetId(target: SelectedModelTarget) {
  return `${target.provider}:${target.model}`;
}

function providerLabel(provider: ProviderId) {
  return provider === "openai" ? "OpenAI" : "Replicate";
}

export function ModelTargetPicker({
  task,
  selectedTargets,
  onChange,
}: {
  task: MediaTask;
  selectedTargets: SelectedModelTarget[];
  onChange: (targets: SelectedModelTarget[]) => void;
}) {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadModels() {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/models?task=${task}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as ModelsResponse;

        if (payload.success) {
          setModels(payload.models);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setModels([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadModels();

    return () => {
      controller.abort();
    };
  }, [task]);

  useEffect(() => {
    if (hasInitialized.current || models.length === 0) {
      return;
    }

    const defaults = models.filter(
      (model) => model.configured && model.defaultForTasks?.includes(task),
    );
    const fallback = models.find((model) => model.configured);
    const nextTargets = (defaults.length > 0 ? defaults : fallback ? [fallback] : []).map(
      (model) => ({
        provider: model.provider,
        model: model.model,
      }),
    );

    onChange(nextTargets);
    hasInitialized.current = true;
  }, [models, onChange, task]);

  const selectedIds = useMemo(
    () => new Set(selectedTargets.map((target) => targetId(target))),
    [selectedTargets],
  );
  const modelsByProvider = useMemo(() => {
    return models.reduce<Record<ProviderId, ModelOption[]>>(
      (acc, model) => {
        acc[model.provider].push(model);
        return acc;
      },
      {
        openai: [],
        replicate: [],
      },
    );
  }, [models]);
  const selectedModels = useMemo(() => {
    return selectedTargets.map((target) => {
      return (
        models.find((model) => model.provider === target.provider && model.model === target.model) ??
        {
          ...target,
          id: targetId(target),
          label: `${providerLabel(target.provider)} · ${target.model}`,
          description: "",
          configured: true,
          requiredEnv: "",
        }
      );
    });
  }, [models, selectedTargets]);
  const configuredCount = models.filter((model) => model.configured).length;

  function toggleModel(model: ModelOption) {
    if (!model.configured) {
      return;
    }

    if (selectedIds.has(model.id)) {
      onChange(selectedTargets.filter((target) => targetId(target) !== model.id));
      return;
    }

    onChange([
      ...selectedTargets,
      {
        provider: model.provider,
        model: model.model,
      },
    ]);
  }

  function removeModel(target: SelectedModelTarget) {
    onChange(selectedTargets.filter((item) => targetId(item) !== targetId(target)));
  }

  return (
    <div className="relative space-y-2">
      <Button
        className="w-full justify-between"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
        variant="outline"
      >
        <span className="truncate">
          {selectedTargets.length > 0
            ? `${selectedTargets.length}개 모델 비교`
            : "모델 선택"}
        </span>
        <ChevronDown className="size-4" />
      </Button>

      {isOpen ? (
        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2 shadow-xl">
          {isLoading ? (
            <p className="px-3 py-2 text-sm text-zinc-400">모델 목록 불러오는 중...</p>
          ) : null}

          {!isLoading && configuredCount === 0 ? (
            <p className="px-3 py-2 text-sm text-zinc-400">
              사용 가능한 API 키가 설정되지 않았습니다.
            </p>
          ) : null}

          <div className="space-y-3">
            {(["openai", "replicate"] as const).map((provider) => {
              const providerModels = modelsByProvider[provider];

              if (providerModels.length === 0) {
                return null;
              }

              return (
                <div key={provider} className="space-y-1">
                  <div className="flex items-center justify-between px-3 py-1">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                      {providerLabel(provider)}
                    </p>
                    <span className="text-xs text-zinc-600">
                      {providerModels.filter((model) => model.configured).length}/
                      {providerModels.length}
                    </span>
                  </div>
                  {providerModels.map((model) => {
                    const selected = selectedIds.has(model.id);

                    return (
                      <button
                        className={cn(
                          "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition",
                          model.configured
                            ? "hover:bg-zinc-900"
                            : "cursor-not-allowed opacity-50",
                          selected && "bg-zinc-900 ring-1 ring-cyan-500/40",
                        )}
                        disabled={!model.configured}
                        key={model.id}
                        onClick={() => toggleModel(model)}
                        type="button"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-zinc-700",
                            selected && "border-cyan-300 bg-cyan-300 text-zinc-950",
                          )}
                        >
                          {selected ? <Check className="size-3" /> : null}
                        </span>
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="break-all text-sm font-medium text-zinc-100">
                            {model.model}
                          </span>
                          <span className="block text-xs text-zinc-500">
                            {model.configured
                              ? model.description
                              : `${model.requiredEnv} 필요`}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {selectedModels.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedModels.map((model) => (
            <span
              className="inline-flex max-w-full items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300"
              key={model.id}
            >
              <Badge>{providerLabel(model.provider)}</Badge>
              <span className="truncate font-mono">{model.model}</span>
              <button
                aria-label={`${model.model} 선택 해제`}
                className="rounded text-zinc-500 transition hover:text-zinc-100"
                onClick={() => removeModel(model)}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
