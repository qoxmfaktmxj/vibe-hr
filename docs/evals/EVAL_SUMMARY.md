Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# EVAL_SUMMARY.md

## 목적
이 문서는 Layer 5 실행 작업이 반복된 뒤, AI 운영 성과와 실패 신호를 최소 계측 기준으로 요약한다.

중요:
- 숫자를 지어내지 않는다.
- 위험도와 작업 유형이 다른 항목을 무리하게 섞지 않는다.
- 평가 목적은 AI를 좋아 보이게 만드는 것이 아니라, 자동화 범위를 넓혀도 되는지 판단하는 것이다.

## 현재 권장 계측 수준
- Level: **Level 1 — Manual Ledger**

### 이유
- 현재는 solo 개발 단계다. [User-stated]
- Pilot 중심으로 실행 작업을 축적하는 단계다. [Derived]
- `docs/TASK_LEDGER.md`를 이미 canonical source로 사용 중이다. [Observed]
- 따라서 별도 자동 파이프라인보다 수기 ledger + 짧은 eval summary가 적절하다. [Proposal]

## 데이터 원본
- `docs/TASK_LEDGER.md`
- 실행 명령 및 테스트 결과
- CI / build 결과
- 리뷰 코멘트 또는 수정 요청
- rollback / hotfix 기록
- flaky / environment / tool failure 기록

없는 데이터는 `[Missing]`으로 표시한다.

## 평가 기간
- from: TBD
- to: TBD
- task_count: TBD

## Segmentation
반드시 아래 기준으로 분리해 본다.
- by_risk: R0 / R1 / R2 / R3
- by_type: docs / test / bugfix / feature / refactor / migration / infra
- by_domain: auth / data / api / ui / infra / legacy hotspot

## Core Metrics
- Task Completion Rate: TBD
- Blocked Rate: TBD
- First-Pass Validation Rate: TBD
- Final Validation Pass Rate: TBD
- Retry Rate: TBD
- Replan Rate: TBD
- Rollback Rate: TBD
- Review Rework Rate: TBD
- Flaky Signal Rate: TBD

## Strong Signals
- 잘 되는 작업: TBD
- 자주 막히는 작업: TBD
- 검토 부담이 큰 작업: TBD
- 회귀 위험이 큰 작업: TBD

## Weak / Uncertain Signals
- 데이터 부족으로 확실히 말하기 어려운 영역: TBD
- 환경 문제 비중이 큰 영역: TBD
- task 수가 너무 적어 결론 보류인 영역: TBD

## Policy Interpretation
- 자동화 확대 가능 영역: TBD
- 유지해야 하는 영역: TBD
- 자동화 축소 또는 승인 강화가 필요한 영역: TBD
- 추가 계측이 필요한 영역: TBD

## Proposed Adjustments
1. TBD
2. TBD
3. TBD

## Governance Update Handoff
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

## 현재 Vibe-HR 적용 규칙
- 최소 3건 이상의 의미 있는 실행 작업이 누적되기 전에는 큰 정책 변경 결론을 내리지 않는다. [Proposal]
- R2/R3 작업은 R0/R1과 별도로 본다. [User-stated]
- 쉬운 문서 작업으로 성공률을 부풀리는 해석을 금지한다. [Proposal]
