# VIBE-HR Legacy Gap Matrix and Execution Backlog

작성일: 2026-03-12  
기준 저장소: `C:\Users\kms\Desktop\dev\vibe-hr`  
레거시 소스: `C:\EHR_PROJECT\isu-hr\EHR_HR50`  
DB 명세: `C:\Users\kms\Desktop\dev\EHR_6\EHR5_DB명세.sql`

관련 선행 문서:
- `docs/ehr-legacy-business-flow-analysis.md`
- `docs/vibe-hr-modernization-gap-plan.md`
- `TIM_MODULE_PLAN.md`

## 1. 목적

이 문서는 다음 단계 작업을 바로 착수할 수 있도록 레거시 EHR과 현재 VIBE-HR의 차이를 모듈별 갭 매트릭스로 정리하고, 사용자가 요청한 1~6번 항목을 실제 실행 백로그로 분해한 문서다.

중요 원칙:
- VIBE-HR이 더 풍부한 UX/구조를 이미 가지고 있는 영역은 VIBE-HR을 기준으로 확장한다.
- VIBE-HR이 비어 있거나 업무 규칙이 얕은 영역은 레거시 EHR과 DB 명세의 업무 흐름을 기준으로 보강한다.
- 신규 테이블명은 레거시 `T*` 관례를 재사용하지 않고 VIBE-HR 명명 규칙을 따른다.
- 확인되지 않은 연결은 추측하지 않고 `미확인`으로 표시한다.

## 2. 이번 단계에서 추가 확인한 근거

### 2.1 Playwright 브라우저 확인

브라우저 확인 근거:
- 명령: `npx --yes --package @playwright/cli playwright-cli goto http://127.0.0.1:3000/login`
- 결과: `Page URL: http://127.0.0.1:3000/login`, `Page Title: VIBE-HR`
- 스냅샷: `C:\Users\kms\Desktop\dev\tower-defense\.playwright-cli\page-2026-03-12T08-28-38-833Z.yml`

판정:
- 로그인 화면 자체는 Playwright로 실접속 확인 완료
- 인증 후 후속 화면 검증은 Playwright CLI 기본 세션이 다른 워크스페이스 세션과 충돌하여 이번 단계에서는 안정적으로 고정하지 못함
- 따라서 이 문서의 UI 상태는 `브라우저 확인`, `코드 확인`, `미구현`으로 구분한다

### 2.2 현재 VIBE-HR 공통 결재(HRI) 기반

확인 근거:
- API: `backend/app/api/hri_request.py`
- 서비스: `backend/app/services/hri_request_service.py`
- 모델: `backend/app/models/entities.py`

확인 사실:
- `HriRequestMaster`, `HriRequestStepSnapshot`, `HriRequestHistory`, `HriReqLeave`, `HriReqTimCorrection` 등 공통 결재 테이블이 존재한다.
- `backend/app/services/hri_request_service.py` 내 `_handle_tim_correction_complete`, `_handle_cert_employment_complete`, `_handle_leave_complete` 는 `TODO` 상태다.
- 즉, HRI 골격은 존재하지만 TIM/증명서 후처리 반영은 아직 완결되지 않았다.

## 3. 갭 매트릭스 요약

상태 기준:
- `브라우저 확인`: Playwright로 실제 라우트 접근 확인
- `코드 확인`: 파일/서비스/API 존재는 확인했으나 이번 단계에서 실화면 진입은 미확인
- `미구현`: 화면 또는 업무 로직 단위가 실질적으로 없음

