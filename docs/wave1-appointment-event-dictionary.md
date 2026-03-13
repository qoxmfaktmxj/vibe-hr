# Wave 1 Appointment Event Dictionary

작성일: 2026-03-12  
기준 저장소: `C:\Users\kms\Desktop\dev\vibe-hr`  
레거시 소스: `C:\EHR_PROJECT\isu-hr\EHR_HR50`  
DB 명세: `C:\Users\kms\Desktop\dev\EHR_6\EHR5_DB명세.sql`

## 1. 목적

이 문서는 발령/인사이력 영역을 “화면 저장”이 아니라 “업무 이벤트” 기준으로 재정의하기 위한 사전이다.

이 사전의 직접 목적:
- 레거시 발령 수정/동기화 흐름을 VIBE-HR 도메인 이벤트로 치환
- 이후 급여, 근태, 교육 등 다른 모듈이 발령 결과를 안정적으로 참조할 수 있게 기준 이벤트 정의
- 레거시 프로시저가 숨기고 있던 후행 동기화 규칙을 애플리케이션 서비스로 끌어올릴 준비

## 2. 근거 소스

레거시:
- Controller: `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hrm\appmt\appmtHistoryMgr\AppmtHistoryMgrController.java`
- Service: `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hrm\appmt\appmtHistoryMgr\AppmtHistoryMgrService.java`
- Mapper: `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\resources\mapper\com\hr\hrm\appmt\appmtHistoryMgr\AppmtHistoryMgr-sql-query.xml`
- Procedure: `P_HRM_151_SABUN_CREATE`, `P_HRM_151_SABUN_EDATE_CREATE`, `P_HRM_223_SABUN_SYNC`

현재 VIBE-HR:
- API: `backend/app/api/hr_appointment_record.py`
- Service: `backend/app/services/hr_appointment_record_service.py`
- Model: `backend/app/models/entities.py`

## 3. 현재 VIBE-HR 발령 흐름

확인 근거:
- `backend/app/services/hr_appointment_record_service.py:265` `create_appointment_record`
- `backend/app/services/hr_appointment_record_service.py:324` `update_appointment_record`
- `backend/app/services/hr_appointment_record_service.py:419` `confirm_appointment_order`
- `backend/app/models/entities.py:427` `HrAppointmentOrder`
- `backend/app/models/entities.py:454` `HrAppointmentOrderItem`
- `backend/app/models/entities.py:499` `HrPersonnelHistory`

현재 처리 방식:
1. `create_appointment_record` 가 `HrAppointmentOrder` 와 `HrAppointmentOrderItem` 을 `draft` 상태로 생성한다.
2. `update_appointment_record` 는 `draft` 상태에서만 수정 가능하다.
3. `confirm_appointment_order` 는 각 대상자별로 `HrEmployee` 의 현재 속성을 직접 갱신한다.
4. 변경된 필드별로 `HrPersonnelHistory` 를 1건 이상 적재한다.
5. 주문/대상 상태를 `confirmed` / `applied` 로 바꾼다.

현재 서비스가 직접 반영하는 필드:
- `department_id`
- `position_title`
- `employment_status`

현재 서비스가 보유한 발령 메타:
- `appointment_kind` (`permanent`, `temporary`)
- `action_type`
- `start_date`
- `end_date`
- `from_department_id`, `to_department_id`
- `from_position_title`, `to_position_title`
- `from_employment_status`, `to_employment_status`

## 4. 레거시 발령 흐름

확인 근거:
- `AppmtHistoryMgrController.java` 의 `saveAppmtHistoryMgrExec`, `prcAppmtHistoryEdateCreate`
- `AppmtHistoryMgrService.java:59` `saveAppmtHistoryMgrExec`
- `AppmtHistoryMgrService.java:76`, `145` 에서 `prcAppmtHistorySync` 호출
- `AppmtHistoryMgrService.java:165` `prcAppmtHistoryEdateCreate`
- `AppmtHistoryMgrService.java:177` `prcAppmtHistoryCreate`
- `AppmtHistoryMgr-sql-query.xml:42` `MERGE INTO THRM191`
- `AppmtHistoryMgr-sql-query.xml:86` `CALL P_HRM_151_SABUN_CREATE`
- `AppmtHistoryMgr-sql-query.xml:98` `CALL P_HRM_151_SABUN_EDATE_CREATE`
- `AppmtHistoryMgr-sql-query.xml:109` `CALL P_HRM_223_SABUN_SYNC`

