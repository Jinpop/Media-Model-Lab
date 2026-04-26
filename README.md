# Media Model Lab

OpenAI API, Replicate API 등 여러 미디어 생성 모델을 한 UI에서 선택하고 같은 프롬프트로 비교하는 Next.js App Router 프로젝트입니다.

## 지원 흐름

- 텍스트 -> 이미지 생성
- 이미지 -> 이미지 편집
- 이미지 -> 비디오 생성
- 모델별 결과 비교
- 생성 히스토리 저장 및 재실행

## Provider

### OpenAI

- 이미지 생성/편집: `gpt-image-2`, `gpt-image-1.5`, `gpt-image-1-mini`
- 이미지 기반 비디오 생성: `sora-2`, `sora-2-pro`

### Replicate

- 텍스트 -> 이미지: `black-forest-labs/flux-schnell`
- 이미지 편집: `qwen/qwen-image-edit-plus`
- 이미지 -> 비디오: `wavespeedai/wan-2.1-i2v-480p`

Replicate 모델은 모델별 입력 스키마가 다를 수 있습니다. `REPLICATE_*_MODELS`에 추가하는 모델은 현재 provider payload와 호환되는 모델을 넣어야 합니다.

## 환경변수

```bash
cp .env.example .env
```

필수:

- `DATABASE_URL`

선택한 provider에 따라 설정:

- `OPENAI_API_KEY`
- `REPLICATE_API_TOKEN`

모델 목록은 쉼표로 확장할 수 있습니다.

```bash
OPENAI_IMAGE_MODELS="gpt-image-2,gpt-image-1.5,gpt-image-1-mini"
OPENAI_EDIT_MODELS="gpt-image-2,gpt-image-1.5,gpt-image-1-mini"
OPENAI_VIDEO_MODELS="sora-2,sora-2-pro"

REPLICATE_IMAGE_MODELS="black-forest-labs/flux-schnell"
REPLICATE_EDIT_MODELS="qwen/qwen-image-edit-plus"
REPLICATE_VIDEO_MODELS="wavespeedai/wan-2.1-i2v-480p"
```

스토리지는 선택 사항입니다.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

Supabase Storage가 없으면 업로드/생성 결과 일부는 data URL로 반환됩니다. 장기 보관과 큰 비디오 결과에는 Supabase Storage 설정을 권장합니다.

## 보안/운영 가드레일

- 생성 API는 env에 등록된 모델 목록만 실행합니다.
- 업로드는 PNG/JPEG/WebP만 허용합니다.
- 외부 이미지 URL은 HTTPS만 허용하며 localhost/private IP/metadata endpoint를 차단합니다.
- 생성/업로드/히스토리/모델 목록 API에는 기본 in-memory rate limit이 적용됩니다.
- history 응답은 UI에 필요한 DTO 필드만 반환합니다.
- `npm audit`의 PostCSS 취약점은 package override로 `postcss@8.5.10`을 강제해 해결했습니다.

## 실행

```bash
npm install
npm run prisma:generate
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API

- `GET /api/models?task=image|edit|video`
- `POST /api/generate/image`
- `POST /api/generate/edit`
- `POST /api/generate/video`
- `GET /api/history`
- `POST /api/upload`

생성 API는 단일 provider/model도 받지만, 비교 실행은 `targets` 배열을 사용합니다.

```json
{
  "prompt": "서울 야경을 배경으로 한 시네마틱 제품 사진",
  "count": 1,
  "size": "1024x1024",
  "targets": [
    { "provider": "openai", "model": "gpt-image-2" },
    { "provider": "replicate", "model": "black-forest-labs/flux-schnell" }
  ]
}
```

응답은 모델별 부분 실패를 허용합니다.

```json
{
  "success": true,
  "assets": [],
  "errors": []
}
```
# Media-Model-Lab
