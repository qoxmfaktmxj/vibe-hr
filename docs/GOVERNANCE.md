Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# GOVERNANCE.md

## 목적
이 문서는 Vibe-HR에서 AI와 사람이 함께 작업할 때 적용할 운영 헌법을 정의한다. 목표는 원칙을 나열하는 것이 아니라, 실제로 통제 가능한 변경 규칙·승인 경계·검증 루프·자동화 한계를 명확히 하는 것이다.

## 운영 범위
- Governance Scope: **High-Control** [Proposal]
- 개발 단계: solo 개발 / 점진 전환 [User-stated][Observed]
- 배포 정책: 현재는 환경 분리 없이 `main` 단일 기준으로 운영 [User-stated]
- 외부 연동 정책: SAP I/F 등 외부 연동은 현재 범위 밖이며 프로젝트 본체 완료 후 검토 [User-stated]

## 권한 우선순위
중요 판단은 아래 우선순위를 따른다. 낮은 단계는 높은 단계를 덮어쓸 수 없다. [User-stated]
1. `[Observed]` repo에서 직접 확인한 사실
2. `[User-stated]` 사용자의 명시적 결정
3. 승인된 명세 / ADR / 정책 문서
4. 테스트 / CI / 정적 분석 / 실행 결과
5. `[Derived]` 확인 사실로부터의 논리적 해석
6. `[Proposal]` 제안
7. `[Assumption]` 확인되지 않은 가정

## Canonical Source Map
### 기존 기준 문서
- `README.md` — 프로젝트 개요, 로컬 실행, 테스트, 운영 요약 [Observed]
- `AGENTS.md` — 실행 계약, 작업 규칙, 검증 규칙 [Observed]
- `docs/GRID_SCREEN_STANDARD.md` — AG Grid 표준 [Observed]
- `docs/MENU_ACTION_PERMISSION_PLAN.md` — 메뉴/액션 권한 기준 계획 [Observed]
- `docs/VIBE_HR_PROGRESS_TODO_2026-03-14.md` — 현재 진행 현황과 backlog [Observed]

### 신규 canonical 문서
- `docs/harness/DISCOVERY_PACKET.md`
- `docs/GOVERNANCE.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/TASK_LEDGER.md`

### Projection 원칙
- 정책 원문은 canonical 문서에만 상세히 적는다. [Proposal]
- tool-specific 규칙은 Layer 4에서 projection으로 만든다. [Proposal]
- `AGENTS.md`는 Codex/OMX 실행 surface이며, 세부 정책은 본 문서를 참조한다. [Proposal]
- `CLAUDE.md`는 Claude 계열 도구용 projection이다. [Observed][Proposal]

### Layer 4 현재 결정
- Codex/OMX projection: `AGENTS.md`를 primary execution surface로 유지한다. [Observed][Proposal]
- Claude projection: `CLAUDE.md`를 유지한다. [Observed]
- Risk-path enforcement: `scripts/check-risk-paths.py`를 사용한다. [Observed]
- CI adapter: `.github/workflows/guardrails.yml`를 사용한다. [Observed]
- 현재 guardrails 모드: **warning-only** [Observed][Proposal]
- warning-only 유지 이유:
  - 현재는 solo 개발 + `main` 운영 구조다. [User-stated]
  - repo baseline의 `validate:grid`가 unrelated 기존 이슈로 실패하고 있어 hard gate 전환 시 개발 흐름을 과도하게 막을 수 있다. [Observed][Derived]
  - baseline grid 이슈가 정리되기 전까지는 경고/요약 중심이 더 적절하다. [Proposal]

## 운영 모드와 전이 규칙
### 1) Discovery Mode
- 목적: 현재 상태, 리스크, 문서, 품질, 빈칸 파악
- 입력: 사용자 설명, repo 관측, 기존 문서
- 출력: 요약, 미해결점, 리스크 맵, 성숙도 초안
- 완료 조건: 프로젝트 유형과 위험 구역이 식별됨

### 2) Blueprint Mode
- 목적: 하네스 구조와 운영 규칙 설계
- 출력: canonical doc map, approval matrix, quality rubric, agent/sub-agent 구조, skill/hook 전략
- 완료 조건: 문서/자동화/승인 경계가 승인 가능한 수준으로 정리됨

### 3) Artifact Generation Mode
- 목적: 실제 repo에 넣을 canonical 문서 초안 생성
- 전제: Blueprint 승인 + 생성 범위 명확화
- 출력: 파일 목록, 초안, placeholder, 링크 구조
- 완료 조건: 승인 범위 내 artifact pack 생성 완료

### 4) Execution Mode
- 목적: 구현, 수정, 테스트, 검증
- 전제: 승인된 변경 범위 + 검증 루프 존재
- 출력: 변경 파일, 실행 명령, 결과, 남은 리스크, rollback 정보
- 완료 조건: 필수 검증 통과 + 결과 기록

### 5) Review / Hardening Mode
- 목적: 보안, 성능, 구조, 관측성, 회귀 안정성 보강
- 출력: 문제 목록, 보강안, quality score 갱신, 추가 테스트 제안

