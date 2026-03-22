Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# DISCOVERY_PACKET.md

## 목적
Layer 1에서 수집한 프로젝트 진단 결과를 고정한다. 이 문서는 Vibe-HR에 대한 초기 하네스 설계의 출발점이며, Layer 2 Governance 설계의 입력 문서다.

## 프로젝트 요약
Vibe-HR은 한국형 EHR/HR 업무를 웹 기반으로 현대화하는 혼합형 레거시 전환 프로젝트다. [Observed][User-stated]

기술적으로는 Next.js + FastAPI + PostgreSQL 모노레포 구조를 사용하며, HR / ORG / TIM / PAYROLL / WEL / HRI / TRA 도메인을 단계적으로 재구성하고 있다. [Observed]

현재 핵심 과제는 화면 수를 늘리는 것이 아니라, 채용→사원→발령, 조직, 근태, 급여, 승인/복리후생 같은 업무 사이클을 운영 수준으로 닫는 것이다. [Derived]

## 확인된 사실
- 프로젝트명은 Vibe-HR이다. [Observed][User-stated]
- Frontend는 Next.js 16 / React 19 / TypeScript / AG Grid 35를 사용한다. [Observed]
- Backend는 FastAPI / SQLModel / PostgreSQL 중심 구조다. [Observed]
- 프론트/백엔드/문서가 하나의 repo 안에 있다. [Observed]
- `vibe-hr/AGENTS.md`에 AG Grid 규칙, 검증 규칙, planner-first 성격의 실행 계약이 존재한다. [Observed]
- `config/grid-screens.json`, `docs/GRID_SCREEN_STANDARD.md`, `docs/MENU_ACTION_PERMISSION_PLAN.md`가 핵심 기준 문서다. [Observed]
- `validate:grid`, lint, build, pytest, 일부 Playwright E2E가 존재한다. [Observed]
- solo 개발 단계이며 현재는 환경 분리 없이 `main` 단일 기준으로 운영한다. [User-stated]
- 외부 연동(SAP I/F 등)은 현재 범위 밖이며 프로젝트 완료 후 검토한다. [User-stated]

## 확인된 판단
- 프로젝트 유형은 혼합형이며, 레거시 전환이 중심이다. [Derived]
- 현재 성숙도는 4단계(계획-실행-검증 에이전트)에 가깝다. [Derived]
- 목표 성숙도는 5단계(멀티 에이전트 협업)다. [Proposal]
- 현재 도입 방향은 빠른 자율화보다 통제형 하네스 구축이 적절하다. [Derived]

## 현재 문제
- 화면과 기능은 늘어났지만 업무 사이클이 완전히 닫히지 않은 영역이 많다. [Derived]
- 메뉴 액션 권한, TIM 월마감, 급여 계산 코어, 데이터 정합성 도구가 주요 병목이다. [Observed]
- canonical 운영 문서 세트가 분산되어 있다. [Derived]
- completion evidence, task ledger, eval harness가 아직 없다. [Derived]

## 위험 구역 맵
### Auth / Permission
- 위험도: High [Derived]
- 이유: 로그인, 메뉴 권한, 액션 권한, 서버 권한 검증이 함께 얽혀 있다. [Observed][Derived]

### Billing / Financial
- 위험도: High [Derived]
- 이유: 급여/수당/보험/세율/월반영 등 금전 영향 도메인이 포함된다. [Observed][Derived]

### Data / Migration
- 위험도: High [Derived]
- 이유: seed, snapshot, backfill, 데이터 복구/정합성과 연결된다. [Observed][Derived]

### Infra / Deployment
- 위험도: High [Derived]
- 이유: 현재 `main` 기준 배포와 GitHub Actions deploy가 운영 영향으로 이어진다. [Observed][User-stated]

### Observability / Operations
- 위험도: Medium-High [Derived]
- 이유: 테스트는 일부 있으나 작업 단위 trace, 감사 기록, 실패 taxonomy가 없다. [Observed][Derived]

