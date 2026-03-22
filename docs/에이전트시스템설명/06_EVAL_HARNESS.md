# Layer 6 — Eval Harness

이 파일은 **Layer 5의 실행 작업이 반복되기 시작한 뒤** 사용한다.  
목표는 AI가 실제로 도움이 되는지, 어디서 실패하는지, 자동화 범위를 넓혀도 되는지를 **운영 근거로 판단** 하는 것이다.

중요: 이 문서는 화려한 대시보드나 모델 벤치마크를 만드는 문서가 아니다.  
이 문서의 핵심은 **실제 작업 로그를 기반으로 운영 결정을 내리는 최소 계측 체계** 다.

- 이전 단계: `05_EXECUTION_PROTOCOL.md`
- 이 단계의 완료물: **Task Ledger**, **Eval Summary**, **Policy Adjustment Proposal**
- 금지: 숫자 지어내기, 지표 놀이, 서로 다른 위험도/작업유형을 무리하게 한데 묶어 비교하기

---

## 사람 사용법

1. 동일한 방식의 작업을 3건 이상 수행했거나, 자동화 범위를 조정할지 판단하고 싶을 때 이 파일을 AI에게 붙여 넣는다.
2. 가능하면 아래를 함께 제공한다.
   - Layer 5의 Handoff Packet
   - Task Ledger Entries
   - 테스트/CI 로그
   - 리뷰 코멘트
   - rollback 또는 회귀 이슈 기록
3. AI에게 “성능을 좋게 보이게” 하는 것이 아니라, **실제 운영 신호를 정리하라** 고 요구한다.
4. 결과로 나온 Eval Summary를 바탕으로 Layer 2의 승인 정책, 자동화 범위, 품질 점수를 갱신할지 결정한다.

---

## 언제 쓰고, 언제 안 쓰는가

### 쓰는 것이 좋은 경우
- AI 작업이 반복되고 있다.
- 어떤 유형의 작업은 잘 되고, 어떤 유형은 자꾸 실패한다.
- 승인 기준을 완화/강화할 근거가 필요하다.
- 팀이 “AI가 실제로 생산적인가?”를 감이 아니라 데이터로 판단하고 싶다.

### 굳이 안 써도 되는 경우
- 아직 실제 실행 작업이 거의 없다.
- 1~2회 실험만 해봤다.
- 데이터를 남길 의지가 전혀 없다.
- 이번 목적이 단순히 문서 초안 몇 개 생성인 경우다.

즉, 이 문서는 **운영형 반복 사용** 이 있을 때 가치가 커진다.  
일회성 사용이라면 과하다.

---

## AI에게 전달할 지시문

너는 지금부터 이 프로젝트의 **운영 평가 분석자** 로 동작한다.  
목표는 AI를 좋게 보이게 하는 것이 아니라, **실제 성과와 실패를 분리하고, 자동화 범위를 조정할 근거를 만드는 것** 이다.

중요 원칙:

1. 숫자를 지어내지 마라.
2. 근거 없는 성공률 추정은 금지다.
3. 작업 유형, 위험도, 검증 수준이 다른 항목을 무리하게 섞지 마라.
4. 한두 건의 사례로 큰 결론을 내리지 마라.
5. 운영 결론은 가능하면 `확장 / 유지 / 축소 / 조사 필요` 중 하나로 정리하라.
6. 지표는 **의사결정을 돕기 위한 수단** 이지 목적이 아니다.
7. 품질 점수(`QUALITY_SCORE.md`)와 operational eval을 혼동하지 마라.

---

## 1. 이 문서가 채우는 빈틈

기존 문서에는 다음이 이미 있다.
- 프로젝트 수준 품질 점수
- 승인 정책
- 테스트 전략
- 위험도 분류

하지만 아직 별도로 필요한 것은 다음이다.
- AI 작업 하나하나가 실제로 성공했는지 보는 방법
- 실패 유형이 무엇인지 누적해서 보는 방법
- 어느 구간에서 사람 검토 부담이 커지는지 보는 방법
- 자동화 범위를 넓혀도 되는지, 오히려 줄여야 하는지 판단하는 방법

즉:
- `QUALITY_SCORE.md` 는 **프로젝트 상태** 에 가깝고
- `EVAL_HARNESS` 는 **AI 운영 성과** 에 가깝다.

둘은 연결되지만 같은 것이 아니다.

---

## 2. 계측 수준(Level) 선택

프로젝트 성숙도에 따라 아래 중 하나를 택하라.

### Level 0 — No Eval
적합:
- 일회성 사용
- 탐색 단계
- 반복 작업이 아직 없음

이 경우 굳이 이 문서를 운영에 넣지 않아도 된다.

### Level 1 — Manual Ledger
기본 권장안.

적합:
- 개인 또는 소규모 팀
- Task 수가 많지 않음
- 먼저 운영 신호만 보고 싶음

구성:
- Task Ledger 수기 기록
- 주간 또는 5~10건 단위 요약

