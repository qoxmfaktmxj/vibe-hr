<!-- IMMUTABLE PRE-CUTOVER ARCHIVE: historical FastAPI/Alembic evidence only; not an executable Spring operating instruction. -->

> **IMMUTABLE PRE-CUTOVER ARCHIVE - NON-EXECUTABLE**
>
> Entries that reference the retired runtime are immutable pre-cutover evidence. Do not run, restore, or update their legacy commands or paths. Record current work with Spring-only commands and `backend-spring/**` paths.

Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# TASK_LEDGER.md

## 목적
이 문서는 Vibe-HR에서 작업 단위 evidence를 남기는 최소 기록 장치다. 목표는 모든 세부 로그를 영구 보관하는 것이 아니라, 나중에 다음 질문에 답할 수 있게 만드는 것이다.

- 왜 이 작업을 했는가?
- 어떤 파일이 바뀌었는가?
- 위험도는 무엇이었는가?
- 어떤 검증을 했는가?
- 무엇이 아직 남아 있는가?
- 실패/재시도/승인 필요가 있었는가?

## 적용 범위
### 필수
- 모든 R2 / R3 작업 [Proposal]
- 모든 vertical slice 작업 [Proposal]
- 권한, 급여, 데이터 정합성, 배포 관련 작업 [Proposal]

### 강력 권장
- 모든 R1 작업 [Proposal]

### 선택
- 순수 문서 작업(R0) [Proposal]

## 저장 원칙
- 현재 단계에서는 별도 시스템을 만들지 않고 이 문서를 append/update 방식으로 사용한다. [Proposal]
- 필요해지면 이후 `docs/task-ledger/` 디렉토리 또는 structured format(JSON/CSV/DB)로 분리할 수 있다. `TBD`
- 비밀값, 자격증명, 민감한 raw 데이터는 기록하지 않는다. [Proposal]

## 최소 기록 필드
각 작업은 최소 아래를 남긴다.
- Task ID
- Date
- Title
- Mode
- Risk Class
- Approval Status
- Scope
- Changed Files
- Commands Run
- Verification Summary
- Result
- Remaining Risks
- Follow-ups

## 상태값
- `planned`
- `in_progress`
- `blocked`
- `completed`
- `rolled_back`
- `cancelled`

## 승인 상태값
- `not_required`
- `requested`
- `approved`
- `denied`

## 실패 분류(Failure Taxonomy)
최소한 아래 분류를 사용한다. [Proposal]
- `build_failure`
- `test_failure`
- `runtime_error`
- `permission_error`
- `data_integrity_error`
- `payroll_logic_mismatch`
- `deploy_failure`
- `unknown`

## 기록 템플릿
```md
## TASK <ID> — <TITLE>
- Date: YYYY-MM-DD
- Status: planned | in_progress | blocked | completed | rolled_back | cancelled
- Mode: Discovery | Blueprint | Artifact Generation | Execution | Review / Hardening | Incident / Hotfix
- Risk Class: R0 | R1 | R2 | R3
- Approval Status: not_required | requested | approved | denied
- Owner: TBD

### Goal
- 이번 작업의 목표

### Scope
- 포함 범위

### Non-Scope
- 제외 범위

### Inputs / Sources
- 참조 문서
- 관련 파일
- 근거 태그가 필요한 판단

### Changed Files
- `path/to/file`

### Commands Run
- `command 1`
- `command 2`

### Verification Summary
- 수행 검증
- 생략 검증과 이유

### Result
- 완료/실패/부분 완료 요약

### Failure / Retry Notes
- 실패 분류
- 재시도 여부
- 원인 요약

### Remaining Risks
- 남아 있는 위험

### Follow-ups
- 다음 액션
```

## Completion Evidence 규칙
완료로 표시하려면 최소한 아래가 있어야 한다. [Proposal]
- 목표가 무엇이었는지
- 실제 변경 파일이 무엇인지
- 어떤 검증을 실행했는지
- 실행하지 못한 검증이 있다면 왜 그런지
- 남은 리스크가 무엇인지

## Metrics Derivation
다음 평가는 이 문서 기반으로 계산 가능해야 한다. [Proposal]
- 작업 성공률
- 테스트 통과율
- 재시도율
- rollback 비율
- 실패 분류 빈도
- 리뷰 부담(남은 리스크/후속 액션 수 기반 추정)

현재는 측정 정의만 두고, 실제 집계 자동화는 나중에 설계한다. [User-stated]

## 작업 단위 기준
작업 단위는 너무 크지도 작지도 않게 잡는다. [Proposal]
권장 단위:
- 화면 1개
- API/엔드포인트 1개 묶음
- 권한 흐름 1개
- vertical slice 1개
- 문서 팩 1개

비권장 단위:
- repo 전체 정리
- 도메인 전체 재작성
- 목적이 섞인 대형 작업 1건으로 뭉치기

## R2/R3 추가 기록 항목
R2 또는 R3는 아래를 추가한다. [Proposal]
- 승인 요청/승인 근거
- 영향 범위
- rollback 또는 중단 조건
- 민감 데이터/권한/배포 영향 여부

## Hotfix 기록 규칙
Incident / Hotfix는 반드시 아래를 포함한다. [Proposal]
- 왜 긴급 모드였는지
- 어떤 우회가 들어갔는지
- 사후 정리 필요 항목
- 정상 모드 문서 반영 필요 여부

## 첫 기록 예시
```md
## TASK VH-HARNESS-001 — Core canonical docs bootstrap
- Date: TBD
- Status: planned
- Mode: Artifact Generation
- Risk Class: R0
- Approval Status: approved
- Owner: 석

### Goal
- DISCOVERY_PACKET, GOVERNANCE, ARCHITECTURE, TEST_STRATEGY, TASK_LEDGER 초안을 생성한다.

### Scope
- canonical 문서 5개 생성

### Non-Scope
- tool-specific adapter 생성
- CI/배포 수정
- 코드 구현 변경

### Inputs / Sources
- docs/harness/DISCOVERY_PACKET.md
- docs/GOVERNANCE.md
- README.md
- AGENTS.md

### Changed Files
- docs/harness/DISCOVERY_PACKET.md
- docs/GOVERNANCE.md
- docs/ARCHITECTURE.md
- docs/TEST_STRATEGY.md
- docs/TASK_LEDGER.md

### Commands Run
- TBD

### Verification Summary
- 문서 구조 및 canonical 범위 확인

### Result
- TBD

### Failure / Retry Notes
- None

### Remaining Risks
- pilot vertical slice 미확정
- Layer 4 adapter 미정

### Follow-ups
- Layer 4 tool adapter 설계
```

## TASK VH-PILOT-001 — Menu action permission pilot bootstrap and server enforcement
- Date: 2026-03-22
- Status: completed
- Mode: Execution
- Risk Class: R2
- Approval Status: approved
- Owner: 석

### Goal
- 3개 pilot 화면(`hr.employee`, `org.departments`, `settings.common-codes`)에 대한 메뉴 액션 권한 pilot의 실행 기준을 고정하고, 서버 enforcement를 pilot 범위까지 연결한다.

### Scope
- execution plan 생성
- Layer 5 execution protocol 문서 추가
- Layer 6 eval summary skeleton 추가
- backend action permission helper 추가
- employee / organization(departments) / common-code API에 query/save action gate 연결
- pilot 관련 단위 테스트 추가

### Non-Scope
- 전체 화면 일괄 rollout
- auth 구조 재설계
- 배포/인프라 변경
- payroll 영역 변경

### Inputs / Sources
- `docs/GOVERNANCE.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/MENU_ACTION_PERMISSION_PLAN.md`
- `docs/exec-plans/active/menu-action-permission-pilot-v0.1.md`
- [Observed] pilot 3개 화면의 frontend gating은 이미 상당 부분 구현되어 있음
- [Observed] backend pilot 대상 API는 role-only 보호가 중심이고 action-level enforcement는 비어 있었음

### Changed Files
- `docs/exec-plans/active/menu-action-permission-pilot-v0.1.md`
- `docs/EXECUTION_PROTOCOL.md`
- `docs/evals/EVAL_SUMMARY.md`
- `docs/TASK_LEDGER.md`
- `backend/app/services/menu_service.py`
- `backend/app/api/employee.py`
- `backend/app/api/organization.py`
- `backend/app/api/common_code.py`
- `backend/tests/test_menu_action_permission_unit.py`
- `scripts/check-risk-paths.py`
- `.github/workflows/guardrails.yml`
- `CLAUDE.md`
- `AGENTS.md`

### Commands Run
- `python3 -m py_compile /root/.openclaw/workspace/vibe-hr/backend/app/services/menu_service.py /root/.openclaw/workspace/vibe-hr/backend/app/api/employee.py /root/.openclaw/workspace/vibe-hr/backend/app/api/organization.py /root/.openclaw/workspace/vibe-hr/backend/app/api/common_code.py /root/.openclaw/workspace/vibe-hr/backend/tests/test_menu_action_permission_unit.py`
- `python3 scripts/check-risk-paths.py --base ca8cc02 --head HEAD`
- `docker run --rm -v /root/.openclaw/workspace/vibe-hr:/repo -w /repo rhysd/actionlint:latest -color .github/workflows/guardrails.yml`
- `docker run --rm -v /root/.openclaw/workspace/vibe-hr/backend:/app -w /app python:3.12-slim bash -lc "python -m pip install --no-cache-dir -r requirements-dev.txt >/tmp/pip.log && python -m pytest -q tests/test_menu_action_permission_unit.py"`
- `docker run --rm -v /root/.openclaw/workspace/vibe-hr:/repo -w /repo/frontend node:22 bash -lc "npm ci >/tmp/npm-ci.log && npm run lint && npm run build"`

