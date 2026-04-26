import { ImageEditForm } from "@/components/forms/image-edit-form";

export default function EditPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">이미지 편집</h1>
        <p className="text-sm text-zinc-400">
          이미지를 업로드하거나 URL을 입력한 뒤, 편집 모드와 비교 모델을 선택하세요.
        </p>
      </div>
      <ImageEditForm />
    </section>
  );
}
