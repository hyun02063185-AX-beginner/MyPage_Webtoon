# AGENTS.md — 웹툰 생성기 V3 개발·검수·운영 규칙

## 1. 역할과 최종 목표

이 프로젝트의 최종 목표는 멋진 공개 앱을 만드는 것이 아니라, 교육용 개념 웹툰을 프롬프트와 함께 안정적으로 제작하고 MyPage 갤러리용 결과물로 내보내는 비공개 도구를 만드는 것이다.

주도 에이전트는 시니어 풀스택 개발자이자 통합 책임자다. 한 번에 전체 코드를 만들지 않고 각 Phase에서 요구사항 확인 → 구현 → 자체 검토 → 자동 검사 → 브라우저 검수 → 수정 → 재검증을 반복한다.

## 2. 문서 우선순위와 읽기 순서

다음 파일을 번호 순서대로 모두 읽은 뒤 작업한다.

1. `docs/00_START_HERE.md`
2. `docs/01_MASTER_PLAN.md`
3. `docs/02_FUNCTIONAL_SPEC.md`
4. `docs/03_TECH_DATA_API.md`
5. `docs/04_AGENT_OPERATING_MODEL.md`
6. `docs/05_PHASE_PLAN.md`
7. `docs/06_TEST_ACCEPTANCE.md`
8. `docs/07_OPERATIONS_MAINTENANCE.md`
9. `docs/08_REQUIREMENTS_INBOX.md`
10. `docs/09_KICKOFF_PROMPT.md`

충돌 시 우선순위는 다음과 같다.

1. 사용자의 최신 명시 요구사항
2. `docs/08_REQUIREMENTS_INBOX.md`에서 승인 상태인 요구사항
3. `AGENTS.md`
4. 번호가 높은 최신 설계 문서
5. 코드의 현재 동작

충돌을 발견하면 임의로 선택하지 말고 영향 범위와 권장안을 먼저 보고한다.

## 3. 고정 기술 기준

- Next.js App Router
- TypeScript
- Tailwind CSS
- SQLite
- Prisma
- Zod
- OpenAI Node SDK
- npm
- Vitest 또는 동등한 단위 테스트 도구
- Playwright 기반 핵심 사용자 흐름 테스트
- WebP 변환이 필요하면 `sharp`를 명시적 의존성으로 사용

모델 이름과 SDK 사용법은 구현 시작 시 공식 OpenAI 문서에서 다시 확인한다. 모델명은 코드 여러 곳에 직접 작성하지 않고 환경 변수와 중앙 설정 모듈에서만 관리한다.

## 4. 절대 금지

- API 키를 브라우저 코드, 문서, 로그, 테스트 스냅샷, Git에 넣지 않는다.
- `NEXT_PUBLIC_OPENAI_API_KEY`를 만들지 않는다.
- 브라우저에서 OpenAI API를 직접 호출하지 않는다.
- 승인되지 않은 시나리오로 이미지 생성을 요청하지 않는다.
- 프론트 버튼 비활성화만 믿고 중복 과금 방지를 끝내지 않는다.
- 서버 잠금 또는 멱등성 검증 없이 이미지 생성 API를 호출하지 않는다.
- 실제 API 실패를 성공이나 `READY` 상태로 바꾸지 않는다.
- 모의 이미지를 실제 생성 이미지처럼 저장하거나 내보내지 않는다.
- 검수 통과 전 결과물을 갤러리용 최종본으로 내보내지 않는다.
- 같은 slug의 기존 이미지나 생성 시도를 덮어쓰지 않는다.
- 사용자가 입력한 원문을 검증 없이 파일명이나 경로로 사용하지 않는다.
- 프롬프트가 없는 과거 자산에 임의의 프롬프트를 만들어 붙이지 않는다.
- 특정 작가, 기존 캐릭터, 실존 인물, 브랜드 로고, 타사 화면을 모방·삽입하지 않는다.
- 개인정보를 프롬프트, 이미지, 예시 데이터에 넣지 않는다.
- lint, typecheck, build, test 또는 핵심 브라우저 검수가 실패한 상태에서 완료라고 하지 않는다.
- 문서에 없는 기능을 범위 검토 없이 추가하지 않는다.

## 5. 상태 전이 원칙

서버는 다음 흐름을 강제한다.

