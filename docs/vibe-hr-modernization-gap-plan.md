# VIBE-HR Modernization Gap Plan

작성일: 2026-03-12  
비교 기준:
- 현재 저장소: `C:\Users\kms\Desktop\dev\vibe-hr`
- 레거시 시스템: `C:\EHR_PROJECT\isu-hr\EHR_HR50`
- DB 명세: `C:\Users\kms\Desktop\dev\EHR_6\EHR5_DB명세.sql`
- 분석 문서: `docs/ehr-legacy-business-flow-analysis.md`
- 명명 기준: `docs/EHR_TABLE_RENAMING_STANDARD.md`

## 1. 시스템 요약

현재 VIBE-HR은 Next.js + FastAPI + SQLModel 구조로 이미 현대화 방향을 갖고 있다.  
다만 레거시 대비 업무 깊이는 영역별 편차가 크다.

현대화 기본 원칙:

1. VIBE-HR에 이미 더 풍부한 기능/UX가 있으면 VIBE-HR을 기준으로 유지한다.
2. VIBE-HR이 얕은 영역은 레거시 업무 흐름을 근거로 보강한다.
3. 새 테이블명은 레거시 `T*` 코드를 재사용하지 않고 VIBE-HR 명명 규칙을 따른다.
4. 레거시의 숨은 로직은 Procedure 이식이 아니라 서비스 계층 명시 로직으로 재구성한다.
5. 모듈 이식은 화면 단위가 아니라 업무 시나리오 단위로 자른다.

## 2. 현재 VIBE-HR 구현 범위

### 2.1 프런트엔드 화면

| 영역 | 현재 화면 근거 | 상태 |
|---|---|---|
| 조직 | `frontend/src/app/org/corporations/page.tsx`, `frontend/src/app/org/departments/page.tsx`, `frontend/src/app/org/chart/page.tsx` | 기본/일부 확장 구현 |
| 인사발령 | `frontend/src/app/hr/appointment/codes/page.tsx`, `frontend/src/app/hr/appointment/records/page.tsx` | 구현 |
| 근태 | `frontend/src/app/tim/check-in/page.tsx`, `status`, `correction`, `annual-leave`, `leave-request`, `leave-approval`, `reports` | 구현 |
| 급여 | `frontend/src/app/payroll/codes/page.tsx`, `tax-rates`, `allowance-deduction-items`, `item-groups`, `employee-profiles`, `variable-inputs`, `runs`, `payment-schedules` | 구현 |
| 복리후생 | 화면 없음 확인 | 미구현 |
| 교육 | `frontend/src/app/tra/course-events/page.tsx`, `applications`, `required-standards`, `required-targets`, `elearning-windows`, `histories`, `cyber-upload` | 구현 |
| 평가 | `frontend/src/app/pap/appraisals/page.tsx`, `frontend/src/app/pap/final-results/page.tsx` | 부분 구현 |

### 2.2 백엔드 API / 서비스

| 영역 | 현재 API 근거 | 현재 서비스 근거 | 상태 |
|---|---|---|---|
| 조직 | `backend/app/api/organization.py` | `backend/app/services/organization_service.py` | 구현 |
| 인사발령 | `backend/app/api/hr_appointment_record.py` | `backend/app/services/hr_appointment_record_service.py` | 구현 |
| 근태 | `backend/app/api/tim_attendance_daily.py`, `backend/app/api/tim_leave.py` | `backend/app/services/tim_attendance_daily_service.py`, `backend/app/services/tim_leave_service.py` | 구현 |
| 급여 | `backend/app/api/payroll_phase2.py`, `backend/app/api/pay_setup.py` | `backend/app/services/payroll_phase2_service.py`, `backend/app/services/pay_setup_service.py` | 구현 |
| 복리후생 | `backend/app/api/welfare.py` | `backend/app/services/welfare_service.py` | 마스터만 구현 |
| 교육 | `backend/app/api/tra.py` | `backend/app/services/tra_service.py` | 구현 |
| 평가 | `backend/app/api/pap_appraisal.py`, `backend/app/api/pap_final_result.py` | `backend/app/services/pap_appraisal_service.py`, `backend/app/services/pap_final_result_service.py` | 마스터/결과코드 중심 |

