# Vibe-HR

## AI 개발 시작 전 필독 순서

1. `docs/DEVELOPMENT_PRECHECK.md`
2. `AGENTS.md`
3. `config/grid-screens.json`
4. `docs/GRID_SCREEN_STANDARD.md`
5. `docs/MENU_ACTION_PERMISSION_PLAN.md`
6. 작업 대상 화면의 `page.tsx`와 실제 컴포넌트 파일

## 프로젝트 개요

Vibe-HR은 한국어 업무 환경을 기본으로 하는 HR 현대화 프로젝트입니다. 단순 CRUD 중심이 아니라, 기존 EHR 흐름을 Next.js + Spring Boot + PostgreSQL 구조로 재구성하면서 실제 운영 시나리오에 가까운 메뉴, 권한, 시드 데이터, 승인 흐름, 급여 계산 흐름을 단계적으로 붙이고 있습니다.

현재 기준으로 프로젝트의 핵심 목표는 아래와 같습니다.

- 한국형 조직/인사/근태/급여 운영 시나리오를 웹 기반으로 일관되게 제공
- 공통 Grid 패턴, 메뉴 권한, 샘플 시드, 문서화를 함께 운영
- 레거시 EHR 흐름을 기능 단위가 아니라 업무 사이클 단위로 재구성

## 현재 아키텍처 및 전환 상태

- 백엔드 코드베이스는 Java 21 + Spring Boot 4.1.0 단일 런타임으로 전환되었습니다.
- 일반적인 쓰기와 엔티티 생명주기는 JPA가 담당하고, 조인·보고서·성능상 명시적 SQL이 필요한 복잡한 읽기 projection만 MyBatis를 사용합니다.
- Flyway V1-V5가 스키마와 필수 참조 데이터의 유일한 작성 경로이며, Next.js BFF는 Spring API만 대상으로 합니다.
- Python 런타임과 소스는 은퇴되었습니다. 이전 기술명은 보존된 전환 증적에서만 확인할 수 있으며 실행 지침이 아닙니다.

코드베이스 전환은 완료되었지만, 프로덕션 트래픽 전환과 운영 데이터베이스 컷오버는 아직 별도의 운영자 작업입니다. 실행 전에는 반드시 [컷오버 런북](docs/spring-migration/CUTOVER_RUNBOOK.md)을 따르십시오.

- [Spring 백엔드 실행 및 검증 안내](backend-spring/README.md)
- [Spring Boot Java 전환 계획](docs/SPRING_BOOT_JAVA_MIGRATION_PLAN.md)
- [Java/Spring 학습 가이드](backend-spring/docs/java-spring-learning-guide.md)
- [Spring 컷오버 런북](docs/spring-migration/CUTOVER_RUNBOOK.md)

## 현재 구현 범위

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

현재 작업 진척도는 [docs/VIBE_HR_PROGRESS_TODO_2026-03-14.md](docs/VIBE_HR_PROGRESS_TODO_2026-03-14.md)를 기준 문서로 삼습니다.

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

- Spring Boot 4.1.0
- Java 21
- Spring MVC / Spring Security
- 일반 쓰기는 JPA / 복잡한 읽기 projection은 MyBatis
- Flyway
- Gradle

Spring Boot가 유일한 백엔드 런타임이며, Flyway가 스키마와 필수 참조 데이터의 유일한 작성 경로입니다.

### Database / Infra

- PostgreSQL
- Docker + Nginx Reverse Proxy 전제 운영

### 품질 / 검증 도구

- ESLint
- Vitest
- JUnit 5
- Playwright E2E (`npm run test:e2e:hr`)
- Grid 전용 검증 스크립트 `npm run validate:grid`

## 저장소 구조

```text
frontend/   Next.js App Router, 화면, API proxy, UI 컴포넌트
backend-spring/ Spring Boot, JPA/MyBatis, Flyway, seed, 서비스 로직, 테스트
config/     Grid 화면 레지스트리 및 공통 설정
docs/       구현 계획, 점검 문서, 운영 메모
```

프로덕션 배포는 `docker-compose.deploy.yml`로 Spring 백엔드, Next.js 프론트엔드, 리버스 프록시를 함께 구성합니다.

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

