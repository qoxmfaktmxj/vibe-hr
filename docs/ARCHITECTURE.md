Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# ARCHITECTURE.md

## 목적
이 문서는 Vibe-HR의 현재 시스템 구조를 하네스 운영 관점에서 요약한다. 구현 세부를 모두 복제하지 않고, 작업 분해·영향도 판단·위험 구역 식별에 필요한 수준의 구조만 다룬다.

## 시스템 개요
- 시스템 목적: 한국형 EHR/HR 업무를 웹 기반으로 현대화한다. [Observed]
- 주요 사용자:
  - 인사담당자 [Derived]
  - 조직/근태 운영자 [Derived]
  - 급여 담당자 [Derived]
  - 승인자 [Derived]
  - 시스템 관리자 [Derived]
- 핵심 도메인:
  - HR [Observed]
  - ORG [Observed]
  - TIM [Observed]
  - PAYROLL [Observed]
  - WEL [Observed]
  - HRI [Observed]
  - TRA [Observed]

## 서비스/컨테이너 맵
### Frontend
- 기술: Next.js 16 App Router + React 19 + TypeScript [Observed]
- 주요 위치:
  - `frontend/src/app` — route/page entrypoints [Observed]
  - `frontend/src/components` — 화면/공통 컴포넌트 [Observed]
  - `frontend/src/components/grid` — AG Grid 공통 UI [Observed]
  - `frontend/src/lib/grid` — Grid 공통 로직 [Observed]
- 역할: 사용자 화면, route proxy, shared UI rendering [Observed][Derived]

### Backend
- 기술: FastAPI + SQLModel [Observed]
- 주요 위치:
  - `backend/app/main.py` — 앱 진입점 [Observed]
  - `backend/tests` — 백엔드 테스트 [Observed]
  - `backend/scripts` — seed 및 보조 스크립트 [Observed]
- 역할: 인증, 도메인 로직, 데이터 조회/저장, seed 및 운영 보조 [Derived]

### Database
- 기술: PostgreSQL [Observed]
- 역할: 조직/인사/근태/급여/권한 관련 운영 데이터 저장 [Derived]

### External Systems
- 현재 범위: 명시적 외부 시스템 연동 없음 [User-stated]
- 향후 가능성: SAP I/F 등은 후속 단계에서 검토 [User-stated]

## Repo 구조 요약
```text
frontend/   Next.js App Router, UI, route proxy, grid screens
backend/    FastAPI, SQLModel, services, tests, scripts
config/     grid registry 및 공통 설정
docs/       계획, 실행 기준, 운영 문서
```

## 레이어 모델
### Presentation
- Next.js page/component
- AG Grid 기반 관리 화면
- 로그인/대시보드/업무 화면

### Application
- 화면별 액션 처리
- API 호출 orchestration
- 검증/저장/조회 흐름 연결

### Domain
- HR / ORG / TIM / PAYROLL / WEL / HRI / TRA 도메인 규칙
- 메뉴 권한 / 액션 권한 / 승인 흐름

### Infrastructure
- PostgreSQL
- FastAPI runtime
- GitHub Actions deploy
- Docker Compose 기반 배포 구조 [Observed]

> 위 레이어 구분은 하네스/설계 관점의 추상화이며, 실제 코드 구조와 1:1 일치 여부는 추가 검증이 필요할 수 있다. [Derived]

## 도메인 경계
### HR
- 사원, 인사기본, 채용 합격자, 발령 관련 흐름 [Observed]
- 핵심 cycle: `합격자 -> 사원 생성 -> 발령` [Observed]

### ORG
- 법인/조직/부서/조직 이력/조직개편 [Observed]
- hotspot: 조직개편 적용 및 이력 반영 [Observed]

### TIM
- 근무코드, 휴일, 근무조, 연차, 상태, 월마감 [Observed]
- hotspot: TIM 월마감 [Observed]

### PAYROLL
- 급여 코드, 항목 그룹, 수당/공제 항목, 세율, payment schedule, payroll run [Observed]
- hotspot: 계산 코어, 연말정산/마감취소 [Observed]

### WEL
- 복리후생 유형, 신청현황, projection 중심 기능 [Observed]
- hotspot: write workflow 미완료 [Observed]

### HRI
- 신청/승인/수신 허브 [Observed]
- WEL과 일부 연결됨 [Observed]

### TRA
- 교육 관련 화면/자원 일부 [Observed]
- 본체 workflow는 미완료 [Observed]

## 주요 데이터/업무 흐름
### 1) 로그인 흐름
1. 사용자가 `/login` 진입 [Observed]
2. `ENTER_CD` 선택 + 계정 로그인 [Observed]
3. 인증 성공 시 대시보드/업무 화면 접근 [Observed]