### Verification Summary
- Python syntax compile: passed
- Risk-path script: passed
- `guardrails.yml` actionlint: passed
- Targeted backend permission pytest: passed (`7 passed`)
- Frontend lint: passed with warnings only
- Frontend build/prebuild: blocked by pre-existing repo baseline `validate:grid` issues unrelated to pilot 변경

### Result
- Pilot 대상 3개 화면 및 실행 계획 확정 완료
- Layer 5 / Layer 6 최소 문서 골격 추가 완료
- backend pilot 범위 action permission enforcement 연결 완료
- targeted backend unit test 추가 및 실행 완료
- Layer 4 adapter 검증(`check-risk-paths.py`, `guardrails.yml`) 완료
- warning-only guardrails 유지 결정 완료

### Failure / Retry Notes
- Initial failure type: `ENV_FAILURE`
- Initial details:
  - host에 `pytest`, `pip`, `python3-venv` 부재
- Recovery:
  - dockerized Python runtime으로 우회하여 pytest 실행 완료
- Additional signal:
  - frontend `validate:grid`는 upstream baseline 이슈로 실패 (`tim.month-closing`, `wel.requests`, `wel-my-requests`) [Observed]

### Remaining Risks
- frontend 3개 화면은 gating 구조가 있으나 실제 브라우저 레벨 수동 검증은 아직 미실행
- repo baseline의 `validate:grid` 이슈가 정리되기 전까지 hard gate 전환은 보류가 적절함
- `org.departments` / `settings.common-codes` save/query API의 실제 런타임 수동 회귀 검증은 추가 가치가 있음

### Follow-ups
- pilot Phase 1/2/3의 브라우저 수동 검증 수행 여부 결정
- baseline `validate:grid` 이슈 별도 정리
- 반복 작업 3건 이상 누적 시 `docs/evals/EVAL_SUMMARY.md`로 평가 시작

## TASK VH-CRON-20260322-1607 — Workflow steward 점검 + TIM 월마감 테스트 보강
- Date: 2026-03-22
- Status: completed
- Mode: Execution
- Risk Class: R1
- Approval Status: not_required
- Owner: 미츄

### Goal
- workflow 1~10 기준 현재 구현 상태를 재분류한다.
- R0/R1 범위에서 가장 작은 저위험 개선 1건을 수행한다.
- 근무마감(TIM month close)과 급여 입력 연결부의 회귀 위험을 줄이는 테스트를 추가한다.

### Scope
- canonical docs / active plans 재확인
- workflow 상태 분류
- `tim_month_close_service` 대상 단위 테스트 추가
- evidence 기록

### Non-Scope
- auth 의미 변경
- payroll semantics 변경
- DB schema / migration / seed 변경
- 배포 / infra / 자동 배포
- 메뉴/권한 구조 변경

### Inputs / Sources
- `AGENTS.md`
- `docs/GOVERNANCE.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/EXECUTION_PROTOCOL.md`
- `docs/TASK_LEDGER.md`
- `docs/MENU_ACTION_PERMISSION_PLAN.md`
- `docs/exec-plans/active/harness-bootstrap.md`
- `config/grid-screens.json`
- `docs/GRID_SCREEN_STANDARD.md`
- `frontend/src/app/tim/month-closing/page.tsx`
- `frontend/src/components/tim/tim-month-close-manager.tsx`
- `frontend/src/app/payroll/runs/page.tsx`
- `frontend/src/components/payroll/payroll-run-manager.tsx`
- `frontend/src/app/wel/requests/page.tsx`
- `frontend/src/components/wel/wel-benefit-request-overview.tsx`
- [Observed] `backend/app/services/tim_month_close_service.py`에 월마감 집계 + `PayVariableInput` 자동생성 로직 존재
- [Observed] 해당 서비스에 대한 전용 unit test는 repo에 없었음

### Changed Files
- `backend/tests/test_tim_month_close_service_unit.py`
- `docs/TASK_LEDGER.md`

### Commands Run
- `git fetch origin && git checkout main && git pull --ff-only origin main`
- `git status --short`
- `python3 -m py_compile backend/tests/test_tim_month_close_service_unit.py backend/app/services/tim_month_close_service.py`
- `docker run --rm -v /root/.openclaw/workspace/vibe-hr/backend:/app -w /app python:3.12-slim bash -lc "python -m pip install --no-cache-dir -r requirements-dev.txt >/tmp/pip.log && python -m pytest -q tests/test_tim_month_close_service_unit.py"`

### Verification Summary
- targeted Python syntax compile: passed
- targeted TIM month close pytest: passed (`2 passed`)
- frontend lint / build / browser verification: not run (이번 변경은 backend unit test 추가만 포함)
- host local pytest: unavailable (`/usr/bin/python3: No module named pytest`) → dockerized fallback 사용

### Result
- `tim_month_close_service`의 핵심 동작 2가지를 고정했다.
  - 월마감 집계 + `PayVariableInput` 자동생성/upsert
  - 마감월 수정 차단(`assert_month_not_closed`)
- workflow 상태 재분류 snapshot:
  - 1. 채용 등록: 동작
  - 2. 발령 진행: 동작
  - 3. 인사기본 확정 + 근무스케줄 생성: 일부 구현
  - 4. 근무마감: 일부 구현
  - 5. 급여 기초데이터 연결: 일부 구현
  - 6. 급여코드 / 급여일자 관리: 동작
  - 7. 복리후생 마감: 일부 구현
  - 8. 월급여일자 생성: 일부 구현
  - 9. 월급여 대상자 선정: 동작
  - 10. 급여 계산 → 검토 → 급여마감: 동작

### Failure / Retry Notes
- Failure taxonomy: `ENV_FAILURE`
- Details:
  - host Python 환경에 `pytest` 미설치
- Recovery:
  - dockerized Python runtime에서 targeted pytest 실행

### Remaining Risks
- TIM 월마감은 service 단위 동작은 고정됐지만, 관련 TIM write API 전반의 `assert_month_not_closed` 연결 범위는 미확인
- 월마감 UI의 실제 브라우저 회귀는 아직 미실행
- 복리후생 `마감` 자체(run/close 개념)는 여전히 별도 구현 필요
- 월급여일자 `생성`은 profile/payment schedule 규칙은 있으나 독립 생성 흐름은 미완

### Follow-ups
- TIM write API에서 마감 잠금이 실제로 걸리는 endpoint 목록 점검
- `/tim/month-closing` 브라우저 수동 회귀 검증
- 복리후생 마감/월급여일자 생성 workflow를 닫기 위한 R1/R2 후보 분리

## TASK VH-CRON-20260322-1627 — Workflow steward 점검 + 월급여 대상자 선정 기준 테스트 고정
- Date: 2026-03-22
- Status: completed
- Mode: Execution
- Risk Class: R1
- Approval Status: not_required
- Owner: 미츄

### Goal
- workflow 1~10 현재 상태를 다시 점검한다.
- R0/R1 범위에서 workflow 9(월급여 대상자 선정)의 핵심 기준을 테스트로 고정한다.
- 남은 blocker / 누락 화면 / 누락 테스트를 짧게 정리한다.

### Scope
- canonical docs / active plan / repo 상태 재확인
- payroll run 대상자 선정 기준 unit test 추가
- evidence 기록

### Non-Scope
- auth 의미 변경
- payroll semantics 변경
- DB schema / migration / seed 변경
- deploy / infra / 자동 배포
- 메뉴/권한 구조 변경

### Inputs / Sources
- `docs/GOVERNANCE.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/EXECUTION_PROTOCOL.md`
- `docs/TASK_LEDGER.md`
- `docs/MENU_ACTION_PERMISSION_PLAN.md`
- `docs/exec-plans/active/harness-bootstrap.md`
- `docs/exec-plans/active/menu-action-permission-pilot-v0.1.md`
- `backend/app/services/payroll_phase2_service.py`
- `backend/tests/test_payroll_phase2_service_unit.py`
- `frontend/src/app/hr/recruit/finalists/page.tsx`
- `frontend/src/app/hr/appointment/records/page.tsx`
- `frontend/src/app/hr/basic/page.tsx`
- `frontend/src/app/tim/month-closing/page.tsx`
- `frontend/src/app/tim/work-codes/page.tsx`
- `frontend/src/app/payroll/employee-profiles/page.tsx`
- `frontend/src/app/payroll/payment-schedules/page.tsx`
- `frontend/src/app/payroll/runs/page.tsx`
- `frontend/src/app/wel/requests/page.tsx`
- [Observed] `_resolve_payroll_targets()`는 `retire_date < period_start` 인 사원을 제외한다.
- [Observed] workflow 9의 “초기 기준: 재직 인원”을 직접 고정하는 전용 unit test는 없었다.

### Changed Files
- `backend/tests/test_payroll_phase2_service_unit.py`
- `docs/TASK_LEDGER.md`
- `docs/evals/EVAL_SUMMARY.md`

### Commands Run
- `git fetch origin && git checkout main && git pull --ff-only origin main`
- `python3 -m py_compile backend/tests/test_payroll_phase2_service_unit.py`
- `docker run --rm -v /root/.openclaw/workspace/vibe-hr/backend:/app -w /app python:3.12-slim bash -lc "python -m pip install --no-cache-dir -r requirements-dev.txt >/tmp/pip.log && python -m pytest -q tests/test_payroll_phase2_service_unit.py"`