| 영역 | 레거시 핵심 시나리오 | 레거시 근거 | VIBE-HR 현재 근거 | 상태 | 갭 판정 | 기준 방향 |
|---|---|---|---|---|---|---|
| 조직 | 조직코드/법인/조직도/조직구분 관리 | `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\org\organization\orgCdMgr\OrgCdMgrController.java`, `OrgCdMgrService.java`, `OrgCdMgr-sql-query.xml`, 테이블 `TORG101`, `TORG103`, `TORG105` | 화면 `frontend/src/app/org/corporations/page.tsx`, `frontend/src/app/org/departments/page.tsx`, `frontend/src/app/org/chart/page.tsx`, `frontend/src/app/org/types/page.tsx`; API `backend/app/api/organization.py`; 서비스 `backend/app/services/organization_service.py` | 코드 확인 | 기본 CRUD는 VIBE-HR 우세, 조직구분 하위 업무는 상세 체인 추가 확인 필요 | VIBE-HR 기준 |
| 인사(발령) | 발령 이력 저장 후 현행 인사정보/겸직 동기화 | `AppmtHistoryMgrController.java`, `AppmtHistoryMgrService.java`, `AppmtHistoryMgr-sql-query.xml`, 프로시저 `P_HRM_151_SABUN_CREATE`, `P_HRM_151_SABUN_EDATE_CREATE`, `P_HRM_223_SABUN_SYNC`, 테이블 `THRM191`, `THRM151`, `THRM223` | 화면 `frontend/src/app/hr/appointment/records/page.tsx`; API `backend/app/api/hr_appointment_record.py`; 서비스 `backend/app/services/hr_appointment_record_service.py:def confirm_appointment_order` | 코드 확인 | 발령 확정 뼈대는 있으나 레거시의 겸직/종료일 산정/동기화 규칙은 부족 | VIBE-HR 구조 + 레거시 규칙 보강 |
| 근태(일상) | 출퇴근/근태정정/월 집계 | 레거시 TIM/WTM 계열, 상세 일부 `미확인`; 근태 신청은 `VacationApp*`와 별도 존재 | 화면 `frontend/src/app/tim/check-in/page.tsx`, `status/page.tsx`, `correction/page.tsx`; 서비스 `backend/app/services/tim_attendance_daily_service.py:def check_in`, `check_out`, `correct_attendance` | 코드 확인 | 일상근태 CRUD는 존재하나 월마감/스케줄 연계/결재 후 반영 일관성 부족 | VIBE-HR 기준 |
| 근태(휴가/연차) | 휴가 신청, 승인, 취소, 연차 차감, 연차 생성 엔진 | `VacationAppController.java`, `VacationAppService.java`, `VacationApp-sql-query.xml`, `WtmLeaveCreMgrService.java:def excCreateWtmLeaves`, 테이블 `TTIM301`, `TTIM511`, `TTIM383`, `TTIM385`, `THRI103` | 화면 `frontend/src/app/tim/annual-leave/page.tsx`, `leave-request/page.tsx`, `leave-approval/page.tsx`; API `backend/app/api/tim_leave.py`; 서비스 `backend/app/services/tim_leave_service.py:def get_or_create_annual_leave`, `create_leave_request`, `decide_leave_request`, `cancel_leave_request` | 코드 확인 | 신청/승인/취소는 있으나 레거시 연차 생성 규칙과 공통결재 연계가 부족 | 레거시 규칙 보강 |
| 급여 | 대상자 생성, 변동입력, 급여 계산, 마감, 지급, 복리 연계 | `PayCalcCreController.java`, `PayCalcCreService.java`, `PayCalcCreProcService.java`, `PayCalcCreProc-sql-query.xml`, 프로시저 `P_CPN_CAL_EMP_INS`, `P_CPN_CAL_PAY_MAIN`, 함수 `F_CPN_PRO_CALC_YN`, 테이블 `TCPN201`, `TCPN203`, `TCPN051` | 화면 `frontend/src/app/payroll/runs/page.tsx`, `employee-profiles/page.tsx`, `variable-inputs/page.tsx`; API `backend/app/api/payroll_phase2.py`; 서비스 `backend/app/services/payroll_phase2_service.py:def create_payroll_run`, `calculate_payroll_run`, `close_payroll_run`, `mark_payroll_run_paid` | 코드 확인 | Run 중심 구조는 좋지만 레거시의 대상자 생성/이벤트 판정/복리 연계가 얕음 | VIBE-HR 구조 + 레거시 규칙 보강 |
| 복리후생 | 대출/경조/의료비/학자금 신청, 승인, 급여 반영, 마감 | `LoanAppController.java`, `LoanAprController.java`, `WelfarePayDataMgrController.java`, `WelfarePayDataMgrService.java`, `WelfarePayDataMgr-sql-query.xml`, 프로시저 `P_BEN_PAY_DATA_CREATE_ALL`, 테이블 `TBEN623`, `TBEN625`, `TBEN991`, `TBEN993`, `TCPN980` | API `backend/app/api/welfare.py`; 서비스 `backend/app/services/welfare_service.py:def list_wel_benefit_types`, `batch_save_wel_benefit_types`; 시드 `backend/app/bootstrap.py:WEL_BENEFIT_TYPE_SEEDS`; 프론트 `frontend/src/app/wel/*` 없음 | 미구현 | 유형 마스터만 존재, 실제 업무 플로우 전부 신규 구현 필요 | 레거시 기준 보강 |
| 교육 | 과정/차수, 신청, 승인, 취소, 결과보고, 이력 반영 | `EduAppController.java`, `EduAppService.java`, `EduApp-sql-query.xml`, `EduApr-sql-query.xml`, `EduCancelApp-sql-query.xml`, `EduResultApr-sql-query.xml`, 테이블 `TTRA201`, `TTRA203`, `TTRA205`, `TTRA301` | 화면 `frontend/src/app/tra/course-events/page.tsx`, `applications/page.tsx`, `histories/page.tsx`; API `backend/app/api/tra.py`; 서비스 `backend/app/services/tra_service.py`; 모델 `backend/app/models/tra.py:approval_request_id` | 코드 확인 | 리소스 CRUD와 생성 배치는 있음, 결재/취소/결과보고 업무흐름은 부족 | VIBE-HR 구조 + 레거시 절차 보강 |
| 평가 | 평가 일정, 배정, 결과, 등급, 피드백/이의 | `AppScheduleMgr-sql-query.xml`, `AppResultMgr-sql-query.xml`, 테이블 `TPAP101`, `TPAP105`, `TPAP202`, `TPAP567` | 화면 `frontend/src/app/pap/appraisals/page.tsx`, `frontend/src/app/pap/final-results/page.tsx`; API `backend/app/api/pap_appraisal.py`, `pap_final_result.py`; 서비스 `backend/app/services/pap_appraisal_service.py`, `pap_final_result_service.py` | 코드 확인 | 평가 마스터/결과코드만 있고 운영 프로세스는 부재 | 레거시 기준 보강 |
| 공통 결재/권한 | 공통 결재, 수신, 권한 체크, 공통코드 | 레거시 `THRI103`, `F_SEC_GET_AUTH_CHK`, `F_COM_GET_LANGUAGE_TEXT`, `F_SEC_GET_TOKEN2` | HRI API `backend/app/api/hri_request.py`; HRI 서비스 `backend/app/services/hri_request_service.py`; 메뉴/권한은 `backend/app/services/menu_service.py` 계열, 시드 `backend/app/bootstrap.py` | 코드 확인 | 공통 기반은 있음, 각 도메인 후처리 연결이 미완 | VIBE-HR 기준 |

