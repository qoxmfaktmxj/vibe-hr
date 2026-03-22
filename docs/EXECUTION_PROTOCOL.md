Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# EXECUTION_PROTOCOL.md

## 목적
이 문서는 Vibe-HR에서 실제 구현/수정/검증 작업을 수행할 때 따르는 실행 규약을 정의한다. 목표는 매 작업마다 계획-실행-검증-보고 루프를 일관되게 적용하고, evidence 없는 완료 선언을 막는 것이다.

## 이 문서의 역할
이 문서는 거버넌스 원문을 반복하는 문서가 아니다. 다음 빈틈을 채운다.
- 실행 입력 계약
- 작업 분해 기준
- 실행 프로파일
- 검증 checkpoint
- 실패 분류와 대응
- Completion Evidence 형식
- Task Ledger 연결 규칙

## Canonical 연결
- Governance / approvals / risk classes: `docs/GOVERNANCE.md`
- Architecture / domains / hotspots: `docs/ARCHITECTURE.md`
- Testing / validation: `docs/TEST_STRATEGY.md`
- Work evidence / trace: `docs/TASK_LEDGER.md`
- Active execution plans: `docs/exec-plans/active/*`

## 실행 입력 계약
실행을 시작하려면 가능한 한 아래 입력을 갖춘다.

### 필수
1. Task Request
2. Scope / Non-Goals
3. Risk Level (`R0` / `R1` / `R2` / `R3`)
4. Approval Status
5. Validation Plan

### 강력 권장
6. 관련 canonical 문서
7. 관련 파일 목록
8. 최근 실패 로그 / 에러 메시지 / 테스트 결과
9. 관련 execution plan 또는 product spec
10. 도메인 분류 (`auth` / `data` / `api` / `ui` / `infra` / `legacy hotspot`)

입력이 부족하면 바로 구현하지 말고 부족한 입력을 먼저 명시한다.

## 실행 프로파일
### Profile A — Direct Single-Agent
적합:
- R0 / R1
- 영향 범위 좁음
- 변경 파일 수 적음
- 검증 루프 단순

예:
- 테스트 추가
- 로컬 버그 수정
- 내부 리팩터링
- 문서 보강

### Profile B — Controlled Multi-Step
적합:
- R1 / R2
- 설계와 구현을 분리해야 함
- 검증 checkpoint가 둘 이상 필요함

예:
- 기능 추가
- 공개 인터페이스에 닿는 수정
- 큰 리팩터링
- 외부 연동 안정화

### Profile C — High-Risk Controlled
적합:
- R3
- 승인과 검증 없이는 진행하면 안 됨
- rollback 계획 필수

예:
- auth / permission
- migration
- billing / payroll semantics
- deployment / infra
- 민감 데이터 경로

## OMX / Agent Orchestration 매핑
이 프로젝트에서 orchestration은 다음 시점에 실제로 발생한다.

- Layer 2: 서브에이전트 구조와 승인 경계를 설계한다.
- Layer 4: 실행 surface와 기계적 gate를 도구에 투영한다.
- **Layer 5: 실제 작업을 planner / executor / verifier 흐름으로 수행한다.**
- Layer 6: orchestration 결과를 계측하고 policy를 조정한다.

### 권장 런타임 매핑
- Profile A → 단일 executor
- Profile B → planner → executor → verifier
- Profile C → planner → specialist review/security/QA → executor → verifier → human approval

## 표준 실행 루프
### Step 0 — Context Read
반드시 먼저 확인:
- 관련 canonical 문서
- 승인 정책
- 리스크 수준
- 기존 테스트 전략
- tool enforcement 존재 여부

### Step 1 — Execution Packet 작성
실행 전에 다음을 정리한다.

```md
# EXECUTION PACKET

## Task Summary
- 요청 요약:
- 작업 유형:
- 목표:
- 비목표:

## Evidence Basis
- [Observed]:
- [User-stated]:
- [Derived]:
- [Assumption]:
- [Missing]:

## Scope
- 변경 예정 파일/영역:
- 건드리면 안 되는 영역:

## Risk & Approval
- 위험도:
- 승인 상태:
- 추가 승인 필요 조건:

## Validation Plan
- lint:
- typecheck:
- unit:
- integration:
- contract:
- build:
- 기타:

## Execution Profile
- Profile A / B / C
- 선택 이유:

## Stop Conditions
- 즉시 멈춰야 하는 조건:
```

### Step 2 — Task Decomposition
아래 중 하나면 작업을 쪼갠다.
- 변경 이유가 둘 이상이다.
- 파일/도메인이 둘 이상 섞인다.
- 공개 인터페이스와 내부 구현이 동시에 바뀐다.
- 테스트 전략이 하나로 설명되지 않는다.
- R2 이상이다.

