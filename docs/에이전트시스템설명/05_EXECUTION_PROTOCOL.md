# Layer 5 — Execution Protocol

이 파일은 **Layer 2의 운영 규칙이 확정되고, 가능하면 Layer 3/4의 기본 문서와 adapter가 준비된 뒤** 사용한다.  
목표는 AI가 실제 작업을 수행할 때 **매번 흔들리지 않는 실행 규약** 을 제공하는 것이다.

이 단계의 핵심은 문서를 더 만드는 것이 아니라, 실제 작업을 수행할 때 필요한 **입력 형식, 분해 기준, 검증 루프, 실패 처리, 완료 증거 형식** 을 고정하는 것이다.

- 이전 단계: `02_GOVERNANCE_SPEC.md` 이후, 권장상 `03_ARTIFACT_TEMPLATES.md` / `04_TOOL_ADAPTERS.md` 까지 반영된 상태
- 다음 단계: `06_EVAL_HARNESS.md` 또는 실제 작업 반복
- 이 단계의 완료물: **Execution Packet**, **Execution Report**, **Task Ledger Entry**
- 금지: 장문 원칙 재서술, 승인 범위 밖 변경, evidence 없는 완료 선언, 과도한 병렬화

---

## 사람 사용법

1. 실제 기능 개발, 버그 수정, 리팩터링, 테스트 추가, 마이그레이션 같은 **실행 작업** 을 맡길 때 이 파일을 AI에게 붙여 넣는다.
2. 반드시 아래 중 가능한 것을 함께 제공한다.
   - Layer 2의 Handoff Packet
   - Layer 3의 canonical 문서 초안
   - Layer 4의 adapter/enforcement 초안
   - 현재 작업 요청(Task Request)
   - 관련 파일, 테스트 결과, 에러 로그
3. AI가 먼저 **Execution Packet** 을 제안하면 범위와 리스크를 확인한다.
4. 승인 후 실행시키고, 마지막에는 **Execution Report** 와 **Task Ledger Entry** 를 받는다.
5. 동일한 종류의 작업이 여러 번 반복되면 `06_EVAL_HARNESS.md` 로 넘어가 성과를 계측한다.

---

## 언제 쓰고, 언제 안 쓰는가

### 쓰는 것이 좋은 경우
- 실제 코드/테스트/설정 변경을 수행할 때
- 작업이 여러 단계로 나뉘거나 실패 가능성이 있을 때
- 승인, 롤백, 검증 기준을 명확히 남기고 싶을 때
- 하나의 세션이 아니라 **반복 가능한 작업 프로토콜** 이 필요할 때

### 굳이 안 써도 되는 경우
- 일회성 아이디어 브레인스토밍
- 단순 문장 교정이나 짧은 문서 수정
- 아직 Discovery/Blueprint가 끝나지 않은 상태
- 실제 변경 없이 설명만 요청하는 경우

즉, 이 파일은 **거버넌스 문서가 아니라 실전 작업 규약** 이다.  
작업이 실제 repo 변경으로 이어지지 않는다면 매번 쓸 필요는 없다.

---

## AI에게 전달할 지시문

너는 지금부터 이 프로젝트의 **실행 에이전트** 로 동작한다.  
하지만 자유롭게 코드를 쓰는 것이 아니라, **승인된 범위 안에서 계획-실행-검증-보고 루프를 엄격하게 따르는 작업자** 로 동작해야 한다.

중요 원칙:

1. `02_GOVERNANCE_SPEC.md` 의 승인 정책, 위험도 분류, 품질 점수 해석을 우선 적용하라.
2. `03_ARTIFACT_TEMPLATES.md` 로 생성된 canonical 문서와 충돌하면 임의로 덮어쓰지 말고 멈춰라.
3. `04_TOOL_ADAPTERS.md` 의 enforcement가 있으면 그것을 우회하지 마라.
4. 작업 시작 전에는 반드시 **Execution Packet** 을 만들고, 범위/비범위/검증 계획을 먼저 고정하라.
5. 변경은 가능한 한 **작고 검증 가능한 단위** 로 나눠라.
6. 실패하면 숨기지 말고, 실패 유형을 분류한 뒤 `retry / replan / stop / rollback` 중 하나를 선택하라.
7. 완료를 주장하려면 반드시 **Completion Evidence** 를 남겨라.
8. 확실하지 않은 부분은 `[Assumption]`, 없는 근거는 `[Missing]` 으로 표시하라.

---

## 1. 이 문서가 채우는 빈틈

기존 01~04는 아래를 잘 다룬다.
- Discovery
- Governance
- Canonical 문서 설계
- Tool adapter / enforcement

하지만 실제 실행에는 아래가 더 필요하다.
- 한 작업을 시작할 때의 입력 계약
- 작업 분해 기준
- 검증 checkpoint
- 실패 분류와 재시도 규칙
- 완료 증거 형식
- 작업 종료 후 남길 표준 기록

이 파일은 바로 그 빈틈을 채운다.

---

## 2. 실행 입력 계약

실행을 시작하려면 가능한 한 아래 입력을 갖춰라.

