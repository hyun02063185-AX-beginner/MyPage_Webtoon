# Phase 0 — 요구사항 동결 및 환경 준비 보고

작성일: 2026-09-06  
범위: 문서·환경·Git·과거 자산의 읽기 전용 점검과 계획 수립. 앱 코드, 의존성, DB, OpenAI API 호출은 시작하지 않았다.

## 1. 확인한 사실

- 앱 코드는 아직 없고 기획 문서·설정 예시·갤러리 JSON 예시만 있다.
- Node.js `v24.16.0`, npm `11.13.0`, Git `2.54.0.windows.1`을 사용할 수 있다.
- 지정한 GitHub 원격은 빈 저장소이며, 로컬 Git은 `main` 브랜치와 `origin`으로 초기화했다.
- 로컬 커밋 이메일은 `288177832+hyun02063185-AX-beginner@users.noreply.github.com`이다.
- 실제 `.env` 또는 `.env.local`은 없고 `.env.example`만 있다. 키 값은 읽거나 출력하지 않았다.
- `backup_images/`에는 PNG 26개(약 59.8 MB)가 있다. 해상도는 `1536x1024` 11개, `1254x1254` 10개, `1024x1536` 3개, `1216x1294` 1개, `2752x1536` 1개으로 서로 다르다.
- 과거 이미지와 런타임 생성물은 Git 제외 대상이다. `backup_images/`도 제외 규칙에 추가했다.

## 2. 확정된 결정(ADR)

### ADR-001 — Git과 원격 저장소

`main` 브랜치, `origin=https://github.com/hyun02063185-AX-beginner/MyPage_Webtoon.git`, 지정 GitHub noreply 이메일을 사용한다. 원격 push는 Phase 산출물을 검토 가능한 단위로 만들 때만 수행한다.

### ADR-002 — 비용 없는 개발 기본값

개발·테스트는 `AI_GENERATION_ENABLED=false` 또는 `AI_GENERATION_MODE=mock`으로만 진행한다. 실제 이미지 생성은 Phase 4 이후 사용자가 `LIVE` 검수를 명시하고 호출 횟수·비용 상한을 승인한 경우에만 허용한다.

### ADR-003 — 과거 이미지의 지위

`backup_images/`는 읽기 전용 참조 자산이다. 현재 위치에서 복사·이름 변경·형식 변환·DB 등록하지 않는다. Phase 7에서 hash 기반 manifest를 먼저 만들고 사용자 선택으로만 이관한다.

### ADR-004 — 갤러리 계약

공개 갤러리는 이 저장소에서 구현하지 않는다. export는 기존 JSON 계약과 검수 통과한 WebP만 대상으로 하며, `MOCK` 결과는 export하지 않는다.

## 3. 요구사항 우선순위와 제외 범위

| 구분 | 항목 |
|---|---|
| Must | F-001~F-022, REQ-20260906-001(원본 보존·규격 식별), REQ-20260906-002(Git 소스 관리), 서버 상태 전이·멱등성·검수·export 차단 |
| Should | 과거 자산의 hash manifest, 원본 PNG 장기 보관 정책, OCR/비전 보조 경고 |
| Could | ZIP 묶음 다운로드, 자동 비전 검수의 기본 활성화 |
| 제외 | 공개 MyPage 갤러리 개발, 자동 배포, 로그인·결제·다중 사용자, SNS 공유, 사람 승인 없는 게시 |

## 4. 요구사항·기능·테스트 추적표 초안

| 요구사항 | 기능 | 테스트 ID | Phase |
|---|---|---|---|
| BASE-001 | F-001, F-002 | T-INT-001, T-E2E-001, T-E2E-002 | 2 |
| BASE-002 | F-003, F-004, F-005 | T-UNIT-003, T-INT-003, T-E2E-003, T-E2E-A | 3 |
| BASE-003 | F-006, F-007, F-008, F-009, F-011, F-017, F-018 | T-UNIT-007, T-INT-007, T-E2E-B, T-E2E-C | 4 |
| BASE-004 | F-010, F-012 | T-INT-010, T-E2E-010, T-MANUAL-010 | 5 |
| BASE-005 | F-013, F-014, F-015, F-016 | T-UNIT-014, T-INT-014, T-E2E-E | 6 |
| BASE-006 | F-020 | T-INT-020, T-MANUAL-020 | 1, 8 |
| REQ-20260906-001 | F-014, F-021 | T-UNIT-014, T-INT-021, T-MANUAL-021 | 0, 7 |
| REQ-20260906-002 | F-020 | T-OPS-002 | 0, 1 |
| BASE-007 | F-022 | T-E2E-022, T-MANUAL-022 | 1~6 |

