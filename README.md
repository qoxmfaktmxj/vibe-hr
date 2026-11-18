# Vibe-HR

## AI 개발 시작 전 필독 순서

1. `docs/DEVELOPMENT_PRECHECK.md`
2. `AGENTS.md`
3. `config/grid-screens.json`
4. `docs/GRID_SCREEN_STANDARD.md`
5. `docs/MENU_ACTION_PERMISSION_PLAN.md`
6. 작업 대상 화면의 `page.tsx`와 실제 컴포넌트 파일

## 프로젝트 개요

Vibe-HR은 한국어 업무 환경을 기본으로 하는 HR 현대화 프로젝트입니다. 기존 EHR 흐름을 Next.js, Rust, PostgreSQL로 구현하고 실제 운영 시나리오에 가까운 메뉴, 권한, 시드 데이터, 승인 흐름, 급여 계산 흐름을 단계적으로 붙이고 있습니다.

현재 기준으로 프로젝트의 핵심 목표는 아래와 같습니다.

- 한국형 조직/인사/근태/급여 운영 시나리오를 웹 기반으로 일관되게 제공
- 공통 Grid 패턴, 메뉴 권한, 샘플 시드, 문서화를 함께 운영
- 레거시 EHR 흐름을 기능 단위가 아니라 업무 사이클 단위로 재구성

## 현재 아키텍처 및 전환 상태

프론트엔드는 Next.js와 React, AG Grid를 사용합니다. BFF가 쿠키와 프록시를 담당하고 Rust 백엔드가 인증, 업무 권한, 트랜잭션, PostgreSQL 접근을 담당합니다. axum과 Tokio가 HTTP 요청을 처리하고, SQLx는 PostgreSQL에서 명시적인 쿼리를 실행합니다.

기존 스키마와 필수 참조 데이터는 Flyway V1부터 V7까지의 SQL로 관리합니다. Spring 코드는 비교 테스트의 기준으로 보존합니다. 운영 트래픽 전환은 별도 승인 대상입니다.

- [아키텍처와 도메인 책임](docs/ARCHITECTURE.md)
- [Spring 기준 범위와 Rust 검증 방법](docs/rust-migration/inventory.md)
- [기존 구현과 확인된 동작 차이](docs/rust-migration/business-differences.md)
- [채용 인터페이스 저장 순서 수정](docs/rust-migration/hr-differences.md)

## 초기 구현 범위 (2026년 3월)

### 현재 사용 가능한 영역

- 로그인 화면과 ENTER_CD 선택형 로그인 UI
- 대시보드
- 법인/조직 기본 조회
- 사원관리
- 채용 합격자관리
- 발령코드 / 발령처리관리
- 근무코드 / 휴일 / 스케줄 관련 일부 화면
- 복리후생 유형관리 / 신청현황
- HRI 신청 / 승인 / 수신 허브
- 급여 Run 조회와 대상자 상세 조회

### 부분 완료 영역

- `합격자 -> 사원 생성 -> 인사기본 -> 입사발령` 흐름은 기본 연결이 가능해졌으나, 발령 후속 시나리오와 브라우저 회귀 점검은 계속 필요
- 조직 메타데이터 가시화는 가능하나 조직개편 적용과 이력 반영은 미완료
- 급여 계산은 Run 대상자 snapshot, 발령/급여프로필 이벤트 판정, 소득세 bracket master, snapshot backfill 까지 들어왔지만 레거시 수준의 계산 엔진 분해는 미완료
- 복리후생은 조회와 projection 중심이며 write workflow는 미완료

### 아직 본체가 닫히지 않은 영역

- TIM 월마감
- 급여 계산 단계 분해 / 월마감 연계
- 연말정산 / 급여 마감취소
- 데이터 복구 / 정합성 도구
- 교육 본체
- 메뉴 액션 권한 UI 완성

이 절은 [2026년 3월 기능 검토](docs/VIBE_HR_PROGRESS_TODO_2026-03-14.md)의 기록입니다. 백엔드 전환 결과는 [작업 기록](docs/TASK_LEDGER.md)에서 확인합니다.

