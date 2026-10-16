Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: 2026-10-16
Confidence: Medium

# QUALITY_SCORE.md

## 목적
프로젝트 상태 관점의 품질 점수를 5축으로 기록한다. 이 문서는 운영 성과(Eval Harness)가 아니라 프로젝트 준비 상태와 안전성을 보는 기준이다.

## 평가 방식
각 축은 0~3점으로 평가한다.
- 0 = 없음
- 1 = 약함
- 2 = 사용 가능
- 3 = 강함

## 현재 점수
| 축 | 점수 | 근거 | 개선 우선순위 |
|---|---:|---|---|
| Test Confidence | 2 | `validate:grid`, lint/build, Gradle/JUnit/Testcontainers, browser/manual 검증 경로 존재 | 높음 |
| Architecture Clarity | 2 | 도메인/문서/실행 규약이 정리됐지만 일부 런타임 결합도가 남음 | 중간 |
| Documentation Freshness | 3 | Layer 1~6, governance, execution, ledger, eval 문서가 최근 상태로 갱신됨 | 낮음 |
| Operational Safety | 2 | main push, 매일 08:00 KST 예약, 수동 배포에 동일 SHA UI 성공 및 backend/image/runtime 검증 적용, R0~R3 승인 경계 유지 | 높음 |
| Observability Readiness | 2 | Task Ledger, guardrails, eval summary skeleton 존재 | 중간 |

## 총점
- Total: 11 / 15
- Band: B

## Band 해석
- A: 저위험 자동화 확대 가능
- B: 표준 자동화 가능, 중위험은 검토 병행
- C: 자동화 제한, 승인 비중 확대
- D: 탐색/문서화/테스트 확보 중심

## 현재 해석
- 현재 Vibe-HR은 **Band B**까지 올라온 상태로 본다.
- 단, 이 점수는 문서/운영 체계 기준이고, 실제 기능 완성도는 workflow 1~10의 세부 도메인 상태에 따라 편차가 있다.
- 따라서 자동화 범위는 여전히 R0/R1 중심을 유지한다.

## 자동화 허용 범위
- 자동 허용 가능한 영역:
  - 문서화
  - 테스트 보강
  - 저위험 UI/버그 수정
  - workflow 진단/상태 점검
- 승인 필요한 영역:
  - shared contract, permission flow, CI/workflow, broad refactor
- 명시적 범위 승인과 충분한 검증이 필요한 R3 영역:
  - auth 의미 변경
  - payroll semantics 변경
  - DB schema/migration
  - deploy/infra 변경 및 반영
  - destructive data change

## 개선 우선순위
1. `validate:grid`와 lint/build 회귀 검증 유지
2. workflow 1~10 기준 기능 완성도 점검과 누락 화면/데이터 보강
3. Layer 6용 반복 실행 데이터 누적
