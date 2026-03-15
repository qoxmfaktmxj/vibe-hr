# Vibe-HR

## AI 개발 시작 전 필독 순서

1. `docs/DEVELOPMENT_PRECHECK.md`
2. `AGENTS.md`
3. `config/grid-screens.json`
4. `docs/GRID_SCREEN_STANDARD.md`
5. `docs/MENU_ACTION_PERMISSION_PLAN.md`
6. 작업 대상 화면의 `page.tsx`와 실제 컴포넌트 파일

## 프로젝트 개요

Vibe-HR은 한국어 업무 환경을 기본으로 하는 HR 현대화 프로젝트입니다. 단순 CRUD 중심이 아니라, 기존 EHR 흐름을 Next.js + FastAPI + PostgreSQL 구조로 재구성하면서 실제 운영 시나리오에 가까운 메뉴, 권한, 시드 데이터, 승인 흐름, 급여 계산 흐름을 단계적으로 붙이고 있습니다.

현재 기준으로 프로젝트의 핵심 목표는 아래와 같습니다.

- 한국형 조직/인사/근태/급여 운영 시나리오를 웹 기반으로 일관되게 제공
- 공통 Grid 패턴, 메뉴 권한, 샘플 시드, 문서화를 함께 운영
- 레거시 EHR 흐름을 기능 단위가 아니라 업무 사이클 단위로 재구성

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
- 급여 계산은 시각화와 일부 계산 로직은 있으나 레거시 수준의 계산 엔진 분해는 미완료
- 복리후생은 조회와 projection 중심이며 write workflow는 미완료

### 아직 본체가 닫히지 않은 영역

- TIM 월마감
- 급여 Run 대상자 snapshot / 발령 이벤트 판정 / 소득세 bracket master
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

- FastAPI 0.115
- SQLModel 0.0.22
- Pydantic Settings
- PyJWT
- psycopg 3
- Uvicorn

### Database / Infra

- PostgreSQL
- Docker + Nginx Reverse Proxy 전제 운영

### 품질 / 검증 도구

- ESLint
- Vitest
- pytest
- Playwright E2E (`npm run test:e2e:hr`)
- Grid 전용 검증 스크립트 `npm run validate:grid`

## 저장소 구조

```text
frontend/   Next.js App Router, 화면, API proxy, UI 컴포넌트
backend/    FastAPI, SQLModel, seed, 서비스 로직, 테스트
config/     Grid 화면 레지스트리 및 공통 설정
docs/       구현 계획, 점검 문서, 운영 메모
```

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

```bash
cd backend
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

### 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

기본적으로 프론트는 백엔드 API를 proxy 형태로 사용합니다. 서버사이드 호출과 route proxy는 아래 파일을 기준으로 동작합니다.

- `frontend/src/lib/server/backend-client.ts`
- `frontend/src/lib/server/route-proxy.ts`

## 환경 변수

### 백엔드 기본값 예시

`backend/.env`

```env
APP_NAME=Vibe-HR API
ENVIRONMENT=local
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/vibe_hr
CORS_ORIGINS=http://localhost:3000
AUTH_TOKEN_SECRET=dev-only-change-me
AUTH_TOKEN_ALGORITHM=HS256
AUTH_TOKEN_EXPIRES_MIN=480
AUTH_TOKEN_ISSUER=vibe-hr
```

### 프론트엔드 기본값 예시

`frontend/.env.local`

```env
API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
APP_ORIGIN=http://localhost:3000
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3000
```

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

- `https://hr.minosek91.cloud`

운영 또는 공유 URL은 실제 DNS, 방화벽, 프록시 상태에 따라 접근 가능 여부가 달라질 수 있습니다. 2026-03-14 현재 이 작업 환경에서는 `hr.minosek91.cloud` DNS 해석이 되지 않아 직접 접속 확인은 하지 못했습니다. 따라서 외부 공개 상태는 실제 배포 네트워크에서 별도 확인이 필요합니다.

## 계정 및 로그인 주의사항

문서상 기본 개발 계정은 아래와 같습니다.

