"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export type GenerationError = {
  provider: string;
  model?: string;
  error: string;
};

function providerLabel(provider: string) {
  if (provider.toLowerCase() === "openai") {
    return "OpenAI";
  }

  if (provider.toLowerCase() === "replicate") {
    return "Replicate";
  }

  return provider;
}

export function GenerationFeedback({
  success,
  error,
  errors,
}: {
  success: string | null;
  error: string | null;
  errors: GenerationError[];
}) {
  if (!success && !error && errors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" aria-live="polite">
      {success ? (
        <div className="flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <p>{success}</p>
        </div>
      ) : null}

      {error ? (
        <div
          className="flex items-start gap-2 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {errors.length > 0 ? (
        <div className="divide-y divide-zinc-800 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
          {errors.map((item) => (
            <div
              className="grid gap-1 px-3 py-2 text-xs text-zinc-400 sm:grid-cols-[auto_1fr]"
              key={`${item.provider}:${item.model}:${item.error}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{providerLabel(item.provider)}</Badge>
                {item.model ? (
                  <span className="break-all font-mono text-zinc-500">{item.model}</span>
                ) : null}
              </div>
              <p className="text-rose-200 sm:text-right">{item.error}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