## 4. 영역별 상세 차이

### 4.1 조직

현재 확인된 VIBE-HR 범위:
- 화면 파일: `frontend/src/app/org/corporations/page.tsx`, `frontend/src/app/org/departments/page.tsx`, `frontend/src/app/org/chart/page.tsx`, `frontend/src/app/org/types/page.tsx`
- 서비스: `backend/app/services/organization_service.py`
- API: `backend/app/api/organization.py`

판단:
- 조직 기본 CRUD와 화면 구조는 레거시보다 현대화 방향에 더 적합하다.
- 레거시 `TORG103`, `TORG105` 수준의 분류/속성 확장 규칙은 현재 단계에서 세부 체인을 다시 추적해야 한다.
- 따라서 조직은 신규 구현보다 세부 코드체계 비교가 우선이다.

### 4.2 발령

레거시 핵심:
- `THRM191` 저장 후 `P_HRM_151_SABUN_CREATE`, `P_HRM_151_SABUN_EDATE_CREATE`, `P_HRM_223_SABUN_SYNC` 실행
- 현행 인사정보(`THRM151`)와 겸직정보(`THRM223`)가 후행 동기화됨

현재 VIBE-HR:
- `backend/app/services/hr_appointment_record_service.py:def confirm_appointment_order`

판단:
- 현재 VIBE-HR은 애플리케이션 서비스에서 확정 로직을 처리하는 방향이라 구조는 더 좋다.
- 다만 레거시 DB 프로시저가 담당하던 종료일 재산정, 최신 인사이력 재생성, 겸직 동기화 규칙은 별도 규칙 테이블 또는 도메인 서비스로 복원해야 한다.

