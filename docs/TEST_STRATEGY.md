Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# TEST_STRATEGY.md

## 목적
이 문서는 Vibe-HR에서 변경을 검증하는 최소 기준과 작업 유형별 테스트/검증 방식을 정의한다. 목표는 테스트 도구를 나열하는 것이 아니라, 변경 위험도와 도메인 민감도에 따라 어떤 검증이 필요한지 일관되게 판단할 수 있게 만드는 것이다.

## 현재 검증 도구
### Frontend
- `npm run validate:grid` — Grid 화면 규약 검증 [Observed]
- `npm run lint` — ESLint [Observed]
- `npm run test` — Vitest [Observed]
- `npm run build` — Next.js build [Observed]
- `npm run test:e2e:hr` — Playwright E2E(현재 HR finalist/appointment 중심) [Observed]

### Backend
- `pytest` 또는 `python -m pytest -q` — 백엔드 단위/통합 성격 테스트 [Observed]

### CI
- GitHub Actions에서 backend tests → frontend validate/lint/build/test 순으로 실행된다. [Observed]

## 테스트 계층
### 1) Unit
- 함수/서비스/도메인 규칙의 국소 검증
- 백엔드 서비스 테스트와 프론트 유틸/컴포넌트 테스트를 포함할 수 있다. [Observed][Derived]

### 2) Integration
- route/service/data 흐름, 화면과 API 연결, 권한 조합 검증
- 권한/급여/seed/backfill은 단위 테스트만으로 충분하지 않다. [Derived]

### 3) Contract
- 공개 API 입력/출력 계약 검증
- Grid list API의 pagination-ready 계약도 포함한다. [Observed][Derived]

### 4) Regression / E2E
- 실제 사용자 흐름의 회귀 방지
- 대표 대상:
  - 로그인
  - 채용합격자 → 사원 생성 → 발령
  - 메뉴 액션 권한 적용 화면
  - 급여 Run 조회 핵심 흐름 [Observed][Derived]

### 5) Characterization (Legacy)
- 레거시 hotspot 변경 전 현재 동작을 고정하는 테스트
- 적용 대상:
  - TIM 월마감
  - 급여 계산 코어
  - 조직개편
  - 액션 권한 end-to-end [Derived]

## 기본 원칙
1. 작은 변경일수록 빠르게, 큰 변경일수록 다층으로 검증한다. [Proposal]
2. AG Grid 화면 변경은 `validate:grid`를 가장 먼저 고려한다. [Observed]
3. 공통 Grid/권한/급여/배포 변경은 회귀 검증 없이 완료로 간주하지 않는다. [Derived]
4. 검증을 하지 못했으면 이유를 명시적으로 기록한다. [Observed][Proposal]
5. 레거시 hotspot은 characterization test 또는 최소 재현 시나리오를 먼저 확보한다. [Proposal]

## 작업 유형별 원칙
### 신규 기능
- acceptance criteria 또는 명확한 테스트 계획을 먼저 정리한다.
- 구현 후 관련 단위/통합/회귀 검증을 수행한다.
- 사용자 화면이 포함되면 수동 경로 또는 E2E 후보를 남긴다.

### 버그 수정
- 재현 단계를 먼저 기록한다.
- 가능하면 failing regression test를 먼저 만든다.
- 수정 후 재현 단계가 사라졌음을 검증한다.

### 리팩터링
- 동작 보호용 테스트를 먼저 확보한다.
- 의미 변화가 없어야 하며, 공통 모듈이면 영향 범위를 함께 적는다.

### 레거시 변경
- characterization test 또는 최소 기준 동작을 먼저 문서화한다.
- 작은 단위로 변경한다.
- 남은 회귀 위험을 명시한다.

### DB 관련 변경
- schema diff / data integrity / rollback plan을 함께 검토한다.
- destructive 변경은 R3로 분류한다.
- 현재 단계에서는 승인 없이는 진행하지 않는다. [User-stated][Derived]

## 위험도별 필수 검증
| 위험도 | 기본 검증 |
|---|---|
| R0 | 문서 구조/링크 확인 |
| R1 | 관련 테스트 + lint/build + 필요 시 `validate:grid` |
| R2 | 관련 테스트 + lint/build + integration/contract 관점 검증 + 영향도 기록 |
| R3 | 명시 승인 후 별도 검증 계획, rollback plan, 데이터/보안 회귀 포함 |

## 작업 클래스별 검증 가이드
### AG Grid 화면 수정
필수:
- `npm run validate:grid`
- `npm run lint`
- `npm run build`
- 기존 화면 최소 1건 회귀 확인 또는 수동 점검 근거 [Observed][Derived]

선택:
- 관련 Vitest
- 필요 시 브라우저 수동 확인

### 메뉴/액션 권한 변경
필수:
- 관련 프론트 UI 확인
- 서버 권한 검증 확인
- 관련 테스트 또는 수동 재현 단계 기록
- 권한 없는 경우 차단되는지 확인

### 급여/정산 변경
필수:
- 관련 백엔드 테스트
- 대표 seed 케이스 검증
- 의미 변화 여부 명시
- rollback 또는 중단 조건 기록

### 배포/CI 변경
필수:
- 변경 이유
- 현재 `main` 운영에 미치는 영향 명시
- 배포 후 health 확인 계획

## 명령 기준
### Frontend 기본 명령
```bash
cd frontend
npm run validate:grid
npm run lint
npm run test
npm run build
```

### Frontend E2E 후보
```bash
cd frontend
npm run test:e2e:hr
```

### Backend 기본 명령
```bash
cd backend
pytest
```

## Type Check 상태
- 별도 standalone `typecheck` 스크립트는 현재 `package.json`에서 직접 확인되지 않았다. [Observed]
- 현재는 lint/build 과정이 일부 타입 이슈를 간접적으로 드러내는 구조로 보인다. [Derived]
- 별도 typecheck 명령 도입 여부는 `NEEDS_CONFIRMATION`

## 증거 기록 규칙
- 수행한 명령
- 성공/실패 여부
- 실패 시 핵심 로그 또는 원인 요약
- 생략한 검증과 그 이유
- 남은 리스크

위 항목은 `docs/TASK_LEDGER.md` 기준으로 기록한다.

## Flaky Test 처리 원칙
- flaky 정의: 동일 조건에서 비결정적으로 실패/성공하는 테스트 [Proposal]
- 처리 규칙:
  - 임시 통과 근거로 사용하지 않는다.
  - flaky suspicion이 있으면 ledger에 기록한다.
  - 격리(quarantine) 여부는 `NEEDS_CONFIRMATION`

## 승인과 테스트 관계
- R0: 문서 확인 중심
- R1: 로컬 검증 후 진행 가능
- R2: 승인 후 검증 세트 수행
- R3: 승인 + 고위험 검증 계획 + rollback/migration 검토 필요

## 현재 확인된 테스트 공백
- 전체 업무 사이클 회귀 체계가 아직 부족하다. [Derived]
- 권한 end-to-end 검증 표준이 아직 없다. [Derived]
- 급여 의미 변화 감지용 characterization 기준이 부족하다. [Derived]
- data repair / integrity 도구의 검증 전략은 미정이다. [Missing]

## 다음 보강 우선순위
1. 권한 변경 테스트 가이드 정리
2. vertical slice별 회귀 시나리오 정의
3. 급여/레거시 hotspot characterization 기준 마련
4. Task Ledger와 검증 결과 연결
