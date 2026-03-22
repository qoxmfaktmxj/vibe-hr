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

## 현재 시드 관측 (2026-03-22)
아래는 초깃값 관측이며 strong signal로 간주하지 않는다.
- permission pilot 관련 ledger entry가 생성됨
- backend boot blocker 복구 작업이 누적됨
- manual deploy 전환이 완료됨
- browser/manual 검증 항목이 쌓이기 시작함
- host Python 환경의 `pytest` 부재로 dockerized test fallback이 반복됨
- workflow steward 루프가 TIM 월마감처럼 workflow 연결점에 대한 characterization/unit test를 추가하기 시작함
- TIM 월마감 검증이 service 단위에서 실제 수정 API lock(423)까지 확장되기 시작함
- workflow 9(월급여 대상자 선정)도 ‘재직 인원 기준’ 회귀 테스트로 점진 고정 중
- 대상자 선정 경계조건(전월 퇴사자 + 미래 입사 예정자 제외)을 테스트로 누적 고정하는 패턴이 자리잡기 시작함

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