### 4.3 근태

현재 VIBE-HR 일상근태:
- `backend/app/services/tim_attendance_daily_service.py:def check_in`
- `backend/app/services/tim_attendance_daily_service.py:def check_out`
- `backend/app/services/tim_attendance_daily_service.py:def correct_attendance`

현재 VIBE-HR 휴가/연차:
- `backend/app/services/tim_leave_service.py:def get_or_create_annual_leave`
- `backend/app/services/tim_leave_service.py:def create_leave_request`
- `backend/app/services/tim_leave_service.py:def decide_leave_request`
- `backend/app/services/tim_leave_service.py:def cancel_leave_request`

현재 VIBE-HR 공통결재 연결 상태:
- `backend/app/services/hri_request_service.py` 의 `_handle_leave_complete`, `_handle_tim_correction_complete` 는 `TODO`

판단:
- 화면과 API는 이미 충분히 있다.
- 그러나 현재 `tim_leave_service.py` 의 연차 부여 규칙은 단순 연차 산식 기반이고, 레거시 `WtmLeaveCreMgrService.excCreateWtmLeaves` 수준의 입사기준/근속/월차/이월/보상 로직은 아직 복원되지 않았다.
- 근태는 새 화면보다 엔진 재설계가 우선이다.

### 4.4 급여

현재 VIBE-HR:
- API: `backend/app/api/payroll_phase2.py`
- 서비스: `backend/app/services/payroll_phase2_service.py`
- 상태 흐름: `draft -> calculated -> closed -> paid`
- 이벤트 로그: `PayPayrollRunEvent`

레거시 핵심:
- `P_CPN_CAL_EMP_INS`: 급여대상자 생성
- `P_CPN_CAL_PAY_MAIN`: 본계산
- `F_CPN_PRO_CALC_YN`: 급여 반영 이벤트 판정
- `P_BEN_PAY_DATA_CREATE_ALL`: 복리후생 급여 연계

판단:
- VIBE-HR의 Run 중심 모델과 상태 전이는 유지할 가치가 크다.
- 그러나 레거시의 핵심 복잡도는 계산 그 자체보다 “대상자 선정”, “인사/근태 이벤트 반영”, “복리 연동”, “마감 후 불가 규칙”에 있다.
- 급여는 VIBE-HR 계산기 구조를 유지하되, 레거시 프로시저의 규칙을 별도 도메인 서비스로 분해해 편입해야 한다.

### 4.5 복리후생

현재 VIBE-HR:
- API: `backend/app/api/welfare.py`
- 서비스: `backend/app/services/welfare_service.py`
- 모델/시드: `backend/app/models/entities.py:WelBenefitType`, `backend/app/bootstrap.py:WEL_BENEFIT_TYPE_SEEDS`
- 프론트 화면: `미구현`

판단:
- 현재는 업무 모듈이 아니라 코드 마스터 준비 수준이다.
- 레거시의 대출/승인/급여차감/마감 플로우를 기준으로 새로 설계해야 한다.
- 복리후생은 가장 큰 신규 구축 영역이다.

### 4.6 교육

현재 VIBE-HR:
- API: `backend/app/api/tra.py`
- 서비스: `backend/app/services/tra_service.py`
- 화면: `frontend/src/app/tra/*`
- 모델: `backend/app/models/tra.py` 에 `approval_request_id` 존재

판단:
- 과정/차수/신청/이력 테이블과 화면이 이미 있다.
- 그러나 `approval_request_id` 필드는 존재해도 현재 서비스에서 승인 워크플로우를 실제로 연결하는 흐름은 확인되지 않았다.
- 교육은 신규 구축보다는 결재/취소/결과보고 레이어를 올리는 작업으로 보는 것이 맞다.