### Level 2 — Segmented Operational Review
적합:
- 작업 유형이 다양함
- R2/R3가 섞임
- 승인 정책을 조정해야 함

구성:
- risk별 / task type별 분리 집계
- 리뷰 부담 / 재작업 / rollback 신호 포함

### Level 3 — Automated Eval Pipeline
적합:
- 작업량이 충분히 많음
- CI/PR/log에서 데이터 추출 가능
- 운영 자동화 투자 가치가 있음

구성:
- 자동 집계
- 추세 리포트
- 정책 변경 트리거 연동

중요: 대부분의 팀은 **Level 1 또는 2면 충분** 하다.  
처음부터 Level 3로 가려는 것은 대개 과잉이다.

---

## 3. 최소 데이터 원본

가능하면 아래 증거를 우선 사용하라.

1. Task Ledger Entry
2. 실행 명령과 테스트 결과
3. CI / build 결과
4. 리뷰 코멘트 또는 수정 요청
5. rollback / hotfix 기록
6. flaky test / 환경 오류 기록
7. 승인 요청 및 승인 지연 기록

없으면 `[Missing]` 으로 표시하고, 없는 데이터를 상상해서 채우지 마라.

---

## 4. 핵심 지표 체계

지표는 크게 6개 묶음으로 본다.

### 4.1 Outcome Metrics
- Task Completion Rate
- Blocked Rate
- Partial Completion Rate

### 4.2 Validation Metrics
- First-Pass Validation Rate
- Final Validation Pass Rate
- Test Addition Rate

### 4.3 Rework Metrics
- Retry Rate
- Replan Rate
- Review Rework Rate

### 4.4 Safety Metrics
- Rollback Rate
- Regression Incident Rate
- Policy Violation Count

### 4.5 Review Burden Metrics
- Human Review Needed Rate
- High-Comment Rate
- Clarification Loop Count

### 4.6 Reliability Metrics
- Flaky Signal Rate
- Environment Failure Rate
- Tool Failure Rate

---

## 5. 지표 정의

숫자 해석이 흔들리지 않도록 최소 정의를 고정하라.

### Task Completion Rate
완료(`done`)된 작업 수 / 전체 작업 수

### Blocked Rate
`blocked` 또는 승인 부족/입력 부족으로 중단된 작업 수 / 전체 작업 수

### First-Pass Validation Rate
재시도/재계획 없이 첫 검증 세트가 통과된 작업 수 / 검증이 실행된 전체 작업 수

### Final Validation Pass Rate
최종 상태에서 필수 검증을 통과한 작업 수 / 검증이 필요한 전체 작업 수

### Retry Rate
재시도를 1회 이상 한 작업 수 / 전체 작업 수

### Replan Rate
중간에 계획을 다시 짠 작업 수 / 전체 작업 수

### Review Rework Rate
리뷰 후 추가 수정이 필요했던 작업 수 / 리뷰된 전체 작업 수

### Rollback Rate
rollback된 작업 수 / 전체 작업 수

### Regression Incident Rate
완료 후 회귀가 발견된 작업 수 / 완료 작업 수

### Human Review Needed Rate
사전/사후 인간 검토가 필요한 작업 수 / 전체 작업 수

### Flaky Signal Rate
검증 실패 원인이 코드보다 flaky 신호였던 작업 수 / 전체 작업 수

정밀한 계산이 어렵다면, 최소한 **분모와 분자 정의를 문서에 고정** 하라.

---

## 6. 반드시 분리해서 봐야 하는 기준

아래는 한데 섞으면 안 된다.

1. 위험도
   - R0/R1 vs R2/R3
2. 작업 유형
   - docs / test / bugfix / feature / refactor / migration / infra
3. 도메인
   - auth / data / api / ui / infra / legacy hotspot
4. 검증 수준
   - lint만 돈 작업 vs integration/contract까지 돈 작업

예를 들어:
- 문서 작업 성공률 95%
- migration 작업 성공률 60%

이 둘을 평균 내는 것은 운영적으로 큰 의미가 없다.

---

## 7. 최소 운영 산출물

복잡한 시스템을 만들기 전에 아래 두 개면 충분하다.

### 7.1 `docs/evals/TASK_LEDGER.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# TASK_LEDGER.md

| Task ID | Date | Type | Domain | Risk | Status | First-Pass Validation | Final Validation | Retry Count | Replan | Review Needed | Rollback | Regression Found Later | Notes |
|---|---|---|---|---|---|---|---|---:|---|---|---|---|---|
| TASK-001 | YYYY-MM-DD | bugfix | api | R1 | done | yes | yes | 1 | no | yes | no | no | regression test added |
```

### 7.2 `docs/evals/EVAL_SUMMARY.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# EVAL_SUMMARY.md

## Window
- from:
- to:
- task_count:

## Segmentation
- by_risk:
- by_type:
- by_domain:

## Core Metrics
- Task Completion Rate:
- Blocked Rate:
- First-Pass Validation Rate:
- Final Validation Pass Rate:
- Retry Rate:
- Replan Rate:
- Rollback Rate:
- Review Rework Rate:
- Flaky Signal Rate:

## Strong Signals
- 잘 되는 작업:
- 자주 막히는 작업:
- 검토 부담이 큰 작업:
- 회귀 위험이 큰 작업:

## Policy Interpretation
- 자동화 확대 가능 영역:
- 유지해야 하는 영역:
- 자동화 축소 또는 승인 강화가 필요한 영역:
- 추가 계측이 필요한 영역:

## Proposed Adjustments
1.
2.
3.
```

---

## 8. 판정 규칙

지표는 단순 보고서가 아니라 **정책 조정 트리거** 여야 한다.

### 자동화 확대 후보
아래가 일정 기간 반복되면 고려 가능:
- R0/R1에서 높은 완료율
- 낮은 rollback / regression
- 낮은 review rework
- 검증 루프가 안정적

### 유지
다음이 혼재하면 유지:
- 성과는 나쁘지 않지만 risk가 중간 수준
- 일부 task type만 안정적
- 입력 품질에 따라 변동이 큼

### 자동화 축소 / 승인 강화
다음 신호가 반복되면 고려:
- R2/R3에서 rollback 또는 regression
- review rework가 지속적으로 큼
- policy violation 발생
- flaky/environment 이슈를 제외해도 실패가 잦음

### 조사 필요
다음은 즉시 결론 내리지 말고 원인을 분리해라.
- 환경 오류 때문에 실패가 많은 경우
- 데이터가 너무 적은 경우
- 작업 난이도 편차가 큰 경우

---

## 9. 안티패턴

아래는 피하라.

1. **지표 극장(metric theater)**
   - 숫자는 많지만 정책에 아무 영향이 없음
2. **허수 성공률**
   - 쉬운 문서 작업만 모아 성공률을 높게 보이게 함
3. **검증 무시**
   - 통과한 척하지만 실제 테스트가 없거나 약함
4. **리스크 혼합**
   - R0와 R3를 같이 묶어 평균값만 봄
5. **속도만 최적화**
   - review burden, rollback, regression을 무시함
6. **데이터 없는 강한 결론**
   - 사례 몇 개로 정책을 크게 바꿈

---

## 10. Layer 2 / QUALITY_SCORE와의 연결

평가 결과는 아래에 반영할 수 있다.

1. `02_GOVERNANCE_SPEC.md`
   - 승인 정책 조정
   - 자동화 허용 범위 조정
2. `docs/QUALITY_SCORE.md`
   - Operational Safety, Test Confidence 재평가 근거 제공
3. `docs/TEST_STRATEGY.md`
   - flaky 대응, 회귀 테스트 보강
4. `docs/SUB_AGENTS.md`
   - 어떤 작업을 단일 에이전트로 유지할지 조정
5. `04_TOOL_ADAPTERS.md`
   - 어떤 hook/CI gate를 추가할지 조정

즉, Eval Harness는 별도 섬이 아니라 **거버넌스 조정 장치** 여야 한다.

---

## 11. 이 단계의 출력 형식

반드시 아래 순서를 우선 사용하라.

1. 평가 대상 기간과 task 수
2. 데이터 품질 상태
   - 충분함 / 부족함 / 왜곡 가능성
3. segmentation 기준
4. 핵심 지표 표
5. 강한 신호와 약한 신호
6. 정책 해석
7. 자동화 확대/유지/축소 제안
8. 추가 계측 또는 문서 수정 제안

---

## 12. Handoff Packet for Governance Update

필요하면 아래 형식으로 Layer 2 갱신안까지 넘겨라.

```md
# HANDOFF PACKET FOR GOVERNANCE UPDATE

## Eval Window
- from:
- to:
- task_count:

## Reliable Signals
- ...

## Weak / Uncertain Signals
- ...

## Policy Changes Proposed
- approval:
- automation:
- validation:
- adapters:

## Docs to Update
- ...

## Do Not Change Yet
- ...
```

---

## 13. 이 단계 완료 기준

다음이 충족되면 이 문서는 쓸모 있게 작동한 것이다.

- 최소한 Task Ledger가 누적되고 있다.
- 성과를 위험도/작업유형별로 구분해 보고 있다.
- 숫자를 지어내지 않았다.
- 지표가 실제 정책 조정으로 연결된다.
- 대시보드가 없어도 운영 판단에 도움이 된다.

---

## 마지막 원칙

좋은 Eval Harness는 AI를 감시하기 위한 장식이 아니다.  
그 목적은 단 하나다.

> **어디까지 자동화해도 되는지, 어디서 인간 검토를 더 붙여야 하는지를 감이 아니라 근거로 판단하게 만드는 것**

그래서 이 문서는 크면 안 된다.  
처음에는 아주 작게 시작해도 충분하다.

- Task Ledger 몇 줄
- 짧은 Eval Summary 한 장
- 그리고 정책 조정 여부에 대한 명확한 결론

이 정도면 대부분의 팀에는 충분히 실용적이다.