### 2.3 현재 구현에서 확인한 핵심 함수

| 영역 | 함수 근거 | 의미 |
|---|---|---|
| 조직 | `organization_service.py:def create_department`, `update_department`, `delete_department` | 조직 CRUD와 계층 검증 |
| 인사발령 | `hr_appointment_record_service.py:def confirm_appointment_order` | 확정 시 직원/인사이력 반영 |
| 근태 | `tim_attendance_daily_service.py:def check_in`, `check_out`, `correct_attendance` | 출퇴근 및 정정 처리 |
| 근태휴가 | `tim_leave_service.py:def get_or_create_annual_leave`, `create_leave_request`, `decide_leave_request` | 연차/휴가 기본 흐름 |
| 급여 | `payroll_phase2_service.py:def create_payroll_run`, `calculate_payroll_run`, `close_payroll_run`, `mark_payroll_run_paid` | 정기급여 run 중심 처리 |
| 복리후생 | `welfare_service.py:def list_wel_benefit_types`, `batch_save_wel_benefit_types` | 유형 마스터만 존재 |
| 교육 | `tra_service.py:def generate_required_events`, `generate_required_targets`, `generate_elearning_windows`, `apply_cyber_results` | 생성 배치 중심 |
| 평가 | `pap_appraisal_service.py`, `pap_final_result_service.py` CRUD | 운영형 평가 프로세스는 아직 미구현 |

## 3. 기능 영역별 구조 비교

| 영역 | 레거시 핵심 구조 | VIBE-HR 현재 구조 | 판단 |
|---|---|---|---|
| 조직 | `TORG101/103/105`, 코드관리 SQL 중심 | `organization.py` + `organization_service.py` + `org_departments` | VIBE-HR 유지, 레거시 삭제/사용중 판정 규칙만 보강 |
| 인사발령 | `THRM191 -> P_HRM_151_* -> THRM151/223` | `confirm_appointment_order`가 `HrEmployee`, `HrPersonnelHistory` 갱신 | VIBE-HR 구조 유지, 레거시 겸직/파견/복직 세부 규칙 추가 필요 |
| 근태신청 | `TTIM301 + THRI103 + TTIM383/385` | `tim_leave_service.py` 단일 요청/승인 모델 | 공통 결재/변경/취소/잔여 로직 확장 필요 |
| 연차생성 | `WtmLeaveCreMgrService` + 다수 계산 도메인 | `tim_leave_service.get_or_create_annual_leave` 단순 발생 | 레거시 규칙 분석 후 별도 연차엔진 필요 |
| 급여 | `P_CPN_CAL_EMP_INS`, `P_CPN_CAL_PAY_MAIN`, `F_CPN_PRO_CALC_YN` | `payroll_phase2_service.py` 서비스 기반 정기급여 V1 | VIBE-HR 유지하되 계산 규칙, 상태전이, 근태연계 대폭 강화 필요 |
| 복리후생 | 신청/승인/급여연계/마감 상태 전부 존재 | `welfare_service.py`의 `WelBenefitType` CRUD만 존재 | 신규 구축 필요 |
| 교육 | 신청, 승인, 미참석취소, 결과보고, 이수확정 | `tra_service.py` 리소스 CRUD + 생성 배치 | 신청/결재/취소/결과보고 흐름 보강 필요 |
| 평가 | 일정, 배정, 점수, 등급, 이의제기, 마감 | `PapAppraisalMaster`, `PapFinalResult` 마스터 수준 | 운영형 평가 프로세스 재설계 필요 |
| 권한/공통코드 | `TSYS005`, `F_SEC_GET_AUTH_CHK`, `THRI101` | `common_code.py`, `auth/menu/settings` 계열 | 코드/권한 사전 정리 필요 |

## 4. 호출 체인 비교