### Legacy Hotspots
- 위험도: High [Observed]
- 대표 hotspot:
  - 메뉴 액션 권한 [Observed]
  - TIM 월마감 [Observed]
  - 급여 계산 코어 [Observed]
  - 데이터 정합성/복구 도구 [Observed]

## 하네스 5요소 초기 갭 분석
### Guardrails
- 현재 상태: 부분적으로 존재 [Observed]
- 부족한 점: 승인 매트릭스, 위험도 공통 언어, 민감 경로 정의 [Derived]

### Plan & Spec
- 현재 상태: 계획/진행 문서는 많다. [Observed]
- 부족한 점: canonical source 구분이 없다. [Derived]

### Verification Loops
- 현재 상태: validate:grid / lint / build / pytest / 일부 E2E 존재 [Observed]
- 부족한 점: 작업 유형별 필수 검증 조합, 완료 증거 포맷 [Derived]

### Eval Harness
- 현재 상태: 미비 [Derived]
- 부족한 점: 성공률, 재시도율, rollback, review burden 기록 위치 부재 [Derived]

### Observability
- 현재 상태: lightweight 수준에도 미정리 [Derived]
- 부족한 점: Task Ledger, 감사 대상, 실패 분류, 배포 후 확인 기록 [Derived]

## 권장 운영 범위
**High-Control** [Proposal]

### 이유
- auth, permission, payroll, 개인정보, 배포가 모두 포함된다. [Observed][Derived]
- 레거시 parity가 미완료이며 hotspot이 남아 있다. [Observed]
- solo 개발 단계라 환경은 단순하지만, 잘못된 자동화가 `main` 운영에 직접 영향을 줄 수 있다. [User-stated][Derived]

## 승인 정책 초안 입력
- 승인 주체: 석 1인 [User-stated]
- AL0 / R0: 문서/분석/읽기/검증, 자동 허용 [Proposal]
- AL1 / R1: 국소적이고 되돌리기 쉬운 코드 변경, 자동 허용 + 검증 [Proposal]
- AL2 / R2: DB/API/권한/공통 규약 변경, 사전 승인 필요 [Proposal]
- AL3 / R3: 인증/급여 의미/배포/인프라/파괴적 데이터 변경, 명시 승인 + 계획 + 검증 필요 [Proposal]

## 최소 Observability 방향
다음이 최소 기준이다. [User-stated][Proposal]
- Task-level evidence 기록
- 필수 검증 결과 기록
- 배포 commit / 시각 / health 확인 가능 상태 유지
- 기본 애플리케이션 로그
- 권한/급여/데이터 복구 등 고위험 작업 감사 기록
- 실패 유형 분류 기준 유지

## 권장 최초 산출물
다음 문서를 우선 생성한다. [User-stated][Proposal]
1. `docs/harness/DISCOVERY_PACKET.md`
2. `docs/GOVERNANCE.md`
3. `docs/ARCHITECTURE.md`
4. `docs/TEST_STRATEGY.md`
5. `docs/TASK_LEDGER.md`

## 권장 최초 실행 범위
첫 pilot vertical slice는 아래 중 하나다. [Proposal]
- 후보 A: `채용합격자 -> 사원생성 -> 발령`
- 후보 B: `메뉴 액션 권한 3개 화면 시범 적용`

## Open Questions
- 첫 pilot을 어느 흐름으로 할지 `NEEDS_CONFIRMATION`
- AGENTS.md에 governance 요약을 어느 수준으로 반영할지 `NEEDS_CONFIRMATION`
- 향후 stage 환경이 필요해지는 시점 기준 `TBD`

## Layer 2로 넘긴 요약
- Governance Scope: High-Control [Proposal]
- Quality Band: C (8/15) [Derived]
- Automation Boundary: R0 자동 / R1 자동+검증 / R2 승인 / R3 명시 승인 [Proposal]
- 우선 도입 대상: canonical 문서 세트 + lightweight observability [Proposal]
