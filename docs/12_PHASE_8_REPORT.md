# Phase 8 — 운영 준비 및 최종 인수 보고

작성일: 2026-09-06  
실행 모드: OFF/MOCK  
비용 발생 OpenAI API 호출: 0회

## 구현한 요구사항

- F-020: DB·생성 원본·export의 안전한 백업 및 복원 후보 검증
- F-022: 데스크톱 및 좁은 화면의 핵심 흐름 검수
- REQ-20260906-002: Git 제외 규칙과 GitHub 기반 소스 관리의 운영 절차

## 이번 최종 인수에서 보완한 사항

E2E가 기존 3000번 개발 서버와 `data/app.db`를 재사용해 테스트 프로젝트를 남길 수 있음을 발견했습니다. 이제 `npm run test:e2e`는 실행 전 `data/e2e/app.db`만 새로 만들고, 저장소의 모든 Prisma migration SQL과 100개 용어 시드를 적용합니다. Playwright는 이 DB를 가진 3100번 production 서버를 사용하며, 기존 개발 서버와 운영 DB를 재사용하지 않습니다.

과거에 운영 DB에 남아 있던 E2E 데이터는 사용자 데이터와 구분할 근거가 충분하지 않아 삭제하지 않았습니다. 이후 테스트 실행은 해당 데이터에 추가로 기록하지 않습니다.

## 변경 파일

- `scripts/prepare-e2e.mjs`: Git 제외 E2E DB 생성, migration 적용, 용어 시드
- `playwright.config.ts`: 3100번 격리 서버와 전용 DB 환경 설정
- `package.json`: E2E 실행 전 격리 DB 준비 연결
- `docs/11_OPERATIONS_RUNBOOK.md`: E2E 데이터 분리 절차 추가
- 이 보고서

데이터 마이그레이션: 없음. 기존 migration 파일은 변경하지 않았습니다.

## 실행한 검사와 결과

| 검사 | 결과 |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test` | PASS — 10 파일, 23 테스트 |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS — 5 테스트, 격리 `data/e2e/app.db` 사용 |
| `npm run ops:backup` | PASS — `data/backups/backup-20260906T141709Z-2fa63836` 생성 |
| `npm run ops:restore:validate -- --backup data/backups/backup-20260906T141709Z-2fa63836` | PASS — 활성 DB 미변경 |

## 브라우저 검수

- 3000번 OFF 앱에서 서버 측 AI 비활성화와 MOCK 표식을 확인했습니다.
- 승인된 시나리오의 버전·프롬프트 옵션·생성 시도·검수 이력이 보존되어 표시됨을 확인했습니다.
- MOCK 결과의 WebP/JSON export 버튼이 차단됨을 확인했습니다.
- Playwright 좁은 화면 흐름에서 가로 넘침 없이 제작·내보내기 안내가 보임을 확인했습니다.
- 가장 최근 E2E의 프로젝트 두 건이 `data/e2e/app.db`에만 기록되며, 기존 3000번 운영 화면에는 새로 나타나지 않음을 확인했습니다.

## 발견 문제와 수정

- 문제: E2E가 운영 DB를 오염시킬 수 있었습니다.
- 수정: 테스트 전용 DB와 별도 포트·서버를 도입했습니다.
- 검증: 격리 DB에는 최신 E2E 프로젝트 2건과 용어 100건이 있고, 운영 앱은 테스트 실행 뒤에도 별도 데이터 집합을 표시했습니다.

## 남은 위험과 다음 단계

- 실제 LIVE 이미지 생성, 실제 이미지 품질 통과, 실제 WebP/JSON export는 사용자의 명시적 LIVE 호출 승인과 횟수·비용 상한이 있어야 검수할 수 있습니다.
- `data/app.db`에 과거 E2E 데이터가 남아 있을 수 있습니다. 삭제 또는 새 운영 DB 초기화는 사용자 확인 없이는 수행하지 않습니다.
- 문서상 정의된 구현 Phase는 Phase 8이 마지막입니다. 다음은 새 기능 Phase가 아니라 실제 제작 데이터로 제한된 LIVE 검수 또는 사용자가 승인한 신규 요구사항입니다.

Phase 8 진입/완료 판정: PASS. 운영 복원 훈련과 전체 OFF/MOCK 흐름이 통과했습니다.