## 기술 스택

### Frontend

- Next.js 16 App Router
- React 19
- TypeScript
- AG Grid 35
- shadcn/ui
- Radix UI
- Tailwind CSS 4
- SWR
- Recharts
- date-fns
- react-day-picker
- xlsx
- lucide-react

### Backend

- Rust 2024 edition, Cargo
- axum, Tokio, Serde
- SQLx, PostgreSQL
- Flyway SQL 마이그레이션과 카탈로그 검증

### Database / Infra

- PostgreSQL
- Docker + Nginx Reverse Proxy 전제 운영

### 품질 / 검증 도구

- ESLint
- Vitest
- Cargo 테스트, Clippy, rustfmt
- Spring 비교용 JUnit 5와 Testcontainers
- Playwright E2E (`npm run test:e2e:hr`)
- Grid 전용 검증 스크립트 `npm run validate:grid`

## 저장소 구조

```text
frontend/   Next.js App Router, 화면, API proxy, UI 컴포넌트
backend-rust/   Rust API, 업무 로직, 데이터베이스 명령, 테스트
backend-spring/ Spring 비교 구현, 참조 테스트, 버전별 Flyway SQL
config/     Grid 화면 레지스트리 및 공통 설정
docs/       구현 계획, 점검 문서, 운영 메모
```

`docker-compose.deploy.yml`은 DB 사전 점검, Flyway 실행, 스키마 확인이 성공한 뒤 Rust 백엔드와 Next.js를 기동합니다. 외부 리버스 프록시는 별도로 구성합니다.

## UI 컬러 및 버튼 가이드

기준 팔레트:

- `https://coolors.co/3c6dee-7a9cec-0ea5e9-b95f89-cc2936`

색상 토큰 위치:

- `frontend/src/app/globals.css`

주요 색상:

- `--vibe-primary`: 조회 계열
- `--vibe-primary-light`: 보조 톤
- `--vibe-save`: 저장 / 확정
- `--vibe-action`: 화면 특수 액션
- `--vibe-warning`: 주의 동작
- `--destructive`: 삭제 / 위험 동작

버튼 variant 기준:

- `query`: 조회
- `save`: 저장
- `action`: 화면 특수 액션
- `warning`: 주의성 액션
- `outline`: 입력 / 복사 / 다운로드 / 업로드 / 템플릿
- `destructive`: 삭제

## 로컬 실행 방법

### 백엔드 실행

PowerShell 7에서 로컬 테스트 DB 연결 정보와 서로 다른 256비트 서명 키를 설정합니다. 개발 셸에 설정한 BFF 서명 키는 프론트의 BFF 환경에서도 같은 값이어야 합니다. 이미 Flyway V1부터 V7까지 검증된 DB라면 마지막 `cargo run --locked`로 서비스를 시작할 수 있습니다.

```powershell
cd backend-rust
$env:SPRING_DATASOURCE_URL = "jdbc:postgresql://127.0.0.1:5432/vibe_hr"
$env:SPRING_DATASOURCE_USERNAME = "postgres"
$env:SPRING_DATASOURCE_PASSWORD = "<local-password>"
$env:AUTH_TOKEN_SECRET = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:VIBEHR_BFF_ASSERTION_SECRET = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:VIBEHR_SCHEMA_OWNER = "flyway"
```

빈 로컬 데이터베이스를 준비한 뒤 아래 명령을 차례로 실행합니다. Flyway CLI와 PostgreSQL 드라이버가 필요합니다. SQL 파일과 매니페스트는 기존 경로를 사용합니다.