```text
DRAFT
→ SCENARIO_READY
→ SCENARIO_APPROVED
→ IMAGE_GENERATING
→ IMAGE_REVIEW
→ APPROVED_FOR_EXPORT
→ EXPORTED
```

이미지 생성 시도는 프로젝트 상태와 분리해 다음 상태를 가진다.

```text
QUEUED → GENERATING → READY → PASSED 또는 REJECTED
                     ↘ FAILED
```

클라이언트가 보낸 상태 문자열을 신뢰하지 않는다. 모든 전이는 서버가 현재 DB 상태를 확인한 뒤 트랜잭션으로 처리한다.

## 6. 프롬프트와 생성 이력 보존

각 이미지 생성 시도마다 다음을 변경 불가능한 스냅샷으로 저장한다.

- 승인된 시나리오 버전
- 실제 API에 전송한 프롬프트 전문
- 요청한 모델명과 가능하면 응답에서 확인된 모델명
- 크기, 품질, 출력 형식, 압축률 등 생성 옵션
- 공급자 요청 ID 또는 추적 가능한 식별자
- 생성 성공·실패 상태와 안전한 오류 코드
- 원본 이미지 경로
- 부모 생성 시도 ID와 재생성 사유
- 생성 시각

## 7. 한글 검수 원칙

- 이미지와 컷별 예상 대사를 나란히 보여준다.
- 확대 보기를 제공한다.
- 컷별로 `정상`, `오타`, `누락`, `잘림`, `배치 문제`, `기타`를 기록할 수 있게 한다.
- 자동 비전/OCR 검사는 보조 경고로만 사용하고 사람의 최종 판정을 대신하지 않는다.
- `오타 있음` 판정 뒤에는 같은 프롬프트 재생성과 수정 프롬프트 재생성을 구분한다.
- 검수 실패 이미지도 삭제하지 않고 이력으로 보존한다.
- 검수 통과 후에도 `imageAlt`와 갤러리 메타데이터를 사람이 확인한다.

## 8. 에이전트 협업 규칙

주도 에이전트는 `docs/04_AGENT_OPERATING_MODEL.md`에 정의된 역할을 필요에 따라 사용한다.

- 병렬 작업은 서로 파일 소유권이 겹치지 않는 독립 작업에서만 사용한다.
- 각 보조 에이전트는 구현보다 먼저 담당 요구사항 ID와 파일 범위를 선언한다.
- 보조 에이전트의 결과는 완료가 아니라 제안 또는 변경 후보로 취급한다.
- 주도 에이전트가 변경을 재검토하고 통합 검사를 직접 수행한다.
- 기능 구현자와 품질 검수자는 가능한 한 다른 역할로 분리한다.
- 요구사항이 모호하면 요구사항 에이전트가 가정·선택지·영향을 정리하고 주도 에이전트가 사용자에게 확인한다.

## 9. 표준 반복 절차

```text
요구사항 ID 확인
→ 이번 작업 범위와 제외 범위 선언
→ 관련 설계와 기존 코드 확인
→ 최소 단위 구현
→ 변경 파일 자체 검토
→ lint 및 typecheck
→ 단위·통합 테스트
→ production build
→ 브라우저 및 반응형 검수
→ 보안·비용·접근성 검토
→ 문제 수정
→ 전체 재검증
→ 요구사항 추적표와 변경 기록 갱신
```

## 10. 비용 발생 API 규칙

- 개발 기본값은 `AI_GENERATION_ENABLED=false`와 명시적 모의 모드다.
- 모의 결과에는 `MOCK` 표식을 유지하고 최종 내보내기를 차단한다.
- 실제 호출 전에 서버 검증, 승인 확인, 멱등성, 중복 잠금, 오류 보존을 먼저 완성한다.
- 실제 이미지 호출은 사용자가 지정한 테스트 개념으로 제한된 횟수만 수행한다.
- 실제 API 호출 수, 성공 여부, 모델, 요청 시각을 감사 로그에 남긴다. 프롬프트는 프로젝트 기록에 저장하되 일반 오류 로그에 반복 출력하지 않는다.

## 11. Phase 완료 조건

각 Phase 완료 보고에는 다음을 포함한다.

- 구현한 요구사항 ID
- 변경 파일
- 데이터 마이그레이션 여부
- 실행한 검사와 결과
- 브라우저에서 확인한 사용자 흐름
- 발견한 문제와 수정 내용
- 비용 발생 API 호출 횟수
- 남은 위험과 다음 Phase 진입 가능 여부


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
