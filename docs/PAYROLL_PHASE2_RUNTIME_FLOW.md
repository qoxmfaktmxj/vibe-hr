# Payroll Phase 2 Runtime Flow (정기급여 V1)

작성일: 2026-03-11

## 구현 범위 (이번 반영)
- 직원 급여프로필 API
- 월 변동입력 API
- 월 급여 Run 생성/계산/마감/지급완료 API
- 급여 결과(사원 요약/항목 상세) 저장
- Run 대상자 snapshot / 발령+급여프로필+TIM/WEL 이벤트 적재 / 소득세 bracket master / snapshot backfill

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
   - confirmed 발령 + 급여프로필 변경 + 승인된 무급휴가/TIM + 승인된 복리후생/WEL 기반 급여 이벤트 판정 결과
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
  - 공제: 변동(deduction) + 승인 무급휴가 자동 공제 + 복리후생 공제 + 국민연금/건강보험/고용보험
  - 소득세: `pay_income_tax_brackets` 우선, 없으면 legacy flat rate fallback
  - 지방소득세: 소득세의 10%
  - 실지급 = 총지급 - 총공제

4-1) 기존 Run snapshot/event 재적재
- `POST /api/v1/pay/runs/{run_id}/snapshot-backfill`
- `draft`/`calculated` 상태에서만 허용
- 기존 `pay_payroll_run_targets` / `pay_payroll_run_target_events` 를 다시 만들고,
  이미 `calculated` 인 Run은 즉시 재계산까지 수행한다.

5) 계산 결과 검토
- `GET /api/v1/pay/runs/{run_id}/employees`
- `GET /api/v1/pay/runs/{run_id}/employees/{run_employee_id}`

6) 마감 (상태: closed)
- `POST /api/v1/pay/runs/{run_id}/close`
- 계산 이후 승인 또는 취소된 자동 무급휴가를 다시 확인하고, 공제액이 달라졌으면 같은 잠금과 트랜잭션에서 재계산한 뒤 마감한다.

7) 지급완료 처리 (상태: paid)
- `POST /api/v1/pay/runs/{run_id}/mark-paid`

---

## 상태 머신

- `draft` -> `calculated` -> `closed` -> `paid`
- `closed`/`paid` 상태에서는 재계산 금지
- `closed`/`paid` 상태에서는 snapshot backfill 금지

## 승인 휴가의 근태 및 급여 자동 반영

- V7 이후 승인한 휴가는 해당 직원의 예정 근무일에 근태 연결을 저장한다. 일정이 없으면 기존 평일 및 활성 공휴일 기준을 사용한다. 반차는 0.5일로 집계하고 실제 근무 기록을 보존한다.
- 새 무급휴가 승인 시 `payroll_minutes_snapshot`에 월별 소정근로 분을 저장한다. 급여 계산은 대상자 기본급 snapshot / 209 / 60 * 해당 월 승인 분 합계를 원 단위 HALF_EVEN으로 반올림해 `TIM_UNPAID` 공제를 만든다. 비근무일은 제외한다. 기본급 2,090,000원, 8시간이면 80,000원이다.
- 이 공제는 기존 V1 공제 경로로 실지급액에서 차감하며 과세 및 법정 공제 기준액은 변경하지 않는다. 독립적인 수동 공제는 합산하지만 `TIM_UNPAID` 코드를 수동 입력하거나 기존 수동 입력과 중복 계산할 수 없다.
- 과거 null snapshot 무급휴가는 기존 `review` 판정과 수동 검토를 유지한다. 새 자동 휴가는 `apply` 판정으로 생성 및 계산 시 동기화한다. 취소 시 연결 근태와 차감을 복원하고 이후 계산에서 자동 공제를 제거한다.
- 근태 월마감과 급여 계산 및 마감은 같은 월 잠금을 사용한다. 이미 마감 또는 지급된 직원 급여에 영향을 주는 자동 휴가 변경은 거절한다. 근태 월을 재개해도 확정 급여 결과와 명세서는 바뀌지 않는다.

---

## 월급여일자관리 관련

현재 V1에서는 급여프로필에 아래 필드를 포함해 운용:
- `payment_day_type`: `fixed_day | month_end`
- `payment_day_value`: 1~31
- `holiday_adjustment`: `previous_business_day | next_business_day | none`

즉, 별도 화면을 분리하기 전에도 프로필 단에서 월급여일 규칙 관리가 가능하다.
향후 운영상 독립 관리가 필요하면 `pay_payment_calendars` 테이블 + 전용 화면으로 확장 권장.
