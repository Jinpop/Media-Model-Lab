# API

모든 API는 Next.js App Router Route Handler입니다. API 키는 서버 환경변수에서만 읽고, 브라우저로 노출하지 않습니다.

## `GET /api/models`

지원 task:

- `image`
- `edit`
- `video`

예시:

```bash
curl "http://localhost:3000/api/models?task=image"
```

응답:

```json
{
  "success": true,
  "models": [
    {
      "id": "openai:gpt-image-2",
      "provider": "openai",
      "model": "gpt-image-2",
      "label": "OpenAI · gpt-image-2",
      "description": "OpenAI Image API",
      "tasks": ["image", "edit"],
      "configured": true,
      "requiredEnv": "OPENAI_API_KEY",
      "defaultForTasks": ["image", "edit"]
    }
  ]
}
```

## `POST /api/generate/image`

텍스트 프롬프트로 이미지를 생성합니다.

```json
{
  "prompt": "비 오는 밤 서울 골목의 시네마틱 사진",
  "negativePrompt": "watermark, blurry",
  "count": 1,
  "size": "1024x1024",
  "targets": [
    { "provider": "openai", "model": "gpt-image-2" },
    { "provider": "replicate", "model": "black-forest-labs/flux-schnell" }
  ]
}
```

제한:

- `prompt`: 3~4000자
- `negativePrompt`: 최대 1000자
- `count`: 1~4
- `targets`: 최대 6개
- `size`: `1024x1024`, `1024x1536`, `1536x1024`

## `POST /api/generate/edit`

이미지를 편집합니다.

```json
{
  "imageUrl": "https://example.com/source.png",
  "prompt": "배경을 야경 도시로 변경",
  "negativePrompt": "broken hands",
  "mode": "background",
  "size": "1024x1024",
  "targets": [
    { "provider": "openai", "model": "gpt-image-2" }
  ]
}
```

제한:

- `imageUrl`: HTTPS URL 또는 제한된 data URL
- `mode`: `variation`, `style`, `background`
- `targets`: 최대 6개
- 외부 URL은 public HTTPS만 허용

## `POST /api/generate/video`

이미지와 장면 프롬프트로 비디오를 생성합니다.

```json
{
  "imageUrl": "https://example.com/source.png",
  "prompt": "카메라가 천천히 피사체로 다가가는 장면",
  "durationSeconds": 4,
  "targets": [
    { "provider": "openai", "model": "sora-2" },
    { "provider": "replicate", "model": "wavespeedai/wan-2.1-i2v-480p" }
  ]
}
```

제한:

- `durationSeconds`: `4`, `5`, `8`, `10`, `12`
- `targets`: 최대 4개
- OpenAI Sora 요청은 4/8/12초로 매핑됩니다.
- OpenAI 비디오 결과 저장에는 Supabase Storage가 필요합니다.

## 생성 응답

모든 생성 API는 부분 성공을 허용합니다.

```json
{
  "success": true,
  "assets": [
    {
      "id": "generation-id",
      "url": "https://...",
      "mimeType": "image/png",
      "prompt": "비 오는 밤 서울 골목의 시네마틱 사진",
      "provider": "openai",
      "model": "gpt-image-2"
    }
  ],
  "records": [],
  "errors": []
}
```

모든 target이 실패하면 `success: false`와 500 status를 반환합니다.

## `POST /api/upload`

이미지 편집/비디오 입력용 이미지를 업로드합니다.

제한:

- 허용 타입: PNG, JPEG, WebP
- Supabase Storage 설정 시 최대 15MB
- Storage 미설정 시 data URL fallback 최대 4MB

## `GET /api/history`

최근 100개 생성 기록을 반환합니다. 응답은 DTO로 최소화되어 있습니다.

```json
{
  "success": true,
  "items": [
    {
      "id": "...",
      "type": "IMAGE",
      "prompt": "...",
      "negativePrompt": null,
      "provider": "OPENAI",
      "model": "gpt-image-2",
      "inputAssetUrl": null,
      "outputAssetUrl": "https://...",
      "status": "COMPLETED",
      "errorMessage": null,
      "createdAt": "2026-04-26T00:00:00.000Z"
    }
  ]
}
```
