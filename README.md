# Media Model Lab

OpenAI API와 Replicate API의 미디어 생성 모델을 한 UI에서 선택하고 같은 입력으로 비교하는 Next.js App Router 프로젝트입니다.

첫 화면은 `/app` 대시보드이며, 환경변수에 API 키와 모델 목록을 넣으면 UI의 모델 선택 드롭다운에 사용 가능한 모델이 표시됩니다.

## 지원 기능

- 텍스트 -> 이미지 생성
- 이미지 -> 이미지 편집
- 이미지 -> 비디오 생성
- 여러 모델 동시 선택 및 결과 비교
- 생성 히스토리 조회 및 재실행
- 모델별 부분 실패 표시

## Provider

### OpenAI

- 이미지 생성/편집: `gpt-image-2`, `gpt-image-1.5`, `gpt-image-1-mini`
- 이미지 기반 비디오 생성: `sora-2`, `sora-2-pro`

OpenAI 비디오 결과는 파일 크기가 클 수 있어 Supabase Storage 설정이 필요합니다.

### Replicate

- 텍스트 -> 이미지 기본값: `black-forest-labs/flux-schnell`
- 이미지 편집 기본값: `qwen/qwen-image-edit-plus`
- 이미지 -> 비디오 기본값: `wavespeedai/wan-2.1-i2v-480p`

Replicate 모델은 모델별 입력 스키마가 다를 수 있습니다. `REPLICATE_*_MODELS`에 추가하는 모델은 현재 provider payload와 호환되는 모델만 넣어야 합니다.

## 환경변수

```bash
cp .env.example .env
```

필수:

- `DATABASE_URL`

선택한 provider에 따라 설정:

- `OPENAI_API_KEY`
- `REPLICATE_API_TOKEN`

모델 목록은 쉼표로 확장합니다.

```bash
OPENAI_IMAGE_MODELS="gpt-image-2,gpt-image-1.5,gpt-image-1-mini"
OPENAI_EDIT_MODELS="gpt-image-2,gpt-image-1.5,gpt-image-1-mini"
OPENAI_VIDEO_MODELS="sora-2,sora-2-pro"

REPLICATE_IMAGE_MODELS="black-forest-labs/flux-schnell"
REPLICATE_EDIT_MODELS="qwen/qwen-image-edit-plus"
REPLICATE_VIDEO_MODELS="wavespeedai/wan-2.1-i2v-480p"
```

스토리지는 선택 사항이지만 운영 환경에서는 권장합니다.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

Supabase Storage가 없으면 일부 이미지 업로드/생성 결과는 data URL로 반환됩니다. OpenAI 비디오 결과 저장에는 Supabase Storage가 필요합니다.

## 실행

```bash
npm install
npm run prisma:generate
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 검증 명령

```bash
npm run lint
npx tsc --noEmit
npm run build
npm audit
```

현재 `npm audit` 기준 취약점은 없습니다. Next.js 16.2.4가 의존하는 PostCSS 취약점은 `package.json`의 `overrides`로 `postcss@8.5.10`을 강제해 해결합니다.

## API 개요

- `GET /api/models?task=image|edit|video`
- `POST /api/generate/image`
- `POST /api/generate/edit`
- `POST /api/generate/video`
- `GET /api/history`
- `POST /api/upload`

비교 실행은 `targets` 배열을 사용합니다.

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
  "errors": [
    {
      "provider": "openai",
      "model": "gpt-image-2",
      "error": "Selected provider is not configured."
    }
  ]
}
```

상세 내용은 [API 문서](docs/api.md), [아키텍처 문서](docs/architecture.md), [보안 문서](docs/security.md)를 확인하세요.