### Verification Summary
- targeted Python syntax compile: passed
- targeted payroll phase2 pytest: passed (`10 passed`)
- frontend lint / build / browser verification: not run (이번 변경은 backend unit test 추가만 포함)

### Result
- `create_payroll_run()`의 대상자 스냅샷 생성에서 전월 퇴사자가 제외되는지를 검증하는 회귀 테스트를 추가했다.
- workflow 9 기준이 “활성 급여프로필 보유 + 기간 시작 전 퇴사 아님”이라는 현재 구현 의미로 문서화/고정됐다.

### Failure / Retry Notes
- Failure taxonomy: `test_failure`
- Initial failure:
  - 신규 테스트에서 `HrEmployeeBasicProfile` import 누락으로 `NameError` 발생
- Recovery:
  - import 보강 후 동일 검증 세트 재실행, `10 passed`

### Remaining Risks
- ‘재직 인원’의 업무 의미(월초 기준 / 지급일 기준 / 월중 입퇴사 처리)는 여전히 명세 문서로는 명확히 고정되지 않았다.
- 복리후생 마감(run/close)과 월급여일자 생성은 여전히 독립 workflow로 닫히지 않았다.
- 브라우저 레벨 검증은 이번 루프에서 수행하지 않았다.

### Follow-ups
- workflow 9 대상자 선정 기준을 product/ops 문서에도 명시할지 결정
- workflow 7(복리후생 마감) / 8(월급여일자 생성) R1·R2 후보 분리
- 가능 시 `/payroll/runs` 브라우저 수동 회귀 검증

## TASK VH-CRON-20260322-1647 — Workflow steward 점검 + TIM 월마감 API 잠금 회귀 테스트 추가
- Date: 2026-03-22
- Status: completed
- Mode: Execution
- Risk Class: R1
- Approval Status: not_required
- Owner: 미츄

### Goal
- workflow 1~10 기준 현재 구현 상태를 다시 점검한다.
- R0/R1 범위에서 근무마감 workflow의 실제 수정 차단 경로를 테스트로 더 고정한다.
- blocker / 누락 테스트 / 다음 후보를 짧게 남긴다.

### Scope
- canonical docs / active plans / repo 상태 재확인
- `tim_month_close_service` 관련 테스트 파일에 API-level lock 회귀 테스트 추가
- evidence 기록

### Non-Scope
- auth 의미 변경
- payroll semantics 변경
- DB schema / migration / seed 변경
- deploy / infra / 자동 배포
- 메뉴/권한 구조 변경
- browser manual verification

### Inputs / Sources
- `vibe-hr/AGENTS.md`
- `config/grid-screens.json`
- `docs/GRID_SCREEN_STANDARD.md`
- `docs/MENU_ACTION_PERMISSION_PLAN.md`
- `docs/GOVERNANCE.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/EXECUTION_PROTOCOL.md`
- `docs/TASK_LEDGER.md`
- `docs/exec-plans/active/harness-bootstrap.md`
- `docs/exec-plans/active/menu-action-permission-pilot-v0.1.md`
- `frontend/src/app/hr/basic/page.tsx`
- `frontend/src/app/tim/month-closing/page.tsx`
- `frontend/src/components/tim/tim-month-close-manager.tsx`
- `frontend/src/app/payroll/runs/page.tsx`
- `frontend/src/components/payroll/payroll-run-manager.tsx`
- `frontend/src/app/payroll/payment-schedules/page.tsx`
- `frontend/src/components/payroll/pay-payment-schedule-manager.tsx`
- `frontend/src/app/wel/requests/page.tsx`
- `frontend/src/components/wel/wel-benefit-request-overview.tsx`
- `backend/app/api/tim_attendance_daily.py`
- `backend/app/services/tim_month_close_service.py`
- `backend/tests/test_tim_month_close_service_unit.py`
- [Observed] `attendance_correct()`는 수정 전 `assert_month_not_closed()`를 호출한다.
- [Observed] 기존 테스트는 service 단위 잠금만 고정했고, 실제 수정 API 경로 회귀 테스트는 없었다.
- [Observed] `/payroll/payment-schedules`는 employee profile의 지급일 속성 CRUD 화면이며, workflow 8의 독립 생성 flow는 여전히 보이지 않는다.

### Changed Files
- `backend/tests/test_tim_month_close_service_unit.py`
- `docs/TASK_LEDGER.md`
- `docs/evals/EVAL_SUMMARY.md`

### Commands Run
- `git fetch origin && git checkout main && git pull --ff-only origin main`
- `git status --short`
- `python3 -m py_compile backend/tests/test_tim_month_close_service_unit.py backend/app/api/tim_attendance_daily.py backend/app/services/tim_month_close_service.py`
- `docker run --rm -v /root/.openclaw/workspace/vibe-hr/backend:/app -w /app python:3.12-slim bash -lc "python -m pip install --no-cache-dir -r requirements-dev.txt >/tmp/pip.log && python -m pytest -q tests/test_tim_month_close_service_unit.py"`

### Verification Summary
- targeted Python syntax compile: passed
- targeted TIM month close pytest: passed (`3 passed`)
- frontend lint / build / browser verification: not run (이번 변경은 backend 회귀 테스트 추가만 포함)
- host local pytest: unavailable (`/usr/bin/python3: No module named pytest`) → dockerized fallback 사용

### Result
- `attendance_correct()` 경로가 마감월에 대해 HTTP 423으로 차단되는지를 회귀 테스트로 고정했다.
- workflow 상태 snapshot:
  - 1. 채용 등록: 동작
  - 2. 발령 진행: 동작
  - 3. 인사기본 확정 + 근무스케줄 생성: 일부 구현
  - 4. 근무마감: 일부 구현
  - 5. 급여 기초데이터 연결: 일부 구현
  - 6. 급여코드 / 급여일자 관리: 동작
  - 7. 복리후생 마감: 일부 구현
  - 8. 월급여일자 생성: 일부 구현
  - 9. 월급여 대상자 선정: 동작
  - 10. 급여 계산 → 검토 → 급여마감: 동작

### Failure / Retry Notes
- Failure taxonomy: `ENV_FAILURE`
- Details:
  - host Python 환경에 `pytest` 미설치
- Recovery:
  - dockerized Python runtime에서 targeted pytest 실행

### Remaining Risks
- TIM 마감 잠금은 `tim_attendance_daily` 수정 경로까지는 고정됐지만, 다른 TIM write API 전체 coverage는 여전히 미확인
- workflow 7은 승인/급여반영 projection은 있으나 ‘복리후생 마감’ 자체의 close/run 개념이 부족함
- workflow 8은 지급일 규칙 관리 화면은 있으나 월 단위 생성/확정 흐름이 별도 구현돼 있지 않음
- 브라우저 레벨 실제 UI 검증은 이번 루프에서도 미실행

### Follow-ups
- TIM write API 전수에서 month-close lock 미적용 endpoint가 더 있는지 점검
- `/tim/month-closing` 또는 `/payroll/runs` 브라우저 수동 검증 1건 수행
- workflow 7 / 8을 닫기 위한 최소 화면/API 설계 후보를 R1/R2로 분리

## TASK VH-CRON-20260322-1707 — Workflow steward 점검 + 급여 대상자 선정(미래 입사자 제외) 회귀 테스트 추가
- Date: 2026-03-22
- Status: completed
- Mode: Execution
- Risk Class: R1
- Approval Status: not_required
- Owner: 미츄

### Goal
- workflow 1~10 기준 현재 구현 상태를 다시 점검한다.
- R0/R1 범위에서 월급여 대상자 선정(재직 인원 기준)의 경계조건을 테스트로 더 고정한다.
- blocker / 누락 화면 / 다음 후보를 짧게 남긴다.

### Scope
- canonical docs / active plans / repo 상태 재확인
- `payroll_phase2_service` 대상자 선정 회귀 테스트 1건 추가
- evidence 기록

### Non-Scope
- auth 의미 변경
- payroll semantics 변경
- DB schema / migration / seed 변경
- deploy / infra / 자동 배포
- 메뉴/권한 구조 변경
- browser manual verification

### Inputs / Sources
- `vibe-hr/AGENTS.md`
- `config/grid-screens.json`
- `docs/GRID_SCREEN_STANDARD.md`
- `docs/MENU_ACTION_PERMISSION_PLAN.md`
- `docs/GOVERNANCE.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/EXECUTION_PROTOCOL.md`
- `docs/TASK_LEDGER.md`
- `docs/exec-plans/active/harness-bootstrap.md`
- `docs/exec-plans/active/menu-action-permission-pilot-v0.1.md`
- `frontend/src/components/hr/hr-recruit-finalist-manager.tsx`
- `frontend/src/components/hr/hr-appointment-record-manager.tsx`
- `frontend/src/components/hr/hr-basic-workspace.tsx`
- `frontend/src/components/tim/schedule-generator-manager.tsx`
- `frontend/src/components/tim/tim-month-close-manager.tsx`
- `frontend/src/components/payroll/pay-payment-schedule-manager.tsx`
- `frontend/src/components/payroll/payroll-run-manager.tsx`
- `frontend/src/components/wel/wel-benefit-request-overview.tsx`
- `backend/app/services/payroll_phase2_service.py`
- `backend/app/services/tim_month_close_service.py`
- `backend/app/services/welfare_service.py`
- `backend/tests/test_payroll_phase2_service_unit.py`
- `backend/tests/test_tim_month_close_service_unit.py`
- [Observed] `_resolve_payroll_targets()`는 `HrEmployee.hire_date <= period_end` 조건으로 급여 대상자를 고른다.
- [Observed] 기존 회귀 테스트는 전월 퇴사자 제외는 고정했지만, 미래 입사 예정자 제외는 직접 고정하지 않았다.
- [Observed] `/payroll/payment-schedules`는 월 단위 생성 화면이 아니라 employee payment-day 속성 CRUD 화면이다.
- [Observed] 복리후생 영역에는 approve/reject/payroll_reflected는 있으나 별도 close/run 개념은 보이지 않았다.

