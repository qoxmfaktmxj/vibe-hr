# EHR Modernization Cycle Audit

작성일: 2026-03-13

## 범위

- 레거시 비교 문서
  - `docs/ehr-legacy-business-flow-analysis.md`
  - `docs/vibe-hr-modernization-gap-plan.md`
  - `docs/vibe-hr-gap-matrix-execution-backlog.md`
- 현재 구현 근거
  - 로그인: `backend/app/api/auth.py:30`, `backend/app/services/auth_service.py:19`, `backend/app/services/auth_service.py:81`, `frontend/src/components/auth/login-card.tsx:140`
  - 채용/인사/발령: `backend/app/api/hr_recruit.py:27`, `backend/app/services/hr_recruit_service.py:104`, `backend/app/api/employee.py:26`, `backend/app/services/employee_command_service.py:27`, `backend/app/api/hr_basic.py:24`, `backend/app/services/hr_basic_service.py:152`, `backend/app/api/hr_appointment_record.py:24`, `backend/app/services/hr_appointment_record_service.py:419`
  - 조직: `backend/app/api/organization.py:31`, `backend/app/schemas/organization.py:8`, `backend/app/models/entities.py:46`, `backend/app/services/organization_service.py:65`
  - 근태/근무조: `backend/app/api/tim_schedule.py:25`, `backend/app/services/tim_schedule_service.py:65`, `backend/app/models/entities.py:1448`, `backend/app/models/entities.py:1481`
  - 급여: `backend/app/api/payroll_phase2.py`, `backend/app/services/payroll_phase2_service.py:434`, `backend/app/bootstrap.py:2156`
  - 복리후생: `backend/app/api/welfare.py`, `backend/app/services/welfare_service.py:19`, `backend/app/services/hri_request_service.py:253`

## 1. 레거시 현대화 기준으로 아직 남은 것

결론:
- 남은 것이 있다.
- 따라서 지금 단계는 `6개 핵심 사이클 전체가 이미 닫혔다`고 보기 어렵다.
- 특히 `ORG 상세 속성`, `TIM 조직근무코드 운영`, `CPN 계산엔진`, `BEN 급여 실연계`가 핵심 미완료 구간이다.

도메인별 잔여 과제:

| 영역 | 현재 상태 | 남은 핵심 |
| --- | --- | --- |
| HRM | 채용 합격자, 사번 생성, 직원 생성, 기본 인사정보, 발령 기록은 각자 존재 | 합격자 -> 직원 생성 -> 기본정보 -> 입사발령까지 한 흐름으로 고정된 전환 절차가 아직 약함 |
| ORG | 법인/부서 CRUD 존재 | COST_CENTER, 조직설명, 조직구분항목, 직급/직위/직책 체계가 조직 모델에 아직 없음 |
| TIM | 출퇴근, 휴가, 스케줄 생성 구조 존재 | 부서별 근무코드 운영 CRUD가 부족하고, HRI 후처리 TODO가 남아 있음 |
| CPN | 급여 run, 변수입력, 항목관리, 세율관리 존재 | `P_CPN_CAL_EMP_INS`, `P_CPN_CAL_PAY_MAIN`, `F_CPN_PRO_CALC_YN` 수준의 대상자선정/이벤트판정/계산 로직이 아직 없음 |
| BEN | 복리후생 유형, 신청/결재 projection 조회 존재 | 실제 급여 항목 삽입 연계는 아직 없음. 현재는 상태 projection + label 수준 |

추가 확인 결과:
- 현재 워크트리에 `backend/app/api/organization.py`, `backend/app/services/organization_service.py`, `backend/app/schemas/organization.py`, `backend/app/schemas/employee.py`, `backend/app/services/employee_command_service.py`, `frontend/src/components/hr/employee-master-manager.tsx` 등 인사/조직 관련 로컬 수정이 남아 있다.
- 즉 2번, 3번 축은 현재도 진행 중일 가능성이 높지만, 아직 검증 완료 상태로 볼 수는 없다.

## 2. 6개 핵심 사이클 점검

### 2.1 로그인

상태: 부분 완료

근거:
- 로그인 전 법인 목록 API 존재: `backend/app/api/auth.py:30`
- 인증 로직 존재: `backend/app/services/auth_service.py:19`
- 로그인용 ENTER_CD 목록 조회 존재: `backend/app/services/auth_service.py:81`
- 로그인 UI가 ENTER_CD 콤보를 사용함: `frontend/src/components/auth/login-card.tsx:140`

판단:
- 로그인 자체는 기본 동작 가능 상태다.
- 다만 한글 인코딩 점검이 계속 필요하다. 실제로 `frontend/src/app/tim/work-codes/page.tsx`에는 깨진 한글 문자열이 남아 있다.

