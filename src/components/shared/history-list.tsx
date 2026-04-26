"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ProviderId } from "@/lib/providers/types";

type HistoryItem = {
  id: string;
  type: "IMAGE" | "EDIT" | "VIDEO";
  prompt: string;
  negativePrompt: string | null;
  provider: "OPENAI" | "REPLICATE";
  model: string | null;
  inputAssetUrl: string | null;
  outputAssetUrl: string | null;
  status: "PENDING" | "COMPLETED" | "FAILED";
  errorMessage: string | null;
  createdAt: string;
};

type FilterType = "ALL" | HistoryItem["type"];

const filterOptions: Array<{ value: FilterType; label: string }> = [
  { value: "ALL", label: "전체" },
  { value: "IMAGE", label: "이미지 생성" },
  { value: "EDIT", label: "이미지 편집" },
  { value: "VIDEO", label: "비디오 생성" },
];

function isVideo(item: HistoryItem) {
  return item.type === "VIDEO";
}

function typeLabel(type: HistoryItem["type"]) {
  if (type === "IMAGE") {
    return "이미지 생성";
  }

  if (type === "EDIT") {
    return "이미지 편집";
  }

  return "비디오 생성";
}

function providerIdFromItem(item: HistoryItem): ProviderId {
  return item.provider === "OPENAI" ? "openai" : "replicate";
}

function providerLabel(provider: HistoryItem["provider"]) {
  return provider === "OPENAI" ? "OpenAI" : "Replicate";
}

function statusLabel(status: HistoryItem["status"]) {
  if (status === "COMPLETED") {
    return "완료";
  }

  if (status === "FAILED") {
    return "실패";
  }

  return "진행 중";
}

function targetPayload(item: HistoryItem) {
  const provider = providerIdFromItem(item);

  if (!item.model) {
    return { provider };
  }

  return {
    provider,
    targets: [
      {
        provider,
        model: item.model,
      },
    ],
  };
}

export function HistoryList({ items }: { items: HistoryItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...items]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .filter((item) => {
        if (filter !== "ALL" && item.type !== filter) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return (
          item.prompt.toLowerCase().includes(normalizedQuery) ||
          (item.model ?? "").toLowerCase().includes(normalizedQuery)
        );
      });
  }, [items, filter, query]);

  async function copyPrompt(item: HistoryItem) {
    try {
      await navigator.clipboard.writeText(item.prompt);
      setCopiedId(item.id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === item.id ? null : prev));
      }, 1200);
    } catch {
      setErrorById((prev) => ({
        ...prev,
        [item.id]: "프롬프트 복사에 실패했습니다.",
      }));
    }
  }

  async function rerun(item: HistoryItem) {
    setActiveId(item.id);
    setErrorById((prev) => ({ ...prev, [item.id]: "" }));

    try {
      let route = "";
      let body: Record<string, unknown> = {};

      if (item.type === "IMAGE") {
        route = "/api/generate/image";
        body = {
          prompt: item.prompt,
          negativePrompt: item.negativePrompt || undefined,
          ...targetPayload(item),
          count: 1,
        };
      }

      if (item.type === "EDIT") {
        route = "/api/generate/edit";
        body = {
          imageUrl: item.inputAssetUrl,
          prompt: item.prompt,
          negativePrompt: item.negativePrompt || undefined,
          ...targetPayload(item),
          mode: "variation",
        };
      }

      if (item.type === "VIDEO") {
        route = "/api/generate/video";
        body = {
          imageUrl: item.inputAssetUrl,
          prompt: item.prompt,
          ...targetPayload(item),
          durationSeconds: 4,
        };
      }

      const response = await fetch(route, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "재실행에 실패했습니다.");
      }

      window.location.reload();
    } catch (rerunError) {
      setErrorById((prev) => ({
        ...prev,
        [item.id]:
          rerunError instanceof Error
            ? rerunError.message
            : "재실행 중 알 수 없는 오류가 발생했습니다.",
      }));
    } finally {
      setActiveId(null);
    }
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>히스토리</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-400">아직 생성 내역이 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="프롬프트 또는 모델명 검색"
              value={query}
            />
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <Button
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  size="sm"
                  type="button"
                  variant={filter === option.value ? "secondary" : "outline"}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-xs text-zinc-500">총 {filtered.length}건 표시 중</p>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-zinc-400">검색/필터 조건에 맞는 항목이 없습니다.</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((item) => (
          <Card key={item.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{typeLabel(item.type)}</Badge>
                <Badge>{providerLabel(item.provider)}</Badge>
                <Badge>{statusLabel(item.status)}</Badge>
                <span className="text-xs text-zinc-500">
                  {new Date(item.createdAt).toLocaleString("ko-KR")}
                </span>
              </div>

              <p className="line-clamp-2 text-sm text-zinc-200">{item.prompt}</p>
              {item.model ? (
                <p className="text-xs text-zinc-500">
                  모델: <span className="font-mono">{item.model}</span>
                </p>
              ) : null}

              {item.outputAssetUrl ? (
                <div className="relative aspect-video overflow-hidden rounded-md border border-zinc-800 bg-zinc-900">
                  {isVideo(item) ? (
                    <video
                      controls
                      className="h-full w-full object-cover"
                      src={item.outputAssetUrl}
                    />
                  ) : (
                    <Image
                      alt={item.prompt}
                      className="h-full w-full object-cover"
                      fill
                      src={item.outputAssetUrl}
                      unoptimized
                    />
                  )}
                </div>
              ) : item.errorMessage ? (
                <p className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {item.errorMessage}
                </p>
              ) : (
                <p className="text-xs text-zinc-500">결과 URL이 없습니다.</p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={activeId === item.id || (item.type !== "IMAGE" && !item.inputAssetUrl)}
                  onClick={() => void rerun(item)}
                  size="sm"
                  variant="secondary"
                >
                  {activeId === item.id ? (
                    <>
                      <Spinner /> 재실행 중...
                    </>
                  ) : (
                    "재실행"
                  )}
                </Button>
                <Button
                  onClick={() => void copyPrompt(item)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {copiedId === item.id ? "복사됨" : "프롬프트 복사"}
                </Button>
              </div>

              {errorById[item.id] ? (
                <p className="text-xs text-rose-300">{errorById[item.id]}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
