# Wave 1 Payroll Target Selection and Event Ingestion Design

작성일: 2026-03-12  
기준 저장소: `C:\Users\kms\Desktop\dev\vibe-hr`  
레거시 소스: `C:\EHR_PROJECT\isu-hr\EHR_HR50`  
DB 명세: `C:\Users\kms\Desktop\dev\EHR_6\EHR5_DB명세.sql`

## 1. 목적

이 문서는 현재 VIBE-HR 급여 Run 구조를 유지하면서, 레거시 급여의 핵심이었던 “대상자 선정”과 “인사/근태/복리 이벤트 반영”을 새 구조로 복원하기 위한 설계 문서다.

핵심 질문:
- 누가 이번 Run의 대상자인가
- 어떤 인사/근태 이벤트가 계산에 반영되어야 하는가
- 복리후생/변동입력/법정공제가 어떤 순서로 들어와야 하는가

## 2. 근거 소스

레거시:
- Controller: `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\cpn\payCalculate\payCalcCre\PayCalcCreController.java`
- Proc Controller: `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\cpn\payCalculate\payCalcCre\PayCalcCreProcController.java`
- Service: `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\cpn\payCalculate\payCalcCre\PayCalcCreService.java`
- Proc Service: `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\cpn\payCalculate\payCalcCre\PayCalcCreProcService.java`
- Mapper: `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\resources\mapper\com\hr\cpn\payCalculate\payCalcCre\PayCalcCreProc-sql-query.xml`
- Procedure/Function: `P_CPN_CAL_EMP_INS`, `P_CPN_CAL_PAY_MAIN`, `P_BEN_PAY_DATA_CREATE_ALL`, `F_CPN_PRO_CALC_YN`

현재 VIBE-HR:
- API: `backend/app/api/payroll_phase2.py`
- Service: `backend/app/services/payroll_phase2_service.py`
- Model: `backend/app/models/entities.py`

## 3. 현재 VIBE-HR 급여 흐름

확인 근거:
- `backend/app/services/payroll_phase2_service.py:356` `create_payroll_run`
- `backend/app/services/payroll_phase2_service.py:434` `calculate_payroll_run`
- `backend/app/services/payroll_phase2_service.py:658` `close_payroll_run`
- `backend/app/services/payroll_phase2_service.py:686` `mark_payroll_run_paid`
- `backend/app/models/entities.py:913` `PayEmployeeProfile`
- `backend/app/models/entities.py:957` `PayPayrollRun`
- `backend/app/models/entities.py:982` `PayPayrollRunEmployee`
- `backend/app/models/entities.py:1026` `PayPayrollRunEvent`

현재 흐름:
1. `create_payroll_run` 이 `PayPayrollRun(status='draft')` 를 만든다.
2. `calculate_payroll_run` 이 유효한 `PayEmployeeProfile` 을 조회해 대상자를 고른다.
3. 같은 월의 `PayVariableInput` 을 합산한다.
4. `PayTaxRate` 기준으로 연금/건강/고용/소득세를 계산한다.
5. 직원별 `PayPayrollRunEmployee`, `PayPayrollRunItem` 을 적재한다.
6. Run 상태를 `calculated` 로 바꾼다.
7. 이후 `close -> paid` 로 이동한다.

현재 대상자 판정 조건:
- `PayEmployeeProfile.payroll_code_id == run.payroll_code_id`
- `is_active == true`
- `effective_from <= period_end`
- `effective_to is null or effective_to >= period_start`
- `HrEmployee.hire_date <= period_end`
- `HrEmployeeBasicProfile.retire_date` 가 `period_start` 이전이면 제외

## 4. 레거시 급여 흐름

확인 근거:
- `PayCalcCreController.java:159` `savePayCalcCrePeopleSet`
- `PayCalcCreService.java:33` `savePayCalcCrePeopleSet`
- `PayCalcCreService.java:145` `prcP_CPN_CAL_EMP_INS`
- `PayCalcCreService.java:158` `prcP_BEN_PAY_DATA_CREATE_ALL`
- `PayCalcCreProcController.java:43` `prcP_CPN_CAL_PAY_MAIN`
- `PayCalcCreProcService.java:27` `prcP_CPN_CAL_PAY_MAIN`
- `PayCalcCreProc-sql-query.xml:13` `CALL P_CPN_CAL_PAY_MAIN`
- `PayCalcCreProc-sql-query.xml:66` `CALL P_BEN_PAY_DATA_CREATE_ALL`

