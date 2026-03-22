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

## 운영 원칙 요약
- 기록 없는 중요한 작업은 추적 불가 작업으로 본다. [Proposal]
- R2/R3는 ledger 없이 완료 처리하지 않는다. [Proposal]
- 완료 보고는 이 문서와 일관돼야 한다. [Proposal]
