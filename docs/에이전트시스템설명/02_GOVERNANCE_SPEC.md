# Layer 2 — Governance Spec

이 파일은 **Layer 1의 Discovery Packet이 나온 뒤** 사용한다.  
목표는 프로젝트별 AI 운영 체계를 정의하는 것이다.

이 단계가 끝나면 다음 단계로 넘어간다.

- 이전 단계: `01_BOOTSTRAP_PROMPT.md`
- 다음 단계: `03_ARTIFACT_TEMPLATES.md`
- 이 단계의 완료물: **Blueprint & Governance Packet**
- 금지: 아직 승인되지 않은 대규모 파일 생성, tool-specific 설정 남발, 근거 없는 자율화 확대

---

## 사람 사용법

1. AI에게 이 파일을 붙여 넣는다.
2. 반드시 **Layer 1의 Handoff Packet** 을 함께 제공한다.
3. 가능하면 repo 구조, 테스트 현황, 기존 문서도 같이 보여 준다.
4. AI가 **Blueprint & Governance Packet** 을 작성하면 검토한다.
5. 승인 범위와 산출물 범위를 확정한 뒤 `03_ARTIFACT_TEMPLATES.md` 로 넘어간다.

---

## AI에게 전달할 지시문

너는 지금부터 이 프로젝트의 **AI 운영 헌법** 을 설계해야 한다.  
이 단계의 목표는 “좋아 보이는 원칙 모음”이 아니라, **이 프로젝트에서 실제로 통제 가능한 운영 규칙** 을 정하는 것이다.

---

## 1. 권한 우선순위

충돌이 생기면 아래 우선순위를 따른다. 낮은 단계는 높은 단계를 덮어쓸 수 없다.

1. `[Observed]` repo에서 직접 확인한 사실
2. `[User-stated]` 사용자의 명시적 결정
3. 승인된 명세 / ADR / 정책 문서
4. 테스트 / CI / 정적 분석 / 실행 결과
5. `[Derived]` 확인 사실로부터의 논리적 해석
6. `[Proposal]` 너의 제안
7. `[Assumption]` 확인되지 않은 가정

모든 중요한 판단과 제안에는 반드시 근거 태그를 붙여라.

---

## 2. 이 단계에서 반드시 정해야 할 것

다음 10가지는 반드시 정리하라.

1. 운영 범위
   - Minimal / Standard / High-Control
2. canonical source
   - 어떤 문서가 기준 문서인지
3. 모드 전이 규칙
4. 변경 위험도 분류
5. 승인 정책
6. 품질 점수 체계
7. 자동화 허용 범위
8. 서브에이전트 사용 기준
9. Skill + Hook 적용 기준
10. 다음 단계에서 생성할 문서 팩 범위

---

## 3. 운영 모드와 전이 규칙

다음 모드를 사용하라.

### 3.1 Discovery Mode
목적:
- 현재 상태 파악
- 기술/리스크/품질 파악

입력:
- 사용자 설명
- repo 관측 결과
- 기존 문서

출력:
- 요약
- 미해결점
- 성숙도 초안
- 리스크 맵

완료 조건:
- 핵심 질문 답변 확보
- 프로젝트 유형 결정
- 위험 구역 초안 확보

### 3.2 Blueprint Mode
목적:
- 하네스 구조와 운영 규칙 설계

출력:
- canonical doc map
- approval matrix
- quality score rubric
- agent/sub-agent 구조
- skill/hook 전략
- 단계별 로드맵

완료 조건:
- 산출물 목록과 생성 우선순위 승인 가능 수준으로 정리
- 자동 허용 / 승인 필요 / 금지 항목이 구분됨

### 3.3 Artifact Generation Mode
목적:
- 실제 파일 초안 생성

전제:
- Blueprint가 승인되었음
- 생성 범위가 명확함

출력:
- 파일 목록
- 각 파일 초안
- placeholder와 확인 필요 지점 표시

완료 조건:
- 선택한 artifact pack 초안 생성
- canonical / projection 구분 유지

### 3.4 Execution Mode
목적:
- 실제 구현, 수정, 테스트, 검증

전제:
- 승인된 변경 범위
- 검증 루프 존재

출력:
- 변경 파일
- 실행 명령
- 테스트 결과
- 리스크
- 롤백 정보

완료 조건:
- 필수 검증 통과
- 승인 조건 충족
- 변경 근거와 결과가 남음

### 3.5 Review / Hardening Mode
목적:
- 구조, 보안, 성능, 신뢰성, 관측성 강화

출력:
- 발견된 문제
- 수정 제안
- 품질 점수 갱신
- 추가 테스트 제안
- 관측성 보강안

### 3.6 Incident / Hotfix Mode
목적:
- 긴급 장애/보안/운영 이슈 대응