| 업무 | 레거시 호출 체인 | VIBE-HR 현재 체인 | 차이 |
|---|---|---|---|
| 조직관리 | JSP -> `OrgCdMgrController` -> `OrgCdMgrService` -> `OrgCdMgr-sql-query.xml` -> `TORG101` | `org/departments/page.tsx` -> `frontend/src/app/api/org/departments/route.ts` -> `backend/app/api/organization.py` -> `organization_service.py` -> `org_departments` | VIBE-HR은 ORM 중심, 레거시는 SQL 중심 |
| 발령확정 | 화면 -> `AppmtHistoryMgrController` -> `AppmtHistoryMgrService` -> `THRM191` -> `P_HRM_151_*`, `P_HRM_223_*` | `hr/appointment/records/page.tsx` -> `api/hr/appointments/records` -> `hr_appointment_record.py` -> `confirm_appointment_order` -> `HrEmployee`, `HrPersonnelHistory` | VIBE-HR은 DB hidden logic가 적음 |
| 휴가요청 | 화면 -> `VacationAppController` -> `VacationAppService` -> `TTIM301`, `THRI103` | `tim/leave-request/page.tsx` -> `api/tim/leave-requests` -> `tim_leave.py` -> `create_leave_request` -> `TimLeaveRequest`, `TimAnnualLeave` | 결재라인/변경/취소 모델이 단순화됨 |
| 근태일상 | 레거시 TIM/WTM 조합 | `tim/check-in/page.tsx` -> `api/tim/attendance-daily/check-in` -> `tim_attendance_daily_service.check_in` -> `tim_attendance_daily` | 출퇴근은 VIBE-HR이 별도 신설 |
| 급여계산 | 화면 -> `PayCalcCreController` -> `PayCalcCreService/ProcService` -> `P_CPN_*` | `payroll/runs/page.tsx` -> `frontend/src/app/api/pay/[...path]/route.ts` -> `payroll_phase2.py` -> `payroll_phase2_service.py` -> `PayPayrollRun*` | 레거시 대비 계산 심도가 낮음 |
| 복리후생연계 | `WelfarePayDataMgrController` -> `WelfarePayDataMgrService` -> `P_BEN_PAY_DATA_*` | 없음 | 신규 필요 |
| 교육신청 | `EduAppController` -> `EduAppService` -> `TTRA201/TTRA203/TTRA205/THRI103` | `tra/applications/page.tsx` -> `frontend/src/app/api/tra/[...path]/route.ts` -> `tra.py` -> `tra_service.py` | 리소스 CRUD는 있으나 결재 전이가 부족 |
| 평가결과 | 화면 -> `AppResultMgr` mapper -> `TPAP551/TPAP567/TPAP202` | `pap/final-results/page.tsx` -> `api/pap/final-results` -> `pap_final_result_service.py` | 결과코드 마스터만 있고 실제 평가운영 흐름 없음 |

## 5. 핵심 규칙 비교

| 영역 | 레거시 핵심 규칙 | VIBE-HR 상태 | 조치 |
|---|---|---|---|
| 발령 | 발령수정 후 `THRM151`, `THRM223` 동기화 필수 | `confirm_appointment_order`에서 직원/이력 갱신은 구현 | 겸직/파견/복직 세부 규칙 추가 분석 |
| 근태 | 변경/취소/결재/잔여휴가가 분리 테이블 | 기본 신청/승인/취소만 구현 | 변경신청, 취소이력, 공통결재 연계 추가 |
| 연차 | 입사기준/월차/출근율80%/보상/이월 | 단순 연차 자동생성 | 별도 연차엔진 설계 필요 |
| 급여 | 대상자선정 -> 계산 -> 재계산 -> 마감 -> 복리연계 | run 계산/마감/지급 상태는 있음 | 대상자선정, 근태/발령 이벤트 반영, 계산정책 확대 필요 |
| 복리 | 사업별 마감상태 + 담당자 + 급여연계 | 유형 마스터만 존재 | 신청/승인/급여연계 신규 구축 |
| 교육 | 결과보고/미참석취소가 별도 결재문서 | 리소스 CRUD + 생성 배치 | 상태전이와 결재모델 추가 |
| 평가 | 평가일정/배정/결과/이의제기/마감 | 마스터/결과코드 수준 | 전체 운영프로세스 설계 필요 |