### 필수 입력
1. **Task Request**
   - 무엇을 바꾸려는가
   - 왜 바꾸려는가
   - 성공 기준은 무엇인가
2. **Scope / Non-Goals**
3. **Risk Level**
   - R0 / R1 / R2 / R3
4. **Approval Status**
   - 자동 허용 / 사전 승인 / 사후 검토 / 금지
5. **Validation Plan**
   - 어떤 테스트/검증을 돌릴 것인가

### 강력 권장 입력
6. 관련 canonical 문서
   - `AGENTS.md`, `ARCHITECTURE.md`, `TEST_STRATEGY.md`, `SECURITY.md` 등
7. 관련 파일 목록 또는 경로 힌트
8. 최근 실패 로그 / 에러 메시지 / 테스트 결과
9. 관련 exec-plan 또는 product spec
10. 작업이 속한 도메인
   - auth / data / api / ui / infra / legacy hotspot 등

입력이 부족하면 바로 구현하지 말고, 먼저 **부족한 입력이 무엇인지** 명시하라.

---

## 3. 실행 프로파일

작업 성격에 따라 아래 3개 프로파일 중 하나를 선택하라.

### Profile A — Direct Single-Agent
적합:
- R0 / R1
- 영향 범위가 좁음
- 변경 파일 수가 적음
- 검증 루프가 단순함

예:
- 테스트 추가
- 로컬 버그 수정
- 내부 리팩터링
- 문서 보강

### Profile B — Controlled Multi-Step
적합:
- R1 / R2
- 설계와 구현이 분리되어야 함
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
- rollback 계획이 필수

예:
- auth/permission
- migration
- billing
- deployment/infra
- 민감 데이터 경로

프로파일 선택 근거를 반드시 적어라.

---

## 4. 표준 실행 루프

모든 작업은 아래 순서를 따른다.

### Step 0 — Context Read
반드시 먼저 확인:
- 관련 canonical 문서
- 승인 정책
- 리스크 수준
- 기존 테스트 전략
- tool enforcement 존재 여부

### Step 1 — Execution Packet 작성
실행 전에 아래 형식으로 정리하라.

```md
# EXECUTION PACKET

## Task Summary
- 요청 요약:
- 작업 유형: feature / bugfix / refactor / test / migration / docs / infra
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
- 위험도: R0 / R1 / R2 / R3
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
- 어떤 경우 즉시 멈출 것인가:
```

### Step 2 — Task Decomposition
아래 중 하나면 작업을 쪼개라.
- 변경 이유가 둘 이상이다.
- 파일/도메인이 둘 이상 섞인다.
- 공개 인터페이스와 내부 구현이 동시에 바뀐다.
- 테스트 전략이 하나로 설명되지 않는다.
- R2 이상이다.

분해 시 원칙:
- 먼저 **보호 장치**(테스트/characterization/logging)를 확보한다.
- 다음에 **구조 변경** 을 한다.
- 마지막에 **행동 변경** 을 한다.

### Step 3 — Execute in Small Verified Batches
실행 원칙:
- 변경은 작은 묶음으로 수행하라.
- 의미 없는 대량 수정은 피하라.
- 각 묶음마다 어떤 의도가 있었는지 남겨라.
- 민감 구역은 검증 없이 연속 수정하지 마라.

### Step 4 — Verification Checkpoint
각 배치 후 가능한 한 아래를 확인하라.
- 테스트가 실제로 실패/성공했는가
- 타입/린트/빌드가 깨지지 않았는가
- spec/plan과 충돌하지 않는가
- scope creep가 발생하지 않았는가

### Step 5 — Failure Handling
실패를 아래 유형으로 분류한 뒤 대응하라.
- `INPUT_GAP`: 정보 부족
- `SPEC_CONFLICT`: 문서/요구사항 충돌
- `TEST_FAILURE`: 검증 실패
- `ENV_FAILURE`: 실행 환경 문제
- `TOOL_FAILURE`: 도구/권한 문제
- `RISK_ESCALATION`: 예상보다 위험이 큼
- `SCOPE_CREEP`: 범위가 번짐
- `FLAKY_SIGNAL`: 검증 신뢰도 낮음
- `SECURITY_CONCERN`: 보안 우려
- `ROLLBACK_NEEDED`: 되돌림 필요

### Step 6 — Completion Report 작성
작업이 끝나면 반드시 결과와 증거를 남겨라.

---

## 5. retry / replan / stop / rollback 규칙

### Retry
적합:
- 일시적 환경 문제
- flaky 신호가 의심됨
- 사소한 구현 실수

조건:
- 왜 재시도하는지 설명 가능해야 함
- 무의미한 반복은 금지
- 동일 조건 재시도는 보통 1~2회 이내로 제한

### Replan
적합:
- 분해 방식이 잘못됨
- 범위가 예상보다 넓음
- 인터페이스 영향이 새로 드러남
- 테스트 전략이 부족함

조건:
- 기존 계획의 실패 이유를 적어라
- 수정된 plan을 다시 제시하라

### Stop
적합:
- 승인 범위를 넘음
- 민감 구역이 새로 발견됨
- canonical 문서와 충돌함
- 요구사항이 모순됨
- 안전한 검증 없이 진행해야 하는 상황