`BASE-*`는 기존 기획 문서에서 이미 승인된 기능 묶음이다. 각 구현 Phase에서 세부 테스트를 추가하고, 실행 전에는 `docs/06_TEST_ACCEPTANCE.md`에 증거·결과를 갱신한다.

## 5. 충돌·누락·결정 필요 항목

1. F-002는 기존 100개 용어 검색을 요구하지만, 현재 작업 폴더에는 용어 원본 데이터가 없다. Phase 2 전 `legacy-input/data/`에 읽기 전용 원본을 제공하거나, 초기 데이터셋의 별도 승인 범위를 정해야 한다.
2. 텍스트 모델 최종명, 이미지 LIVE 비용 상한, OCR/비전 기본 활성화, PNG 원본 장기 보관 여부는 아직 미결정이다. 각각 Phase 3·4·5·6 진입 전 결정하면 된다.
3. `backup_images/`는 여러 가로·세로·정사각 규격이 섞여 있다. 이는 통일되지 않은 기존 사례라는 요구와 일치하며, 신규 export 규격을 정하는 근거로만 사용한다. 자동 리사이즈나 일괄 변환은 승인되지 않았다.

## 6. Phase 1 초기 구조 계획

Phase 1은 Next.js App Router·TypeScript·Tailwind·Prisma/SQLite의 최소 골격만 만든다. 예정 소유 영역은 다음과 같다.

```text
app/                    UI, 로딩·오류 화면
lib/config/             서버 전용 환경 검증과 중앙 설정
lib/domain/             상태 전이와 도메인 규칙
prisma/                 SQLite 스키마·초기 마이그레이션
tests/                  단위·통합 테스트
e2e/                    Playwright 핵심 흐름
public/placeholders/    MOCK 전용 시각 표식
```

`data/`, `storage/`, `logs/`, `legacy-input/`, `backup_images/`는 런타임·원본 영역으로 Git에 넣지 않는다. DB 마이그레이션은 아직 없다.

## 7. 역할 분리와 Phase 1 완료 조건

| 역할 | Phase 1 책임 | 파일 소유 예시 |
|---|---|---|
| Lead | 요구사항·파일 소유권·통합 게이트 | 추적표, 변경 기록 |
| Architecture/Security | Prisma 스키마, 환경 경계, 상태 전이 | `prisma/`, `lib/config/`, `lib/domain/` |
| Implementation | Next.js 골격과 기본 UI | `app/`, UI 컴포넌트 |
| QA | 독립 설치·OFF/MOCK·브라우저 흐름 재현 | 테스트·검수 증거(구현 파일 미수정) |
| Operations | `.gitignore`, 환경 예시, 백업·복구 진입 점검 | 운영 문서·검증 기록 |

Phase 1 진입 가능 조건은 이 Phase 0 보고의 승인이다. Phase 1 완료에는 빈 SQLite DB 기동, 서버 비밀값 미노출, OFF/MOCK에서 이해 가능한 설정 안내, lint·typecheck·test·E2E·build와 브라우저 확인의 통과가 필요하다.

## 8. 비용·마이그레이션·검증 기록

- OpenAI API 호출: 0회
- 데이터 마이그레이션: 없음
- 앱 테스트·빌드: 앱 코드와 package 설정이 없으므로 미실행
- 수행한 점검: 문서 완독, 공식 OpenAI 이미지 모델 문서 확인, Git/Node/npm/Git 상태, 환경 파일명만 확인, 과거 PNG 수량·용량·해상도 검사
- 다음 단계: 사용자가 이 보고와 미결정 항목을 확인한 뒤에만 Phase 1을 시작한다.
