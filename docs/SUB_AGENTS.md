Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: 2026-03-22
Confidence: Medium

# SUB_AGENTS.md

## 목적
Vibe-HR에서 필요한 경우에만 사용할 서브에이전트 구조와 책임 범위를 정의한다.

## 사용 원칙
- 작은 버그 수정/문서 보강은 단일 에이전트로 충분하면 분해하지 않는다.
- 역할 이름보다 입력/출력 계약을 우선한다.
- fan-in 검증 기준 없이 병렬화하지 않는다.
- codex/omx/claude surface가 있더라도 canonical docs authority를 넘지 않는다.

## 기본 역할
### Planner / Orchestrator
- 책임:
  - 작업 분해
  - 위험도 판단
  - 승인 필요 여부 판단
  - fan-out / fan-in 기준 설정
- 입력:
  - 사용자 요청
  - canonical docs
  - 최근 ledger / failure history
- 출력:
  - execution packet
  - task decomposition
  - stop conditions

### Frontend Executor
- 책임:
  - 화면/그리드/UI 구현
  - browser/manual 검증 보조
- 금지:
  - auth/payroll 의미 변경 독단 처리

### Backend Executor
- 책임:
  - API/service/domain 로직 수정
  - schema without migration 수준의 안전 수정
- 금지:
  - 승인 없는 migration/destructive data change

### Verifier / QA
- 책임:
  - 검증 명령 실행
  - 브라우저/수동 체크 포인트 정리
  - completion evidence 정리
- 출력:
  - pass/fail/remaining risk

### Specialist (조건부)
- Permission reviewer
- Payroll reviewer
- Deploy/runtime reviewer

## fan-out / fan-in 규칙
- 병렬 실행 조건:
  - frontend/backend/doc 작업이 분리 가능할 때
  - 충돌 경로가 적을 때
- merge order:
  1. 구조/도메인 판단
  2. 구현
  3. 검증
  4. 기록
- 최종 검증:
  - verifier가 completion evidence를 취합
  - human review가 필요한 R2/R3는 자동 종료 금지

## 현재 추천 매핑
- Profile A: 단일 executor
- Profile B: planner → executor → verifier
- Profile C: planner → specialist → executor → verifier → human review
