# HR 발령관리 테이블 설계안 (THRM 매핑, 통합안)

작성일: 2026-02-27

## 1) Legacy 매핑

- `THRM100` (인사마스터) -> `hr_employees` (기존 유지)
- `THRM191` (발령) -> `hr_appointment_orders`, `hr_appointment_order_items`
- `THRM221` (임시발령) -> `hr_appointment_order_items`의 `appointment_kind='temporary'`
- `THRM151` (인사이력) -> `hr_personnel_histories`

## 2) 신규 테이블 요약

### `hr_appointment_orders`
- 발령처리 헤더/확정 상태 단위
- 주요 필드:
  - `appointment_no` (유니크 발령번호)
  - `appointment_code_id` (`app_codes` -> `HR_APPOINTMENT_CODE`)
  - `effective_date`
  - `status` (`draft|confirmed|cancelled`)
  - `confirmed_at`, `confirmed_by`

### `hr_appointment_order_items`
- 발령 대상자 상세 단위 (사원별 1행)
- THRM191(일반발령) + THRM221(임시발령) 통합 표현
- 주요 필드:
  - `order_id`, `employee_id`
  - `appointment_kind` (`permanent|temporary`)
  - `action_type`
  - `start_date`, `end_date`
  - `temporary_reason`
  - `from_*`, `to_*` (부서/직위/재직상태 전후값)
  - `apply_status` (`pending|applied|cancelled`)

### `hr_personnel_histories`
- 인사 이력(Audit) 단위
- 주요 필드:
  - `employee_id`
  - `history_type`
  - `source_table`, `source_id`
  - `effective_date`
  - `field_name`, `before_value`, `after_value`

## 3) 처리 흐름(목표)

1. 발령코드 정의 (`HR_APPOINTMENT_CODE`)
2. 발령처리 헤더 생성 (`hr_appointment_orders`)
3. 대상자 상세 입력 (`hr_appointment_order_items`)
4. 발령확정 시:
   - 사원 마스터(`hr_employees`) 반영
   - 인사이력(`hr_personnel_histories`) 기록

## 4) 현재 반영 상태

- 테이블 모델은 통합안으로 반영됨
- 발령코드 10종 시드 추가됨
- 기존 `hr_employee_info_records`의 `appointment` 카테고리 데이터는 정리됨
- 화면/API는 단계적으로 신규 테이블 기반으로 전환 예정