### 4.7 평가

현재 VIBE-HR:
- 화면: `frontend/src/app/pap/appraisals/page.tsx`, `frontend/src/app/pap/final-results/page.tsx`
- API: `backend/app/api/pap_appraisal.py`, `backend/app/api/pap_final_result.py`
- 서비스: `backend/app/services/pap_appraisal_service.py`, `backend/app/services/pap_final_result_service.py`

판단:
- 현재 구조는 평가 제도 마스터와 결과 코드 마스터에 가깝다.
- 레거시의 평가 일정, 대상 배정, 결과 확정, 피드백/이의 흐름은 아직 이식되지 않았다.
- 평가는 화면은 일부 존재하지만 실제 업무 모듈은 아직 시작 전 단계에 가깝다.

## 5. 실행 백로그

## 5.1 1번. 현재 VIBE-HR과 Legacy/DB 명세 비교 후 없는 부분 추가 계획 확정

목표:
- 기능 존재 여부를 넘어서 “업무 시나리오 단위”로 매핑을 완료한다.

실행 작업:
1. 조직, 발령, 근태, 급여, 복리후생, 교육, 평가별로 레거시 시나리오 목록을 확정한다.
2. 각 시나리오를 `화면`, `API`, `서비스`, `테이블`, `결재`, `배치`, `프로시저 규칙` 항목으로 쪼갠다.
3. 각 항목을 `유지`, `보강`, `신규`, `폐기 검토`로 분류한다.
4. 각 항목에 VIBE-HR 신규 테이블 후보명을 연결한다.

산출물:
- 기능-시나리오 매핑 시트
- 레거시 객체 -> VIBE-HR 객체 매핑표
- 신규 테이블 후보 목록

우선 근거:
- 선행 문서 `docs/ehr-legacy-business-flow-analysis.md`
- 선행 문서 `docs/vibe-hr-modernization-gap-plan.md`
- 본 문서의 갭 매트릭스

## 5.2 2번. 급여 로직 비교 및 VIBE-HR 급여 로직 개선

핵심 근거:
- 레거시: `PayCalcCreController.java`, `PayCalcCreService.java`, `PayCalcCreProcService.java`
- 레거시 DB: `P_CPN_CAL_EMP_INS`, `P_CPN_CAL_PAY_MAIN`, `F_CPN_PRO_CALC_YN`
- 현재: `backend/app/api/payroll_phase2.py`, `backend/app/services/payroll_phase2_service.py`

구현 백로그:
- `PAY-01` 급여대상자 선정 단계를 `run 생성`과 분리한다.
  - 이유: 레거시 `P_CPN_CAL_EMP_INS` 가 대상자 생성을 독립 처리함
- `PAY-02` 인사/발령/입퇴사/조직이동 이벤트를 급여 대상 이벤트로 정규화한다.
  - 이유: `F_CPN_PRO_CALC_YN` 가 이벤트 판정을 수행함
- `PAY-03` `PayPayrollRunEvent` 를 단순 로그가 아니라 계산 근거 이벤트 저장소로 승격한다.
  - 이유: 현재 서비스는 이벤트 객체가 있으나 판정 규칙 저장이 얕음
- `PAY-04` 복리후생 지급/공제 반영 지점을 급여 마감 전에 삽입한다.
  - 이유: 레거시 `P_BEN_PAY_DATA_CREATE_ALL` 이 급여 연계 전제를 가짐
- `PAY-05` 계산 불가/경고/수동보정 대상을 분리한다.
  - 이유: 레거시는 프로시저 내부에서 누락/상태 오류를 배제함
- `PAY-06` 근태/연차/휴가 반영 인터페이스를 명시한다.
  - 이유: 급여와 근태는 선후관계가 강함

권장 신규 테이블 후보:
- `pay_run_targets`
- `pay_run_target_events`
- `pay_run_rule_results`
- `pay_run_exception_logs`

## 5.3 3번. 근태 로직 확인 후 VIBE-HR 근태 로직 개선

