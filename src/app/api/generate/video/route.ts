import { NextResponse } from "next/server";
import { z } from "zod";

import {
  assertRequestContentLength,
  assertSafeImageReference,
  clientErrorMessage,
  errorResponse,
  imageReferenceSchema,
  modelNameSchema,
  providerSchema,
  resolveModelTargets,
  targetSchema,
} from "@/lib/generation-api";
import { saveGenerationFailure, saveGenerationResult } from "@/lib/generation-store";
import { generateVideo } from "@/lib/providers";
import { assertRateLimit } from "@/lib/rate-limit";
import type { ProviderId } from "@/lib/providers/types";

const requestSchema = z.object({
  imageUrl: imageReferenceSchema,
  prompt: z.string().trim().min(3).max(4000),
  provider: providerSchema.default("replicate"),
  durationSeconds: z
    .union([
      z.literal(4),
      z.literal(5),
      z.literal(8),
      z.literal(10),
      z.literal(12),
    ])
    .optional(),
  model: modelNameSchema.optional(),
  targets: z.array(targetSchema).min(1).max(4).optional(),
});

export async function POST(request: Request) {
  let payload: z.infer<typeof requestSchema>;
  let targets: Array<{ provider: ProviderId; model: string }>;

  try {
    assertRequestContentLength(request, 8 * 1024 * 1024);
    assertRateLimit(request, {
      key: "generate:video",
      limit: 6,
      windowMs: 60 * 1000,
    });
  } catch (error) {
    return errorResponse(error, "Video generation request was rejected.");
  }

  try {
    payload = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request payload.",
      },
      { status: 400 },
    );
  }

  try {
    payload.imageUrl = await assertSafeImageReference(payload.imageUrl);
    targets = resolveModelTargets("video", payload, 4);
  } catch (error) {
    return errorResponse(error, "Invalid image or model selection.");
  }

  const assets: Array<{
    id: string;
    url: string;
    mimeType: string;
    prompt: string;
    provider: ProviderId;
    model?: string;
  }> = [];
  const records: Array<{ createdAt: Date }> = [];
  const errors: Array<{ provider: ProviderId; model?: string; error: string }> = [];

  for (const target of targets) {
    try {
      const result = await generateVideo(target.provider, {
        imageUrl: payload.imageUrl,
        prompt: payload.prompt,
        durationSeconds: payload.durationSeconds,
        model: target.model,
      });

      const targetRecords = await saveGenerationResult({
        type: "video",
        provider: target.provider,
        prompt: payload.prompt,
        model: result.model,
        inputAssetUrl: payload.imageUrl,
        settings: {
          durationSeconds: payload.durationSeconds,
        },
        result,
      });

      records.push(...targetRecords);
      assets.push(
        ...result.assets.map((asset, index) => ({
          id: targetRecords[index]?.id ?? crypto.randomUUID(),
          url: asset.url,
          mimeType: asset.mimeType,
          prompt: payload.prompt,
          provider: target.provider,
          model: result.model,
        })),
      );
    } catch (error) {
      const message = clientErrorMessage(error, "Video generation failed.");

      errors.push({
        provider: target.provider,
        model: target.model,
        error: message,
      });

      try {
        await saveGenerationFailure({
          type: "video",
          provider: target.provider,
          prompt: payload.prompt,
          model: target.model,
          inputAssetUrl: payload.imageUrl,
          settings: {
            durationSeconds: payload.durationSeconds,
          },
          errorMessage: message,
        });
      } catch {
        // Ignore failure tracking errors so we can still return a JSON response.
      }
    }
  }

  return NextResponse.json(
    {
      success: assets.length > 0,
      assets,
      records: records.map((record) => ({
        ...record,
        createdAt: record.createdAt.toISOString(),
      })),
      errors,
      error: assets.length === 0 ? errors[0]?.error : undefined,
    },
    { status: assets.length > 0 ? 200 : 500 },
  );
}
