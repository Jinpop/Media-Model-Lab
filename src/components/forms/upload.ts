export async function uploadAsset(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as {
    success: boolean;
    url?: string;
    error?: string;
  };

  if (!response.ok || !payload.success || !payload.url) {
    throw new Error(payload.error ?? "업로드에 실패했습니다.");
  }

  return payload.url;
}
