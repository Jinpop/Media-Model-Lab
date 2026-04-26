import { NextResponse } from "next/server";

import { assertRequestContentLength, errorResponse } from "@/lib/generation-api";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  isAllowedImageMimeType,
  MAX_INLINE_IMAGE_BYTES,
} from "@/lib/security";
import { isStorageConfigured, persistBufferAsset, uploadBufferToStorage } from "@/lib/storage";

const MAX_STORAGE_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    assertRateLimit(request, {
      key: "upload",
      limit: 20,
      windowMs: 60 * 1000,
    });
    assertRequestContentLength(
      request,
      isStorageConfigured()
        ? MAX_STORAGE_UPLOAD_SIZE_BYTES + 1024 * 1024
        : MAX_INLINE_IMAGE_BYTES + 1024 * 1024,
    );
  } catch (error) {
    return errorResponse(error, "Upload request was rejected.");
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        success: false,
        error: "No file uploaded.",
      },
      { status: 400 },
    );
  }

  const mimeType = file.type || "application/octet-stream";
  if (!isAllowedImageMimeType(mimeType)) {
    return NextResponse.json(
      {
        success: false,
        error: "Only PNG, JPEG, and WebP images can be uploaded.",
      },
      { status: 400 },
    );
  }

  const maxSize = isStorageConfigured()
    ? MAX_STORAGE_UPLOAD_SIZE_BYTES
    : MAX_INLINE_IMAGE_BYTES;
  if (file.size > maxSize) {
    return NextResponse.json(
      {
        success: false,
        error: `File is too large. Max upload size is ${Math.round(maxSize / 1024 / 1024)}MB.`,
      },
      { status: 400 },
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  if (!isStorageConfigured()) {
    const dataUrl = await persistBufferAsset({
      buffer,
      mimeType,
      prefix: "uploads",
      fileName: file.name,
    });

    return NextResponse.json({
      success: true,
      url: dataUrl,
      path: null,
    });
  }

  const upload = await uploadBufferToStorage({
    buffer,
    mimeType,
    prefix: "uploads",
    fileName: file.name,
  });

  return NextResponse.json({
    success: true,
    url: upload.publicUrl,
    path: upload.path,
  });
}