### 2) 채용 → 사원 → 발령 흐름
1. 채용 합격자 관리 화면에서 대상 선택 [Observed]
2. 사번 채번 / 사원 생성 [Observed]
3. 발령 화면으로 이동 [Observed]
4. 첫 발령 초안 작성/저장/확정 [Observed]
5. 사원/인사기본 후속 반영 확인 [Observed][Derived]

### 3) 메뉴/액션 권한 흐름
1. 로그인/권한 로드 시 메뉴 + 액션 권한 수신 [Observed]
2. 화면은 `allowedActions` 기준으로 버튼을 표시/비표시 또는 비활성 처리 [Observed]
3. 서버는 저장/업로드/다운로드 등 액션별 권한 검증 수행 [Observed]

### 4) 급여 흐름
1. Payroll Run 목록/대상자 조회 [Observed]
2. snapshot 및 이벤트 기준 계산 요소 생성 [Observed]
3. 급여 항목/세율/보험/복리후생 반영 [Observed]
4. 상세 확인 및 검증 [Observed][Derived]

## 공통 규약
### AG Grid 화면 규약
다음 조건을 모두 만족하면 AG Grid 화면으로 본다. [Observed]
1. `AgGridReact` 사용
2. page 파일에 `GRID_SCREEN` 메타데이터 선언
3. `config/grid-screens.json` 등록

필수 규약:
- 공통 grid 모듈 사용 [Observed]
- toolbar 순서 준수 [Observed]
- dirty row 보호 [Observed]
- pagination-ready API 계약 [Observed]
- 수정 시 `npm run validate:grid` 선행 [Observed]

### 화면/백엔드 변경 규약
- Frontend는 `frontend/*`, Backend는 `backend/*` 경계를 기본으로 한다. [Observed]
- API contract 변경 시 프론트 화면과 백엔드 schema/route 영향을 함께 적는다. [Observed]
- 메뉴/액션/권한 관련 작업은 `docs/MENU_ACTION_PERMISSION_PLAN.md`와 함께 확인한다. [Observed]
- 큰 refactor는 화면/endpoint/도메인 단위로 쪼갠다. [Observed]

## 의존성 규칙
### 허용되는 방향
- page → component → shared grid/ui/util [Derived]
- frontend → backend API contract 소비 [Derived]
- backend service → database [Derived]

### 금지하거나 주의할 방향
- 개별 화면이 공통 Grid 계약을 우회하는 것 [Observed][Derived]
- UI 비노출만으로 보안을 대체하는 것 [Observed]
- 큰 레거시 영역을 characterization 없이 한 번에 갈아엎는 것 [Derived]
- 승인 없이 auth/payroll/deploy/data repair에 진입하는 것 [Derived]

## Cross-Cutting Concerns
### Authorization
- 메뉴 권한은 이미 존재 [Observed]
- 액션 권한은 설계/도입 중 [Observed]
- 서버 검증이 필수이며, UI 상태만으로 보안을 판단하지 않는다. [Observed]

### Validation
- Grid standard 검증 [Observed]
- lint/build/pytest/일부 E2E [Observed]
- 작업 유형별 검증 규칙은 `docs/TEST_STRATEGY.md`를 따른다.

### Logging / Observability
- 현재 기준은 lightweight 방향이다. [User-stated][Derived]
- 작업 단위 증거와 감사 기록은 `docs/TASK_LEDGER.md` 기준으로 관리한다. [Proposal]

### Error Handling
- 세부 표준은 `NEEDS_CONFIRMATION`
- 다만 고위험 흐름은 실패 시 rollback/중단 기준이 plan 단계에서 먼저 정의돼야 한다. [Proposal]

## 레거시 Hotspots
- 메뉴 액션 권한 end-to-end 닫기 [Observed]
- TIM 월마감 [Observed]
- 급여 계산 코어 및 마감취소 [Observed]
- 조직개편 적용/이력 [Observed]
- 데이터 복구 / 정합성 도구 [Observed]

## 변경 시 주의점
### 공개 계약 영향
- API contract 변경 시 소비 화면/테스트/문서 동시 확인 필요 [Observed][Derived]

### 데이터 영향
- seed/backfill/schema/data repair는 R3로 본다. [Derived]

### 운영 영향
- 현재 `main` 단일 배포이므로 workflow/infra 변경은 운영 영향이 즉시 발생할 수 있다. [User-stated][Derived]

### 테스트 영향
- 공유 Grid/권한/급여 흐름 수정은 최소 1개 이상의 회귀 검증이 필요하다. [Observed][Derived]

## 확인 필요 지점
- backend 내부 세부 계층(service/router/model) 의존 방향의 명시적 규칙 `NEEDS_CONFIRMATION`
- queue/cache 사용 여부 `Missing`
- observability 런타임 구현 상세 `Missing`
- 외부 연동 상세는 현재 범위 밖 [User-stated]
