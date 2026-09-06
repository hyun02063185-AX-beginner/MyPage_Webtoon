# 03. 기술·데이터·API 설계

## 1. 제안 아키텍처

```text
Next.js UI
  → 서버 Route Handler / Server Action
    → Zod 입력 검증
      → 도메인 서비스
        ├─ Prisma + SQLite
        ├─ OpenAI Responses API
        ├─ OpenAI Image API
        └─ 로컬 파일 저장·WebP export
```

검색이나 기존 프로젝트 열람은 OpenAI 장애와 분리한다. 외부 API 모듈은 도메인 저장소나 UI 컴포넌트에 직접 섞지 않는다.

## 2. 권장 저장 구조

```text
prisma/
  schema.prisma
  migrations/
storage/
  projects/{projectId}/
    attempts/{attemptId}/source.png 또는 source.webp
    exports/{exportId}/{slug}.webp
    exports/{exportId}/{slug}.json
data/
  app.db
  backups/YYYY-MM-DD-HHmmss/
public/
  placeholders/
```

`storage`와 `data`는 Git에서 제외한다. 파일 접근은 검증된 DB 경로와 서버 API를 통해서만 허용한다.

## 3. 데이터 모델

### Project

- id, slug, concept, audience, audienceDetail, purpose, style, memo
- title, imageAlt, paragraphsJson
- status
- selectedScenarioVersionId, selectedImageAttemptId
- createdAt, updatedAt

### ScenarioVersion

- id, projectId, version
- term, english, title, audience, coreMessage
- background, characterGuide, panelsJson, finalCaption
- sourceModel, sourceResponseId
- approvedAt, createdAt

### ImageAttempt

- id, projectId, scenarioVersionId, parentAttemptId
- idempotencyKey
- promptSnapshot, promptHash
- requestedModel, responseModel, providerRequestId
- size, quality, outputFormat, outputCompression
- status, filePath, fileSha256
- regenerationMode, regenerationReason
- errorCode, safeErrorMessage
- createdAt, completedAt

### ImageReview

- id, imageAttemptId
- result: `PASSED` 또는 `REJECTED`
- panelChecksJson
- typoFound, missingText, croppedText, layoutIssue, contentIssue
- notes, reviewedAt

### ExportBundle

- id, projectId, imageAttemptId
- exportVersion, imagePath, jsonPath, archivePath
- imageSha256, jsonSha256
- createdAt

### GenerationLock 또는 동등한 잠금

- projectId 또는 generationKey
- status, acquiredAt, expiresAt

SQLite 트랜잭션과 조건부 갱신으로 하나의 프로젝트에 활성 이미지 생성이 하나만 존재하도록 한다.

## 4. 시나리오 JSON 구조

```json
{
  "term": "API",
  "english": "Application Programming Interface",
  "title": "API를 설명할 때 제주도 식당 이야기를 합니다",
  "audience": "일반 직장인",
  "coreMessage": "API는 서로 다른 서비스가 정해진 방식으로 요청과 응답을 주고받는 연결 규칙입니다.",
  "background": "제주도 여행 중 식당",
  "characterGuide": "실존 인물이나 브랜드가 아닌 일반적인 직장인 캐릭터",
  "panels": [
    { "number": 1, "scene": "상황", "dialogues": ["짧은 대사"] },
    { "number": 2, "scene": "상황", "dialogues": ["짧은 대사"] },
    { "number": 3, "scene": "상황", "dialogues": ["짧은 대사"] },
    { "number": 4, "scene": "상황", "dialogues": ["짧은 대사"] }
  ],
  "finalCaption": "한 줄 정리"
}
```

Responses API의 Structured Outputs 또는 동등한 JSON Schema 기능을 사용하고, 서버에서 Zod로 다시 검증한다. 공식 기준은 [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)와 [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)를 구현 시작 시 다시 확인한다.

## 5. 이미지 생성 규칙