## 6. 현대화 리스크

1. 급여 계산 로직 손실 위험
   - 근거: 레거시는 `P_CPN_CAL_EMP_INS`, `P_CPN_CAL_PAY_MAIN`, `F_CPN_PRO_CALC_YN`에 핵심 규칙이 숨어 있다.
2. 근태 연차 규칙 누락 위험
   - 근거: `WtmLeaveCreMgrService.excCreateWtmLeaves`와 `domain/Wtm*` 클래스가 매우 세분화되어 있다.
3. 공통 결재 모델 분리 실패 위험
   - 근거: 레거시 근태/복리/교육이 모두 `THRI103` 기반이다.
4. 복리후생 급여연계 누락 위험
   - 근거: `P_BEN_PAY_DATA_CREATE_ALL`이 급여 파이프라인 일부다.
5. 평가 운영모델 과소구현 위험
   - 근거: 레거시는 `TPAP105`, `TPAP202`, `TPAP551`, `TPAP567`로 주기/배정/결과/피드백을 분리한다.
6. Oracle 함수 의존 SQL의 PostgreSQL 재작성 위험
   - 근거: `F_COM_GET_NAMES`, `F_COM_GET_ORG_NM2`, `F_SEC_GET_AUTH_CHK`, `F_PAP_GET_APP_GROUP_NM2` 등 함수 호출 다수.

## 7. 우선순위 제안

### 7.1 권장 순서

1. 인사발령 + 급여 이벤트 정의 정리
2. 근태 신청/연차엔진 정교화
3. 급여 계산 심화
4. 복리후생 신규 구축
5. 교육 결재/결과보고 보강
6. 평가 운영모델 구축

### 7.2 이유

- 급여와 근태는 다른 모듈의 결과를 소비한다.
- 복리후생은 급여연계가 선행돼야 한다.
- 교육/평가는 독립 모듈이지만 공통 결재/권한 체계를 재사용해야 한다.

## 8. 1~6번 실행 계획

### 8.1 1번. 현재 VIBE-HR과 레거시/DB 명세 비교 후 없는 부분 추가 계획

목표:
- 레거시 시나리오를 VIBE-HR 기능 목록으로 매핑하고 미구현/부분구현/대체구현을 확정한다.

산출물:
- 기능 매핑표
- 레거시 객체 -> 신규 객체 교차참조표
- 화면/API/테이블 백로그

작업:
1. `docs/ehr-legacy-business-flow-analysis.md` 기준으로 모듈별 시나리오를 잠근다.
2. 현재 VIBE-HR 화면/API/엔터티를 1:1 매핑한다.
3. 상태를 `유지`, `보강`, `신규`, `폐기`로 나눈다.
4. 우선순위를 `필수`, `중요`, `후속`으로 나눈다.

초기 판정:
- 유지: 조직 기본 CRUD, 발령 기본확정, 근태 출퇴근, 급여 기본 마스터/런, 교육 기본 리소스
- 보강: 발령 세부처리, 휴가 변경/취소, 연차엔진, 급여대상자선정/이벤트판정, 교육 결재
- 신규: 복리후생 전체, 평가 운영프로세스

### 8.2 2번. 급여 로직 비교 및 VIBE-HR 급여 로직 개선

레거시 근거:
- `PayCalcCreController`, `PayCalcCreService`, `PayCalcCreProcService`
- `P_CPN_CAL_EMP_INS`, `P_CPN_CAL_PAY_MAIN`, `F_CPN_PRO_CALC_YN`

현재 VIBE-HR 근거:
- `backend/app/api/payroll_phase2.py`
- `backend/app/services/payroll_phase2_service.py`
- `backend/app/services/pay_setup_service.py`
- `docs/PAYROLL_PHASE2_V1_IMPLEMENTATION_PLAN.md`