### 2.2 채용 합격자등록 -> 인사정보 등록 -> 발령 -> 시스템 사용 가능 상태

상태: 부분 완료, 아직 E2E 폐쇄 아님

이미 있는 것:
- 합격자 CRUD: `backend/app/api/hr_recruit.py:27`, `backend/app/services/hr_recruit_service.py:104`
- 합격자 사번 생성: `backend/app/services/hr_recruit_service.py:254`
- 직원 CRUD: `backend/app/api/employee.py:26`, `backend/app/services/employee_command_service.py:27`
- 기본 인사정보 상세/수정: `backend/app/api/hr_basic.py:24`, `backend/app/services/hr_basic_service.py:152`
- 발령 확정: `backend/app/services/hr_appointment_record_service.py:419`

막히는 지점:
- `hr_recruit_service.py`는 합격자 생성/수정/사번부여까지만 보이며, 합격자를 `HrEmployee`로 승격시키는 전용 전환 서비스는 확인되지 않았다.
- 발령 확정은 기존 직원을 전제로 한다. `confirm_appointment_order()`는 `HrEmployee`를 조회한 뒤 부서/직위/재직상태만 변경한다: `backend/app/services/hr_appointment_record_service.py:445`
- 기본 인사정보에는 `gender`, `resident_no_masked`, `birth_date`는 있으나: `backend/app/models/entities.py:248`
- 가족(family) 전용 모델/서비스는 현재 확인되지 않았다.

판단:
- 이 흐름은 각 단계별 화면과 API는 있으나, `합격자 -> 직원 생성 -> 기본정보 완성 -> 입사발령 확정`이 하나의 업무 절차로 잠겨 있지 않다.
- 특히 가족정보가 빠져 있어 사용자가 말한 “인사시스템 사용 가능” 기준에는 아직 못 미친다.

### 2.3 조직별 인원 매핑 + COST_CENTER + 조직설명 + 조직구분항목

상태: 미완료

이미 있는 것:
- 법인/부서 CRUD API: `backend/app/api/organization.py:31`
- 부서 기본 모델: `backend/app/models/entities.py:46`
- 직원은 `department_id`로 조직과 연결됨: `backend/app/models/entities.py:92`

막히는 지점:
- `OrgDepartment` 필드는 `code`, `name`, `parent_id`, `is_active`뿐이다: `backend/app/models/entities.py:46`
- `OrganizationDepartmentItem`에도 `cost_center`, `description`, `organization_type` 계열 필드가 없다: `backend/app/schemas/organization.py:8`
- `OrganizationService`도 기본 CRUD만 수행한다: `backend/app/services/organization_service.py:65`

판단:
- 조직별 인원 매핑 자체는 `HrEmployee.department_id`로 가능하다.
- 하지만 사용자가 요구한 `어떤 조직인지`, `어떤 COST_CENTER를 가지는지`, `조직구분항목`은 현재 모델과 API에 없다.
- 이 항목은 아직 닫히지 않았다.

### 2.4 조직별 근무코드 확인 + 인원별 근무조 매핑 + 개인 근무시간 세팅

상태: 부분 완료

이미 있는 것:
- 근무코드 마스터: `backend/app/models/entities.py:782`
- 부서별 스케줄 할당 테이블 존재: `backend/app/models/entities.py:1448`
- 직원별 예외 스케줄 테이블 존재: `backend/app/models/entities.py:1465`
- 일자별 개인 스케줄 테이블 존재: `backend/app/models/entities.py:1481`
- 스케줄 생성 서비스는 직원 예외 -> 부서 기본 -> 회사 기본 순으로 패턴을 결정한다: `backend/app/services/tim_schedule_service.py:65`
- 부서 기본 패턴 seed도 들어간다: `backend/app/bootstrap.py:2031`

막히는 지점:
- 현재 공개 API/스키마는 `employee schedule exception`과 `generate` 중심이다: `backend/app/api/tim_schedule.py:46`, `backend/app/api/tim_schedule.py:75`, `backend/app/schemas/tim_schedule.py:57`
- 부서별 `TimDepartmentScheduleAssignment`를 직접 운영하는 CRUD는 이번 점검 범위에서 확인되지 않았다.
- 화면 `frontend/src/app/tim/work-codes/page.tsx`는 존재하지만 한글 문자열이 깨진 상태다.

판단:
- 구조적으로는 “조직 기본 근무조 -> 개인 예외 -> 개인 일자 스케줄 생성” 모델이 맞다.
- 하지만 부서별 근무코드 운영 UI/API가 충분히 닫히지 않아, 사용자가 기대하는 운영 완성도에는 아직 부족하다.

### 2.5 야근수당/연장수당/직책수당/식대 포함 급여 계산

상태: 미완료