- 기본 후보 모델은 환경 변수의 `OPENAI_IMAGE_MODEL`로 관리한다.
- 초기 예시는 `gpt-image-2`지만 구현 시 공식 모델 문서와 계정 가용성을 다시 확인한다.
- 최종 API 프롬프트는 시스템 템플릿, 프로젝트 입력, 승인된 시나리오, 금지사항, 출력 제약을 조합한다.
- 조합된 최종 문자열을 먼저 DB에 저장한 뒤 그 스냅샷으로 API를 호출한다.
- 프롬프트를 호출 뒤 다시 조합하지 않는다.
- Image API 오류를 모의 이미지로 대체하지 않는다.
- 공급자 오류 코드를 안전한 내부 오류 코드로 변환하되 요청 추적 ID는 보존한다.
- 이미지 텍스트 정확도에는 모델 한계가 있으므로 사람 검수 단계를 필수로 둔다.

OpenAI Image API는 WebP 출력과 압축 설정을 지원한다. 프로젝트는 최종 WebP를 직접 요청하거나, 원본 보존 정책에 따라 PNG 원본을 저장한 뒤 `sharp`로 WebP를 생성할 수 있다. 상세 옵션은 [OpenAI 이미지 생성 문서](https://developers.openai.com/api/docs/guides/image-generation)를 구현 시점에 재검증한다.

## 6. API 초안

| Method | Path | 역할 |
|---|---|---|
| GET | `/api/projects` | 프로젝트 목록 |
| POST | `/api/projects` | 프로젝트 생성 |
| GET | `/api/projects/{id}` | 전체 작업 상태 조회 |
| PATCH | `/api/projects/{id}` | 기본 정보와 갤러리 메타데이터 수정 |
| POST | `/api/projects/{id}/scenarios` | 시나리오 새 버전 생성 |
| PATCH | `/api/scenarios/{id}` | 시나리오 수정 버전 생성 |
| POST | `/api/scenarios/{id}/approve` | 시나리오 승인 |
| POST | `/api/projects/{id}/image-attempts` | 이미지 생성 또는 재생성 |
| POST | `/api/image-attempts/{id}/reviews` | 검수 통과·반려 기록 |
| POST | `/api/projects/{id}/exports` | WebP와 JSON export |
| GET | `/api/exports/{id}/download` | 검증된 export 묶음 다운로드 |
| POST | `/api/maintenance/backup` | 로컬 백업 생성 |
| POST | `/api/maintenance/restore/validate` | 복원 파일 사전 검증 |

## 7. 갤러리 출력 계약

```json
{
  "slug": "api",
  "concept": "API",
  "title": "API를 설명할 때 저는 제주도 식당 이야기를 합니다",
  "image": "api.webp",
  "imageAlt": "제주도 식당의 주문 과정을 통해 서비스 사이의 요청과 응답 규칙을 설명하는 4컷 만화",
  "prompt": "실제로 이미지 API에 전송한 프롬프트 전문",
  "model": "생성에 사용한 모델",
  "createdAt": "2026-07-01",
  "paragraphs": ["사람이 작성한 해설 문단", "두 번째 해설 문단"]
}
```

추가 내부 필드는 별도 manifest에 둘 수 있지만, 위 공개 JSON 계약을 임의로 바꾸지 않는다.

## 8. 주요 오류 코드

- `INVALID_INPUT`
- `API_KEY_MISSING`
- `AI_GENERATION_DISABLED`
- `SCENARIO_NOT_APPROVED`
- `SCENARIO_VERSION_MISMATCH`
- `GENERATION_IN_PROGRESS`
- `IDEMPOTENCY_CONFLICT`
- `EXTERNAL_RATE_LIMIT`
- `EXTERNAL_API_ERROR`
- `MODERATION_BLOCKED`
- `IMAGE_SAVE_ERROR`
- `REVIEW_REQUIRED`
- `REVIEW_REJECTED`
- `EXPORT_VALIDATION_ERROR`
- `SLUG_CONFLICT`
- `BACKUP_VALIDATION_ERROR`

## 9. 보안과 개인정보

- 비밀은 서버 환경 변수에서만 읽는다.
- 요청·응답 전체를 일반 로그에 남기지 않는다.
- 프롬프트 DB는 로컬 개인 데이터로 취급한다.
- 사용자 입력을 파일 경로에 직접 결합하지 않는다.
- export 전 개인정보, 실존 인물, 브랜드, 저작권 위험을 사람이 확인한다.
- DB와 이미지 백업은 같은 세트로 관리하고 체크섬으로 무결성을 확인한다.