복원 가능한 흐름:
1. 대상자 선택 화면에서 `savePayCalcCrePeopleSet` 이 중복 체크 후 `P_CPN_CAL_EMP_INS` 를 호출한다.
2. 대상자는 `TCPN203` 쪽에 적재/수정/취소된다.
3. 계산 실행 시 `PayCalcCreProcController.prcP_CPN_CAL_PAY_MAIN` 이 비동기로 `P_CPN_CAL_PAY_MAIN` 을 실행한다.
4. 복리후생 연계가 필요하면 `P_BEN_PAY_DATA_CREATE_ALL` 을 수행한다.

즉, 레거시는 “대상자 선정”과 “계산 실행”이 분리되어 있고, 대상자 선정 결과가 독립된 작업 테이블에 먼저 저장된다.

## 5. 레거시 DB 규칙 요약

확인 근거:
- `C:\Users\kms\Desktop\dev\EHR_6\EHR5_DB명세.sql:183762` `P_BEN_PAY_DATA_CREATE_ALL`
- `C:\Users\kms\Desktop\dev\EHR_6\EHR5_DB명세.sql` 내 `P_CPN_CAL_EMP_INS`
- `C:\Users\kms\Desktop\dev\EHR_6\EHR5_DB명세.sql` 내 `P_CPN_CAL_PAY_MAIN`
- `C:\Users\kms\Desktop\dev\EHR_6\EHR5_DB명세.sql` 내 `F_CPN_PRO_CALC_YN`

복원 가능한 규칙:
- `P_CPN_CAL_EMP_INS`
  - 급여 액션/사번/사업장 기준으로 대상자를 준비한다.
- `P_CPN_CAL_PAY_MAIN`
  - 준비된 대상자 집합을 기준으로 메인 계산을 수행한다.
- `F_CPN_PRO_CALC_YN`
  - 입사/퇴사/부서이동 등 인사 이벤트의 급여 반영 여부를 판정한다.
- `P_BEN_PAY_DATA_CREATE_ALL`
  - 복리후생 데이터를 급여 반영용으로 생성/삭제/마감 처리한다.

## 6. 핵심 차이

| 항목 | 레거시 | 현재 VIBE-HR | 설계 판단 |
|---|---|---|---|
| 대상자 선정 | 별도 프로시저/별도 작업 결과 | 계산 시점에 `PayEmployeeProfile` 로 즉시 선정 | 별도 `target selection` 단계 복원 필요 |
| 인사 이벤트 반영 | 함수/프로시저 내부 판정 | 사실상 미반영 | 발령 이벤트 테이블 기반으로 분리 필요 |
| 복리후생 연계 | 별도 프로시저 | 미연계 | 복리후생 연결 포인트 추가 필요 |
| 계산 엔진 | DB 중심 | 서비스 중심 | 서비스 중심 유지 |
| 계산 로그 | DB 작업 로그 | `PayPayrollRunEvent` | 이벤트 내용을 더 구조화해야 함 |

## 7. 권장 신규 설계

### 7.1 목표 아키텍처

1. Run 생성
2. 대상자 선정
3. 인사 이벤트 수집
4. 근태/휴가/변동입력 수집
5. 복리후생 연계 데이터 수집
6. 계산 실행
7. 예외/경고 검토
8. 마감
9. 지급

### 7.2 신규 테이블 후보

- `pay_run_targets`
  - Run별 대상자 고정 스냅샷
- `pay_run_target_events`
  - 발령/입퇴사/휴직복직/조직이동 등 대상자 이벤트
- `pay_run_input_links`
  - variable/attendance/welfare 입력 반영 스냅샷
- `pay_run_exception_logs`
  - 경고/오류 상세

## 8. 대상자 선정 규칙 초안

아래 규칙은 현재 확인 가능한 근거만으로 작성했다.