핵심 근거:
- 레거시 신청: `VacationAppController.java`, `VacationAppService.java`, `VacationApp-sql-query.xml`
- 레거시 연차 생성: `WtmLeaveCreMgrService.java:def excCreateWtmLeaves`
- 현재: `backend/app/api/tim_leave.py`, `backend/app/services/tim_leave_service.py`, `backend/app/services/tim_attendance_daily_service.py`
- 공통결재: `backend/app/services/hri_request_service.py` 의 TIM 관련 후처리 `TODO`

구현 백로그:
- `TIM-01` 휴가 직접 저장 흐름과 HRI 결재 흐름의 기준 모델을 하나로 정한다.
  - 현재는 `tim_leave_service.py` 와 `hri_request_service.py` 가 분리되어 중복 가능성이 큼
- `TIM-02` 연차 생성 엔진을 별도 run 단위로 분리한다.
  - 이유: 레거시 `excCreateWtmLeaves` 는 단순 조회가 아니라 생성 배치
- `TIM-03` 연차 생성 규칙을 근속/월차/이월/보상 기준으로 분해해 명시 규칙화한다.
- `TIM-04` 승인/반려/취소 후 연차 차감 및 복구 규칙을 HRI 완료 후처리와 통합한다.
- `TIM-05` 일상 근태와 월마감/집계 단위를 분리한다.
- `TIM-06` 근태 정정 신청은 `TimAttendanceCorrection` 와 `HriReqTimCorrection` 를 일원화한다.

권장 신규 테이블 후보:
- `tim_leave_generation_runs`
- `tim_leave_generation_results`
- `tim_leave_policies`
- `tim_leave_change_requests`
- `tim_monthly_closings`

## 5.4 4번. 복리후생 추가

핵심 근거:
- 레거시: `LoanAppController.java`, `LoanAppService.java`, `LoanAprController.java`, `WelfarePayDataMgrController.java`
- 레거시 DB: `P_BEN_PAY_DATA_CREATE_ALL`, `TBEN623`, `TBEN625`, `TBEN991`, `TBEN993`, `TCPN980`
- 현재: `backend/app/api/welfare.py`, `backend/app/services/welfare_service.py`, `backend/app/bootstrap.py:WEL_BENEFIT_TYPE_SEEDS`

구현 백로그:
- `WEL-01` 유형 마스터(`WelBenefitType`)와 실제 신청 문서를 분리한다.
- `WEL-02` 공통 신청/승인 프레임을 HRI 위에 올린다.
- `WEL-03` 1차 대상 업무를 `사내대출`, `학자금`, `경조금`, `의료비` 로 한정한다.
- `WEL-04` 급여 공제/지급 연결 정책을 별도 테이블로 둔다.
- `WEL-05` 사업장별 마감 상태를 관리한다.
- `WEL-06` 화면은 업무 유형별 상세폼 + 공통 승인함으로 설계한다.

권장 신규 테이블 후보:
- `wel_request_masters`
- `wel_request_lines`
- `wel_pay_link_policies`
- `wel_pay_link_runs`
- `wel_loan_repayment_schedules`

## 5.5 5번. 교육 추가/보강

핵심 근거:
- 레거시: `EduAppController.java`, `EduAppService.java`, `EduApr-sql-query.xml`, `EduCancelApp-sql-query.xml`, `EduResultApr-sql-query.xml`
- 레거시 테이블: `TTRA201`, `TTRA203`, `TTRA205`, `TTRA301`
- 현재: `frontend/src/app/tra/*`, `backend/app/api/tra.py`, `backend/app/services/tra_service.py`

구현 백로그:
- `TRA-01` 교육 신청과 결과보고를 서로 다른 문서 흐름으로 분리한다.
- `TRA-02` `approval_request_id` 를 실제 HRI 요청과 연결한다.
- `TRA-03` 교육 취소 요청과 승인 흐름을 추가한다.
- `TRA-04` 결과보고 완료 후 교육이력/필수교육 대상 상태를 갱신한다.
- `TRA-05` 사이버 업로드 결과 반영 시 차수/이력/필수대상 동기화 규칙을 명문화한다.

