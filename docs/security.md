# Security And Operations

이 문서는 현재 구현된 보안/운영 가드레일을 정리합니다.

## 비밀값

- `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, Supabase service role key는 서버 환경변수에서만 읽습니다.
- `src/lib/env.ts`, provider, Prisma, storage 관련 모듈은 `server-only`로 보호합니다.
- Client에는 API 키나 service role key를 전달하지 않습니다.

## 모델 allow-list

생성 API는 요청된 모델이 `src/lib/model-catalog.ts`에서 계산한 목록에 있는지 확인합니다.

- OpenAI 목록: `OPENAI_IMAGE_MODELS`, `OPENAI_EDIT_MODELS`, `OPENAI_VIDEO_MODELS`
- Replicate 목록: `REPLICATE_IMAGE_MODELS`, `REPLICATE_EDIT_MODELS`, `REPLICATE_VIDEO_MODELS`

env에 등록되지 않은 모델은 실행하지 않습니다.

## 외부 URL 검증

이미지 입력 URL은 다음 조건을 만족해야 합니다.

- HTTPS URL
- username/password가 없는 URL
- localhost, `.localhost`, `.local` 차단
- private IP, loopback, link-local, multicast 차단
- redirect 후 URL도 동일하게 검증

이 검증은 SSRF와 metadata endpoint 접근을 줄이기 위한 최소 방어선입니다.

## 업로드 제한

- 허용 MIME type: `image/png`, `image/jpeg`, `image/webp`
- Supabase Storage 설정 시 최대 15MB
- Storage 미설정 시 data URL fallback 최대 4MB
- 파일명은 storage path에 쓰기 전에 안전한 문자로 정규화합니다.

## Remote Asset 저장

Provider 결과 URL을 서버가 다운로드해 Supabase Storage에 저장할 때:

- public HTTPS URL만 다운로드합니다.
- redirect URL도 재검증합니다.
- 최대 다운로드 크기는 200MB입니다.
- 허용 media MIME type만 저장합니다.

Supabase Storage가 없으면:

- OpenAI 이미지 결과는 data URL fallback이 가능합니다.
- OpenAI 비디오 결과는 저장하지 않고 실패 처리합니다.
- Replicate 결과는 provider가 반환한 URL을 그대로 사용할 수 있습니다.

## Rate Limit

현재 rate limit은 in-memory 방식입니다. 단일 Node.js 프로세스 기준 방어이므로 서버리스/멀티 인스턴스 운영에서는 Redis 등 외부 저장소 기반 rate limit으로 교체해야 합니다.

현재 제한:

- `GET /api/models`: 120 requests/min
- `GET /api/history`: 60 requests/min
- `POST /api/upload`: 20 requests/min
- `POST /api/generate/image`: 12 requests/min
- `POST /api/generate/edit`: 10 requests/min
- `POST /api/generate/video`: 6 requests/min

## Request Size

- 이미지 생성 JSON: 최대 256KB
- 이미지 편집 JSON: 최대 8MB
- 비디오 생성 JSON: 최대 8MB
- 업로드 multipart: Storage 설정에 따라 4MB 또는 15MB + multipart overhead

## Dependency Audit

`npm audit` 기준 취약점은 `0`이어야 합니다.

Next.js 16.2.4 내부 PostCSS dependency가 취약 버전으로 고정되어 있어 `package.json`의 `overrides`로 `postcss@8.5.10`을 강제합니다.

검증:

```bash
npm audit
npm ls postcss --all
```

## 남은 운영 과제

- 사용자 인증/권한 분리
- 사용자별 history scope
- Redis 기반 rate limit
- 장기 작업용 queue/worker
- Provider webhook 기반 비동기 처리
- Content moderation policy 문서화
