# 운영 실행 안내서 — Phase 8

이 문서는 개인용 웹툰 제작 도구를 새 로컬 환경에서 설치하고, 안전 모드로 점검하며, DB·생성 원본·export를 백업하고 복원 후보를 검증하는 절차입니다. 공개 배포나 자동 복원은 범위에 포함하지 않습니다.

## 운영 원칙

- 기본 실행값은 `AI_GENERATION_ENABLED=false`, `AI_GENERATION_MODE=mock`입니다. LIVE 호출은 별도의 사용자 승인과 제한된 횟수·비용 범위가 있을 때만 허용합니다.
- API 키는 `.env.local`의 `OPENAI_API_KEY`에만 넣습니다. `.env.example`, 문서, 로그, Git에 키를 쓰지 않습니다.
- `data/`, `storage/`, `logs/`, `backup_images/`, `.env.local`은 Git 제외 대상입니다. `git status --ignored`로 확인할 수 있습니다.
- 운영 데이터와 과거 원본은 삭제·이름 변경·자동 이관하지 않습니다.

## 새 환경 설치

1. 지정 GitHub 저장소를 복제하고 루트에서 Node.js와 npm을 준비합니다.
2. `.env.example`을 참고해 `.env.local`을 새로 만듭니다. `DATABASE_URL`은 이 저장소 내부의 `data/app.db`를 가리켜야 하며, 기본 AI 설정은 OFF/MOCK으로 유지합니다.
3. 의존성과 Prisma 클라이언트를 설치·생성하고 빈 DB에 마이그레이션과 신규 100개 용어 시드를 적용합니다.

```powershell
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

4. 브라우저에서 `http://localhost:3000`을 열어 프로젝트 생성, 용어 검색, 시나리오 MOCK 흐름을 확인합니다. 실제 API 호출 없이도 검색·조회·MOCK 검수 흐름은 동작해야 합니다.

## 릴리스 전 검증

다음은 데이터 변경 없이 실행할 수 있는 전체 게이트입니다.

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

마이그레이션을 적용하기 전, LIVE 생성 또는 대량 이관 전에, 그리고 중요한 작업 종료 후에는 먼저 백업을 만듭니다.

## 백업

백업 전에 개발 서버와 다른 쓰기 작업을 중지합니다. DB는 SQLite online backup API로 읽기 전용 스냅샷을 만들지만, DB와 `storage/`가 같은 시점의 세트가 되도록 이미지 생성·export·이관 중에는 실행하지 않습니다.

```powershell
npm run ops:backup
```

명령은 `data/backups/backup-<UTC timestamp>-<unique id>/`에 다음을 새로 만듭니다.

```text
app.db
storage/                 # 존재하는 원본·WebP·export만 복사
storage-manifest.json    # 파일 경로·크기·SHA-256
checksums.txt
```

기존 백업, 실행 DB, `storage/`, 원본 이미지는 덮어쓰지 않습니다. 백업 중 실패하면 해당 명령이 새로 만든 임시 폴더만 정리하며, 이전 백업은 그대로 둡니다. 최소 최근 5개는 보관하고, 보관 기간은 로컬 저장 용량에 맞춰 사람이 결정합니다.

## 복원 후보 검증

복원은 두 단계로 분리합니다. 먼저 아래 명령으로 **선택한 백업을 임시 위치에서만** 검증합니다. `--backup`에는 `data/backups` 내부의 폴더만 지정할 수 있습니다.

```powershell
npm run ops:restore:validate -- --backup data/backups/backup-YYYYMMDDTHHMMSSZ-xxxxxxxx
```

검증기는 다음을 수행합니다.

- manifest의 모든 파일 경로·크기·SHA-256 확인
- `data/restore-validation/validate-.../restored/app.db`에만 DB 사본 생성
- 복원 사본의 SQLite `integrity_check`, 외래 키 검사, 필수 테이블 확인
- export JSON이 존재하면 기본 갤러리 필드·UTF-8 JSON을 확인
- 실행 중인 `data/app.db`의 실행 전후 SHA-256 비교

검증 보고서는 `data/restore-validation/validate-.../validation-report.json`에 남습니다. 이 폴더도 Git 제외 대상입니다. 이 명령은 실행 DB·기존 `storage/`·기존 백업을 절대 복원하거나 덮어쓰지 않습니다.

실제 운영 경로 전환은 자동화하지 않습니다. 검증이 `PASS`인 경우에만 다음을 사람이 수행합니다: 앱 쓰기 중지, 현재 `data/`와 `storage/`를 별도 안전 위치에 보존, 대상 백업의 DB·storage를 새 운영 경로로 전환, 앱을 OFF/MOCK으로 기동, 프로젝트 조회·이미지 경로·export JSON을 다시 확인합니다. 전환 실패 시 보존한 직전 세트로 되돌립니다.

## 장애와 업데이트

- OpenAI 오류·속도 제한: 생성 시도 상태와 안전한 오류 코드를 확인하고 무한 재시도하지 않습니다. 검색·기존 프로젝트 조회는 계속 가능해야 합니다.
- DB·파일 불일치: export를 중지하고 최신 백업의 `storage-manifest.json`과 현재 파일을 비교합니다. 원본을 삭제하지 않습니다.
- 중복 생성 의심: 생성 잠금, 멱등성 키, 시작 시각, 이미지 생성 이력을 비교합니다. 결과를 삭제하지 않고 검토합니다.
- 패키지·마이그레이션 변경: 먼저 백업, 전체 검증, 임시 DB에서 마이그레이션 검토, OFF/MOCK 브라우저 흐름 확인 순서로 진행합니다.

## Phase 8 검수 기록

- 관련 기능: F-020, REQ-20260906-002
- 자동 검증: `npm run test`의 backup manifest 단위 검증 및 전체 lint/typecheck/E2E/build 게이트
- 수동 운영 검증: 새 백업 생성 → 해당 백업의 임시 복원 검증 → 활성 DB SHA-256 불변 확인
- 비용 발생 API 호출: 0회
- 알려진 제한: 실제 LIVE 이미지 생성과 실제 운영 경로 전환은 사용자 승인 없이 실행하지 않는다. 자동 복원은 의도적으로 제공하지 않는다.