### 6) Incident / Hotfix Mode
- 목적: 긴급 장애/운영 이슈 대응
- 규칙:
  - 범위를 최소화한다.
  - 우회 변경은 명시적으로 기록한다.
  - 사후 hardening과 회고를 의무화한다.
  - R3 영역은 승인 없이는 진행하지 않는다.
  - 핫픽스 후 canonical 문서와 Task Ledger에 환원 기록을 남긴다.

## 위험도 분류
### R0 — 문서/비실행/저위험
예:
- 문서 작성
- 주석/타이포 수정
- 비기능적 정리

### R1 — 저위험 코드 변경
예:
- 내부 리팩터링
- 테스트 추가
- 명백한 타입 오류 수정
- 개별 화면의 로컬 버그 수정

### R2 — 중위험 인터페이스/구조 변경
예:
- 공개 API 변경
- 빌드/CI 변경
- 메뉴/액션 권한 흐름 변경
- 공통 Grid 규약 변경
- 성능 민감 경로 수정
- 큰 구조 리팩터링

### R3 — 고위험 민감 변경
예:
- 인증/인가
- 급여/정산 의미 변경
- 개인정보/민감 데이터 처리
- DB 스키마/마이그레이션
- 운영 데이터 직접 조작
- 배포/인프라/비밀/자격증명

## Path 기반 민감 구역
| 경로/영역 | 기본 위험도 | 비고 |
|---|---|---|
| `docs/**` | R0 | 문서 중심 |
| `frontend/src/app/**` 개별 화면 | R1 | 단, 권한/공통 규약 영향 시 R2 |
| `frontend/src/components/grid/**` | R2 | 공유 Grid 표준 영향 |
| `frontend/src/lib/grid/**` | R2 | 공유 Grid 로직 영향 |
| `config/grid-screens.json` | R2 | 화면 registry 계약 영향 |
| 권한 관련 프론트/백 코드 | R2~R3 | 서버 enforcement 포함 시 R3 가능 |
| 인증 관련 코드 | R3 | 민감 구역 |
| 급여 계산/정산 로직 | R3 | 민감 구역 |
| DB schema/migration/seed/backfill/data repair | R3 | 민감 구역 |
| `.github/workflows/**` 및 배포 스크립트 | R3 | 운영 배포 영향 |

## 승인 주체와 정책
- 승인 주체: 석 1인 [User-stated]
- 기본 원칙:
  - R0: 자동 허용
  - R1: 자동 허용 + 검증 필수
  - R2: 사전 승인 필요
  - R3: 명시 승인 + 변경 계획 + 검증 계획 필요

## 승인 정책 매트릭스
| 변경 유형 | 위험도 | 기본 정책 | 필수 검증 | 추가 승인 조건 |
|---|---|---|---|---|
| 문서 초안 | R0 | 자동 허용 | 링크/구조 점검 | canonical 충돌 시 검토 |
| 테스트 추가 | R1 | 자동 허용 | 관련 테스트 실행 | 민감 도메인이면 검토 |
| 개별 화면 UI 수정 | R1 | 자동 허용 | `validate:grid`(해당 시), lint/build | 권한/공통 규약 영향 시 승격 |
| 로컬 버그 수정 | R1 | 자동 허용 | 관련 테스트 + 회귀 확인 | 공통 모듈 영향 시 R2 |
| 공통 Grid 모듈 수정 | R2 | 승인 필요 | `validate:grid`, lint, build, 기존 화면 회귀 1건 이상 | 영향 화면 목록 필요 |
| API contract 변경 | R2 | 승인 필요 | contract/integration/build | 소비자 영향 분석 |
| 메뉴 액션 권한 플로우 변경 | R2 | 승인 필요 | UI/server permission 검증 | 서버 enforcement 포함 여부 명시 |
| CI/workflow 변경 | R2 | 승인 필요 | workflow 영향 검토, 관련 검증 | `main` 운영 영향 명시 |
| 인증/인가 정책 변경 | R3 | 명시 승인 필요 | auth regression / permission tests | 보안 검토 필수 |
| 급여 계산 의미 변경 | R3 | 명시 승인 필요 | 계산 회귀 / 시드 검증 / rollback plan | 업무 의미 확인 필수 |
| DB schema/migration | R3 | 명시 승인 필요 | schema diff / data integrity / rollback plan | destructive 여부 별도 확인 |
| seed/backfill/data repair | R3 | 명시 승인 필요 | dry-run 근거 / 무결성 점검 | 운영 데이터 영향 확인 |
| 배포/인프라 변경 | R3 | 명시 승인 필요 | 배포 검증 계획 / health check | 운영 영향 사전 동의 |
| secret/credential 처리 | R3 | 기본 금지 | N/A | 직접 노출/수정 금지 |

## 품질 점수 체계
각 축은 0~3점으로 평가한다. [User-stated]

