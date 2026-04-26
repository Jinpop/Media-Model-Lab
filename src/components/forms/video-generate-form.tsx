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

const durationOptions = [
  { label: "4초", value: "4" },
  { label: "8초", value: "8" },
  { label: "12초", value: "12" },
];

const videoPromptExamples = [
  {
    label: "줌인 장면",
    text: "카메라가 천천히 줌인하고 조명이 서서히 밝아지는 장면",
  },
  {
    label: "네온 무드",
    text: "바람에 머리카락이 흔들리고 배경 네온이 깜빡이는 장면",
  },
  {
    label: "제품 회전",
    text: "제품을 중심으로 부드럽게 180도 회전하는 쇼케이스 장면",
  },
];

export function VideoGenerateForm() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<4 | 8 | 12>(4);
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

      const response = await fetch("/api/generate/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: resolvedImageUrl,
          prompt,
          targets: selectedTargets,
          durationSeconds,
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
        throw new Error(payload.error ?? "비디오 생성에 실패했습니다.");
      }

      const nextAssets = payload.assets ?? [];
      const nextErrors = payload.errors ?? [];
      setAssets(nextAssets);
      setModelErrors(nextErrors);
      const failed = nextErrors.length;
      setSuccess(
        failed > 0
          ? `${nextAssets.length}개 영상 결과가 생성되었고 ${failed}개 모델은 실패했습니다.`
          : `${nextAssets.length}개 영상 결과가 생성되었습니다.`,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "비디오 생성 중 알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>이미지에서 비디오 생성</CardTitle>
          <CardDescription>
            원본 이미지와 장면 프롬프트를 기준으로 비디오 모델을 비교합니다.
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

            <div className="space-y-2">
              <Label htmlFor="prompt">장면 프롬프트</Label>
              <Textarea
                id="prompt"
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="예: 카메라가 천천히 피사체로 다가가며 조명이 따뜻해지는 장면"
                required
                value={prompt}
              />
              <div className="flex flex-wrap gap-2">
                {videoPromptExamples.map((example) => (
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="duration">길이</Label>
                <Select
                  id="duration"
                  onChange={(event) =>
                    setDurationSeconds(Number(event.target.value) as 4 | 8 | 12)
                  }
                  options={durationOptions}
                  value={String(durationSeconds)}
                />
              </div>
              <div className="space-y-2">
                <Label>비교 모델</Label>
                <ModelTargetPicker
                  onChange={setSelectedTargets}
                  selectedTargets={selectedTargets}
                  task="video"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={!canSubmit} type="submit" variant="primary">
                {isLoading ? (
                  <>
                    <Spinner /> 생성 중...
                  </>
                ) : (
                  "비디오 생성"
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

      <ResultGallery assets={assets} title="비디오 결과" />
    </div>
  );
}