| 규칙 ID | 규칙 | 근거 |
|---|---|---|
| PAY-TGT-01 | 해당 Run의 `payroll_code_id` 와 일치하는 급여 프로필만 대상 후보가 된다 | `payroll_phase2_service.py:443` 이후 `PayEmployeeProfile.payroll_code_id == run.payroll_code_id` |
| PAY-TGT-02 | 프로필 유효기간이 Run 월과 겹쳐야 한다 | `payroll_phase2_service.py` 의 `effective_from/effective_to` 조건 |
| PAY-TGT-03 | 입사일이 Run 종료일 이후인 직원은 제외한다 | `payroll_phase2_service.py` 의 `HrEmployee.hire_date <= period_end` |
| PAY-TGT-04 | 퇴사일이 Run 시작일 이전이면 제외한다 | `HrEmployeeBasicProfile.retire_date` 조건 |
| PAY-TGT-05 | 최종 대상자 집합은 계산 전에 고정 저장해야 한다 | 레거시 `P_CPN_CAL_EMP_INS`, `TCPN203` 작업 구조 |
| PAY-TGT-06 | 대상자에 대한 인사 이벤트는 계산 전에 함께 스냅샷 저장해야 한다 | 레거시 `F_CPN_PRO_CALC_YN` 와 발령 프로시저 구조 |

## 9. 이벤트 반영 규칙 초안

이벤트 입력원:
- 발령 이벤트: `wave1-appointment-event-dictionary.md`
- 근태/휴가 이벤트: `tim_leave_service.py`, 향후 `HRI` 완료 후처리
- 복리후생 이벤트: 향후 `wel_*` 설계

권장 이벤트 종류:
- `hire_started`
- `employment_status_changed`
- `resigned`
- `department_changed`
- `position_changed`
- `leave_started`
- `leave_ended`
- `welfare_deduction_added`
- `welfare_payment_added`

## 10. 계산 순서 권장안

1. `pay_run_targets` 생성
2. `pay_run_target_events` 생성
3. 기본급 적재
4. 월변동수당/공제 적재
5. 근태/휴가 연동액 적재
6. 복리후생 지급/공제 적재
7. 법정공제 계산
8. 경고/오류 판정
9. 결과 확정

이 순서를 권장하는 이유:
- 레거시도 대상자 집합을 먼저 만들고 계산을 나중에 돌렸다.
- 복리후생과 근태는 계산 입력원이므로 세액 계산 전에 들어와야 한다.

## 11. 현재 구조에서 바로 손봐야 할 부분

1. `create_payroll_run` 은 헤더만 만들고 있어 대상자 스냅샷이 없다.
2. `calculate_payroll_run` 이 즉시 대상을 다시 계산하므로 재현성이 약하다.
3. `PayPayrollRunEvent` 가 현재는 상태 로그 수준이라 입력 이벤트 근거를 남기지 못한다.
4. 복리후생 연계 포인트가 없다.
5. 발령 이벤트를 읽는 코드가 없다.

## 12. Wave 1 구현 제안

### 12.1 설계 우선

- `PayPayrollRun` 은 유지
- 새로 `pay_run_targets`, `pay_run_target_events` 추가
- 계산은 이 스냅샷만 읽도록 변경

### 12.2 데이터 수집 우선순위

1. 발령 이벤트
2. 퇴사/휴직 상태
3. 변동수당/공제
4. 복리후생
5. 근태/휴가 금액 반영

### 12.3 검증 기준

- 같은 월/같은 Run 재계산 시 대상자 집합이 흔들리지 않을 것
- 발령 이벤트 유무에 따라 대상자 포함/제외가 설명 가능할 것
- 복리후생/변동입력/법정공제의 입력 근거가 각각 추적 가능할 것

## 13. 다음 작업

이 문서 다음 순서:
1. `pay_run_targets` / `pay_run_target_events` 스키마 초안
2. 발령 이벤트 -> 급여 이벤트 매핑표 상세화
3. 근태/HRI 후처리 완성 후 급여 입력 인터페이스 정의
4. 복리후생 설계 완료 후 급여 링크 규칙 추가