이미 있는 것:
- 급여 run 생성/계산/마감/지급완료: `backend/app/services/payroll_phase2_service.py:356`, `backend/app/services/payroll_phase2_service.py:434`, `backend/app/services/payroll_phase2_service.py:658`, `backend/app/services/payroll_phase2_service.py:686`
- 계산 엔진은 급여 프로필 + 변동입력으로 급여를 계산한다: `backend/app/services/payroll_phase2_service.py:444`, `backend/app/services/payroll_phase2_service.py:481`

막히는 지점:
- 계산 시작은 `base_salary`다: `backend/app/services/payroll_phase2_service.py:516`
- 추가 수당은 `PayVariableInput`로 들어온 값만 더한다: `backend/app/services/payroll_phase2_service.py:553`
- 현재 기본 seed 급여항목은 `BSC`, `MLA`, `PEN`, `HIN`, `ITX` 수준이다: `backend/app/bootstrap.py:2164`
- `야근수당`, `연장수당`, `직책수당` 기본 항목 seed는 확인되지 않았다.
- 근태 쪽의 `overtime_minutes`는 출퇴근 API에 노출되지만: `backend/app/api/tim_attendance_daily.py:142`
- 급여 계산 함수에서 이를 참조하는 연결은 확인되지 않았다.

판단:
- 식대는 항목/비과세 seed가 있으므로 수동 입력 기반 반영은 가능하다.
- 야근/연장/직책수당의 자동 계산은 아직 아니다.
- 레거시 `P_CPN_CAL_PAY_MAIN` 유사 수준이라고 보기 어렵다.

### 2.6 사회보험 + 복리후생 급여 연결 + 월 급여 반영

상태: 미완료

이미 있는 것:
- 세율 seed에 국민연금/건강보험/장기요양/고용보험이 있다: `backend/app/bootstrap.py:2156`
- 급여 계산에서 국민연금/건강보험/고용보험/소득세/지방소득세를 계산한다: `backend/app/services/payroll_phase2_service.py:494`, `backend/app/services/payroll_phase2_service.py:588`
- 복리후생 HRI 요청은 `WelBenefitRequest`로 projection 된다: `backend/app/services/hri_request_service.py:265`
- HRI 완료 상태는 복리후생 `payroll_reflected`로 매핑된다: `backend/app/services/hri_request_service.py:253`

막히는 지점:
- `장기요양`은 seed는 있으나 급여 계산식에서 사용되지 않는다. 계산 함수가 읽는 세율은 pension/health/employment/income_tax뿐이다: `backend/app/services/payroll_phase2_service.py:494`
- 복리후생 쪽 `payroll_reflected`는 실제 급여 item insert가 아니라 projection 상태다.
- `payroll_run_label`만 만들어 붙인다: `backend/app/services/hri_request_service.py:293`
- `payroll_phase2_service.py`에서 `WelBenefitRequest`를 읽어 급여 run item으로 넣는 로직은 이번 점검 범위에서 확인되지 않았다.

판단:
- 사회보험도 일부만 계산된다.
- 복리후생 급여 반영은 아직 “실계산 연계”가 아니라 “상태/표시 연계”에 가깝다.

## 3. 최종 판단

현재 상태에서 가장 중요한 결론:

1. 레거시 현대화 과정에서 남은 것이 있다.
2. 따라서 6개 핵심 사이클이 완전히 닫혔다고 판단하면 안 된다.
3. 지금 가장 먼저 닫아야 할 축은 아래 순서다.

우선순위:
- 1순위: HRM E2E 폐쇄
  - 합격자 -> 직원 생성 -> 기본인사정보 -> 입사발령
- 2순위: ORG 상세 모델 확장
  - COST_CENTER, 조직설명, 조직구분, 직급/직위/직책
- 3순위: TIM 조직근무코드 운영 폐쇄
  - 부서 할당 CRUD + 스케줄 생성 + 개인 확인
- 4순위: CPN 계산엔진 고도화
  - 대상자선정, 이벤트판정, 수당자동계산, 4대보험 확장
- 5순위: BEN 실급여 연계
  - 복리후생 승인 건을 급여 run item으로 실제 삽입

## 4. 지금 바로 다음에 할 일

권장 작업 묶음:

1. HRM 전환 플로우 문서와 API 계약 확정
   - `finalist -> employee -> hr_basic -> appointment confirm`
2. ORG 확장 스키마 설계
   - `cost_center`, `description`, `org_type_code`, `job_grade`, `job_position`, `job_role`
3. TIM 부서근무조 CRUD 추가 여부 점검 후 부족분 구현
4. CPN gap 문서 기준으로 `P_CPN_CAL_EMP_INS`, `P_CPN_CAL_PAY_MAIN` 대응 설계 세분화
5. BEN 승인완료분을 `pay_variable_inputs` 또는 신규 `pay_run_target_events`로 투입하는 구조 설계