복원 가능한 흐름:
1. 발령내역수정 화면이 `THRM191` 를 직접 `MERGE`/`DELETE` 한다.
2. 저장 후 `P_HRM_151_SABUN_CREATE` 로 해당 사번의 `THRM151` 현행/이력 테이블을 재생성한다.
3. 이어서 `P_HRM_151_SABUN_EDATE_CREATE` 로 종료일(`EDATE`)을 재산정한다.
4. 필요 시 `P_HRM_223_SABUN_SYNC` 로 `THRM223` 관련 동기화를 수행한다.

즉, 레거시는 “발령 수정”과 “현행 인사정보 재구축”이 분리되어 있고, 후행 프로시저가 실질 업무 결과를 완성한다.

## 5. DB 규칙 요약

확인 근거:
- `C:\Users\kms\Desktop\dev\EHR_6\EHR5_DB명세.sql:314171` `P_HRM_151_SABUN_CREATE`
- `C:\Users\kms\Desktop\dev\EHR_6\EHR5_DB명세.sql:314082`, `314188` `P_HRM_151_SABUN_EDATE_CREATE`
- `C:\Users\kms\Desktop\dev\EHR_6\EHR5_DB명세.sql` 내 `P_HRM_223_SABUN_SYNC`

복원 가능한 핵심 규칙:
- `P_HRM_151_SABUN_CREATE`
  - 사번 기준으로 `THRM191` 내용을 바탕으로 `THRM151` 을 다시 만든다.
- `P_HRM_151_SABUN_EDATE_CREATE`
  - `THRM151` 의 `EDATE` 를 다음 시작일 직전으로 재산정한다.
  - 마지막 레코드는 `99991231` 종결값 관례를 사용한다.
- `P_HRM_223_SABUN_SYNC`
  - 발령내역 수정만 있었어도 `THRM223` 쪽 참조 정합성을 별도 보정한다.

## 6. 발령 이벤트 사전

주의:
- 아래 이벤트는 현재 VIBE-HR 필드와 레거시 프로시저가 확인된 범위만 사용했다.
- 세부 명칭은 신규 설계용 코드명이며, 추후 테이블명/코드명은 VIBE-HR 규칙에 맞춰 확정한다.

| 이벤트 ID | 이벤트명 | 판정 기준 | 레거시 근거 | 현재 VIBE-HR 근거 | 후행 영향 모듈 |
|---|---|---|---|---|---|
| APT-E01 | `appointment_order_confirmed` | 발령 오더가 `confirmed` 로 확정됨 | `AppmtHistoryMgrController.java`, `AppmtHistoryMgrService.java`, `P_HRM_151_SABUN_CREATE` | `confirm_appointment_order` | 급여, 근태, 교육, 권한 |
| APT-E02 | `department_changed` | `to_department_id` 가 기존 부서와 다름 | `THRM191 -> THRM151` 재생성 구조 | `confirm_appointment_order` 에서 `department_id` 변경 | 급여 대상, 조직통계, 권한 |
| APT-E03 | `position_changed` | `to_position_title` 이 기존 직위와 다름 | `THRM191 -> THRM151` 재생성 구조 | `confirm_appointment_order` 에서 `position_title` 변경 | 결재선, 권한, 급여 |
| APT-E04 | `employment_status_changed` | `to_employment_status` 가 기존 상태와 다름 | `THRM151` 재생성, 상태 반영 | `confirm_appointment_order` 에서 `employment_status` 변경 | 급여 대상, 근태 대상 |
| APT-E05 | `temporary_assignment_started` | `appointment_kind='temporary'` 이고 `start_date` 도래 | `THRM223` 동기화 프로시저 존재 | `HrAppointmentOrderItem.appointment_kind`, `start_date`, `end_date` | 권한, 조직표시, 급여 |
| APT-E06 | `temporary_assignment_ended` | `appointment_kind='temporary'` 이고 `end_date` 종료 | `P_HRM_151_SABUN_EDATE_CREATE`, `P_HRM_223_SABUN_SYNC` | `HrAppointmentOrderItem.end_date` 존재 | 급여 대상, 조직표시 |
| APT-E07 | `leave_status_started` | 상태가 `active -> leave` 로 바뀜 | `THRM151` 재생성 | `VALID_EMPLOYMENT_STATUSES` 와 `to_employment_status` | 근태 생성, 급여 반영 |
| APT-E08 | `leave_status_ended` | 상태가 `leave -> active` 로 바뀜 | `THRM151` 재생성 | `employment_status` 변경 이력 | 근태/급여 재개 |
| APT-E09 | `resigned` | 상태가 `resigned` 로 바뀜 | `THRM151 EDATE` 재계산 구조 | `VALID_EMPLOYMENT_STATUSES` 에 `resigned` 포함 | 급여 제외, 근태 제외 |