### Changed Files
- `backend/tests/test_payroll_phase2_service_unit.py`
- `docs/TASK_LEDGER.md`
- `docs/evals/EVAL_SUMMARY.md`

### Commands Run
- `git fetch origin && git checkout main && git pull --ff-only origin main`
- `git status --short`
- `python3 -m py_compile backend/tests/test_payroll_phase2_service_unit.py backend/tests/test_tim_month_close_service_unit.py backend/app/services/payroll_phase2_service.py backend/app/services/tim_month_close_service.py backend/app/api/tim_attendance_daily.py`
- `docker run --rm -v /root/.openclaw/workspace/vibe-hr/backend:/app -w /app python:3.12-slim bash -lc "python -m pip install --no-cache-dir -r requirements-dev.txt >/tmp/pip.log && python -m pytest -q tests/test_payroll_phase2_service_unit.py tests/test_tim_month_close_service_unit.py"`

### Verification Summary
- targeted Python syntax compile: passed
- targeted payroll + TIM pytest: passed (`14 passed`)
- first-pass pytest: failed once (`UNIQUE constraint failed: pay_payroll_codes.code`) → 테스트 시드 충돌 수정 후 재실행
- frontend lint / build / browser verification: not run (이번 변경은 backend 회귀 테스트 추가만 포함)
- host local pytest: unavailable (`/usr/bin/python3: No module named pytest`) → dockerized fallback 사용

### Result
- 월급여 대상자 선정에서 **기준 월 종료일 이후 입사자**가 Run 대상에서 제외되는지를 회귀 테스트로 고정했다.
- workflow 상태 snapshot:
  - 1. 채용 등록: 동작 — finalist 관리/사원 생성 화면과 서비스가 존재
  - 2. 발령 진행: 동작 — 발령 기록/확정 화면과 서비스가 존재
  - 3. 인사기본 확정 + 근무스케줄 생성: 일부 구현 — 인사기본 workspace와 스케줄 생성 기능은 있으나 하나의 닫힌 확정 workflow/회귀 검증은 부족
  - 4. 근무마감: 일부 구현 — 월마감 UI/service와 lock 테스트는 있으나 전체 write API coverage와 브라우저 검증이 부족
  - 5. 급여 기초데이터 연결: 일부 구현 — payroll run snapshot/event가 발령·근태·복리후생을 끌어오지만 연결 상태를 확인하는 전용 운영 화면/검증 흐름은 약함
  - 6. 급여코드 / 급여일자 관리: 동작 — 코드 관리와 payment-day profile CRUD 화면이 존재
  - 7. 복리후생 마감: 일부 구현 — 신청/승인/급여반영 projection은 있으나 close/run 개념의 독립 마감 흐름은 없음
  - 8. 월급여일자 생성: 일부 구현 — 지급일 규칙 관리 화면은 있으나 월 단위 생성/확정 flow는 별도 구현이 보이지 않음
  - 9. 월급여 대상자 선정: 동작 — 재직자/퇴사자/미래 입사자 제외 기준이 테스트로 점진 고정 중
  - 10. 급여 계산 → 검토 → 급여마감: 동작 — run 생성/계산/스냅샷 갱신/마감/지급완료 흐름이 존재

### Failure / Retry Notes
- Failure taxonomy: `TEST_FAILURE`, `ENV_FAILURE`
- Details:
  - 새 테스트 1차 시도에서 동일 급여코드 seed 중복으로 sqlite unique 제약 위반
  - host Python 환경에 `pytest` 미설치
- Recovery:
  - 미래 입사자 시드를 기존 급여코드 재사용 형태로 수정
  - dockerized Python runtime에서 targeted pytest 재실행

### Remaining Risks
- workflow 3은 인사기본 확정과 근무스케줄 생성이 분리돼 있어 운영자가 한 번에 닫는 체크포인트가 약함
- workflow 7은 close/run/lock semantics가 없어 “복리후생 마감” 기준 자체가 아직 느슨함
- workflow 8은 월 단위 지급일 생성 메뉴/API/seed 매핑이 없어 실제 운영 workflow를 닫지 못함
- 브라우저 레벨 실제 UI 검증은 이번 루프에서도 미실행

### Follow-ups
- `/payroll/runs` 대상자 탭에서 review_required / 이벤트 표시를 브라우저로 1회 확인
- workflow 7의 최소 close 개념이 projection인지 독립 테이블/API인지 R2 전 설계 메모로 분리
- workflow 8에 필요한 메뉴/권한/DB seed 포함 최소 화면 후보를 문서화만 먼저 수행

## TASK VH-SESSION-20260708 — 전체 점검 + HR 라이프사이클 E2E 검증 + TIM/WEL 스키마 드리프트 수리
- Date: 2026-07-08
- Status: completed
- Mode: Review / Hardening
- Risk Class: R1
- Approval Status: not_required
- Owner: kms (Claude Code 세션)

### Goal
- 프로젝트 전체 상태 점검, 채용→인사등록→발령→근태/복지→급여→전표 라이프사이클과 퇴직신청 흐름의 실동작 검증, 더미데이터 보강, 우선순위 TODO 도출

### Scope
- 읽기 전용 감사(7개 병렬 탐색) + dev DB(myhr) 스키마 드리프트 수리 + 시간의존 테스트 픽스처 수정 + API 경유 더미데이터 생성

### Non-Scope
- 급여/인증/전표 등 R2·R3 로직 변경, 디자인 변경(방향 제안만), 커밋/배포

### Inputs / Sources
- AGENTS.md, docs/ARCHITECTURE.md, docs/CURRENT_STATUS.md, docs/GOVERNANCE.md, backend openapi.json
- [Observed] 서버 실사용 DB는 `.env`의 `myhr`이며, 별도 `vibe_hr` DB가 병존한다 (혼동 주의)

### Changed Files
- `backend/app/core/database.py` — init_db()에 tim_attendance_daily 9개 컬럼 + wel_benefit_requests.employee_id ADD COLUMN IF NOT EXISTS 패치 (기존 드리프트 패치 패턴 준수)
- `backend/tests/test_payroll_phase2_service_unit.py` — 복지→급여 반영 테스트의 `_utc_now()` 시간의존 픽스처를 고정 날짜(2026-03)로 교체
- `docs/TASK_LEDGER.md`

### Commands Run
- `backend: .venv/Scripts/python.exe -m pytest -q`
- `frontend: npm run validate:grid && npm run lint && npm run build`
- E2E: 스크래치패드 `e2e_lifecycle.py` (API 경유, admin-local 로그인 → finalist 생성 → 사원화 → 발령확정 → 체크인/아웃 → 휴가/복지 신청·승인 → 급여 run 생성·계산·마감·지급 → 퇴직 케이스→체크리스트→확정)
- 더미데이터: 스크래치패드 `dummy_batch.py`

### Verification Summary
- backend pytest: 47 passed (수정 전 46 passed / 1 failed — 시간의존 픽스처)
- frontend validate:grid / lint / build: 모두 통과 (문서상 3개 화면 baseline 실패는 이미 해소된 상태)
- E2E 24 스텝 중 22 PASS. 나머지 2건은 결함 아님:
  - 복지→급여 반영: 2026-07 P100 런이 기지급 상태라 라이브 재현 불가(유닛테스트로 로직 검증), P200 런은 대상 프로파일 0명이라 미반영이 정상
  - 퇴직 후 직원 상태: DB 직접 확인으로 `resigned` 전환 확인(/employees 검색 응답에 해당 직원 미노출)

### Result
- 체인 상태: 채용→사원화 동작 / 발령확정+finalist sync 동작 / 근태 체크인·아웃 동작(드리프트 수리 후) / 휴가·복지 신청·승인 동작 / 급여 계산·마감·지급 동작 / **급여→전표 모듈 부재(끊김)** / 퇴직 케이스→확정→resigned 동작(퇴직금 계산 없음)
- 더미데이터 추가: finalist 10+, 신규직원 6008~6017, 발령 orders 4~9, 퇴직 케이스 12건(혼합 상태), 복지 신청 20여건(혼합 상태), 휴가 신청 10건, 급여 run 3(P100, paid)·4(P200, paid)

### Failure / Retry Notes
- Failure taxonomy: `ENV_FAILURE`, `TEST_FAILURE`
- `tim_attendance_daily` 9개 컬럼·`wel_benefit_requests.employee_id` 드리프트로 check-in 500 → init_db 패치로 수리
- `requirements-dev.txt` 일괄 설치 실패(psycopg-binary 3.2.9 미해석, py3.14) → pytest 단독 설치로 우회

### Remaining Risks
- 전표(voucher/GL) 모듈 전무 — 라이프사이클 유일 완전 단절 (R3, 설계 승인 필요)
- 퇴직금 계산/정산 부재, 퇴직 확정 시 부서 정리 없음
- 마이그레이션 도구 부재로 동일 드리프트 재발 가능 (ALTER 패치 수동 관리)
- `myhr` / `vibe_hr` 이중 DB 혼재 — .env 기준 단일화 필요

