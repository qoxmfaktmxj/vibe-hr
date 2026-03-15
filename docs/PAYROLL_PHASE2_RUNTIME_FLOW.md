# Payroll Phase 2 Runtime Flow (정기급여 V1)

작성일: 2026-03-11

## 구현 범위 (이번 반영)
- 직원 급여프로필 API
- 월 변동입력 API
- 월 급여 Run 생성/계산/마감/지급완료 API
- 급여 결과(사원 요약/항목 상세) 저장
- Run 대상자 snapshot / 발령 이벤트 적재 / 소득세 bracket master

> 참고: 화면(UI)보다 백엔드 지급 파이프라인 우선 반영

---

## 데이터 흐름

1. `pay_employee_profiles`
   - 직원별 기본급/급여코드/지급일 규칙
2. `pay_variable_inputs`
   - 대상 월(YYYY-MM) 변동 수당/공제
3. `pay_payroll_runs`
   - 월 실행 헤더(draft/calculated/closed/paid)
4. `pay_payroll_run_targets`
   - Run 생성 시 대상자/프로필 snapshot 고정
5. `pay_payroll_run_target_events`
   - confirmed 발령 기반 급여 이벤트 판정 결과
6. `pay_payroll_run_employees`
   - 사원별 계산 요약(총지급, 공제, 실지급)
7. `pay_payroll_run_items`
   - 사원별 항목 상세(기본급/변동/법정공제)
8. `pay_payroll_run_events`
   - 생성/계산/마감/지급 이벤트 로그
9. `pay_income_tax_brackets`
   - 연도별 소득세 bracket master

---

## 실제 지급 처리 플로우 (운영 절차)

1) 급여프로필 등록
- `POST /api/v1/pay/employee-profiles/batch`

2) 월 변동입력 등록
- `POST /api/v1/pay/variable-inputs/batch`

3) Run 생성 (초기 상태: draft)
- `POST /api/v1/pay/runs`
- 이 시점에 대상자 snapshot 과 발령 이벤트가 고정 저장된다.

4) Run 계산 (상태: calculated)
- `POST /api/v1/pay/runs/{run_id}/calculate`
- 계산식 V1.1:
  - 대상자는 `pay_payroll_run_targets` snapshot 만 사용
  - 지급: snapshot 기본급 + 변동(earning) + 복리후생 지급
  - 공제: 변동(deduction) + 복리후생 공제 + 국민연금/건강보험/고용보험
  - 소득세: `pay_income_tax_brackets` 우선, 없으면 legacy flat rate fallback
  - 지방소득세: 소득세의 10%
  - 실지급 = 총지급 - 총공제

5) 계산 결과 검토
- `GET /api/v1/pay/runs/{run_id}/employees`
- `GET /api/v1/pay/runs/{run_id}/employees/{run_employee_id}`

6) 마감 (상태: closed)
- `POST /api/v1/pay/runs/{run_id}/close`

7) 지급완료 처리 (상태: paid)
- `POST /api/v1/pay/runs/{run_id}/mark-paid`

---

## 상태 머신

- `draft` -> `calculated` -> `closed` -> `paid`
- `closed`/`paid` 상태에서는 재계산 금지

---

## 월급여일자관리 관련

현재 V1에서는 급여프로필에 아래 필드를 포함해 운용:
- `payment_day_type`: `fixed_day | month_end`
- `payment_day_value`: 1~31
- `holiday_adjustment`: `previous_business_day | next_business_day | none`

즉, 별도 화면을 분리하기 전에도 프로필 단에서 월급여일 규칙 관리가 가능하다.
향후 운영상 독립 관리가 필요하면 `pay_payment_calendars` 테이블 + 전용 화면으로 확장 권장.
