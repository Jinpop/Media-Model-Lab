# Architecture

Media Model Lab은 Next.js App Router 기반의 BFF 구조입니다. 브라우저는 API 키를 직접 다루지 않고, 서버 Route Handler가 provider SDK와 데이터 저장을 담당합니다.

```mermaid
flowchart LR
    A[Next.js UI] --> B[Model Picker]
    A --> C[Generate Forms]
    B --> D[/api/models]
    C --> E[/api/generate/*]
    A --> F[/app/history]
    F --> G[(Prisma/PostgreSQL)]
    D --> H[Model Catalog]
    E --> I[Validation + Rate Limit]
    I --> J[Provider Abstraction]
    J --> K[OpenAI Images + Sora]
    J --> L[Replicate Predictions]
    E --> M[(Supabase Storage)]
    E --> G
    K --> E
    L --> E
```

## 주요 레이어

- UI: `/app/image`, `/app/edit`, `/app/video`, `/app/history`
- API BFF: `src/app/api/*`
- 모델 카탈로그: `src/lib/model-catalog.ts`
- 보안/검증: `src/lib/generation-api.ts`, `src/lib/security.ts`, `src/lib/rate-limit.ts`
- Provider 추상화: `src/lib/providers`
- 히스토리 저장: Prisma `Generation`
- 파일 저장: Supabase Storage, 미설정 시 제한된 이미지 data URL fallback

## 요청 흐름

1. UI가 `/api/models?task=...`에서 env 기반 모델 목록을 가져옵니다.
2. 사용자는 하나 이상의 모델을 선택합니다.
3. 생성 API가 payload, 모델 allow-list, rate limit, 외부 URL 안전성을 검증합니다.
4. provider별 생성 함수를 순차 실행합니다.
5. 성공한 asset은 history에 저장하고, 실패한 모델은 `errors[]`로 반환합니다.
6. UI는 성공 결과와 모델별 실패 사유를 함께 표시합니다.

## Provider 제약

- OpenAI 이미지/편집은 base64 결과를 Storage 또는 data URL로 정규화합니다.
- OpenAI 비디오는 결과 파일이 커서 Supabase Storage가 필요합니다.
- Replicate 결과 URL은 Storage가 설정되어 있으면 서버가 다운로드해 재저장합니다.
- Replicate 모델은 input schema가 모델마다 다르므로 현재 payload와 호환되는 모델만 env에 넣어야 합니다.

## 데이터 모델

`Generation`은 생성 단위별로 한 row를 저장합니다.

- `type`: `IMAGE`, `EDIT`, `VIDEO`
- `provider`: `OPENAI`, `REPLICATE`
- `model`: 실행 모델명
- `prompt`, `negativePrompt`
- `inputAssetUrl`, `outputAssetUrl`
- `status`, `errorMessage`
- `settings`
- `createdAt`

Client에는 DB row 전체가 아니라 `src/lib/generation-dto.ts`의 DTO 필드만 전달합니다.