### Follow-ups
- P0/P1/P2 TODO는 세션 종합 보고 참조 (전표 모듈 설계, 퇴직금, 셀프 퇴직신청, 워크플로 7/8 시맨틱)
- core/database.py 패치 + 테스트 수정 커밋 여부 사용자 결정 대기

## TASK VH-GRID-QA-SLICE-20260708 — 라이프사이클 그리드 브라우저 QA 슬라이스 실행
- Date: 2026-07-08
- Status: completed
- Mode: Review / Hardening
- Risk Class: R1 (테스트 spec 1개 추가, 소스/보호경로 무변경)
- Approval Status: not_required
- Owner: kms (Claude Code — 계획 Fable, 실행 Sonnet 위임)

### Goal
- `docs/VIBE_GRID_LIFECYCLE_QA_PLAN.md`의 Suggested Next Execution Slice 실행: 라이프사이클 핵심 8개 화면 브라우저 렌더/그리드/콘솔에러 검증 + 스크린샷 확보

### Scope
- Playwright spec 신규 1개, 8개 라우트 QA, 스크린샷/리포트 산출

### Non-Scope
- R2/R3 코드 변경, 권한/메뉴 데이터 변경, 디자인 변경

### Inputs / Sources
- `docs/VIBE_GRID_LIFECYCLE_QA_PLAN.md`, `frontend/tests/e2e/hr-finalist-appointment.spec.ts`(로그인 패턴)

### Changed Files
- `frontend/tests/e2e/lifecycle-grid-qa.spec.ts` (신규)
- `docs/TASK_LEDGER.md`
- 산출물: `output/playwright/lifecycle-grid-20260708/` (스크린샷 8장 + report.json)

### Commands Run
- `frontend: npm install` (@playwright/test 설치 — devDependencies 선언분)
- `frontend: npx playwright test tests/e2e/lifecycle-grid-qa.spec.ts --reporter=line --workers=1`

### Verification Summary
- 1차(기본 workers=24 병렬): 2 passed / 6 failed — 동시 로그인 폭주로 dev 서버 타임아웃 (spec 문제, 화면 결함 아님)
- 2차(--workers=1 순차): **8/8 passed (52.4s)**
- 화면별: finalists(22행)·employee(6,017건 중 19행)·appointment-records(9행)·tim/status(3행)·payroll/runs(2행 paid)·retire/checklist(4행) 정상 + toolbar 표준 순서 확인. retire/approvals는 계획대로 비등록 커스텀 UI 정상 렌더.

### Result
- 7/8 화면 정상. 실결함 1건:
  - **`/wel/requests` 접근 불가** — 스크린샷상 "접근 권한이 없습니다". 원인 확정: `app_menus`에서 `code='wel.requests'`가 `is_active=False` (id=102, 2026-03-12 생성 시점부터). 백엔드 API `GET /api/v1/wel/requests`는 admin 토큰으로 200 정상 → 권한 매트릭스가 아니라 **메뉴 마스터 비활성** 상태. 활성화는 정책 결정 필요(복지 마감 시맨틱 미정의와 연관 가능).
- 부수 관찰: `/hr/employee` 로딩 초기 리소스 404 콘솔 에러 1건(기능 영향 없음, 원인 미특정)

### Failure / Retry Notes
- Failure taxonomy: `test_failure`(환경성)
- 병렬 로그인 폭주 → `--workers=1` CLI 플래그로 우회 (config 미수정)

### Remaining Risks
- spec의 에러페이지 판정이 "접근 권한이 없습니다" 패턴 미커버 → 오탐(loaded=true) 소지, 스크린샷 수동 보정으로 해소. spec 개선 여지
- playwright.config.ts에 workers 미설정 — CI 실행 시 동일 폭주 재현 가능

### Follow-ups
- ~~`wel.requests` 메뉴 활성화 여부 결정~~ → 2026-07-08 사용자 승인으로 `is_active=true` 전환, QA 재실행 결과 정상(그리드 렌더, 21행, 콘솔에러 0) — 8/8 화면 그린
- `wel.my-requests`는 app_menus에 메뉴 행 자체가 없음 — 메뉴 시드 보강 여부 결정 필요
- `/hr/employee` 404 리소스 원인 조사
- spec 에러페이지 판정 패턴 보강 + playwright workers 설정 (R1)
- `/hr/retire/approvals` AG Grid 등록 vs 커스텀 예외 결정

## TASK VH-GRID-VARIANT-20260708 — grid variant 필드 도입 + readonly toolbar 정합성 수정
- Date: 2026-07-08
- Status: completed
- Mode: Execution
- Risk Class: R2 (config/grid-screens.json, validator)
- Approval Status: approved (사용자 승인: "전체 진행")
- Owner: kms (계획 Fable, 구현 Sonnet 위임 → 세션 한도 중단분 메인 세션이 마무리)

### Goal
- `docs/exec-plans/grid-variant-readonly-toolbar-v0.1.md` 구현: variant 필드 + validator 규칙 + readonly 화면 toolbar 선언 축소

### Changed Files
- `frontend/scripts/validate-grid-screens.mjs` — variant 값 검증(crud/readonly/approval/workflow), readonly는 toolbar ⊆ [query,download], approval/workflow는 query 필수
- `config/grid-screens.json` — 60화면 variant 분류(crud 34 생략기본/readonly 14/approval 5/workflow 7), readonly 14화면 toolbar를 [query,download]로 축소
- `docs/exec-plans/grid-variant-readonly-toolbar-v0.1.md` — 구현 정정 주석(approval 통합 폐기, 최종 분류)

### Commands Run
- `frontend: npm run validate:grid && npm run lint && npm run build`
- `frontend: npx playwright test tests/e2e/lifecycle-grid-qa.spec.ts --workers=1`

### Verification Summary
- validate:grid / lint / build: 통과
- 라이프사이클 QA spec: 8/8 PASS (49.4s)
- 핵심 확인: registry toolbar는 프론트 런타임에서 import되지 않음(`frontend/src`에 grid-screens.json 참조 0건) → 이번 축소는 UI 무변경의 선언 정합성 수정, 기능 상실 위험 없음

### Result
- 커밋 5건: fecb3a4(validator) → b902ebc(approval/workflow 분류) → 4a0af0a(tim/hr readonly) → 38357c8(mng readonly) → 0c8bad8(org/wel readonly)
- 감사 문서(GRID_CRUD_AUDIT) 대비 편차: tim.leave-approval·hri.tasks.approvals·hri.tasks.receives를 approval로 분류(실화면 승인 액션 보유), wel.benefit-types는 onQuery만 구현된 조회 화면으로 확인되어 readonly 확정

### Failure / Retry Notes
- Failure taxonomy: `ENV_FAILURE`
- Sonnet 실행자 세션 한도 중단(커밋 3까지 완료) → 메인 세션이 잔여분(mng 커밋, org/wel 처리, 최종 검증) 마무리
- QA 재실행 시 `next build`가 dev 서버 `.next`를 건드려 frontend 크래시 + backend 프로세스 사망 → 재기동 후 8/8 통과. build와 dev 서버 동시 운용 주의

### Remaining Risks
- approval/workflow 화면 12개의 toolbar 선언은 여전히 과대(표준 7버튼) — 실지원 액션 조사 후 별도 정리 필요
- validator의 readonly componentFile 토큰 검사가 주석 충족을 허용(예: wel-benefit-type-overview.tsx) — VibeGrid 전환 시 자연 해소 예정

### Follow-ups
- VibeGrid wrapper 구현 + readonly 파일럿 1화면 (Wave 1 진입)
- /hr/retire/approvals VibeGrid 기반 표준 전환
- approval/workflow 화면 toolbar 실지원 액션 조사

