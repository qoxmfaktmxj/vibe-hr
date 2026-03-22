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

## 운영 원칙 요약
- 기록 없는 중요한 작업은 추적 불가 작업으로 본다. [Proposal]
- R2/R3는 ledger 없이 완료 처리하지 않는다. [Proposal]
- 완료 보고는 이 문서와 일관돼야 한다. [Proposal]
