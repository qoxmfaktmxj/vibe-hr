# VIBE-HR 진행 현황 및 남은 작업

작성일: 2026-03-14

## 1. 문서 목적

이 문서는 현재 VIBE-HR 현대화 작업에서

- 지금까지 완료된 내용
- 아직 남아 있는 작업
- 다음 우선순위
- 재기동 후 바로 확인 가능한 seed 데이터

를 한 번에 확인하기 위한 운영 문서다.

## 2. 지금까지 진행한 내용

### 2.1 레거시 분석 및 계획 문서화

- 기존 EHR 소스 + DB 명세 기준 업무 흐름 분석 문서 작성
  - `docs/ehr-legacy-business-flow-analysis.md`
- VIBE-HR 갭 분석 및 현대화 실행 계획 문서 작성
  - `docs/vibe-hr-modernization-gap-plan.md`
  - `docs/vibe-hr-gap-matrix-execution-backlog.md`
- 통합 신청/승인 구조 비교 및 HRI form registry 초안 작성
  - `docs/unified-application-approval-cross-check.md`
  - `docs/hri-form-registry-phase1-draft.md`
- 메뉴/샘플 seed 정책 문서 작성
  - `docs/menu-sample-seed-policy.md`
- 6개 핵심 사이클 점검 문서 작성
  - `docs/ehr-modernization-cycle-audit-2026-03-13.md`
  - `docs/EHR_PHASE1_EXECUTION_BACKLOG.md`

### 2.2 공통/플랫폼

- 로그인 `ENTER_CD`를 텍스트 입력이 아닌 회사 선택 콤보로 전환
- 주요 화면들을 Grid Standard V2 패턴으로 정리
- 메뉴 추가 시 메뉴 seed + 샘플 seed + 화면 노출 + 검증을 한 묶음으로 운영

### 2.3 데이터 규모

- 개발용 seed 데이터를 6000명 기준으로 확장
- 인사, 근태, 급여, 복리후생, 교육, HRI 신청 데이터까지 대량 seed 반영

### 2.4 HRM / ORG / TIM

- 채용 합격자 seed 구성
- `합격자 -> 인사정보 -> 발령` 흐름용 샘플 데이터 반영
- 조직 메타데이터 가시화
  - 조직구분
  - COST CENTER
  - 조직 설명
  - 인원수
- 부서 기본 근무패턴, 개인 예외 근무조, 스케줄 생성 샘플 반영

### 2.5 HRI / WEL

- HRI 통합 신청 타입 seed 추가
  - `LEAVE_REQUEST`
  - `WEL_BENEFIT_REQUEST`
- 복리후생 메뉴/유형관리/신청현황 화면 추가
- HRI 통합 신청 -> 승인/수신 -> 복리후생 신청 projection 연결

### 2.6 CPN / 급여

- 급여 Run -> 대상자 -> 항목상세 조회 흐름 구성
- 수당/공제 계산 기본 반영
  - 식대
  - 연장수당
  - 야간수당
  - 직책수당
  - 국민연금
  - 건강보험
  - 장기요양
  - 고용보험
- 복리후생 급여 반영 월 조건 정리
- 급여 상세 확인용 seed 케이스 고정
  - `HR-0001 MLA`
  - `KR-0004 MLA/POS/OTX`
  - `KR-0008 NGT`
- 재기동 시 현재월 기준 복리후생 seed가 다시 생성되도록 보강

### 2.7 최근 반영 커밋

- `2015e87` 복리후생 유형관리 seed overview
- `4909c75` 복리후생 신청현황 sample flow
- `04695ed` HRI 통합 신청 form seed
- `2c494db` HRI 신청 허브 복리후생 필드 연결
- `fe958ab` HRI 승인 흐름과 복리후생 신청 연결
- `5233689` 6000명 seed 확장
- `aae1ecb` 현대화 cycle seed 및 급여 검증 보강
- `0b3fa41` 대상 화면 Grid Standard V2 정리
- `2b9243f` 급여 공제/복리후생 월반영 로직 고도화
- `7a85256` 급여 Run 대상자/항목상세 그리드 추가
- `f4f75a6` 재기동용 급여/복리후생 seed 재현성 고정

## 3. 현재 상태 요약

### 3.1 현재 사용 가능한 영역

- 로그인
- 법인/조직 기본 조회
- 기본 인사정보 조회/일부 입력
- 발령 기록/확정
- 근무코드/근무패턴 조회
- 복리후생 유형/신청현황 조회
- HRI 공통 신청/승인 허브
- 급여 Run 조회 및 대상자 상세 조회

### 3.2 아직 완전하게 닫히지 않은 영역

- `합격자 -> 직원 -> 인사기본 -> 입사발령` 완전한 E2E 고정
- 조직개편 적용 및 조직 이력 배치
- TIM 월마감
- 급여 계산 엔진의 레거시 수준 분해
- 연말정산 / 급여 마감취소
- 복리후생 write workflow 전체
- 교육 / 평가 본체
- 메뉴 액션 권한
- 데이터 복구 / 정합성 도구

## 4. 6개 핵심 사이클 기준 상태

### 4.1 로그인

- 상태: 부분 완료
- 비고: `ENTER_CD` 콤보 로그인 가능

### 4.2 채용 합격자등록 -> 인사정보 -> 발령 -> 사용 가능 상태