```powershell
cd backend-spring
$env:SPRING_DATASOURCE_URL = "jdbc:postgresql://localhost:5432/vibe_hr"
$env:SPRING_DATASOURCE_USERNAME = "postgres"
$env:SPRING_DATASOURCE_PASSWORD = "<local-password>"
$env:AUTH_TOKEN_SECRET = "<openssl-rand-hex-32-output>"
$env:VIBEHR_BFF_ASSERTION_SECRET = "<different-openssl-rand-hex-32-output>"
.\gradlew.bat bootRun --args="--spring.profiles.active=local"
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

Spring Boot는 로컬 백엔드 설정을 환경 변수에서 읽습니다. 전체 로컬 프로필과 검증 명령은 [백엔드 안내](backend-spring/README.md)를 확인하십시오.

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
VIBEHR_BFF_ASSERTION_SECRET=<same-value-as-backend-VIBEHR_BFF_ASSERTION_SECRET>
APP_ORIGIN=http://localhost:3000
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3000
```

외부 리버스 프록시는 BFF 로그인 요청이 Spring에 도달하기 전에 클라이언트가 보낸 `x-vibehr-client-ip` 헤더를 제거하고, 신뢰할 수 있는 단일 값으로 다시 주입해야 합니다.

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

Spring fixture 시드는 자동 실행되지 않으며, 로컬에서만 명시적으로 실행합니다.

수동 재시드는 아래처럼 수행할 수 있습니다.

```powershell
cd backend-spring
$env:VIBEHR_ALLOW_FIXTURE_SEEDING = "true"
.\gradlew.bat bootRun --args="--spring.profiles.active=local,dev-seed --vibehr.seed.confirmation=dev"
```

의도된 seed 범위는 아래와 같습니다.

- `admin`, `admin-local` 계정 보장
- 메뉴 / 권한 / 공통코드 초기화
- 대량 한국어 더미 직원 데이터
- 조직 / 근태 / 급여 / 복리후생 / 교육 / HRI 샘플 데이터
- 현재월 / 전월 급여 Run
- 복리후생 반영용 샘플 케이스
- 채용 합격자 -> 발령 흐름용 샘플 데이터

현재 운영 문서 기준 대표 샘플 케이스:

- 6000명 기준 직원 / 근태 / 급여 / 복리후생 / 교육 / HRI 데이터
- 현재월 복리후생 고정 샘플 5건
- 급여 상세 확인용 수당 샘플
- `HR-0001 MLA 130000`
- `KR-0004 POS 150000`
- `KR-0004 OTX 125000`
- `KR-0008 NGT 70000`

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
cd backend-spring
.\gradlew.bat test

# Docker Desktop가 실행 중이어야 합니다.
$env:VIBEHR_RUN_CONTAINER_TESTS = "true"
.\gradlew.bat integrationTest
.\gradlew.bat migrationIntegrationTest
```

현재 저장소에는 아래와 같은 백엔드 테스트가 포함되어 있습니다.

- 인증 서비스 단위 테스트
- bootstrap seed 단위 테스트
- 공통코드 서비스 테스트
- 사원 커맨드 서비스 테스트
- HRI 승인 / 신청 라우트 테스트
- 복리후생 projection 테스트
- 조직 서비스 테스트
- 급여 phase2 서비스 테스트
- TIM 스케줄 서비스 테스트

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

### 전환 완료 검증

저장소 루트에서 전환 정합성을 확인합니다.

```powershell
node scripts/spring-migration/spring-route-coverage.js --verify-complete
node scripts/spring-migration/spring-schema-coverage.js
node scripts/spring-migration/flyway-verify.js
node scripts/spring-migration/bff-cutover-audit.js
node scripts/spring-migration/verify-python-retirement.js
node scripts/spring-migration/verify-delivery.js
node --test scripts/spring-migration/*.test.js
```

전환 완료 시점의 검증 스냅샷은 다음과 같습니다. 이는 코드베이스 전환 검증 결과이며, 프로덕션 배포 또는 운영 데이터베이스 컷오버 완료를 뜻하지 않습니다.

- 백엔드: 253개 테스트 통과 (단위 176개, 통합 59개, `migrationIntegrationTest` 18개)
- 프론트엔드: 139개 테스트 통과
- 전환 검증기: 30개 테스트 통과
- API 경로: 290/290 확인
- 스키마 참조 테이블: 105/105 매핑 확인
- `.py` 파일과 활성 Python 호출: 각 0개

실제 트래픽 전환 전에는 [컷오버 런북](docs/spring-migration/CUTOVER_RUNBOOK.md)의 Flyway adoption, `flyway-cutover`, 스모크 및 롤백 절차를 운영자가 수행해야 합니다.

## 참고 문서

- `docs/VIBE_HR_PROGRESS_TODO_2026-03-14.md`
- `docs/ehr-legacy-business-flow-analysis.md`
- `docs/vibe-hr-modernization-gap-plan.md`
- `docs/vibe-hr-gap-matrix-execution-backlog.md`
- `docs/ehr-modernization-cycle-audit-2026-03-13.md`
- `docs/EMPLOYEE_MASTER_REFACTOR_PLAN.md`