| 축 | 현재 점수 | 근거 |
|---|---:|---|
| Test Confidence | 2 | `validate:grid`, lint, build, pytest, 일부 Playwright E2E 존재 [Observed] |
| Architecture Clarity | 2 | 도메인/문서가 있으나 canonical 구조 문서가 분산 [Observed][Derived] |
| Documentation Freshness | 2 | 최근 진행 상태와 주요 운영 문서가 존재 [Observed] |
| Operational Safety | 1 | `main` 단일 배포 + 민감 도메인 다수 + 승인 체계 신설 단계 [Observed][Derived] |
| Observability Readiness | 1 | Task Ledger, failure taxonomy, 감사 로그 기준 부재 [Observed][Derived] |

- Total: 8 / 15 [Derived]
- Band: C [Derived]

### Band 해석
- A: 저위험 자동화 확대 가능
- B: 표준 자동화 가능, 중위험은 검토 병행
- C: 자동화 제한, 승인 비중 확대
- D: 탐색/문서화/테스트 확보 중심

현재 Vibe-HR은 **Band C**이므로, R0~R1만 제한적으로 자동화하고 R2 이상은 승인 중심으로 운영한다. [Derived]

## 자동화 허용 범위
- R0 + C: 자동 허용 가능 [Proposal]
- R1 + C: 자동 허용 가능하나 범위를 좁게 유지하고 검증 필수 [Proposal]
- R2: 기본적으로 승인 필요 [Proposal]
- R3: 승인 필요 또는 금지 [Proposal]
- 테스트가 빈약하거나 민감 도메인이면 자동화 범위를 축소한다. [Proposal]

## 하네스 5요소 운영 규칙
### Guardrails
- 자동 허용 작업, 승인 필요 작업, 금지 작업을 위험도 기준으로 구분한다.
- 민감 경로 진입 시 작업 전 멈추고 승인 상태를 확인한다.
- 공개 계약, 권한, 급여, 배포 변경은 반드시 검증 계획을 먼저 적는다.

### Plan & Spec
- product spec, execution plan, decision log, test strategy, task ledger를 분리 관리한다.
- 같은 규칙을 여러 문서에 장문으로 복제하지 않는다.
- 실행 전에는 관련 spec 또는 plan 존재 여부를 확인한다.

### Verification Loops
- 작업 유형별로 unit/integration/contract/lint/build/regression 필요 여부를 명시한다.
- AG Grid 화면 수정 시 `npm run validate:grid`를 우선 실행한다. [Observed]
- 검증을 하지 못했으면 이유를 기록한다. [Observed][Proposal]

### Eval Harness
- 아직 숫자는 고정하지 않는다. [User-stated]
- 저장 위치와 측정 정의만 정한다.
- 최소 지표:
  - 작업 성공 여부
  - 테스트 통과 여부
  - 재시도 여부
  - rollback 여부
  - flaky test 관측 여부
  - 리뷰 부담/남은 리스크

### Observability
- 최소 기준:
  - 작업 목적/변경 파일/검증 결과/남은 리스크 기록
  - 배포 commit / 시각 / health 확인 가능 상태 유지
  - 기본 애플리케이션 로그 확보
  - 권한/급여/데이터 복구/배포 변경에 대한 감사 기록
  - 실패 분류 기준 유지

## Sub-Agent 사용 기준
- 작은 리팩터링, 문서 초안, 테스트 추가, 로컬 버그 수정은 단일 에이전트로 처리한다. [Proposal]
- 프론트/백/권한/배포/DB가 동시에 얽히면 서브에이전트를 고려한다. [Proposal]
- Orchestrator는 작업 분해, 병렬 가능성 판단, 입력/출력 계약 관리, 충돌 해결, 최종 검증과 승인 요청을 담당한다. [Proposal]

## Skill + Hook 원칙
- skill은 거대한 백과사전이 아니라 상황별 규칙 패키지여야 한다. [User-stated]
- hook은 개입 시점, skill은 주입 지식이다. [User-stated]
- 권장 후보:
  - grid-screen-change
  - permission-change
  - payroll-change
  - legacy-flow-regression
  - deploy-safety
- 실제 projection 문서는 Layer 4에서 생성한다. [User-stated]

## 문서 신선도 규칙
새 canonical 문서는 다음 메타데이터를 포함한다.
- Status
- Owner
- Canonical
- Source of Truth
- Last Verified
- Confidence

## 단계별 도입 로드맵
1. Discovery 결과 고정 [Done]
2. Governance 확정 [Current]
3. Core Canonical Docs 생성 [Next]
4. Lightweight observability 도입 [Next]
5. 첫 vertical slice 시범 적용 [TBD]
6. Layer 4 tool adapter / mechanical enforcement 설계 [Later]

## 멈춤 조건
다음 중 하나라도 해당하면 진행 전 승인 또는 확인을 요구한다.
- canonical source가 불명확할 때
- R3 영역 경계가 불명확할 때
- 승인 필요 변경이 정의되지 않았을 때
- 생성할 문서 범위가 과도할 때
- tool-specific 파일 생성 여부가 불명확할 때
- 레거시 hotspot 방어 전략이 없는 상태에서 큰 변경이 예상될 때