권장 신규 테이블 후보:
- `tra_application_requests`
- `tra_result_reports`
- `tra_cancel_requests`
- `tra_completion_updates`

## 5.6 6번. 평가 추가

핵심 근거:
- 레거시: `AppScheduleMgr-sql-query.xml`, `AppResultMgr-sql-query.xml`
- 레거시 테이블: `TPAP101`, `TPAP105`, `TPAP202`, `TPAP567`
- 현재: `frontend/src/app/pap/appraisals/page.tsx`, `frontend/src/app/pap/final-results/page.tsx`

구현 백로그:
- `PAP-01` 평가 제도 마스터와 평가 회차/일정 운영을 분리한다.
- `PAP-02` 평가 대상 배정 모델을 추가한다.
- `PAP-03` 평가 입력, 중간저장, 제출, 확정 상태를 정의한다.
- `PAP-04` 최종등급 코드는 현재 `PapFinalResult` 를 재사용하되 결과 문서와 분리한다.
- `PAP-05` 피드백/이의신청 흐름이 필요한지 레거시 추가 추적 후 반영한다.

권장 신규 테이블 후보:
- `pap_cycles`
- `pap_assignments`
- `pap_result_documents`
- `pap_feedback_threads`

## 6. 우선순위와 선후관계

권장 순서:
1. 발령 이벤트 정리
2. 근태 엔진 정리
3. 급여 계산 규칙 보강
4. 복리후생 신규 구축
5. 교육 결재/결과보고 보강
6. 평가 운영 모듈 구축

이 순서의 이유:
- 급여는 발령과 근태의 영향을 직접 받는다.
- 복리후생은 급여 연계를 선행 정의해야 한다.
- 교육과 평가는 독립성이 더 높아 후행 배치가 가능하다.

## 7. 바로 착수할 작업 제안

다음 실제 작업 묶음은 아래가 적절하다.

### Wave 1

- 발령 이벤트 사전 작성
  - 목표: 레거시 `P_HRM_151_*`, `P_HRM_223_*` 규칙을 VIBE-HR 이벤트 목록으로 치환
- 근태/HRI 연결 정리
  - 목표: `tim_leave_service.py` 와 `hri_request_service.py` 의 중복 제거 방향 확정
- 급여 대상자 선정 설계서 작성
  - 목표: `P_CPN_CAL_EMP_INS` 역할을 VIBE-HR 서비스로 분리 설계

### Wave 2

- 복리후생 도메인 모델 초안 작성
- 교육 결재/취소/결과보고 시나리오 상세화
- 평가 운영 프로세스 상세화

## 8. 미확인 및 추가 확인 필요 항목

아래 항목은 이번 단계에서 의도적으로 추측하지 않았다.

| 항목 | 상태 | 이유 |
|---|---|---|
| 조직구분/조직구분업로드/조직구분개인별현황의 백엔드 호출 체인 | 미확인 | 화면 파일은 확인했지만 API/서비스 세부 추적은 이번 단계 범위 밖 |
| 레거시 WTM 월마감/집계 전체 호출 체인 | 일부 미확인 | 현재 확인한 것은 `VacationApp*`, `WtmLeaveCreMgrService` 중심 |
| 평가 피드백/이의신청 상세 프로세스 | 미확인 | 현재 확보한 레거시 근거는 일정/결과 관리 위주 |
| Playwright 인증 후 다중 화면 지속 세션 | 미확인 | 기본 세션 충돌로 로그인 후 안정 반복 검증 환경이 아직 고정되지 않음 |

## 9. 결론

현재 시점의 판정은 다음과 같다.

- 조직, 발령, 근태, 급여는 “현대화된 뼈대가 이미 있는 영역”이다.
- 복리후생과 평가는 “실질 업무 모듈 신규 구축”에 가깝다.
- 교육은 “기존 VIBE-HR 구조를 살리되 승인/취소/결과보고 흐름을 보강”하는 방식이 가장 효율적이다.
- 공통 결재 HRI는 재사용 가치가 높지만 후처리 연결이 아직 비어 있으므로, 근태/교육/복리후생 확장 전에 먼저 결재-후처리 표준을 정해야 한다.
