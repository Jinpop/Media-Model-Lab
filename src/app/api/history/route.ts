import { NextResponse } from "next/server";

import { toHistoryItem } from "@/lib/generation-dto";
import { prisma } from "@/lib/prisma";
import { assertRateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/generation-api";

export async function GET(request: Request) {
  try {
    assertRateLimit(request, {
      key: "history",
      limit: 60,
      windowMs: 60 * 1000,
    });
  } catch (error) {
    return errorResponse(error, "History request was rejected.");
  }

  const generations = await prisma.generation.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  return NextResponse.json({
    success: true,
    items: generations.map(toHistoryItem),
  });
}
