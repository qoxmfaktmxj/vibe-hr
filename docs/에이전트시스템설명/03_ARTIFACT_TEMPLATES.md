# Layer 3 — Artifact Templates

이 파일은 **Layer 2의 Blueprint & Governance Packet이 승인된 뒤** 사용한다.  
목표는 프로젝트에 넣을 **실제 문서 초안과 골격** 을 일관되게 생성하는 것이다.

이 단계가 끝나면 다음 단계로 넘어간다.

- 이전 단계: `02_GOVERNANCE_SPEC.md`
- 다음 단계: `04_TOOL_ADAPTERS.md`
- 이 단계의 완료물: **Artifact Draft Pack**
- 금지: 승인되지 않은 범위까지 문서 확장, canonical/projection 중복, 근거 없는 세부사항 채우기

---

## 사람 사용법

1. 이 파일 전체를 AI에게 붙여 넣는다.
2. 반드시 **Layer 2의 Handoff Packet** 을 함께 제공한다.
3. 생성해도 되는 파일 범위를 먼저 분명히 한다.
4. AI가 각 파일 초안을 만들면 검토한다.
5. canonical 문서 초안이 승인되면 `04_TOOL_ADAPTERS.md` 로 넘어간다.

---

## AI에게 전달할 지시문

이 단계의 목표는 **실제 repo에 넣을 수 있는 문서 골격과 초안** 을 만드는 것이다.  
여기서 생성하는 문서는 반드시 **Layer 2에서 승인된 운영 규칙** 을 따른다.

---

## 1. 생성 원칙

1. 없는 사실을 지어내지 마라.
2. 확인되지 않은 정보는 아래 중 하나로 표시하라.
   - `TBD`
   - `NEEDS_CONFIRMATION`
   - `[Assumption]`
   - `[Missing]`
3. 각 문서에 신선도 메타데이터를 넣어라.
4. canonical 문서에만 상세 정책을 쓰고, 나머지는 참조하거나 요약하라.
5. 한 문서가 다른 문서의 역할을 침범하지 않게 하라.
6. 소규모 프로젝트에는 최소 문서 세트를, 고위험 프로젝트에는 확장 세트를 쓰라.
7. 문서만 나열하지 말고 **파일 경로 + 목적 + 초안** 을 함께 제시하라.

---

## 2. 추천 artifact pack

### Pack S — Minimal
다음 상황에 적합:
- 소규모
- 저위험
- 신규 개발 초기
- 빠른 정착이 우선

포함:
- `AGENTS.md`
- `ARCHITECTURE.md`
- `docs/product-specs/TEMPLATE.md`
- `docs/exec-plans/active/TEMPLATE.md`
- `docs/TEST_STRATEGY.md`

### Pack M — Standard
대부분의 팀과 서비스에 적합.

포함:
- Pack S 전체
- `docs/QUALITY_SCORE.md`
- `docs/SUB_AGENTS.md`
- `docs/SKILLS_INDEX.md`
- `docs/SECURITY.md`
- `docs/OBSERVABILITY.md`

### Pack L — High-Control
고위험 / 규제 / 복잡한 레거시에 적합.

포함:
- Pack M 전체
- `docs/RELIABILITY.md`
- `docs/design-docs/index.md`
- `docs/design-docs/core-beliefs.md`
- `docs/exec-plans/active/harness-bootstrap.md`
- `skills/TEMPLATE.md`

선택 기준은 반드시 Layer 2 결정을 따른다.

---

## 3. 문서 메타데이터 규칙

각 문서 상단에 아래 메타데이터 블록을 넣어라.

```md
Status: Draft
Owner: TBD
Canonical: Yes/No
Source of Truth: <문서 또는 TBD>
Last Verified: TBD
Confidence: Low/Medium/High
```

문서가 projection이면 반드시 canonical source를 적어라.

---

## 4. 출력 방식

아래 순서로 정리하라.

1. 생성 대상 파일 목록
2. 각 파일의 역할
3. 각 파일의 초안 또는 골격
4. placeholder / 확인 필요 지점
5. 문서 간 링크 구조
6. 다음 단계에서 projection할 대상

---

## 5. 기본 템플릿

아래 템플릿을 사용해 실제 초안을 생성하라.  
내용은 프로젝트에 맞게 채우되, 확인되지 않은 부분은 placeholder로 남겨라.

