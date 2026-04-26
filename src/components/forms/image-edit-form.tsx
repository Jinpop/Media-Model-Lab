"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import {
  GenerationFeedback,
  type GenerationError,
} from "@/components/forms/generation-feedback";
import {
  ModelTargetPicker,
  type SelectedModelTarget,
} from "@/components/forms/model-target-picker";
import { uploadAsset } from "@/components/forms/upload";
import { ResultGallery, type GalleryAsset } from "@/components/shared/result-gallery";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { EditMode } from "@/lib/providers/types";

const modeOptions: Array<{ value: EditMode; label: string }> = [
  { value: "variation", label: "변형" },
  { value: "style", label: "스타일 변경" },
  { value: "background", label: "배경 변경" },
];

const modePromptExamples: Record<EditMode, Array<{ label: string; text: string }>> = {
  variation: [
    {
      label: "드라마틱 조명",
      text: "구도는 유지하고 조명을 더 드라마틱하게 바꿔줘",
    },
    {
      label: "색감 강화",
      text: "원본 느낌을 살리면서 색감을 더 선명하게 바꿔줘",
    },
  ],
  style: [
    {
      label: "애니 스타일",
      text: "지브리 애니메이션 스타일로 바꿔줘",
    },
    {
      label: "빈티지 필름",
      text: "필름 사진 느낌의 빈티지 스타일로 변환해줘",
    },
  ],
  background: [
    {
      label: "해변 배경",
      text: "인물은 유지하고 배경을 노을지는 해변으로 바꿔줘",
    },
    {
      label: "스튜디오 배경",
      text: "제품은 유지하고 배경을 미니멀한 스튜디오로 바꿔줘",
    },
  ],
};

export function ImageEditForm() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [mode, setMode] = useState<EditMode>("variation");
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<SelectedModelTarget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelErrors, setModelErrors] = useState<GenerationError[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [assets, setAssets] = useState<GalleryAsset[]>([]);

  const filePreviewUrl = useMemo(() => {
    if (!file) {
      return "";
    }

    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  const sourcePreviewUrl = filePreviewUrl || imageUrl;
  const canSubmit = useMemo(() => {
    return (
      Boolean(prompt.trim()) &&
      Boolean(file || imageUrl.trim()) &&
      selectedTargets.length > 0 &&
      !isLoading
    );
  }, [prompt, file, imageUrl, selectedTargets, isLoading]);

  async function resolveImageUrl() {
    if (file) {
      return uploadAsset(file);
    }

    return imageUrl;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setModelErrors([]);
    setSuccess(null);
    setIsLoading(true);

    try {
      const resolvedImageUrl = await resolveImageUrl();
      if (!resolvedImageUrl) {
        throw new Error("이미지를 업로드하거나 공개 이미지 URL을 입력해 주세요.");
      }

      const response = await fetch("/api/generate/edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: resolvedImageUrl,
          prompt,
          negativePrompt: negativePrompt || undefined,
          mode,
          targets: selectedTargets,
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        assets?: GalleryAsset[];
        error?: string;
        errors?: GenerationError[];
      };

      if (!response.ok || !payload.success) {
        setModelErrors(payload.errors ?? []);
        throw new Error(payload.error ?? "이미지 편집에 실패했습니다.");
      }

      const nextAssets = payload.assets ?? [];
      const nextErrors = payload.errors ?? [];
      setAssets(nextAssets);
      setModelErrors(nextErrors);
      const failed = nextErrors.length;
      setSuccess(
        failed > 0
          ? `${nextAssets.length}개 결과가 생성되었고 ${failed}개 모델은 실패했습니다.`
          : `${nextAssets.length}개 결과가 생성되었습니다.`,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "이미지 편집 중 알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>이미지 편집</CardTitle>
          <CardDescription>
            파일 또는 URL을 기준으로 선택한 편집 모델의 결과를 비교합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="image-file">원본 이미지 업로드</Label>
                <Input
                  accept="image/*"
                  id="image-file"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setFile(nextFile);
                    if (nextFile) {
                      setImageUrl("");
                    }
                  }}
                  type="file"
                />
                <p className="text-xs text-zinc-500">
                  파일을 선택하면 URL 입력보다 우선 적용됩니다.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-url">또는 이미지 URL</Label>
                <Input
                  id="image-url"
                  onChange={(event) => {
                    setImageUrl(event.target.value);
                    if (event.target.value.trim()) {
                      setFile(null);
                    }
                  }}
                  placeholder="https://..."
                  value={imageUrl}
                />
              </div>
            </div>

            {sourcePreviewUrl ? (
              <div className="relative h-56 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                <Image
                  alt="원본 미리보기"
                  className="h-full w-full object-contain"
                  fill
                  sizes="(max-width: 768px) 100vw, 700px"
                  src={sourcePreviewUrl}
                  unoptimized
                />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mode">편집 모드</Label>
                <Select
                  id="mode"
                  onChange={(event) => setMode(event.target.value as EditMode)}
                  options={modeOptions}
                  value={mode}
                />
              </div>
              <div className="space-y-2">
                <Label>비교 모델</Label>
                <ModelTargetPicker
                  onChange={setSelectedTargets}
                  selectedTargets={selectedTargets}
                  task="edit"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">편집 프롬프트</Label>
              <Textarea
                id="prompt"
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="예: 인물은 유지하고 배경을 야경 도시로 변경해줘"
                required
                value={prompt}
              />
              <div className="flex flex-wrap gap-2">
                {modePromptExamples[mode].map((example) => (
                  <Button
                    key={example.label}
                    onClick={() => setPrompt(example.text)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {example.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="negative-prompt">제외할 요소 (선택)</Label>
              <Input
                id="negative-prompt"
                onChange={(event) => setNegativePrompt(event.target.value)}
                placeholder="예: 깨진 손가락, 뭉개진 얼굴, 텍스트 노이즈"
                value={negativePrompt}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={!canSubmit} type="submit" variant="primary">
                {isLoading ? (
                  <>
                    <Spinner /> 편집 중...
                  </>
                ) : (
                  "편집 실행"
                )}
              </Button>
            </div>

            <GenerationFeedback
              error={error}
              errors={modelErrors}
              success={success}
            />
          </form>
        </CardContent>
      </Card>

      <ResultGallery assets={assets} title="편집 결과" />
    </div>
  );
}
