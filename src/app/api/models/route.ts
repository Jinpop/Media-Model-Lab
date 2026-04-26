import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/generation-api";
import { listModelOptions } from "@/lib/model-catalog";
import { assertRateLimit } from "@/lib/rate-limit";

const taskSchema = z.enum(["image", "edit", "video"]).optional();

export async function GET(request: Request) {
  try {
    assertRateLimit(request, {
      key: "models",
      limit: 120,
      windowMs: 60 * 1000,
    });
  } catch (error) {
    return errorResponse(error, "Model list request was rejected.");
  }

  const parsedTask = taskSchema.safeParse(
    new URL(request.url).searchParams.get("task") ?? undefined,
  );

  if (!parsedTask.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid task.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    models: listModelOptions(parsedTask.data),
  });
}
