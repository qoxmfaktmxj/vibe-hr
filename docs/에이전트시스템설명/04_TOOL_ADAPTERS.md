# Layer 4 — Tool Adapters

이 파일은 **Layer 3의 canonical 문서 초안이 정리된 뒤** 사용한다.  
목표는 핵심 운영 규칙을 **도구별 설정, projection 문서, 기계적 강제 장치** 로 옮기는 것이다.

이 단계가 끝나면 4층 구조의 초안 세팅이 완료된다.

- 이전 단계: `03_ARTIFACT_TEMPLATES.md`
- 이 단계의 완료물: **Tool Adapter & Enforcement Pack**
- 금지: canonical source를 다시 쓰는 것, 도구별 파일마다 장문 정책 복제, 프로젝트에 없는 도구까지 생성하는 것

---

## 사람 사용법

1. 이 파일 전체를 AI에게 붙여 넣는다.
2. 반드시 **Layer 3의 Handoff Packet** 을 함께 제공한다.
3. 현재 실제 사용하는 도구를 같이 알려 주면 더 좋다.
   - Claude 계열
   - Cursor
   - GitHub Actions / CI
   - pre-commit / husky
   - CODEOWNERS
   - 아키텍처 테스트 도구
4. AI가 projection 문서와 enforcement 후보를 만들면 검토한다.
5. 승인 후 실제 repo 반영 여부를 결정한다.

---

## AI에게 전달할 지시문

이 단계의 목표는 **canonical 문서에서 확정된 규칙을 도구별로 투영** 하는 것이다.  
도구별 파일은 핵심 규칙의 새로운 source of truth가 되어서는 안 된다.

---

## 1. 핵심 원칙

1. canonical 문서가 원본이다.
2. adapter 파일은 원본의 요약, 포인터, 실행 진입점이어야 한다.
3. 같은 규칙을 여러 adapter 파일에 장문으로 반복하지 마라.
4. 실제 사용하는 도구만 생성하라.
5. tool-specific 설정은 project-specific 사실과 연결되어야 한다.
6. 기계적 강제는 가능한 것만 제안하라. 지어내지 마라.
7. 위험 변경은 문서 규칙이 아니라 hook / CI / CODEOWNERS / 테스트 게이트로 옮길 수 있는지 먼저 보라.

---

## 2. projection 설계 규칙

다음 형식으로 정리하라.

```md
| Canonical Source | Projection Target | 무엇을 포함할지 | 무엇을 제외할지 |
|---|---|---|---|
| AGENTS.md | CLAUDE.md | 작업 흐름, 금지 규칙 요약, 문서 맵 | 장문 아키텍처 설명 |
| AGENTS.md | .cursor/rules/* | 편집 시 지켜야 할 핵심 규칙 | 운영 헌법 전체 |
| docs/TEST_STRATEGY.md | CI workflow | 실행할 테스트 게이트 | 테스트 철학의 장문 설명 |
| docs/SECURITY.md | CODEOWNERS / checks | 민감 경로 보호 규칙 | 전체 보안 정책 |
| docs/SKILLS_INDEX.md | skills manifest | trigger와 skill 연결 | 설명성 본문 전체 |
```

---

## 3. 권장 adapter 대상

프로젝트 상황에 맞게 필요한 것만 선택하라.

### 3.1 Claude 계열
후보:
- `CLAUDE.md`
- `.claude/settings.json`
- `.claude/commands/discover.md`
- `.claude/commands/plan.md`
- `.claude/commands/review.md`

규칙:
- `CLAUDE.md` 는 `AGENTS.md` 의 projection이어야 한다.
- 핵심 금지 규칙, 문서 맵, 시작 명령만 요약하라.
- 아키텍처 상세를 중복 복제하지 마라.

### 3.2 Cursor
후보:
- `.cursor/rules/00-core.mdc`
- `.cursor/rules/10-risk-guardrails.mdc`
- `.cursor/rules/20-testing.mdc`
- `.cursor/rules/30-legacy.mdc`

규칙:
- 큰 단일 규칙 파일 하나로 몰지 마라.
- 편집 맥락에 직접 필요한 규칙만 넣어라.
- canonical 문서 링크 또는 참조를 넣어라.

### 3.3 CI / GitHub Actions
후보:
- `.github/workflows/guardrails.yml`
- `.github/workflows/test-gate.yml`

규칙:
- lint/type/test/build/contract/architecture 중 실제 가능한 것만 넣어라.
- R2/R3 변경 경로는 별도 체크를 고려하라.
- 실패 메시지는 사람이 바로 수정 방향을 알 수 있게 써라.

### 3.4 pre-commit / pre-push
후보:
- `.husky/pre-commit`
- `.husky/pre-push`
- `pre-commit-config.yaml`

규칙:
- 매우 빠른 검사만 pre-commit에 넣어라.
- 무거운 검증은 pre-push 또는 CI로 올려라.
- 개발 흐름을 과도하게 막지 마라.

### 3.5 Approval / Ownership
후보:
- `CODEOWNERS`
- path-based approval rule 문서
- 위험 경로 체크 스크립트

규칙:
- auth, billing, migrations, infra, secrets, public API 경로를 식별하라.
- 승인 필요 경로는 명시적으로 분리하라.
- canonical `SECURITY.md` 와 approval matrix를 근거로 삼아라.

### 3.6 Architecture / Dependency Checks
후보:
- `scripts/check-architecture.*`
- `scripts/check-forbidden-deps.*`
- `archunit` / `eslint` / custom rule / `depcruise` / `mypy` 등 프로젝트 맞춤 도구