## 7. 이벤트별 필수 데이터

| 이벤트 ID | 필수 데이터 | 현재 보유 여부 | 비고 |
|---|---|---|---|
| APT-E01 | `order_id`, `appointment_no`, `effective_date`, `confirmed_by`, `confirmed_at` | 보유 | `HrAppointmentOrder` |
| APT-E02 | `employee_id`, `before_department_id`, `after_department_id`, `effective_date` | 보유 | `HrAppointmentOrderItem` + `HrPersonnelHistory` |
| APT-E03 | `employee_id`, `before_position_title`, `after_position_title`, `effective_date` | 보유 | `HrAppointmentOrderItem` + `HrPersonnelHistory` |
| APT-E04 | `employee_id`, `before_status`, `after_status`, `effective_date` | 보유 | `HrAppointmentOrderItem` + `HrPersonnelHistory` |
| APT-E05 | `employee_id`, `appointment_kind`, `start_date`, `end_date`, `temporary_reason` | 보유 | `temporary_reason` 있음 |
| APT-E06 | `employee_id`, `end_date`, `restore_target` | 일부 미확인 | 복귀 대상 부서/직위 복원 정책은 별도 설계 필요 |

## 8. 현재 구조의 부족한 점

1. 현재 `confirm_appointment_order` 는 직원 속성을 즉시 덮어쓰지만, 레거시처럼 “재구축 후 종료일 정리” 단계가 없다.
2. 현재 `HrPersonnelHistory` 는 필드별 변경 이력은 남기지만, 후행 시스템이 읽기 쉬운 정규 이벤트 레이어는 없다.
3. 임시 발령 종료 시 복귀 규칙은 현재 명시적으로 보이지 않는다.
4. 겸직/파견성 동기화에 해당하는 `THRM223` 대응 구조는 현재 VIBE-HR에서 명시적으로 분리되어 있지 않다.

## 9. 권장 설계

### 9.1 신규 이벤트 레이어

권장 신규 테이블:
- `hr_appointment_events`
- `hr_appointment_event_details`

권장 역할:
- `HrPersonnelHistory` 는 사람이 읽는 변경 이력 보존용
- `hr_appointment_events` 는 다른 모듈이 소비하는 정규 이벤트 스트림

### 9.2 권장 처리 순서

1. 오더 확정
2. 대상자별 필드 변화 계산
3. `HrEmployee` 반영
4. `HrPersonnelHistory` 적재
5. `hr_appointment_events` 적재
6. 급여/근태/권한 후속 수집 대상으로 표준화

## 10. 급여 모듈과의 연결 포인트

급여 대상자 선정에서 반드시 읽어야 할 이벤트:
- `employment_status_changed`
- `resigned`
- `leave_status_started`
- `leave_status_ended`
- `department_changed`

이유:
- 레거시 `F_CPN_PRO_CALC_YN` 는 입사/퇴사/부서이동 등 급여 반영 여부를 함수로 판정했다.
- VIBE-HR은 이를 발령 이벤트 기반 판정으로 치환하는 편이 구조적으로 맞다.

## 11. 바로 다음 작업

이 문서를 기준으로 바로 이어질 작업:
1. `action_type` 표준코드 목록 정리
2. `appointment_kind='temporary'` 종료 후 복귀 규칙 정의
3. `HrPersonnelHistory` 와 별도 `hr_appointment_events` 설계서 작성
4. 급여 대상자 선정 설계서에서 읽을 이벤트 필드 확정
