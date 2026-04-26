import { toHistoryItem } from "@/lib/generation-dto";
import { prisma } from "@/lib/prisma";
import { HistoryList } from "@/components/shared/history-list";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const generations = await prisma.generation.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">히스토리</h1>
        <p className="text-sm text-zinc-400">
          프롬프트, 모델, 생성 결과를 확인하고 빠르게 재실행할 수 있습니다.
        </p>
      </div>
      <HistoryList items={generations.map(toHistoryItem)} />
    </section>
  );
}