---

## 5.1 `AGENTS.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# AGENTS.md

## 목적
이 문서는 사람과 AI가 이 repo를 탐색하고 작업할 때 따라야 할 기본 운영 지도를 제공한다.

## 프로젝트 개요
- 프로젝트명:
- 한 줄 설명:
- 주요 사용자:
- 핵심 비즈니스 목표:

## 현재 범위
- 프로젝트 유형:
- 운영 범위(Minimal / Standard / High-Control):
- 현재 단계(성숙도 1~6):
- 주요 제약:
- No-Go 영역:

## Source of Truth Map
- 운영 규칙:
- 아키텍처 기준:
- 제품/기능 명세:
- 실행 계획:
- 테스트 전략:
- 보안 기준:
- 관측성 기준:

## Repo 탐색 시작점
- 주요 디렉토리:
- 앱/서비스 구분:
- 공통 코드 위치:
- 레거시 hotspot:
- 신규 영역:

## 기본 작업 흐름
1. 관련 문서 확인
2. 범위와 위험도 확인
3. exec plan 또는 spec 확인/작성
4. 테스트 전략 확인
5. 변경
6. 검증
7. 결과/리스크 기록

## 위험도와 승인 요약
- 자동 허용:
- 승인 필요:
- 금지:

## 기본 검증 명령
- install:
- test:
- lint:
- typecheck:
- build:

## 작업 시 필수 표기
- [Observed]
- [User-stated]
- [Derived]
- [Assumption]
- [Proposal]
- [Missing]

## 문서 맵
- `ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/QUALITY_SCORE.md`
- `docs/SECURITY.md`
- `docs/OBSERVABILITY.md`
- `docs/SUB_AGENTS.md`
- `docs/SKILLS_INDEX.md`

## 변경 전 멈춤 조건
- auth/billing/data migration/prod/secret 관련 변경
- 공개 인터페이스 변경
- 대규모 구조 변경
- 허용 범위 불명확
```

---

## 5.2 `ARCHITECTURE.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Low

# ARCHITECTURE.md

## 시스템 개요
- 시스템 목적:
- 주요 사용자 흐름:
- 핵심 도메인:

## 컨테이너/서비스 맵
- Frontend:
- Backend:
- DB:
- Queue/Cache:
- External Systems:

## 레이어 모델
- Presentation
- Application
- Domain
- Infrastructure

## 도메인 경계
- 도메인 A:
- 도메인 B:
- 도메인 C:

## 주요 데이터 흐름
1. 사용자 요청 →
2. 서비스 계층 →
3. 데이터 저장/조회 →
4. 외부 연동 →
5. 응답/이벤트

## 의존성 규칙
- 허용되는 방향:
- 금지되는 방향:
- 공통 모듈 규칙:
- 레거시 예외:

## 위험 구역
- 인증/인가:
- 정산/민감 데이터:
- 외부 API:
- 마이그레이션:

## cross-cutting concerns
- logging:
- error handling:
- validation:
- authorization:
- observability:

## 변경 시 주의점
- 공개 계약 영향:
- 데이터 영향:
- 운영 영향:
- 테스트 영향:
```

---

## 5.3 `docs/product-specs/TEMPLATE.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: High

# Product Spec Template

## 문서 정보
- 기능명:
- 작성자:
- 상태:
- 관련 티켓/이슈:

## 목적
이 기능/변경이 왜 필요한가?

## 범위
무엇을 포함하는가?

## 비범위
무엇을 하지 않는가?

## 사용자 가치 / 비즈니스 목적
이 변경이 주는 가치와 성공 기준은 무엇인가?

## 사용자 시나리오
- 시나리오 1
- 시나리오 2

## 수용 기준
- [ ] 기준 1
- [ ] 기준 2
- [ ] 기준 3

## API / 데이터 계약
- 입력:
- 출력:
- 제약:
- 호환성 고려:

## 보안 고려사항
- auth/authz 영향:
- 민감 데이터:
- secret/external call 영향:

## 성능 고려사항
- latency:
- throughput:
- 비용:
- 병목 가능성:

## 관측성 요구사항
- 로그:
- 메트릭:
- 트레이스:
- 알림:

## 테스트 전략
- unit:
- integration:
- contract:
- e2e/regression:

