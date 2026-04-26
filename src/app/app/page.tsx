import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listModelOptions } from "@/lib/model-catalog";

const tools = [
  {
    href: "/app/image",
    title: "텍스트 → 이미지",
    description: "OpenAI/Replicate 이미지 모델을 체크해 같은 프롬프트로 비교합니다.",
  },
  {
    href: "/app/edit",
    title: "이미지 편집",
    description: "업로드한 이미지를 모델별 편집 결과로 나란히 확인합니다.",
  },
  {
    href: "/app/video",
    title: "이미지 → 비디오",
    description: "정지 이미지를 Sora와 Replicate 비디오 모델로 변환합니다.",
  },
  {
    href: "/app/history",
    title: "히스토리",
    description: "기존 결과를 검색하고 재실행해 반복 개선합니다.",
  },
];

export default function DashboardPage() {
  const models = listModelOptions();
  const configuredModels = models.filter((model) => model.configured);
  const providerStatus = [
    {
      label: "OpenAI",
      configured: models.some((model) => model.provider === "openai" && model.configured),
      total: models.filter((model) => model.provider === "openai").length,
      active: configuredModels.filter((model) => model.provider === "openai").length,
    },
    {
      label: "Replicate",
      configured: models.some((model) => model.provider === "replicate" && model.configured),
      total: models.filter((model) => model.provider === "replicate").length,
      active: configuredModels.filter((model) => model.provider === "replicate").length,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">대시보드</p>
        <h1 className="mt-2 text-3xl font-semibold">하이브리드 미디어 컨트롤</h1>
        <p className="mt-2 text-sm text-zinc-400">
          작업 유형을 고르고 비교할 모델을 선택하세요.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {tools.map((tool) => (
          <Link href={tool.href} key={tool.href}>
            <Card className="h-full transition hover:border-cyan-400/60 hover:bg-zinc-900">
              <CardHeader>
                <CardTitle>{tool.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400">{tool.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {providerStatus.map((provider) => (
          <Card key={provider.label}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-medium text-zinc-100">{provider.label}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {provider.active}/{provider.total} 모델 사용 가능
                </p>
              </div>
              <Badge>{provider.configured ? "연결됨" : "API 키 필요"}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