```powershell
cargo run --locked -- schema-preflight
if ($LASTEXITCODE) { throw "Schema preflight failed" }
$env:FLYWAY_URL = $env:SPRING_DATASOURCE_URL
$env:FLYWAY_USER = $env:SPRING_DATASOURCE_USERNAME
$env:FLYWAY_PASSWORD = $env:SPRING_DATASOURCE_PASSWORD
flyway "-locations=filesystem:../backend-spring/src/main/resources/db/migration" "-cleanDisabled=true" "-baselineOnMigrate=false" migrate
if ($LASTEXITCODE) { throw "Flyway migration failed" }
cargo run --locked -- schema-verify ../backend-spring/src/main/resources/db/migration/schema-metadata-manifest.json
if ($LASTEXITCODE) { throw "Schema verification failed" }
cargo run --locked
```

기본 바인딩은 `127.0.0.1:8080`입니다. `/health`와 `/api/v1/health`, `/actuator/health/readiness`에서 응답을 확인할 수 있습니다.

Docker Desktop에서 API를 확인하려면 저장소 루트에서 다음 명령을 실행합니다. 이 구성은 자체 PostgreSQL에 Flyway를 적용하고 카탈로그 검증이 통과하면 Rust 서버를 시작합니다. 앞에서 생성한 두 서명 키를 같은 셸에 설정해 둡니다.

```powershell
docker compose -p vibehr-dev -f docker-compose.rust-smoke.yml up --build --wait backend
$address = docker compose -p vibehr-dev -f docker-compose.rust-smoke.yml port backend 8080
$env:VIBEHR_BFF_BACKEND_URL = "http://$address"
Invoke-RestMethod "$env:VIBEHR_BFF_BACKEND_URL/api/v1/health"
```

### 프론트엔드 실행

```powershell
cd frontend
npm install
npm run dev
```

기본적으로 프론트는 백엔드 API를 proxy 형태로 사용합니다. 서버사이드 호출과 route proxy는 아래 파일을 기준으로 동작합니다.

- `frontend/src/lib/server/backend-client.ts`
- `frontend/src/lib/server/route-proxy.ts`

## 환경 변수

### 백엔드 기본값 예시

Rust 서버는 기존 운영 설정과 호환되는 PostgreSQL JDBC 환경 변수를 읽습니다. `SPRING_DATASOURCE_URL`이 설정되면 해당 URL과 사용자 이름, 암호를 사용합니다. 이 값이 없으면 SQLx 형식의 `DATABASE_URL`을 사용합니다.

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/vibe_hr
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=<local-password>
AUTH_TOKEN_SECRET=<openssl-rand-hex-32-output>
VIBEHR_BFF_ASSERTION_SECRET=<different-openssl-rand-hex-32-output>
CORS_ORIGINS=http://localhost:3000
```

### 프론트엔드 기본값 예시

`frontend/.env.local`

```env
VIBEHR_BFF_BACKEND_URL=http://127.0.0.1:8080
VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER=x-vibehr-client-ip
VIBEHR_BFF_ASSERTION_SECRET=<same-value-as-backend-VIBEHR_BFF_ASSERTION_SECRET>
APP_ORIGIN=http://localhost:3000
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3000
```

외부 리버스 프록시는 로그인 요청이 Next.js BFF에 도달하기 전에 클라이언트가 보낸 `x-vibehr-client-ip` 헤더를 제거하고, 신뢰할 수 있는 단일 값으로 다시 주입해야 합니다.

## 로그인 및 접속 경로

### 로컬 접속

- 로그인: `http://localhost:3000/login`
- 대시보드: `http://localhost:3000/dashboard`
- 사원관리: `http://localhost:3000/hr/employee`
- 채용합격자관리: `http://localhost:3000/hr/recruit/finalists`
- 발령처리관리: `http://localhost:3000/hr/appointment/records`
- 급여 Run: `http://localhost:3000/payroll/runs`
- 복리후생 신청현황: `http://localhost:3000/wel/requests`

### 공유 URL

- `https://hr.minseok91.cloud`

기준 배포 URL은 추적 중인 배포 설정과 일치합니다. 공개 사이트 주소는 `https://hr.minseok91.cloud`입니다.

## 계정 및 로그인 주의사항

문서상 기본 개발 계정은 아래와 같습니다.

- `login_id`: `admin`
- `password`: `admin`