## 롤백 전략
- 롤백 방법:
- 손상 가능 데이터:
- fallback:
```

---

## 5.4 `docs/exec-plans/active/TEMPLATE.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: High

# Execution Plan Template

## 목표
이번 작업의 목표는 무엇인가?

## 현재 상태
현재 확인된 사실과 제약은 무엇인가?

## 범위
이번 실행에 포함되는 것

## 비범위
이번 실행에 포함되지 않는 것

## 위험도
- Risk Class: R0 / R1 / R2 / R3
- 승인 필요 여부:
- 민감 영역 영향:

## 단계별 체크리스트
- [ ] 단계 1
- [ ] 단계 2
- [ ] 단계 3

## 관련 파일
- 수정 대상:
- 참고 대상:
- 생성 대상:

## 테스트 및 검증 계획
- unit:
- integration:
- contract:
- typecheck:
- lint:
- build:
- 추가 수동 검증:

## 의사결정 로그
- 결정 1:
- 근거:
- 대안:
- 영향:

## 알려진 이슈 / 미해결점
- 이슈 1
- 이슈 2

## 완료 조건
- [ ] 수용 기준 충족
- [ ] 필수 검증 통과
- [ ] 문서 반영
- [ ] 리스크 기록

## 롤백 / 종료 조건
- 언제 중단해야 하는가?
- 롤백은 어떻게 하는가?
```

---

## 5.5 `docs/TEST_STRATEGY.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# TEST_STRATEGY.md

## 목적
이 프로젝트에서 테스트를 어떻게 설계하고, 어떤 수준까지 요구하는지 정의한다.

## 테스트 피라미드
- unit
- integration
- contract
- e2e
- performance(필요 시)

## 작업 유형별 원칙
### 신규 기능
- acceptance criteria 확인
- failing test 또는 테스트 계획 선행
- 구현 후 회귀 확인

### 버그 수정
- 재현 단계 명시
- failing regression test 우선
- 수정 후 회귀 통과 확인

### 리팩터링
- 동작 보호용 테스트 확보
- 구조 개선 후 동일성 확인

### 레거시 변경
- characterization test 우선
- 작은 단위 변경
- 회귀 범위 명시

### DB 변경
- schema diff
- data integrity
- rollback rehearsal(필요 시)

## 필수 검증
- lint:
- typecheck:
- build:
- test commands:

## flaky test 처리 원칙
- flaky 정의:
- quarantine 규칙:
- 복구 기준:

## 승인과 테스트 관계
- R0:
- R1:
- R2:
- R3:
```

---

## 5.6 `docs/QUALITY_SCORE.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# QUALITY_SCORE.md

## 평가 방식
각 축은 0~3점으로 평가한다.

## 평가 축
| 축 | 점수 | 근거 | 개선 우선순위 |
|---|---:|---|---|
| Test Confidence |  |  |  |
| Architecture Clarity |  |  |  |
| Documentation Freshness |  |  |  |
| Operational Safety |  |  |  |
| Observability Readiness |  |  |  |

## 총점
- Total:
- Band: A / B / C / D

## Band 해석
- A:
- B:
- C:
- D:

## 자동화 허용 범위
- 자동 허용 가능한 영역:
- 승인 필요한 영역:
- 금지 영역:

## 개선 우선순위
1.
2.
3.
```

---

## 5.7 `docs/SECURITY.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Low

# SECURITY.md

## 목적
이 프로젝트의 보안 관련 기본 원칙과 변경 승인 기준을 정의한다.

## 인증 / 인가 구조
- 인증 방식:
- 인가 모델:
- 역할/권한 개요:

## 민감 데이터 처리
- 어떤 데이터가 민감한가:
- 저장 시 규칙:
- 전송 시 규칙:
- 마스킹/로그 제한:

## 비밀 관리 원칙
- secret 저장 위치:
- 로컬 개발 규칙:
- CI/CD 규칙:
- 금지 사항:

## 외부 연동 보안
- 주요 외부 시스템:
- 자격증명 관리:
- 서명/검증 필요 여부:
- rate limit / retry 고려:

## 승인 필요 변경
- auth 변경
- role/permission 변경
- secret 관련 변경
- 공개 보안 경계 변경
```

---

## 5.8 `docs/OBSERVABILITY.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Low

