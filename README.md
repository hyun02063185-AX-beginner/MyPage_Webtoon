# 웹툰 생성기 V3 기획 패키지

이 폴더는 기존 노트북의 소스코드가 없어도 새 환경에서 웹툰 생성기를 처음부터 구축할 수 있도록 만든 전달 패키지다.

## 이 패키지의 목적

- 비공개 제작 도구인 웹툰 생성기를 새 저장소에서 구축한다.
- 결과물은 MyPage의 공개 갤러리에서 사용할 WebP 이미지와 JSON 데이터로 내보낸다.
- 시나리오, 실제 이미지 프롬프트, 모델, 생성 이력, 한글 검수 이력을 보존한다.
- 기획, 개발, 품질 검수, 운영·유지보수를 역할 기반 에이전트 구조로 진행한다.
- 나중에 추가되는 사용자 요구사항을 안전하게 반영할 수 있게 한다.

## 새 환경에서 시작하는 순서

1. 이 폴더의 내용 전체를 새 저장소 루트에 복사한다.
2. `docs/00_START_HERE.md`부터 번호 순서대로 읽는다.
3. 새 요구사항을 `docs/08_REQUIREMENTS_INBOX.md`의 사용자 추가 요구사항 영역에 붙인다.
4. `.env.example`을 참고해 `.env.local`과 `.env`를 만들되 API 키는 문서나 Git에 넣지 않는다.
5. Codex 또는 개발 에이전트에게 `docs/09_KICKOFF_PROMPT.md` 내용을 전달한다.
6. 에이전트는 Phase 0 상태 점검을 보고한 뒤에만 구현을 시작한다.

## 문서 구성

| 파일 | 역할 |
|---|---|
| `AGENTS.md` | 모든 에이전트가 지켜야 할 최상위 개발 규칙 |
| `.env.example` / `.gitignore` | 새 환경의 안전한 설정 예시와 비밀·생성물 제외 규칙 |
| `docs/00_START_HERE.md` | 문서 읽기 순서와 시작 절차 |
| `docs/01_MASTER_PLAN.md` | 서비스 목적, 범위, 핵심 의사결정 |
| `docs/02_FUNCTIONAL_SPEC.md` | 기능 요구사항과 사용자 흐름 |
| `docs/03_TECH_DATA_API.md` | 기술 구조, 데이터 모델, API, 내보내기 규격 |
| `docs/04_AGENT_OPERATING_MODEL.md` | 기획·개발·검수·운영 에이전트 협업 방식 |
| `docs/05_PHASE_PLAN.md` | 단계별 구현 및 완료 조건 |
| `docs/06_TEST_ACCEPTANCE.md` | 기능 검수 및 승인 체크리스트 |
| `docs/07_OPERATIONS_MAINTENANCE.md` | 운영, 백업, 장애 대응, 유지보수 규칙 |
| `docs/08_REQUIREMENTS_INBOX.md` | 사용자가 새 요구사항을 계속 추가하는 문서 |
| `docs/09_KICKOFF_PROMPT.md` | 새 환경에서 처음 실행할 시작 프롬프트 |
| `docs/11_OPERATIONS_RUNBOOK.md` | 새 환경 설치, 안전한 백업·임시 복원 검증, 장애 대응 |
| `templates/gallery-item.example.json` | MyPage 갤러리 전달 데이터 예시 |

## 현재 결정

- 기존 프로젝트를 그대로 복구하거나 패치하지 않는다.
- 새 구조로 시작하되, 나중에 기존 자산에 접근할 수 있으면 별도 가져오기 절차로 이관한다.
- 갤러리 자체는 웹툰이 충분히 모인 다음 MyPage에서 개발한다.
- 이 패키지는 기획과 작업 규칙만 제공하며 앱 코드는 포함하지 않는다.