다만 현재 로그인은 `ENTER_CD` 검증을 통과해야 하므로, 활성 법인(`OrgCorporation`) 데이터가 있어야 정상 로그인됩니다. 즉, 계정만 있어도 법인 seed가 비어 있으면 로그인은 실패합니다.

브라우저 로그인 문제 발생 시 아래를 먼저 확인합니다.

1. `OrgCorporation`에 활성 법인이 존재하는지
2. `/api/v1/auth/enter-cds`가 비어 있지 않은지
3. `admin` 또는 `admin-local` 계정이 존재하는지
4. 프론트 proxy가 `404`를 내면 `frontend/.env.local`의 `VIBEHR_BFF_BACKEND_URL`이 `http://127.0.0.1:8080`인지

## 시드 데이터

로컬 또는 dev 프로필의 루프백 데이터베이스에서만 실행합니다. 먼저 Flyway로 스키마와 필수 참조 데이터를 준비합니다. `seed dev dev`는 개발 관리자 두 명과 연결된 사원, 역할을 준비합니다.

```powershell
cd backend-rust
$env:SPRING_PROFILES_ACTIVE = "local"
$env:VIBEHR_ALLOW_FIXTURE_SEEDING = "true"
cargo run --locked -- seed dev dev
```

별도 테스트 사원이 필요하면 같은 환경에서 `cargo run --locked -- seed demo demo 10`을 실행합니다. 마지막 인수는 생성할 사원 수이며, 생략 시 기본값은 6000입니다.

## 테스트 방법

### 프론트엔드 정적 검증

```powershell
cd frontend
npm run validate:grid
npm run lint
npm run test
npm run test:e2e:hr
npm run build
```

### 백엔드 테스트

```powershell
cd backend-rust
cargo fmt --all -- --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
cargo build --release --locked
```

DB가 필요한 테스트는 격리 PostgreSQL에 fixture를 준비한 뒤 별도로 실행합니다. [테스트 전략](docs/TEST_STRATEGY.md)에 Rust 테스트, 기존 Spring 기준 테스트, 실제 BFF를 통과하는 브라우저 검증 조건을 정리했습니다.

### 브라우저 수동 테스트 권장 시나리오

#### 로그인

1. `/login` 진입
2. ENTER_CD 목록 확인
3. `admin` 로그인 시도
4. `/dashboard` 이동 확인

#### HR 흐름

1. `/hr/recruit/finalists`
2. 초안 또는 준비 상태 합격자 선택 후 `사번 채번`, `사원 생성` 실행
3. 같은 화면에서 `발령 이동` 실행
4. `/hr/appointment/records` 에서 사번 검색값이 자동 반영됐는지 확인
5. `입력`으로 첫 발령 초안을 만들고 저장
6. `/hr/employee` 와 `/hr/basic` 에서 후속 반영 흐름 확인

#### 급여 흐름

1. `/payroll/runs`
2. 현재월 / 전월 Run 존재 여부 확인
3. 대상자 상세와 항목 상세 확인

### 전환 검증

[현재 전환 목록](docs/rust-migration/inventory.md)은 Spring 컨트롤러의 실제 매핑과 실행 중인 서버가 제공한 OpenAPI를 기준으로 합니다. Rust 후보와 Spring 기준 서버를 동일한 fixture의 개별 PostgreSQL 복제본에 연결하고 HTTP 응답과 저장 상태를 비교합니다. 운영 검토에는 Spring을 종료한 상태의 실제 Next.js BFF 브라우저 결과와 [작업 기록](docs/TASK_LEDGER.md)의 미해결 항목도 함께 사용합니다.

## 참고 문서

- `docs/VIBE_HR_PROGRESS_TODO_2026-03-14.md`
- `docs/ehr-legacy-business-flow-analysis.md`
- `docs/vibe-hr-modernization-gap-plan.md`
- `docs/vibe-hr-gap-matrix-execution-backlog.md`
- `docs/ehr-modernization-cycle-audit-2026-03-13.md`
- `docs/EMPLOYEE_MASTER_REFACTOR_PLAN.md`