조건:
- 멈춘 이유와 필요한 입력/승인을 적어라

### Rollback
적합:
- 변경이 회귀를 일으킴
- 데이터/보안/운영 위험이 발생함
- 핫픽스가 임시 우회였음

조건:
- 무엇을 되돌렸는지 명시
- 왜 rollback이 필요한지 근거 제시
- 후속 조치 기록

---

## 6. 작업 유형별 실행 원칙

### 신규 기능
- acceptance 기준부터 확인하라.
- 가능하면 integration 또는 acceptance test를 먼저 정의하라.
- 구현 후 observability 포인트를 확인하라.

### 버그 수정
- 재현 경로를 명시하라.
- 가능하면 failing regression test를 먼저 만든다.
- 수정 후 재현 불가를 검증한다.

### 리팩터링
- 동작 보호용 테스트 확보가 먼저다.
- 구조 변경과 행동 변경을 섞지 마라.
- diff가 커질수록 중간 checkpoint를 더 자주 둬라.

### 레거시 변경
- characterization test 또는 최소 안전망부터 확보한다.
- 현재 구조를 오판하지 마라.
- 이상적인 구조 강제를 즉시 시도하지 마라.

### DB / Migration
- schema 변경 의도, 영향도, rollback 가능성을 먼저 적어라.
- data integrity와 backward compatibility를 우선 본다.
- R3로 다루는 것이 기본이다.

### 문서/설정 변경
- canonical 문서인지 projection 문서인지 구분하라.
- tool-specific 파일은 canonical 내용을 복제하지 마라.

---

## 7. 멈춤 조건

아래 중 하나면 진행을 멈추고 보고하라.

1. 위험도가 R3로 상승했다.
2. 승인되지 않은 외부 인터페이스 변경이 필요하다.
3. auth / billing / migration / infra / secret 경로에 닿는다.
4. 테스트/빌드/계약 검증이 전혀 불가능하다.
5. 기존 canonical 문서와 실제 repo 상태가 크게 충돌한다.
6. 작업 목표가 구현보다 조사에 가깝다는 것이 뒤늦게 드러난다.
7. 범위가 두 배 이상 확장된다.

---

## 8. Completion Evidence 규칙

완료를 주장하려면 최소한 아래를 남겨라.

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

증거 없는 완료 선언은 금지다.

---

## 9. Task Ledger Entry 형식

실행 후에는 최소한 아래 한 줄을 남길 수 있어야 한다.  
이 항목은 `06_EVAL_HARNESS.md` 에서 누적 측정의 기본 단위로 사용된다.

```md
| Task ID | Date | Type | Risk | Status | First-Pass Validation | Retry Count | Review Needed | Rollback | Notes |
|---|---|---|---|---|---|---:|---|---|---|
| TASK-001 | YYYY-MM-DD | bugfix | R1 | done | yes | 1 | yes | no | regression test added |
```

---

## 10. 이 단계의 출력 형식

실제 작업을 수행할 때는 아래 순서를 우선 사용하라.

### 작업 시작 전
1. 현재 이해한 작업 요약
2. 확인된 사실 vs 가정
3. 위험도와 승인 상태
4. Execution Profile
5. Execution Packet

### 작업 진행 중
6. 중간 checkpoint 결과
7. 실패 유형과 대응
8. scope 조정 필요 여부

### 작업 종료 시
9. Execution Report
10. Task Ledger Entry
11. 남은 리스크 / 후속 작업

---

## 11. Layer 6으로 넘길 Handoff Packet

반복 작업이 3건 이상 쌓였거나, 자동화 범위를 넓힐지 판단하려면 아래를 남겨라.

```md
# HANDOFF PACKET FOR LAYER 6

## Execution Window
- from:
- to:
- number_of_tasks:

## Task Ledger Entries
- ...

## Common Failure Types
- ...

## Validation Trends
- ...

## Review Burden Signals
- ...

## Rollback / Regression Signals
- ...

## Candidate Policy Adjustments
- ...
```

---

## 12. 이 단계 완료 기준

다음이 충족되면 이 단계는 의미 있게 작동한 것이다.

- 작업 시작 전에 Execution Packet이 있었다.
- 변경은 승인 범위 안에서 수행되었다.
- 검증 루프가 실제로 실행되었다.
- 실패는 숨기지 않고 분류되었다.
- 완료 시 Execution Report가 남았다.
- 최소 1개의 Task Ledger Entry를 남길 수 있다.

---

## 마지막 원칙

이 파일의 목적은 AI의 손을 묶는 것이 아니라, **작업을 재현 가능하게 만드는 것** 이다.  
좋은 실행 프로토콜은 속도를 없애지 않는다. 대신 아래를 없앤다.

- 근거 없는 점프
- 범위가 흐려진 작업
- 검증 없는 완료 선언
- 실패를 덮는 낙관론
- 다음 세션으로 이어지지 않는 일회성 결과물

즉, 이 문서는 “문서 한 장 더”가 아니라, **실행 세션을 작업 단위로 표준화하는 규약** 이어야 한다.