분해 원칙:
1. 보호 장치 확보
2. 구조 변경
3. 행동 변경

### Step 3 — Execute in Small Verified Batches
- 변경은 작은 묶음으로 수행한다.
- 의미 없는 대량 수정은 피한다.
- 각 배치의 의도를 남긴다.
- 민감 구역은 검증 없이 연속 수정하지 않는다.

### Step 4 — Verification Checkpoint
각 배치 후 가능한 한 확인한다.
- 테스트가 실제로 실패/성공했는가
- 타입/린트/빌드가 깨지지 않았는가
- spec/plan과 충돌하지 않는가
- scope creep가 발생하지 않았는가

### Step 5 — Failure Handling
실패는 숨기지 않고 다음으로 분류한다.
- `INPUT_GAP`
- `SPEC_CONFLICT`
- `TEST_FAILURE`
- `ENV_FAILURE`
- `TOOL_FAILURE`
- `RISK_ESCALATION`
- `SCOPE_CREEP`
- `FLAKY_SIGNAL`
- `SECURITY_CONCERN`
- `ROLLBACK_NEEDED`

### Step 6 — Completion Report 작성
작업 종료 시 변경 결과와 증거를 남긴다.

## retry / replan / stop / rollback 규칙
### Retry
적합:
- 일시적 환경 문제
- flaky 신호 의심
- 사소한 구현 실수

### Replan
적합:
- 분해 방식이 잘못됨
- 범위가 예상보다 넓음
- 인터페이스 영향이 새로 드러남
- 테스트 전략이 부족함

### Stop
적합:
- 승인 범위를 넘음
- 민감 구역이 새로 발견됨
- canonical 문서와 충돌함
- 안전한 검증 없이 진행해야 함

### Rollback
적합:
- 회귀 유발
- 데이터/보안/운영 위험 발생
- 핫픽스 우회가 임시였음

## 작업 유형별 실행 원칙
### 신규 기능
- acceptance 기준부터 확인
- integration 또는 acceptance test 먼저 정의 가능하면 선행
- observability 포인트 확인

### 버그 수정
- 재현 경로 명시
- 가능하면 failing regression test 우선
- 수정 후 재현 불가 검증

### 리팩터링
- 동작 보호 테스트가 먼저
- 구조 변경과 행동 변경을 섞지 않음

### 레거시 변경
- characterization test 또는 최소 안전망부터 확보
- 이상적인 구조 강제를 즉시 시도하지 않음

### DB / Migration
- schema 변경 의도 / 영향도 / rollback 가능성 먼저 정리
- 기본적으로 R3로 다룸

### 문서 / 설정 변경
- canonical 문서인지 projection 문서인지 구분
- tool-specific 파일은 canonical 내용을 복제하지 않음

## 멈춤 조건
다음 중 하나면 진행을 멈추고 보고한다.
1. 위험도가 R3로 상승했다.
2. 승인되지 않은 외부 인터페이스 변경이 필요하다.
3. auth / billing / migration / infra / secret 경로에 닿는다.
4. 테스트/빌드/계약 검증이 전혀 불가능하다.
5. canonical 문서와 실제 repo 상태가 크게 충돌한다.
6. 작업 목표가 구현보다 조사에 가깝다는 것이 드러난다.
7. 범위가 두 배 이상 확장된다.

## Completion Evidence 규칙
완료를 주장하려면 최소한 아래를 남긴다.

```md
# EXECUTION REPORT

## Task Summary
- 무엇을 바꾸려 했는가:
- 실제로 무엇을 바꿨는가:

## Changed Files
- file/path:
- file/path:

## Commands Run
- command:
- command:

## Validation Results
- passed:
- failed:
- not run:
- why:

## Risk Notes
- 새로 발견된 위험:
- 승인/정책 관련 메모:

## Assumptions / Missing
- [Assumption]:
- [Missing]:

## Outcome
- status: done / partial / blocked / rolled-back
- 이유:

## Next Step
- 즉시 다음 작업:
- 추가 승인 필요 여부:
```

## Task Ledger Entry 규칙
모든 의미 있는 실행 작업은 `docs/TASK_LEDGER.md`에 연결 가능해야 한다.
최소 필드:
- Task ID
- Date
- Type
- Risk
- Status
- First-Pass Validation
- Retry Count
- Review Needed
- Rollback
- Notes

## 현재 Vibe-HR 적용 기본값
- Pilot 액션 권한 시범 적용은 `Profile B — Controlled Multi-Step`로 본다.
- R2 작업은 최소 planner → executor → verifier 사고흐름을 따른다.
- 실제 실행 결과는 `docs/TASK_LEDGER.md`에 기록한다.
- 반복 작업이 3건 이상 누적되면 `docs/evals/EVAL_SUMMARY.md`로 Layer 6 평가를 시작한다.