- `login_id`: `admin`
- `password`: `admin`

다만 현재 로그인은 `ENTER_CD` 검증을 통과해야 하므로, 활성 법인(`OrgCorporation`) 데이터가 있어야 정상 로그인됩니다. 즉, 계정만 있어도 법인 seed가 비어 있으면 로그인은 실패합니다.

브라우저 로그인 문제 발생 시 아래를 먼저 확인합니다.

1. `OrgCorporation`에 활성 법인이 존재하는지
2. `/api/v1/auth/enter-cds`가 비어 있지 않은지
3. `admin` 또는 `admin-local` 계정이 존재하는지
4. 프론트 proxy가 `404`를 내면 `frontend/.env.local`의 `API_BASE_URL`이 `http://127.0.0.1:8000`인지

## 시드 데이터

FastAPI startup 시 `seed_initial_data()`가 자동 실행됩니다.

수동 재시드는 아래처럼 수행할 수 있습니다.

```bash
cd backend
set DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/vibe_hr
set PYTHONPATH=%CD%
python scripts/seed_dev_postgres.py
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

```bash
cd frontend
npm run validate:grid
npm run lint
npm run test
npm run test:e2e:hr
npm run build
```

### 백엔드 테스트

```bash
cd backend
.venv\Scripts\activate
pytest
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

## 현재 README 기준으로 추가 또는 수정이 필요한 내용

기존 README는 프로젝트 소개와 기본 실행법만 담고 있어 현재 상태를 설명하기에 부족합니다. 최소한 아래 내용은 항상 유지되어야 합니다.

- 현재 구현 범위와 미완료 범위
- 실제 사용 중인 기술 스택 상세
- 프론트 / 백엔드 / Grid 검증 / pytest 실행 방법
- 로컬 접속 URL과 공유 URL
- 로그인 실패 시 ENTER_CD / 법인 seed 확인 필요
- seed 데이터 규모와 대표 샘플 케이스
- 기준 운영 문서와 계획 문서 위치

특히 기존 README의 아래 내용은 그대로 두면 오해를 만들 수 있습니다.

- `admin / admin`만 적어두고 `ENTER_CD` 의존성을 설명하지 않은 점
- 시드가 항상 정상 로그인 상태를 보장한다고 읽히는 점
- 현재 구현된 화면 범위를 설명하지 않은 점
- 테스트 명령이 프론트 / 백엔드 기준으로 정리되어 있지 않은 점

## 현재 점검 메모

2026-03-14 로컬 점검 기준:

- DB는 기동 상태
- 백엔드 `/health` 응답 정상
- 프론트 `/login` 응답 정상
- 수동 `seed_initial_data()` 재실행 후 `OrgCorporation` 1건 확인
- `HrRecruitFinalist` 6건 확인
- `HrAppointmentOrder` 3건 / `HrAppointmentOrderItem` 3건 확인
- `admin / admin` 로그인 정상 확인
- `합격자 -> 사원 생성` API 실데이터 검증 완료
- 샘플 검증 결과: `RC-SEED-0001 -> EMP-900007 / emp900007 / 인사본부 / 채용대기 / leave`

즉, 채용-사원-발령 흐름을 점검할 수 있는 기본 시드는 현재 확보된 상태입니다. 다만 이 상태는 자동 startup만으로 항상 동일하게 보장된다고 단정하지 말고, 브라우저 점검 전에 `ENTER_CD`, 합격자, 발령 데이터가 실제로 존재하는지 한 번 더 확인하는 운영 습관이 필요합니다.

## 참고 문서

- `docs/VIBE_HR_PROGRESS_TODO_2026-03-14.md`
- `docs/ehr-legacy-business-flow-analysis.md`
- `docs/vibe-hr-modernization-gap-plan.md`
- `docs/vibe-hr-gap-matrix-execution-backlog.md`
- `docs/ehr-modernization-cycle-audit-2026-03-13.md`
- `docs/EMPLOYEE_MASTER_REFACTOR_PLAN.md`
