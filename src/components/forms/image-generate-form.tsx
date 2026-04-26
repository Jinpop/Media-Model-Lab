"use client";

import { useMemo, useState } from "react";

import {
  GenerationFeedback,
  type GenerationError,
} from "@/components/forms/generation-feedback";
import {
  ModelTargetPicker,
  type SelectedModelTarget,
} from "@/components/forms/model-target-picker";
import { ResultGallery, type GalleryAsset } from "@/components/shared/result-gallery";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const promptExamples = [
  {
    label: "네온 야경",
    text: "비 오는 밤, 네온 간판이 반사되는 서울 골목의 시네마틱 사진",
  },
  {
    label: "제품 광고",
    text: "미니멀한 화이트 배경 위 제품 광고 컷, 부드러운 스튜디오 조명",
  },
  {
    label: "풍경 사진",
    text: "한옥 마을을 내려다보는 드론 시점의 일출 풍경, 고해상도",
  },
  {
    label: "애니 스타일",
    text: "레트로 애니메이션 스타일의 우주 정거장 내부",
  },
];

const sizeOptions = [
  { value: "1024x1024", label: "정사각형 (1:1)" },
  { value: "1024x1536", label: "세로형 (2:3)" },
  { value: "1536x1024", label: "가로형 (3:2)" },
] as const;

export function ImageGenerateForm() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [count, setCount] = useState(1);
  const [size, setSize] = useState<(typeof sizeOptions)[number]["value"]>("1024x1024");
  const [selectedTargets, setSelectedTargets] = useState<SelectedModelTarget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelErrors, setModelErrors] = useState<GenerationError[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [assets, setAssets] = useState<GalleryAsset[]>([]);

  const canSubmit = useMemo(() => {
    return Boolean(prompt.trim()) && selectedTargets.length > 0 && !isLoading;
  }, [prompt, selectedTargets, isLoading]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setModelErrors([]);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/generate/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          negativePrompt: negativePrompt || undefined,
          targets: selectedTargets,
          count,
          size,
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
        throw new Error(payload.error ?? "이미지 생성에 실패했습니다.");
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
      const message =
        submitError instanceof Error
          ? submitError.message
          : "이미지 생성 중 알 수 없는 오류가 발생했습니다.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>텍스트로 이미지 생성</CardTitle>
          <CardDescription>
            선택한 모델마다 같은 프롬프트를 실행해 결과를 비교합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="prompt">프롬프트</Label>
              <Textarea
                id="prompt"
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="예: 비 오는 밤, 네온 간판이 반사되는 거리의 시네마틱 장면"
                required
                value={prompt}
              />
              <div className="flex flex-wrap gap-2">
                {promptExamples.map((example) => (
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
                placeholder="예: 흐림, 저화질, 워터마크, 왜곡된 손"
                value={negativePrompt}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="count">생성 개수</Label>
                <Input
                  id="count"
                  max={4}
                  min={1}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isNaN(value)) {
                      setCount(1);
                      return;
                    }

                    setCount(Math.min(4, Math.max(1, value)));
                  }}
                  type="number"
                  value={count}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="size">비율</Label>
                <Select
                  id="size"
                  onChange={(event) =>
                    setSize(event.target.value as (typeof sizeOptions)[number]["value"])
                  }
                  options={sizeOptions.map((option) => ({
                    label: option.label,
                    value: option.value,
                  }))}
                  value={size}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>비교 모델</Label>
              <ModelTargetPicker
                onChange={setSelectedTargets}
                selectedTargets={selectedTargets}
                task="image"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={!canSubmit} type="submit" variant="primary">
                {isLoading ? (
                  <>
                    <Spinner /> 생성 중...
                  </>
                ) : (
                  "이미지 생성"
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

      <ResultGallery assets={assets} title="생성 결과" />
    </div>
  );
}