# OBSERVABILITY.md

## 목적
이 프로젝트에서 변경의 영향과 런타임 상태를 관찰하기 위한 최소 기준을 정의한다.

## 로그 기준
- 필수 로그 이벤트:
- 금지 로그:
- correlation id 규칙:
- 에러 로그 기준:

## 메트릭 기준
- 서비스 레벨 메트릭:
- 도메인 메트릭:
- 실패/재시도 메트릭:
- 배포 후 확인 메트릭:

## 트레이스 기준
- 어떤 경로를 추적할지:
- 외부 연동 추적:
- 고비용 구간 추적:

## 알림 기준
- 어떤 실패를 alert로 볼지:
- 임계치:
- 소유자:

## 변경 시 체크 포인트
- 새 기능에서 관측해야 할 지점
- 디버깅에 필요한 증거
- 회귀 확인 지표
```

---

## 5.9 `docs/SUB_AGENTS.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# SUB_AGENTS.md

## 목적
이 프로젝트에서 필요한 경우에만 사용할 서브에이전트 구조를 정의한다.

## 사용 원칙
- 단일 에이전트로 충분하면 분해하지 않는다.
- 역할 이름보다 입력/출력 계약을 우선한다.
- fan-in 검증 기준 없이 병렬화를 하지 않는다.

## Orchestrator
- 책임:
- 입력:
- 출력:
- 승인 요청 시점:
- 금지 범위:

## 후보 서브에이전트
### Repo Analyst
- 역할:
- 입력:
- 출력:
- 금지 범위:
- 완료 조건:

### Architecture Guardian
- 역할:
- 입력:
- 출력:
- 금지 범위:
- 완료 조건:

### Test / QA Agent
- 역할:
- 입력:
- 출력:
- 금지 범위:
- 완료 조건:

### Security Reviewer
- 역할:
- 입력:
- 출력:
- 금지 범위:
- 완료 조건:

### Legacy Migration Agent
- 역할:
- 입력:
- 출력:
- 금지 범위:
- 완료 조건:

## fan-out / fan-in 규칙
- 병렬 실행 조건:
- 충돌 해결 방식:
- merge order:
- 최종 검증:
```

---

## 5.10 `docs/SKILLS_INDEX.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# SKILLS_INDEX.md

## 목적
이 프로젝트에서 상황별로 주입할 skill의 목록과 적용 조건을 정의한다.

## 기본 원칙
- skill은 큰 백과사전이 아니라 상황별 패키지다.
- path / task / risk / event 기반으로 호출한다.
- 적용 시 반드시 관련 검증과 연결한다.

## skill 목록
| Skill | 목적 | 호출 조건 | 관련 문서 | 관련 테스트 |
|---|---|---|---|---|
| auth-security | 인증/인가 변경 방어 | auth 파일 수정 / auth 작업 | docs/SECURITY.md | auth regression |
| role-permission | 권한 경계 검토 | role/permission 변경 | docs/SECURITY.md | permission tests |
| db-migration | 스키마/마이그레이션 검토 | schema/sql 변경 | docs/TEST_STRATEGY.md | migration/data integrity |
| api-integration | 외부 연동 검토 | API client/contract 변경 | TBD | contract/integration |
| legacy-characterization | 레거시 안전 변경 | legacy hotspot 수정 | docs/TEST_STRATEGY.md | characterization tests |
| logging-observability | 로그/메트릭 보강 | 런타임 행위 변경 | docs/OBSERVABILITY.md | runtime checks |

## 추가 예정 skill
- TBD
```

---

## 5.11 `docs/RELIABILITY.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Low

# RELIABILITY.md

## 목적
런타임 안정성, 장애 격리, 회복 전략의 기준을 정의한다.

## 안정성 목표
- SLA/SLO:
- 중요 사용자 경로:
- 실패 허용도:

## 실패 처리 원칙
- timeout:
- retry:
- circuit breaker:
- fallback:
- idempotency:

## 장애 영향도가 큰 변경
- 어떤 변경이 운영에 큰 영향을 주는가:
- 사전 검증:
- 배포 후 확인:

## 롤백/복구 원칙
- 롤백 기준:
- 복구 플레이북 위치:
- 데이터 영향 확인:
```

---

## 5.12 `docs/design-docs/index.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# Design Docs Index

