import { VideoGenerateForm } from "@/components/forms/video-generate-form";

export default function VideoPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">이미지 → 비디오</h1>
        <p className="text-sm text-zinc-400">
          원본 이미지와 장면 프롬프트를 입력하고 비디오 모델을 비교하세요.
        </p>
      </div>
      <VideoGenerateForm />
    </section>
  );
}