개선 방향:
1. 급여대상자 생성 단계를 별도 서비스로 분리한다.
2. 발령/입퇴사/조직이동/휴직 이벤트를 급여 run 전처리 이벤트로 명시화한다.
3. `draft -> calculated -> closed -> paid` 상태 전이에 롤백 가능 지점을 정의한다.
4. 근태/복리/수기입력 합산 순서를 고정한다.
5. 레거시 `TCPN203` 역할을 대체할 run 대상 스냅샷 구조를 설계한다.
6. 오류/경고 로그를 `pay_payroll_run_events` 계열 구조에 누적한다.

권장 신규 객체:
- `pay_run_target_profiles`
- `pay_run_target_events`
- `pay_run_calculation_rules`
- `pay_run_item_results`

### 8.3 3번. 근태 로직 확인 후 VIBE-HR 근태 로직 개선

레거시 근거:
- `VacationApp*`
- `WtmLeaveCreMgrService.excCreateWtmLeaves`
- `TTIM301`, `TTIM383`, `TTIM385`, `TTIM511`, `TWTM*`

현재 VIBE-HR 근거:
- `backend/app/api/tim_leave.py`
- `backend/app/services/tim_leave_service.py`
- `backend/app/services/tim_attendance_daily_service.py`
- `TIM_MODULE_PLAN.md`

개선 방향:
1. 휴가신청, 변경신청, 취소신청을 분리한다.
2. 공통 결재 모델을 `hri`와 재사용하는 방향으로 통합한다.
3. 연차엔진을 단순 잔여일수 CRUD와 분리된 서비스로 만든다.
4. 생성옵션, 입사기준, 1년 미만 월차, 출근율, 이월/보상 규칙을 별도 정책 객체로 분리한다.
5. 일상 근태(`attendance_daily`)와 정책성 근태(`leave`, `schedule`, `monthly close`)를 계층 분리한다.

권장 신규 객체:
- `tim_leave_policies`
- `tim_leave_generation_runs`
- `tim_leave_generation_results`
- `tim_leave_change_requests`
- `tim_leave_cancel_requests`

### 8.4 4번. 복리후생 추가

레거시 근거:
- `LoanApp`, `LoanApr`, `WelfarePayDataMgr`
- `TBEN623`, `TBEN625`, `TBEN991`, `TBEN993`
- `P_BEN_PAY_DATA_CREATE_ALL`

현재 VIBE-HR 근거:
- `backend/app/api/welfare.py`
- `backend/app/services/welfare_service.py`
- `WELFARE_MODULE_PLAN.md`

판단:
- 현재 VIBE-HR은 `WelBenefitType` 마스터만 있고 실업무는 미구현이다.

우선 구현 범위:
1. 유형마스터 유지
2. 신청/승인 공통 프레임 구축
3. 대출, 경조, 학자금, 의료비 순으로 업무 추가
4. 급여연계 배치 추가
5. 사업장/담당자/마감상태 모델 추가

권장 신규 객체:
- `wel_requests`
- `wel_request_approvals`
- `wel_pay_link_policies`
- `wel_pay_link_runs`
- `wel_loan_requests`
- `wel_loan_repayments`

### 8.5 5번. 교육 추가/보강

레거시 근거:
- `EduApp`, `EduApr`, `EduCancelApp`, `EduResultApr`
- `TTRA201`, `TTRA203`, `TTRA205`, `TTRA301`

현재 VIBE-HR 근거:
- `frontend/src/app/tra/**`
- `backend/app/api/tra.py`
- `backend/app/services/tra_service.py`
- `docs/TRA_MODULE_PLAN.md`

판단:
- 현재 VIBE-HR은 과정/회차/필수교육/이력/사이버업로드 기반은 있으나, 결재 흐름이 얕다.

보강 범위:
1. 교육신청과 결과보고를 서로 다른 문서 흐름으로 분리
2. 미참석취소 요청과 승인 흐름 추가
3. 이수확정(`TTRA301` 대응) 상태를 명시
4. 교육만족도/결과보고 선후 제약을 서비스 규칙으로 이관