- 상태: 부분 완료
- 비고: 합격자 화면에서 사원 생성 후 발령 화면으로 이동하고, 사번 기준 첫 발령 초안 작성/저장/확정 후 인사기본 `발령` 탭 반영까지는 동작한다. Playwright E2E도 추가했다. 다만 운영 규칙 세분화와 추가 회귀 시나리오는 계속 필요하다.

### 4.3 조직별 인원 매핑 + COST CENTER + 조직 설명

- 상태: 부분 완료
- 비고: 조회/가시화는 가능하나 조직개편 적용/이력 배치는 미구현

### 4.4 조직별 근무코드 -> 인원별 근무조 -> 개인 근무시간

- 상태: 부분 완료
- 비고: 구조와 seed는 있으나 운영 완성도 보강 필요

### 4.5 수당 포함 급여 계산

- 상태: 부분 완료
- 비고: 수당/보험 일부 반영은 되지만 `P_CPN_CAL_PAY_MAIN` 수준과는 차이가 큼

### 4.6 사회보험 + 복리후생 급여 연결

- 상태: 부분 완료
- 비고: 월반영 조건과 seed는 정리했지만, 완전한 급여 item 체계는 추가 필요

## 5. 남은 Phase 기준 해야 할 것

### E2 ORG 조직개편 적용/정렬

- 조직개편 적용 API
- 조직정렬 배치 API
- `/org/chart` 적용/미리보기 UI
- 적용 실패 로그 및 감사 로그

### E3 TIM 월마감

- 월마감 상태 모델
- 월마감 계산/집계 서비스
- `/api/v1/tim/month-close/*`
- `/tim/month-close`
- 마감 후 수정 제한 규칙

### E4 CPN 급여 코어 고도화

- `P_CPN_CAL_EMP_INS` 대응 대상자 snapshot 구조
- `F_CPN_PRO_CALC_YN` 대응 이벤트 판정 구조
- `P_CPN_CAL_PAY_MAIN` 대응 계산 단계 분해
- 소득세 master/산식
- 급여 Run 대상자 고정 / 계산요소 생성 / 검증 경고 고도화
- 1차 반영 완료
  - Run 생성 시 `pay_payroll_run_targets` snapshot 적재
  - confirmed 발령을 `pay_payroll_run_target_events` 로 고정
  - 계산은 target snapshot 기준으로 수행
  - 소득세는 `pay_income_tax_brackets` 우선, 기존 flat rate fallback
  - 급여프로필 기준 `base_salary/item_group/payment schedule` 변경 이벤트 판정 추가
  - 기존 Run용 `snapshot-backfill` 경로 추가

### E5 CPN 연말정산 / 마감취소

- 연말정산 실행/검증 API
- 마감/취소 API
- `/payroll/year-end`
- 감사 로그 및 이력 정리

### E6 SYS 데이터 복구 / 정합성 도구

- dry-run / execute 분리
- FK/중복/누락 검사
- 실행 이력 로그
- 관리자 전용 UI

### E7 WEL 복리후생 본체

- 신청 등록
- 승인/반려 write flow
- 급여 item 실연결
- 유형별 상세 모듈

### E8 TRA 교육 본체

- 교육 신청/승인/이수
- 필수교육 대상 추출
- 결과/이력 처리

### E9 메뉴 액션 권한

- `app_menu_actions`
- `app_role_menu_actions`
- 역할별 버튼 권한 UI/API
- 서버 API 액션 권한 검증

## 6. 지금 가장 먼저 해야 할 것

우선순위는 아래 순서가 맞다.

1. 소득세 master/산식 정리
2. `합격자 -> 직원 -> 인사기본 -> 입사발령` E2E 고정
3. 조직개편 적용/정렬 배치
4. TIM 월마감
5. 급여 대상자 snapshot + 이벤트 판정
6. 복리후생 신청/승인 write flow

## 7. 재기동/seed 기준 현재 보장되는 테스트 데이터

현재 `seed_initial_data()` 재실행 시 아래 데이터가 다시 생성된다.

- 6000명 기준 직원/근태/급여/복리후생/교육/HRI 샘플 데이터
- 현재월 급여 Run
- 전월 급여 Run
- 현재월 복리후생 고정 샘플 5건
- 급여 상세 확인용 수당 seed
  - `HR-0001 MLA 130000`
  - `KR-0004 POS 150000`
  - `KR-0004 OTX 125000`
  - `KR-0008 NGT 70000`

## 8. 참고 문서

- `docs/ehr-legacy-business-flow-analysis.md`
- `docs/vibe-hr-modernization-gap-plan.md`
- `docs/vibe-hr-gap-matrix-execution-backlog.md`
- `docs/ehr-modernization-cycle-audit-2026-03-13.md`
- `docs/EHR_PHASE1_EXECUTION_BACKLOG.md`

## 9. 메모

- 현재 워크트리에는 사용자 작업 중인 파일과 로그/산출물이 별도로 남아 있다.
- 대표적으로 `frontend/src/components/ui/calendar.tsx` 는 이번 문서 작업 범위에 포함하지 않았다.
- 브라우저 검증은 환경에 따라 `localhost:3000` 이 다른 앱으로 연결될 수 있으므로, 검증 전 실제 서버 대상을 다시 확인해야 한다.