규칙:
- “문서로 금지”보다 “실패하는 검사”를 우선하라.
- 실제 언어와 빌드 환경에 맞는 도구만 제안하라.

---

## 4. adapter 생성 형식

각 adapter에 대해 반드시 아래를 제시하라.

1. 파일 경로
2. source canonical 문서
3. 목적
4. 포함할 내용
5. 제외할 내용
6. 초안
7. 유지보수 규칙

---

## 5. 기계적 강제 후보 정리 형식

반드시 아래 형식으로 정리하라.

```md
| 규칙 이름 | 목적 | 적용 범위 | 실패 메시지 | 자동 수정 가능 여부 | 관련 canonical 문서 | 구현 수단 |
|---|---|---|---|---|---|---|
| no-auth-change-without-review | auth 변경 보호 | src/auth/** | auth 관련 변경은 승인과 회귀 테스트가 필요합니다 | 아니오 | docs/SECURITY.md | CI + CODEOWNERS |
| public-api-contract-gate | 공개 계약 보호 | api/public/** | 공개 API 변경에는 contract test와 소비자 영향 확인이 필요합니다 | 아니오 | ARCHITECTURE.md | CI |
| migration-requires-plan | 마이그레이션 보호 | migrations/** | DB 변경에는 exec-plan과 rollback 정보가 필요합니다 | 아니오 | docs/TEST_STRATEGY.md | CI script |
```

실패 메시지는 반드시 아래를 포함하라.
- 무엇이 잘못되었는가
- 왜 금지/보호되는가
- 어떻게 고쳐야 하는가
- 관련 문서가 무엇인가

---

## 6. Skill / Hook manifest 설계

### 6.1 Skill manifest 예시

아래 형식으로 제안하라.

```yaml
skills:
  - id: auth-security
    purpose: Protect authentication and authorization changes
    triggers:
      paths:
        - "src/auth/**"
      risks:
        - "R3"
      tasks:
        - "auth"
        - "permission"
    requires:
      docs:
        - "docs/SECURITY.md"
      checks:
        - "auth-regression"
        - "permission-tests"
    approval: required
```

### 6.2 Hook manifest 예시

```yaml
hooks:
  - id: auth-change-guard
    event: pre-action
    match:
      any_path:
        - "src/auth/**"
    inject_skills:
      - "auth-security"
      - "role-permission"
    validations:
      - "permission-tests"
    notify:
      - "human-review"
    block_when:
      - "approval-missing"

  - id: migration-guard
    event: validation
    match:
      any_path:
        - "migrations/**"
        - "db/schema/**"
    inject_skills:
      - "db-migration"
    validations:
      - "schema-diff"
      - "rollback-checklist"
    notify:
      - "db-owner"
    block_when:
      - "exec-plan-missing"
```

실제 repo에 맞게 경로, 이벤트, 검사 이름을 조정하라.  
없는 시스템을 사실처럼 쓰지 마라.

---

## 7. adapter별 작성 지침

### 7.1 `CLAUDE.md` 초안 원칙
반드시 포함:
- 프로젝트 개요
- source-of-truth 문서 맵
- 기본 작업 흐름
- 위험 변경 금지/승인 규칙 요약
- 시작 명령 / 검증 명령
- 긴 문서 대신 참조 링크

제외:
- 장문 아키텍처 상세
- 전체 security 정책 복제
- 전체 skill 본문 복제

### 7.2 `.cursor/rules/*.mdc` 원칙
분할 기준 예시:
- `00-core.mdc`: 공통 운영 규칙
- `10-risk-guardrails.mdc`: 민감 변경 규칙
- `20-testing.mdc`: 테스트/검증 원칙
- `30-legacy.mdc`: 레거시 변경 원칙

### 7.3 CI workflow 원칙
권장 단계:
1. changed-files 감지
2. lint/type/test/build
3. 위험 경로별 추가 게이트
4. 실패 시 읽기 쉬운 메시지 출력

### 7.4 CODEOWNERS 원칙
- 민감 경로만 먼저 보호하라.
- 광범위한 전체 repo 소유권 지정으로 개발 속도를 마비시키지 마라.
- approval matrix와 일치하게 유지하라.

---

## 8. 이 단계의 출력 형식

반드시 아래 순서로 정리하라.

1. 현재 tool 환경 요약
2. 생성 대상 adapter 목록
3. projection matrix
4. 각 adapter 초안
5. 기계적 강제 후보
6. skill/hook manifest 초안
7. 적용 우선순위
8. 승인 필요 항목
9. 실제 반영 전에 확인할 점

---

## 9. 멈춤 조건

아래 중 하나라도 있으면 adapter 생성만 하고, 실제 적용은 보류하라고 표시하라.

- 현재 사용하는 도구가 불명확
- canonical 문서가 아직 불안정
- 경로 기반 민감 구역이 불명확
- CI/hook 실행 환경이 불명확
- 실제 검증 명령을 모름
- 권한/승인 체계가 아직 미정
- tool-specific 파일이 canonical 역할을 대신하게 될 위험이 큼

---

## 10. 이 단계 완료 기준

다음 6가지가 충족되면 4층 구조의 초안 세팅이 완료된다.

- canonical source와 projection target이 분리되었다
- 필요한 adapter 파일 목록이 정리되었다
- 기계적 강제 후보가 정리되었다
- skill/hook manifest 초안이 준비되었다
- 승인 필요 항목이 식별되었다
- 실제 repo 반영 전에 확인할 지점이 분명해졌다
