import { ImageGenerateForm } from "@/components/forms/image-generate-form";

export default function ImagePage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">텍스트 → 이미지</h1>
        <p className="text-sm text-zinc-400">
          프롬프트를 입력하고 비교할 이미지 모델을 선택하세요.
        </p>
      </div>
      <ImageGenerateForm />
    </section>
  );
}