규칙:
- 범위를 최소화하라.
- 우회 변경은 명시적으로 기록하라.
- 사후 하드닝과 회고를 의무화하라.
- 고위험 영역은 승인 없이는 진행하지 마라.
- 핫픽스 후 반드시 정상 모드 문서에 반영하라.

---

## 4. 하네스 5요소 설계 규칙

### 4.1 Guardrails
반드시 정리:
- 자동 허용 작업
- 승인 필요 작업
- 금지 작업
- path 기반 민감 구역
- 위험 변경 시 필수 검증

### 4.2 Plan & Spec
반드시 정리:
- product spec 최소 세트
- exec plan 최소 세트
- decision log 위치
- rollback / exit criteria 포함 여부
- 추적성 규칙

### 4.3 Verification Loops
반드시 정리:
- unit
- integration
- contract
- architecture/structure
- type check
- lint
- build
- regression
- characterization test(legacy)

### 4.4 Eval Harness
반드시 정리:
- 작업 성공률을 어떻게 볼지
- 테스트 통과율
- 재시도율
- PR 크기 / 변경량
- rollback 비율
- flaky test
- 리뷰 부담 지표

이 단계에서는 측정 정의와 저장 위치만 정하라.  
숫자를 지어내지 마라.

### 4.5 Observability
반드시 정리:
- 어떤 변경이 있었는지
- 어떤 검증이 돌았는지
- 어떤 가정이 사용됐는지
- 어떤 스킬/서브에이전트가 적용됐는지
- 어떤 실패와 재시도가 있었는지

---

## 5. 변경 위험도 분류

다음 4단계로 분류하라.

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
- 로컬한 버그 수정

### R2 — 중위험 인터페이스/구조 변경
예:
- 공개 API 변경
- 빌드/CI 변경
- 외부 연동 변경
- 성능 민감 경로 수정
- 큰 구조 리팩터링

### R3 — 고위험 민감 변경
예:
- 인증/인가
- 결제/정산
- 개인정보/민감 데이터
- DB 스키마/마이그레이션
- 운영 데이터 직접 조작
- 배포/인프라/비밀/자격증명

각 프로젝트에 맞게 path, 도메인, 예외를 붙여 구체화하라.

---

## 6. 승인 정책 매트릭스

다음 형식으로 승인 정책을 만들어라.

```md
| 변경 유형 | 위험도 | 기본 정책 | 필수 검증 | 추가 승인 조건 |
|---|---|---|---|---|
| 문서 초안 | R0 | 자동 허용 | markdown lint(있다면) | canonical source 충돌 시 검토 |
| 테스트 추가 | R1 | 자동 허용 또는 사후 검토 | 관련 테스트 실행 | 민감 도메인일 때 검토 |
| 내부 리팩터링 | R1 | 자동 허용 또는 사전 공지 | unit/type/lint | 레거시 hotspot이면 검토 |
| 공개 API 변경 | R2 | 승인 필요 | contract/integration/build | 소비자 영향 분석 |
| DB 마이그레이션 | R3 | 승인 필요 | schema diff/data integrity/rollback plan | 운영 반영 전 별도 승인 |
| auth 변경 | R3 | 승인 필요 | auth regression/permission tests | 보안 검토 필수 |
| prod 관련 변경 | R3 | 기본 금지 또는 별도 승인 | 환경별 검증 | 운영 승인 필요 |
```

반드시 프로젝트에 맞게 채워라.  
빈칸이 있으면 `[Missing]` 또는 `[Assumption]` 으로 표시하라.

---

## 7. 품질 점수 체계

주관적 총평만 하지 말고, 아래 5축으로 점수를 매겨라.

각 축 점수:
- 0 = 없음
- 1 = 약함
- 2 = 사용 가능
- 3 = 강함

평가 축:
1. Test Confidence
2. Architecture Clarity
3. Documentation Freshness
4. Operational Safety
5. Observability Readiness

총점으로 밴드를 정하라.
- A = 13~15
- B = 10~12
- C = 7~9
- D = 0~6

반드시 포함:
- 축별 근거
- 총점
- band
- 자동화 허용 해석

기본 해석:
- A: 저위험 영역 자동화 범위 확대 가능
- B: 표준 자동화 가능, 중위험은 검토 병행
- C: 자동화 제한, 승인 비중 확대
- D: 탐색/문서화/테스트 확보 위주, 구현 자동화 최소화

---

## 8. 자동화 허용 범위 규칙

위험도와 품질 밴드를 결합해 자율성을 정하라.

기본 규칙:
- R0 + A/B: 자동 허용 가능
- R1 + A/B: 자동 허용 가능하나 검증 필수
- R1 + C/D: 범위 축소 또는 검토 필요
- R2: 기본적으로 승인 필요
- R3: 승인 필요 또는 금지
- 테스트 빈약 + 민감 도메인: 자동화 최소화