## TASK VH-VIBEGRID-V1-20260709 — VibeGrid wrapper v1 + readonly 파일럿 + 퇴직승인 화면 표준 전환
- Date: 2026-07-09
- Status: completed
- Mode: Execution
- Risk Class: R2 (frontend/src/components/grid/**, config/grid-screens.json)
- Approval Status: approved (사용자: "#13~ 순차 진행")
- Owner: kms (계획 Fable, 구현 Sonnet 위임 2건)

### Goal
- VIBE_GRID_ROADMAP Step 1 진입: VibeGrid v1(readonly) 구현, 파일럿 1화면 전환, 마지막 비등록 그리드성 화면(hr.retire.approvals) 표준 등록

### Scope / Non-Scope
- 포함: vibe-grid.tsx 신규, validator VibeGrid 인정, tim.attendance-status 전환, 퇴직승인 화면 전환+등록
- 제외: crud/approval/workflow variant 핸들러 구현(throw), registry 런타임 연동(v2 codegen 예정), Wave 1 일괄 전환

### Inputs / Sources
- docs/VIBE_GRID_ROADMAP.md, docs/GRID_SCREEN_STANDARD.md, 파일럿 참조 패턴 e50b0e9
- [Observed] config/grid-screens.json은 Next 프로젝트 경계 밖 → 런타임 import 불가(externalDir 기본 off) → **v1은 variant prop으로 toolbar 도출** 설계 결정

### Changed Files
- `frontend/src/components/grid/vibe-grid.tsx` (신규 + onRowClick/selectedRowId 확장)
- `frontend/scripts/validate-grid-screens.mjs` (VibeGrid 화면 토큰 면제)
- `frontend/src/components/tim/attendance-status-manager.tsx` (파일럿, LOC 166→154)
- `frontend/src/components/hr/hr-retire-approval-manager.tsx` (카드 목록 → VibeGrid, 상세/승인 패널 유지, 전역 mutate로 목록 동기화)
- `frontend/src/app/hr/retire/approvals/page.tsx` (GRID_SCREEN 메타)
- `config/grid-screens.json` (hr.retire.approvals 등록: variant=approval, toolbar=[query,download]) — **registry 61화면**

### Commands Run
- `frontend: npm run validate:grid && npm run lint && npx tsc --noEmit`
- `frontend: npx playwright test tests/e2e/lifecycle-grid-qa.spec.ts --workers=1 --grep "tim|retire"`
- `frontend: npm run build` (VibeGrid 단계에서 1회)

### Verification Summary
- validate:grid(61) / lint(0 errors) / tsc / build: 통과
- QA: tim 1/1, retire 2/2 PASS — /hr/retire/approvals hasGrid=true rowCount=12 consoleErrors=[]
- 브라우저 수동: 행 클릭 → 상세 패널 갱신, 체크리스트/confirm/cancel 동작 보존 확인

### Result
- 커밋 5건: f65f785(VibeGrid v1) → 076aa41(validator) → e50b0e9(파일럿) → 46806d9(onRowClick) → 73b3a78(퇴직승인 전환+등록)
- 비등록 그리드성 화면 0개 달성

### Failure / Retry Notes
- `ENV_FAILURE`: Sonnet 실행자 1차 API 연결 끊김 → 트랜스크립트 재개로 이어서 완료

### Remaining Risks
- VibeGrid v1은 readonly 전용 — crud variant 미구현 상태에서 Wave 2 진입 불가
- registryKey는 식별용 (registry↔런타임 이중선언은 validator 정적 검증에 의존)

### Follow-ups
- Wave 1 잔여 readonly 화면 일괄 전환 (화면당 ~15분 예상)
- VibeGrid v2: codegen으로 registry 런타임 연동, crud variant + xlsx/batch-save/dirty-dialog 공유 유틸

## TASK VH-QA-HARDEN-20260709 — QA spec 보강 + employee 404 근본 수정 + 헬스체크
- Date: 2026-07-09
- Status: completed
- Mode: Review / Hardening
- Risk Class: R1
- Approval Status: not_required
- Owner: kms

### Changed Files / Result
- `frontend/tests/e2e/lifecycle-grid-qa.spec.ts` + `frontend/playwright.config.ts` (e9334ad): 한국어 에러페이지 판정 4패턴 추가, workers=1 고정 (병렬 로그인 폭주 사고 재발 방지)
- `backend/app/api/health.py` + `main.py` (3509723): `/api/v1/health` DB 프로브 추가
- `backend/app/bootstrap.py` + `frontend/src/components/hr/employee-master-manager.tsx`: /hr/employee 콘솔 404 근본 수정 — EMPLOYMENT_STATUS 공통코드 그룹 시드 부재였음. 시드 추가 + 라이브 DB API 주입 + 프론트 소문자 정규화(공통코드 서비스는 대문자 저장, employment_status 값은 소문자 — 기존엔 이 불일치로 서버 옵션이 영구 무시되고 폴백만 동작했음)

### Verification Summary
- QA spec 전체 8/8 PASS (workers=1 config), /hr/employee consoleErrors=[] 확인
- pytest 47/47 (헬스체크 커밋 시점), lint 0 errors

### Remaining Risks / Follow-ups
- 공통코드 대문자 저장 vs 도메인 소문자 값 불일치는 다른 소비처에도 잠재 — 공통코드 소비 화면 전수 점검 후보
- uvicorn --reload 워커 고착 현상 2회 관찰 (파일 변경 후 재시작 실패) — 재현 시 클린 재시작으로 해소, 원인 조사 후보

## TASK VH-R3-WAVE-20260709 — Alembic 도입 + 전표(Voucher/GL) + 퇴직금 모듈 + 화면 5종 (전부 승인 완료분)
- Date: 2026-07-09
- Status: completed
- Mode: Execution
- Risk Class: R3 (DB 스키마 3리비전 + 급여 연계 신모듈 2종)
- Approval Status: approved (2026-07-09 사용자: "전부 승인한다. 소스 작업은 모두 sonnet위임한다")
- Owner: kms (계획·검수 Fable, 구현 Sonnet 위임 4건)

### Goal
- 승인된 설계 3종 구현: ALEMBIC_ADOPTION_PLAN(C안), PAY_VOUCHER_GL_DESIGN(Phase 1), HR_SEVERANCE_DESIGN(Phase 1) + 화면/메뉴 연결로 라이프사이클 완전 폐합

### Changed Files (커밋 20건 요약)
- **Alembic** (3fbf9fc, 0efd652, 6c1050e, 73cac85): migrations/ 스캐폴드, baseline 470095da5995 + myhr stamp, check_schema_drift.py, 워크플로 README
- **정리 리비전** (75d1c0e7dd53): 레거시 users DROP(0행 확인)·중복 인덱스·PAP 인덱스 casing·calculated_at 타입 — 이후 myhr alembic check 클린/drift 0
- **전표 백엔드** (13ebba7~9c01159, 리비전 7e248ebed919): gl_accounts/pay_gl_mappings/pay_vouchers/pay_voucher_lines, 분개 서비스(차대평형+1원 반올림 조정), API 8종, 시드(계정12/매핑17), 유닛 7
- **퇴직금 백엔드** (716f147~e5fabf1, 리비전 46507f02680a): hr_severance_calcs/pay_severance_item_rules, 산정 서비스, retire confirm 훅(try/except 격리 1줄), API 6종, 유닛 13
- **화면 5종** (1f30bd2~1c818c7): crud 3(gl-accounts/gl-mappings/severance-item-rules, attendance-code-manager 패턴) + workflow 2(vouchers/severance.calcs, VibeGrid readonly+상세패널 패턴), BFF hr/severance 라우트 4, registry 61→66, MENU_TREE 5항목 + 라이브 targeted insert(wel.requests 활성 보존 확인)

### Commands Run / Verification Summary
- pytest 67 passed (47→54→67), validate:grid 66 통과, lint 0 errors, build 통과
- 풀체인 E2E 14/14 PASS: 채용→사원(6018)→발령확정→체크인/아웃→퇴직확정(case 15)→**퇴직금 자동 draft(1년 미만 0원+경고 정확)→조정→확정**→급여 2026-08 P100 생성→계산→마감→지급→**전표 PV-202608-0001 생성(401라인, 차대 27,336,035,000 균형)→확정**. 매핑 누락 0
- 라이브 스모크(각 모듈별): 전표 PV-202607-0001(run 3), 퇴직금 calc(독립 재계산 일치 2,677,970.80)

### Result
- **급여→전표 단절 해소 — HR 라이프사이클 전 구간 연결 완료**
- 스키마 변경 경로 Alembic 단일화(리비전 4개, drift 0), 모델↔DB 완전 정합

### Failure / Retry Notes
- `ENV_FAILURE` 3회: Sonnet 세션한도/API 오류 중단 → 트랜스크립트 재개로 전부 복구 (단계별 즉시 커밋 전략 유효)
- uvicorn --reload 워커 고착 재발(2회) → 동일 커맨드 재기동으로 해소
- 실버그 수리: 전표 1원 반올림 경계(d44a1c0 — 6000명 스케일에서만 발현)

### Remaining Risks
- QA spec 풀배치가 로그인 rate limiter(10회/5분)에 걸림 — spec을 storageState 재사용으로 개선 필요
- 전표 Phase 2 미착수: 지급 시점 은행 전표, 자동 생성 훅, 외부 IF / 퇴직금 Phase 2: 퇴직소득세, 퇴직연금 구분
- init_db의 DO $$ 패치 블록 제거 유예 중 (Alembic 정착 확인 후)

### Follow-ups
- QA spec storageState 개선, VibeGrid Wave 1 잔여 전환, 전표·퇴직금 Phase 2 설계

## TASK VH-SEVERANCE-PHASE2-20260709 — 퇴직소득세 산출 (HR_SEVERANCE_DESIGN §9)
- Date: 2026-07-09
- Status: completed
- Mode: Execution
- Risk Class: R3 (스키마 리비전 + 급여 연계 세액 로직)
- Approval Status: approved (§9 승인, 사용자 순차 진행 지시)
- Owner: kms (구현 Sonnet 위임)

### Goal
- HR_SEVERANCE_DESIGN.md §9 그대로: 근속연수공제→환산급여→환산급여공제→과세표준→기본세율(pay_income_tax_brackets 읽기 재사용)→환산산출세액→산출세액/12×근속연수→지방소득세 10%→실수령 산출을 산정/재계산/조정(PUT) 시 자동 계산.

### Changed Files (커밋 4건)
- **스키마** (ab7a12f, 리비전 ea501237b804): `hr_severance_calcs`에 service_years/income_tax/local_income_tax/net_severance/tax_detail_json 추가. server_default로 기존 confirmed 2건 backfill 후 default 제거.
- **세액 서비스** (0f90f1d): `backend/app/services/hr_severance_service.py`에 `SEVERANCE_TAX_TABLE[2026]` 상수, `calc_service_years/calc_service_year_deduction/calc_conversion_income/calc_conversion_income_deduction/calc_severance_tax` 추가. `_build_calc`(draft 생성+재계산)와 `update_severance_adjustment`(PUT)에서 자동 호출, `tax_detail_json`에 단계별 스냅샷 저장. `pay_income_tax_brackets`는 읽기만 재사용(연도 없으면 최신 연도 fallback+warning). 스키마(`HrSeveranceCalcItem`/`HrSeveranceCalcDetailResponse`)에 신규 필드 + `tax_detail` 노출.
- **화면** (d19b73e): `frontend/src/types/hr-severance.ts` 타입 확장, `hr-severance-calc-manager.tsx` 그리드에 소득세/실수령액 컬럼, 상세 패널에 퇴직소득세 산출 내역 섹션(근속연수공제→환산급여→환산급여공제→과세표준→산출세액→지방소득세→실수령액) 추가.
- **유닛 테스트** (ae25a2d): `backend/tests/test_hr_severance_service_unit.py`에 고정 2026 세율 브래킷 픽스처 + 9건 추가(구간 경계 5/10/20년, 환산급여공제 4개 구간, 1년미만/0원 세액 0, 조정액 변경 재계산, confirmed 불변, 수기 대조 1건, 연도 fallback).

### Commands Run / Verification Summary
- pytest: 75 passed(기존) → 84 passed(전체, 신규 9건)
- alembic: autogenerate로 컬럼 5종만 감지 → upgrade head(ea501237b804) → check 클린 / drift 0
- 수기 대조: 근속10년·퇴직금1억 → 근속연수공제 1,500만 / 환산급여 1억200만 / 환산급여공제 6,260만 / 과세표준 3,940만 / 2026 기본세율(15%, 누진공제126만) → 환산산출세액 465만 → income_tax 3,875,000 / local_income_tax 387,500 / net_severance 95,737,500 — 코드 결과와 정확히 일치
- 라이브 스모크: 재직자(employee_id=4, KR-0002) 퇴직 케이스 16 생성→체크리스트 3건 체크→confirm→severance draft(id=3) 자동 생성, 세액 필드 채워짐 확인(초기 final_amount 1,877만은 환산급여<800만 구간이라 세액 0 — 정상)→조정액 +8,000만 PUT→income_tax 0→4,252,584 재계산 확인, tax_detail 단계값 역전/음수 없음→confirm 성공
- 기존 confirmed 2건(id 1,2)은 스모크 전후 모두 신규 컬럼 0 유지 — 소급 재계산 없음 확인
- 프론트: `npm run validate:grid` PASS, `npm run lint` 0 errors, `npx playwright test tests/e2e/lifecycle-grid-qa.spec.ts` 13/13 PASS, `npm run test`(vitest) 9 passed

### Result
- 퇴직금 확정 흐름에 퇴직소득세 산출이 완전히 연결됨 — draft 생성/재계산/조정 시 자동 계산, confirmed 후 불변 보장

### Remaining Risks
- `npm run build` 시 `pay-gl-account-manager.tsx`(GL계정 화면, 본 작업 범위 밖) 타입 오류로 프로덕션 빌드 실패 — Phase 2 변경 전후 동일하게 재현되어 pre-existing 이슈로 확인, 별도 task로 flag(task_d61a1977)
- SEVERANCE_TAX_TABLE은 연도 키 상수 — 세법 개정 시 코드 수정 필요(설계상 의도된 트레이드오프, 개정 2회 이상 시 DB 테이블화 재평가 예정)

### Follow-ups
- ~~pay-gl-account-manager.tsx `is_cash_account` 필드 누락 수정~~ → 당일 메인 세션 리뷰 픽스업으로 해결 (VH-SEQ123-20260709)
- 퇴직연금(DC/DB) 구분, IRP 이전 처리는 여전히 비목표 범위

## TASK VH-SEQ123-20260709 — 백로그 1·2·3 순차 실행 (storageState / Wave 1 판정 / Phase 2 완결)
- Date: 2026-07-09
- Status: completed
- Mode: Execution
- Risk Class: R3 최고 (전표 P2 보호경로 훅 포함)
- Approval Status: approved (사용자: "1,2,3 순차대로 — 계획·리뷰 Fable, 소스 Sonnet")
- Owner: kms

### Result (스테이지별)
1. **QA storageState** (ebbb51d, 리뷰 PASS): 로그인 13→1회, rate limiter 해소. 풀스위트 13/13 + 전체 3spec 15/15
2. **VibeGrid Wave 1** (커밋 0건 — **전환 보류 판정, 리뷰 승인**): 13화면 전수 검증 결과 전부 그리드 밖 CRUD폼/듀얼그리드/비표준 계약 보유. 로드맵이 registry 라벨만으로 오산정했던 것. VIBE_GRID_ROADMAP에 재산정+v2 요구사항(beforeGrid/afterGrid 슬롯, 멀티 fetch, 응답 어댑터) 기록
3. **전표 Phase 2** (5커밋 5610f1b~42f53b5, 리비전 ffc17a622333, 리뷰 PASS): voucher_type(accrual|disbursement)+(run,type) 유니크, is_cash_account, close 자동훅(**보호경로 diff +13줄 실측 검증** — commit 후 격리 호출), 지급전표(PV-202609-0002, 순지급액 206.1억 정확 일치), CSV(BOM)/JSON export + BFF text/csv passthrough 실결함 수리
4. **퇴직금 Phase 2** (5커밋 ab7a12f~95e3b20, 리비전 ea501237b804, 리뷰 PASS): 퇴직소득세 산출(근속연수공제→환산급여→환산급여공제→과세표준→기본세율→역산→지방소득세→실수령), 수기 대조 케이스(근속10년·1억: 세액 3,875,000) 완전 일치, 조정 시 재계산 등식 성립, confirmed 불변 409, 기존 확정분 소급 금지 준수
- 리뷰 픽스업 1건(메인 세션 직접): GL계정 화면 is_cash_account 미반영 타입 에러 → 필드+현금계정 Y/N 컬럼 배선 (빌드 차단 해소)

### Verification Summary
- pytest **84 passed** / validate:grid 66 / lint 0 errors / tsc 0 errors / **build 통과** / QA 13/13 / alembic check 클린·drift 0 (head=ea501237b804)

### Remaining Risks / Follow-ups
- ~~vouchers 화면 생성 직후 상세 패널 선택 레이스~~ → VH-CANDIDATES-20260711에서 해결
- ~~VibeGrid v2 설계 후 Wave 1 재개~~ → VH-CANDIDATES-20260711에서 완료
- 퇴직소득세 상수(2026)는 세법 개정 시 SEVERANCE_TAX_TABLE 연도 키 추가 필요

## TASK VH-CANDIDATES-20260711 — 후보 4건 일괄 처리 (VibeGrid v2·Wave 1 / 정리 / 스테일 DB) + 원격 푸시
- Date: 2026-07-11
- Status: completed
- Mode: Execution
- Risk Class: R2 (공유 그리드 모듈 + 11화면)
- Approval Status: approved (사용자: "다음 후보 작업 다 진행하고 오류 없는지 확인한 후에 푸시해")
- Owner: kms (계획·리뷰 Fable, 구현 Sonnet 2건 병렬)

### Result
1. **VibeGrid v2 + Wave 1 재전환** (6커밋 348f0cd~213eaa9, 리뷰 PASS):
   - v2 additive props 4종: beforeGrid/afterGrid(슬롯 passthrough), fetchAdapter(비표준 응답 정규화), transformRows(클라이언트 필터)
   - **v1 잠복 버그 발견·수정**(f6c9c84): onQuery 핸들러가 fetchUrl을 stale closure로 스냅샷 → 필터 적용에 조회 2클릭 필요하던 결함. SWR 키를 prop 직접 파생으로 변경. **계약 주의**: fetchUrl은 반드시 "적용된(applied) 필터 상태"에서 파생할 것 — 라이브 입력 상태 직결 시 타이핑마다 fetch됨
   - 전환 11화면: mng 8종 전부(CRUD 폼→beforeGrid, 듀얼 요약그리드→afterGrid), hr.retire.checklist, wel.benefit-types, tim.annual-leave. VibeGrid 총 사용처 16화면
   - 보류 1: org.dept-history — useMenuActions().can() 권한 기반 툴바 숨김을 VibeGrid 미지원, 전환 시 권한 UI 회귀라 보류 (v2.1 후보: 권한 인지 툴바)
2. **정리** (88356e5, d3de46f, 리뷰 PASS): init_db DO$$ + bootstrap ensure_*_schema 3종 제거(베이스라인 대조 후, fresh DB 부트 패치 없이 성공 검증), vouchers 선택 레이스 isSubmitting 가드
3. **동일 레이스 픽스업** (메인 세션 직접): hr-retire-approval-manager에도 같은 가드 적용
4. **스테일 DB 삭제**: vibe_hr_stale_20260709 → pg_dump 백업(output/db-backups/, 3.8MB) 후 DROP. 남은 DB: myhr, ehr6(별개)

### Verification Summary
- pytest 84 / validate:grid 66 / lint 0 errors / tsc 0 / build 통과 / **QA 23/23** (기존 13 + 전환 10 route) / drift 0
- mng 화면들은 시드(회사) 부재로 CRUD 폼 실제 제출은 미검증 — 렌더+콘솔에러 0+네트워크 파라미터 정합+코드 패리티로 갈음 (원장 기록)

### Follow-ups
- VibeGrid v2.1: 권한 인지 툴바(useMenuActions 연동) → org.dept-history 전환 재개
- mng 화면 CRUD 실검증용 mng.companies 시드 보강

## 운영 원칙 요약
- 기록 없는 중요한 작업은 추적 불가 작업으로 본다. [Proposal]
- R2/R3는 ledger 없이 완료 처리하지 않는다. [Proposal]
- 완료 보고는 이 문서와 일관돼야 한다. [Proposal]

## TASK VH-VIBE-GRID-QA-PLAN-20260708 — vibe-grid 활용 계획 정리
- Date: 2026-07-08
- Status: completed
- Mode: Planning
- Risk Class: R0
- Approval Status: not_required

### Goal
- 디자인 개편은 보류하고, `vibe-grid`를 HR 라이프사이클 QA와 AG Grid 표준 검증에 활용하는 방안을 문서화한다.

### Changed Files
- `docs/VIBE_GRID_LIFECYCLE_QA_PLAN.md`
- `docs/TASK_LEDGER.md`

### Verification Summary
- `frontend: npm run validate:grid` 통과
- 등록 AG Grid 화면 수: 60개

### Result
- 채용, 인사정보, 조직발령, 근태, 복리후생, 급여, 퇴직 화면을 `grid-screens.json` registry key 기준으로 매핑했다.
- 급여→전표는 등록 화면과 모듈이 없어 R3 설계 승인 전까지 명시적 gap으로 유지한다.
- `/hr/retire/approvals`는 현재 AG Grid registry 대상이 아니므로 별도 브라우저 QA 또는 AG Grid 등록 판단이 필요하다.

## TASK VH-QUIET-DEPTH-20260713 — Enterprise Quiet Depth UI/UX 개선
- Date: 2026-07-13
- Status: completed
- Mode: Execution / Ultragoal
- Risk Class: R2 (shared UI + 공통 AG Grid 표면)
- Approval Status: approved (사용자: 두 테마 개선, A 진행, 승인)

### Scope
- Standard/Vivid의 Light/Dark 네 조합에 semantic canvas/surface/elevation 계약 적용
- AppShell, Sidebar, Card, Dashboard chart, 공통 Grid의 시각 위계 및 반응형 UX 개선
- 브라우저 감사에서 발견한 축 잘림, 다크 Grid palette 불일치, mobile overlay stacking, 영문 복구 안내, 시계 hydration 오류 수정
- 인증/권한/급여 업무 의미/API/DB/배포 계약은 변경하지 않음

### Changed Files
- `frontend/src/app/globals.css`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/components/ui/card.tsx`
- `frontend/src/components/grid/manager-layout.tsx`
- `frontend/src/components/layout/app-shell.tsx`
- `frontend/src/components/dashboard/dashboard-sidebar.tsx`
- `frontend/src/components/dashboard/dashboard-charts.tsx`
- `frontend/src/components/dashboard/dashboard-attendance-panel.tsx`
- `frontend/src/lib/ui/quiet-depth-contract.test.ts`
- `docs/superpowers/plans/2026-07-13-vibe-hr-quiet-depth-implementation.md`

### Verification Summary
- `npm run validate:grid`: PASS
- `npm run test`: PASS (4 files, 22 tests)
- `npm run lint`: PASS (0 errors, 기존 범위 외 warning 15건)
- `npm run build`: PASS (Next.js production build, 178 pages)
- AI slop cleanup: PASS/no-op (변경 파일 한정, dead/debug/중복/불필요 추상화 없음)
- Browser: Standard/Vivid Light/Dark dashboard, Standard/Vivid Dark vouchers, 390x844 mobile sidebar 확인
- Fresh browser runtime: 한국어 서울 시계, 411x224 chart SVG 2개, warning/error 0건
- Visual verdict: iteration 18, 97/100, PASS
- Independent review: code-reviewer `APPROVE`, architect `CLEAR`

### Evidence
- `output/design-review/quiet-depth/dashboard-standard-light.png`
- `output/design-review/quiet-depth/dashboard-standard-dark-hydration-clean.png`
- `output/design-review/quiet-depth/dashboard-vivid-light.png`
- `output/design-review/quiet-depth/dashboard-vivid-dark.png`
- `output/design-review/quiet-depth/dashboard-vivid-dark-neutral-nav.png`
- `output/design-review/quiet-depth/dashboard-vivid-light-neutral-nav.png`
- `output/design-review/quiet-depth/vouchers-standard-dark.png`
- `output/design-review/quiet-depth/vouchers-vivid-dark-fixed.png`
- `output/design-review/quiet-depth/mobile-sidebar-standard-dark-fixed.png`
- Commits: `c9448dc`, `92fa90c`, `511bfce`, `6edf40b`, `adaed44`, `98402a5`

### Remaining Risks / Follow-ups
- 전체 lint의 범위 외 warning 15건은 기존 기술부채로 유지한다.
- 실제 브라우저 검증은 대표 dashboard/vouchers/mobile 화면 기준이며 모든 178개 route의 픽셀 회귀 검사는 아니다.

## TASK VH-GRID-RETIREMENT-MUTATION-QA-20260722 — Grid retirement mutation regression evidence
- Date: 2026-07-22
- Status: completed
- Mode: Execution / verification
- Risk Class: R1
- Approval Status: not_required (테스트·원장만 변경)

### Goal
- retirement 관련 화면의 mutation 가능 경로 12개와 read-only 경로 3개에 대해, 서비스 단위 및 실제 UI E2E 회귀 검증을 완료한다.

### Classification and Safety
- Mutation-capable: 12개. backend 서비스 mutation 단위 테스트는 disposable SQLite를 사용하므로 영속 업무 데이터에 쓰지 않는다.
- Read-only: 3개. Playwright workflow mutation은 route-isolated mock/route interception으로 검증하여 local backend 업무 데이터에 쓰지 않는다.

### Changed Files
- `docs/superpowers/plans/2026-07-22-grid-retirement-mutation-regression.md`
- `backend/tests/test_grid_retirement_mutation_services_unit.py`
- `frontend/tests/e2e/grid-retirement-mng-crud.spec.ts`
- `frontend/tests/e2e/grid-retirement-workflow-mutations.spec.ts`
- `docs/TASK_LEDGER.md`

### Commands Run / Verification Summary
- `backend: python -m pytest -q` — PASS: 93 passed, warnings 106 (FastAPI/Starlette `asyncio.iscoroutinefunction` deprecation).
- `frontend: npm run validate:grid` — PASS: validator가 수치 count는 출력하지 않았고, 등록된 모든 AG Grid 화면 통과를 보고.
- `frontend: npm run lint` — PASS: 0 errors, 15 warnings (기존 범위 밖 unused variable/Hooks dependency 경고).
- `frontend: npx tsc --noEmit` — PASS: 0 diagnostics.
- `frontend: npm test` — PASS: 5 test files, 24 tests.
- `frontend: npx playwright test tests/e2e/lifecycle-grid-qa.spec.ts tests/e2e/grid-retirement-mng-crud.spec.ts tests/e2e/grid-retirement-workflow-mutations.spec.ts --workers=1 --reporter=line` — PASS: 38 tests, Node `NO_COLOR`/`FORCE_COLOR` warnings 2건.
- `frontend: npm run build` — PASS: Next.js production build; prebuild `validate:grid`도 PASS.

### Scope Review
- 기준 `602c751` 이후 tracked diff는 plan 1개, backend test 1개, frontend E2E test 2개, 본 ledger 1개뿐이다.
- production/API/schema/migration/shared grid/config/CSS/data 파일 변경은 0개다. 기존 user untracked 파일은 보존하고 검증 범위에서 제외했다.

### Remaining Risks
- 인증 및 메뉴 권한을 포함하는 실제 서비스 통합 검증은 local service 환경과 해당 권한 시드가 필요하다.

## TASK VH-R3-FLYWAY-SEED-REMEDIATION-20260801
- Date: 2026-08-01
- Status: completed
- Mode: Execution / verification
- Risk Class: R3 (Flyway migration, reference data, and fixture seeding)
- Approval Status: approved (user explicitly authorized the bounded R3 remediation)
- Owner: Terra executor

### Scope
- Reconcile canonical Python bootstrap reference rows in V3 by natural key without overwriting noncanonical business rows; retain source stale-menu retirement behavior.
- Make V3 generation atomic, PostgreSQL-parseable, deterministic, and auditable against the 1,377-row source inventory.
- Gate dev/demo fixtures on an explicit local/dev profile, `VIBEHR_ALLOW_FIXTURE_SEEDING=true`, and a non-production loopback PostgreSQL target.
- Validate exact successful V1/V2 Flyway adoption history and update the cutover/operator documentation.

### Evidence
- `node scripts/spring-migration/flyway-verify.js`: PASS; verified Alembic head, all 66 seed ownership records, and all 1,377 required reference rows.
- `backend-spring: .\\gradlew.bat -I "$env:LOCALAPPDATA\\Temp\\vibehr-terra-gradle.init.gradle" compileJava compileMigrationTestJava test --rerun-tasks --console=plain`: PASS.
- `backend-spring: .\\gradlew.bat -I "$env:LOCALAPPDATA\\Temp\\vibehr-terra-gradle.init.gradle" migrationIntegrationTest --rerun-tasks --console=plain`: PASS; 10 ownership-transfer checks plus 1 whole-application Hibernate validation on PostgreSQL 16.
- `backend-spring: .\\gradlew.bat -I "$env:LOCALAPPDATA\\Temp\\vibehr-terra-gradle.init.gradle" integrationTest --tests com.vibehr.time.TimePostgreSqlIntegrationTest --rerun-tasks --console=plain`: PASS; 5 real TIM PostgreSQL checks.
- Atomic regeneration retained V3 SHA-256 `564BAF8E350C4E1A001CA992C1CD60C85D7D465C08DEF23C990B5FA8B9C99AB4`; generator verification matched the checked-in V3 and manifest byte-for-byte.

### Remaining Risks
- The V1/V2/V3 ownership transfer has no reverse migration. Follow the documented backup-and-stop recovery procedure instead of manually editing either migration history.
<!-- IMMUTABLE PRE-CUTOVER ARCHIVE: historical FastAPI/Alembic evidence only; not an executable Spring operating instruction. -->
