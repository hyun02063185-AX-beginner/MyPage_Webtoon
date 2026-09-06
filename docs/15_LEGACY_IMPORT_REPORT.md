# LEGACY 과거 자산 이관 보고

작성일: 2026-09-07  
요구사항: F-021, REQ-20260906-001

## 구현 범위

- `backup_images/`에서 사용자가 명시적으로 선택한 `LEGACY:SHA-256` 후보만 이관한다.
- 원본 SHA-256을 이관 직전에 다시 확인하고, 원본은 수정·이름 변경·이동하지 않는다.
- 관리 영역에는 별도 WebP 사본을 만들고, `LEGACY`, `promptUnavailable=true`, 원본 파일명·원본 SHA-256을 생성 이력에 보존한다.
- 프롬프트·모델 정보가 없는 원본에는 추정 프롬프트를 붙이지 않는다. export JSON에는 `LEGACY_ASSET_PROMPT_UNAVAILABLE`와 `LEGACY_ORIGINAL`을 명시한다.
- 이관 뒤에도 사람의 컷별 검수와 갤러리 메타데이터가 끝나기 전에는 내보내기를 허용하지 않는다.

## 변경 파일

- `prisma/schema.prisma`, `prisma/migrations/20260907023000_add_legacy_asset_import/migration.sql`
- `lib/legacy/import.ts`, `app/actions/legacy.ts`, `app/legacy/page.tsx`
- `app/projects/[id]/page.tsx`, `lib/image/generation.ts`, `lib/image/live-generation.ts`
- `docs/14_USER_GUIDE.md`

데이터 마이그레이션: `ImageAttempt`에 source·LEGACY 원본 참조 필드를 추가했다. 적용 전 백업 `data/backups/backup-20260906T172905Z-6553a6de`를 만들었다.

## 실제 검증

- 사용자가 선택한 과거 원본 10개를 이관했다.
- WebP 사본 10개가 모두 존재하며 DB의 SHA-256과 일치한다.
- 첫 이관 프로젝트에서 `LEGACY 원본 · 프롬프트 없음` 표시, 원본 해시, 이미지 미리보기, 사람 검수표, 내보내기 차단 상태를 브라우저로 확인했다.
- OpenAI Image API 호출: 0회.

## 검사 결과

| 검사 | 결과 |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test` | PASS — 11 파일, 25 테스트 |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS — 5 테스트 |

## 다음 사용자 작업

각 이관 프로젝트에서 실제 이미지의 대사·잘림·배치를 사람이 확인하고 검수표를 저장한다. 통과 뒤 slug·제목·imageAlt·해설을 저장하면 WebP와 JSON 묶음을 내보낼 수 있다.