반드시 이 프로젝트에 맞는 해석을 덧붙여라.

---

## 9. 서브에이전트 구조 설계 기준

서브에이전트는 필요할 때만 사용하라.  
역할 이름만 늘리는 설계를 하지 마라.

### 단일 에이전트로 충분한 경우
- 작은 리팩터링
- 문서 초안
- 테스트 추가
- 로컬한 버그 수정

### 서브에이전트 고려가 필요한 경우
- 프론트/백/DB/인프라가 동시에 얽힘
- 공개 API + 마이그레이션 + 배포가 함께 바뀜
- 큰 레거시 전환
- 보안/성능/관측성 검토가 병행됨

각 서브에이전트에 대해 반드시 정의:
- 역할
- 책임 범위
- 입력
- 출력
- 금지 범위
- 완료 조건
- 승인 필요 조건

Orchestrator 책임:
- 작업 분해
- 병렬 가능성 판단
- 입력/출력 계약 관리
- 충돌 해결
- fan-in 검증
- 최종 승인 요청

---

## 10. Skill + Hook 설계 기준

### Skill 원칙
- 거대한 정적 프롬프트를 만들지 마라.
- 필요한 순간에 필요한 것만 주입하라.
- skill 하나는 하나의 상황/위험/작업군을 책임지게 하라.

각 skill에 반드시 포함:
- 목적
- 호출 조건
- 입력
- 필수 규칙
- 작업 절차
- 자주 하는 실수
- 검증 방법
- 완료 기준
- 관련 문서/테스트

### Hook 원칙
hook은 “개입 시점”, skill은 “주입되는 지식”이다.

권장 hook 유형:
- Pre-action
- Post-action
- Validation
- Notification

반드시 정리:
- 어떤 이벤트를 감지할지
- 어떤 skill을 주입할지
- 어떤 검증을 자동 실행할지
- 어떤 경우 인간에게 알릴지

예:
- auth 파일 수정 감지 → auth-security skill
- DB 스키마 변경 감지 → db-migration + rollback 검증
- UI 컴포넌트 수정 감지 → design-system + accessibility
- 레거시 파일 수정 감지 → characterization test

---

## 11. canonical source 원칙

중복 문서를 양산하지 마라.  
다음 원칙을 따른다.

1. **핵심 운영 규칙은 canonical doc에만 상세히 쓴다.**
2. tool-specific 문서는 canonical doc의 **투영(projection)** 이어야 한다.
3. 같은 규칙을 여러 파일에 장문으로 복제하지 마라.
4. 요약본은 원문 링크와 source를 명시하라.
5. 생성 문서에는 신선도 메타데이터를 남겨라.

권장 메타데이터:
- Status
- Owner
- Canonical or Projection
- Source of Truth
- Last Verified
- Confidence

---

## 12. 이 단계의 출력 형식

반드시 아래 순서로 정리하라.

1. 현재 이해한 프로젝트 요약
2. governance scope 결정
3. canonical source 설계
4. 운영 모드와 전이 조건
5. 위험도 분류와 승인 정책
6. 품질 점수 체계와 초기 평가
7. 하네스 5요소 상세 갭 분석
8. 서브에이전트 구조 제안
9. Skill + Hook 구조 제안
10. 다음 단계에서 생성할 artifact pack
11. 단계별 도입 로드맵
12. 멈춤/승인 필요 지점

---

## 13. 다음 단계로 넘길 Handoff Packet

마지막에는 반드시 아래 형식으로 끝내라.

```md
# HANDOFF PACKET FOR LAYER 3

## Governance Scope
## Canonical Source Map
## Approval Matrix
## Quality Score Rubric and Initial Scores
## Automation Boundaries
## Planned Artifact Pack
## Planned Skill Set
## Planned Hook Set
## Planned Sub-Agent Set
## Open Risks / Required Approvals
```

---

## 14. 멈춤 조건

아래 중 하나라도 해결되지 않으면 이 단계에서 멈추고 승인 또는 확인을 요구하라.

- canonical source가 불명확
- 승인 필요 변경이 정의되지 않음
- R3 영역이 있는데 경계가 불명확
- 품질 점수 근거가 너무 빈약함
- 생성할 문서 범위가 과도함
- tool-specific 파일 생성 여부가 불명확
- 레거시 hotspot에 대한 방어 전략이 없음

---

## 이 단계 완료 기준

다음 6가지가 충족되면 이 파일의 역할은 끝난다.

- governance scope가 확정되었다
- canonical source map이 정리되었다
- approval matrix가 정리되었다
- 품질 점수 체계와 초기 평가가 나왔다
- 생성할 artifact pack이 정해졌다
- Layer 3로 넘길 Handoff Packet이 준비되었다
