import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { listModelOptions } from "@/lib/model-catalog";
import { RateLimitError } from "@/lib/rate-limit";
import {
  assertSafeDataImageUrl,
  assertPublicHttpsUrl,
  MAX_INLINE_IMAGE_BYTES,
} from "@/lib/security";
import type { MediaTask, ProviderId } from "@/lib/providers/types";

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const providerSchema = z.enum(["replicate", "openai"]);
export const modelNameSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9._:/+-]+$/, "Model names can only include letters, numbers, . _ - + : and /.");
export const targetSchema = z.object({
  provider: providerSchema,
  model: modelNameSchema,
});
export const imageReferenceSchema = z.string().min(1).refine(
  (value) => value.startsWith("data:image/") || /^https:\/\//.test(value),
  "Image must be an HTTPS URL or a supported inline image.",
);

export function assertRequestContentLength(request: Request, maxBytes: number) {
  const contentLength = Number(request.headers.get("content-length"));

  if (contentLength > maxBytes) {
    throw new ApiRequestError(
      `Request payload must be ${Math.round(maxBytes / 1024 / 1024)}MB or smaller.`,
      413,
    );
  }
}

export async function assertSafeImageReference(value: string) {
  try {
    if (value.startsWith("data:")) {
      assertSafeDataImageUrl(value, MAX_INLINE_IMAGE_BYTES);
      return value;
    }

    return await assertPublicHttpsUrl(value);
  } catch (error) {
    throw new ApiRequestError(
      error instanceof Error ? error.message : "Invalid image reference.",
      400,
    );
  }
}

export function resolveModelTargets(
  task: MediaTask,
  input: {
    provider: ProviderId;
    model?: string;
    targets?: Array<{ provider: ProviderId; model: string }>;
  },
  maxTargets: number,
) {
  const requested =
    input.targets && input.targets.length > 0
      ? input.targets
      : [
          {
            provider: input.provider,
            model: input.model,
          },
        ];

  const allOptions = listModelOptions(task);
  const configuredOptions = allOptions.filter((option) => option.configured);

  if (configuredOptions.length === 0) {
    throw new ApiRequestError("No API key is configured for this task.", 400);
  }

  const resolved = requested.map((target) => {
    if (target.model) {
      const exact = allOptions.find(
        (option) => option.provider === target.provider && option.model === target.model,
      );

      if (!exact) {
        throw new ApiRequestError(`Model is not enabled for ${task}: ${target.model}`, 400);
      }

      if (!exact.configured) {
        throw new ApiRequestError(`${exact.requiredEnv} is required for ${target.model}.`, 400);
      }

      return {
        provider: exact.provider,
        model: exact.model,
      };
    }

    const fallback =
      configuredOptions.find(
        (option) =>
          option.provider === target.provider && option.defaultForTasks?.includes(task),
      ) ?? configuredOptions.find((option) => option.provider === target.provider);

    if (!fallback) {
      throw new ApiRequestError(`${target.provider} is not configured for ${task}.`, 400);
    }

    return {
      provider: fallback.provider,
      model: fallback.model,
    };
  });

  const deduped = [
    ...new Map(resolved.map((target) => [`${target.provider}:${target.model}`, target])).values(),
  ];

  if (deduped.length > maxTargets) {
    throw new ApiRequestError(`Select ${maxTargets} models or fewer.`, 400);
  }

  return deduped;
}

function safeMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (error instanceof RateLimitError) {
    return error.message;
  }

  if (!(error instanceof Error)) {
    return fallback;
  }

  if (error.message.startsWith("Missing required environment variables")) {
    return "Selected provider is not configured.";
  }

  return error.message.slice(0, 500);
}

export function errorResponse(error: unknown, fallback: string) {
  const status =
    error instanceof ApiRequestError
      ? error.status
      : error instanceof RateLimitError
        ? 429
        : 500;
  const headers =
    error instanceof RateLimitError
      ? { "Retry-After": String(error.retryAfterSeconds) }
      : undefined;

  return NextResponse.json(
    {
      success: false,
      error: safeMessage(error, fallback),
    },
    {
      status,
      headers,
    },
  );
}

export function clientErrorMessage(error: unknown, fallback: string) {
  return safeMessage(error, fallback);
}