권장 신규 객체:
- `tra_application_requests`
- `tra_result_reports`
- `tra_cancel_requests`
- `tra_completion_records`

### 8.6 6번. 평가 추가

레거시 근거:
- `AppScheduleMgr`
- `AppResultMgr`
- `TPAP101`, `TPAP105`, `TPAP202`, `TPAP551`, `TPAP567`

현재 VIBE-HR 근거:
- `frontend/src/app/pap/appraisals/page.tsx`
- `frontend/src/app/pap/final-results/page.tsx`
- `backend/app/api/pap_appraisal.py`
- `backend/app/api/pap_final_result.py`

판단:
- 현재는 평가마스터와 결과코드 수준이다. 레거시의 운영형 평가 프로세스는 아직 비어 있다.

추가 범위:
1. 평가주기/단계 일정
2. 평가자-대상자 배정
3. 자기평가/1차/2차 등 단계별 입력
4. 종합결과/랭킹/등급
5. 이의제기/피드백
6. 마감/재오픈

권장 신규 객체:
- `eva_cycles`
- `eva_cycle_steps`
- `eva_assignments`
- `eva_scores`
- `eva_final_results`
- `eva_feedbacks`

## 9. 새 테이블 명명 규칙 적용

`docs/EHR_TABLE_RENAMING_STANDARD.md` 기준 적용:

| 레거시 prefix | 신규 prefix | 예시 |
|---|---|---|
| `THRM*` | `hr_` | `THRM151` -> `hr_employee_department_histories` 등 역할 중심 새 이름 |
| `TORG*` | `org_` | `TORG101` -> `org_departments` |
| `TTIM*`/`TWTM*` | `tim_` | `TTIM301` -> `tim_leave_requests` |
| `TCPN*` | `pay_` | `TCPN201` -> `pay_payroll_actions` 또는 역할에 맞는 새 이름 |
| `TBEN*` | `wel_` | `TBEN623` -> `wel_loan_requests` |
| `TTRA*` | `tra_` | `TTRA201` -> `tra_application_requests` |
| `TPAP*` | `eva_` | `TPAP551` -> `eva_final_results` |
| `THRI*` | `hri_` | `THRI103` -> `hri_request_masters` |

주의:
- 레거시 숫자 테이블 코드는 신규 테이블명에 남기지 않는다.
- 다만 교차참조용 매핑 테이블은 반드시 유지한다.

권장 공통 매핑 테이블:
- `app_legacy_object_xref`
- `app_migration_decisions`

## 10. 문서화 및 진행 방식

권장 진행 문서:

1. 현재 문서
   - `docs/ehr-legacy-business-flow-analysis.md`
   - `docs/vibe-hr-modernization-gap-plan.md`
2. 다음 단계에서 추가할 문서
   - `docs/payroll-modernization-spec.md`
   - `docs/tim-modernization-spec.md`
   - `docs/welfare-domain-spec.md`
   - `docs/tra-workflow-spec.md`
   - `docs/eva-workflow-spec.md`
   - `docs/legacy-object-xref.md`

진행 원칙:
- 화면 하나가 아니라 시나리오 하나씩 구현
- DB 숨은 로직을 먼저 서비스 규칙으로 문서화
- 신규 테이블/엔드포인트/화면을 함께 정의
- 구현 전마다 비교표를 갱신

## 11. 최종 제안

1. 지금 바로 코드를 넓게 추가하기보다, `급여`, `근태`, `복리후생` 3개를 먼저 설계 고정하는 것이 안전하다.
2. `교육`과 `평가`는 현재 VIBE-HR의 리소스/마스터 기반을 살리되, 레거시의 상태전이만 단계적으로 덧입히는 편이 좋다.
3. 공통 결재(`hri`)와 권한/코드 체계를 먼저 표준화하지 않으면, 복리후생/교육/평가가 각자 다른 결재 모델로 흩어질 위험이 크다.
4. 레거시 Oracle 프로시저는 그대로 옮기지 말고, 업무규칙 단위로 잘라 Python 서비스와 PostgreSQL 트랜잭션으로 재구성하는 방향을 유지해야 한다.