## 목적
주요 설계 문서의 인덱스와 상태를 관리한다.

## 문서 목록
| 문서 | 상태 | 범위 | 소유자 | 비고 |
|---|---|---|---|---|
| core-beliefs.md | Draft | 운영 원칙 | TBD |  |
| TBD | TBD | TBD | TBD |  |
```

---

## 5.13 `docs/design-docs/core-beliefs.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# Core Beliefs

## 팀의 기본 신념
- 단순함 우선
- 변경 가능성 고려
- 관측 가능성 확보
- 테스트 가능한 구조 선호
- 위험 변경에는 승인과 검증 강화

## 절대 깨면 안 되는 원칙
- 근거 없는 구조 상정 금지
- 민감 변경 무단 진행 금지
- canonical source 중복 생성 금지
- 테스트/검증 없는 고위험 자동화 금지

## 코딩/구조 철학
- naming:
- error handling:
- logging:
- validation:
- dependency direction:

## entropy management
- 큰 변경은 쪼갠다
- 레거시는 characterization test부터
- 문서와 규칙은 오래된 것을 정리한다
```

---

## 5.14 `docs/exec-plans/active/harness-bootstrap.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# Harness Bootstrap Plan

## 목표
이 프로젝트에 맞는 AI 하네스와 운영 문서를 최소 위험으로 도입한다.

## 현재 상태
- 문서 상태:
- 테스트 상태:
- 성숙도:
- 주요 리스크:

## 단계별 계획
- [ ] Layer 1 진단 결과 정리
- [ ] Layer 2 governance 확정
- [ ] Layer 3 artifact draft 생성
- [ ] Layer 4 adapter / 기계적 강제 초안 생성
- [ ] 우선순위 높은 검증 루프 연결

## 성공 기준
- source of truth가 정리됨
- 승인 정책이 정의됨
- 최소 문서 팩이 생성됨
- 최소 1개 이상 기계적 강제가 설계됨
```

---

## 5.15 `skills/TEMPLATE.md`

```md
Status: Draft
Owner: TBD
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: High

# Skill Template

## 목적
이 skill이 해결하려는 상황은 무엇인가?

## 호출 조건
- path:
- task:
- risk:
- event:

## 입력
이 skill이 필요로 하는 정보는 무엇인가?

## 반드시 지켜야 할 규칙
- 규칙 1
- 규칙 2

## 작업 절차
1.
2.
3.

## 자주 하는 실수
- 실수 1
- 실수 2

## 검증 방법
- 테스트:
- lint/type/build:
- 수동 점검:

## 관련 문서 / 테스트
- 문서:
- 테스트:

## 완료 기준
- [ ] 기준 1
- [ ] 기준 2
```

---

## 6. 문서 생성 시 추가 규칙

- `AGENTS.md`, `ARCHITECTURE.md`, `docs/TEST_STRATEGY.md` 는 우선순위가 높다.
- `SECURITY.md`, `OBSERVABILITY.md`, `QUALITY_SCORE.md` 는 중간 이상 위험도에서 강하게 권장된다.
- 소규모 프로젝트에 문서가 과도하면 Pack S 또는 Pack M으로 줄여라.
- projection용 문서(`CLAUDE.md`, `.cursor/rules/*`)는 여기서 만들지 말고 **Layer 4** 에서 다뤄라.
- 문서 간 역할이 겹치면 한쪽을 canonical로 정하고 다른 쪽은 요약본으로만 유지하라.

---

## 7. 다음 단계로 넘길 Handoff Packet

마지막에는 반드시 아래 형식으로 끝내라.

```md
# HANDOFF PACKET FOR LAYER 4

## Generated Canonical Files
## File Roles
## Open Placeholders
## Canonical vs Projection Decisions
## Required Tool Adapters
## Candidate Mechanical Enforcement Rules
## Pending Approvals
```

---

## 이 단계 완료 기준

다음 5가지가 충족되면 이 파일의 역할은 끝난다.

- 승인된 artifact pack 범위 내에서 초안이 생성되었다
- canonical 문서가 식별되었다
- placeholder와 확인 필요 지점이 표시되었다
- projection 대상이 정리되었다
- Layer 4로 넘길 Handoff Packet이 준비되었다
