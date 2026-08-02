<!-- IMMUTABLE PRE-CUTOVER ARCHIVE: historical FastAPI/Alembic evidence only; not an executable Spring operating instruction. -->
# 퇴직금 계산·정산 설계 (v0.1)

- Date: 2026-07-08
- Status: approved (2026-07-09 사용자 전부 승인 — §8 승인 요청 4건 포함) → 구현 착수
- Risk Class: R3
- Owner: kms
- 근거: 2026-07-08 E2E 감사 — 퇴직 확정(`hr_retire_service.confirm` → employment_status=resigned)은 동작하나 퇴직금 계산·기록·급여 연동이 전무

## 1. 목표 / 비목표

**목표**
- 법정 퇴직금 산정: `평균임금(1일) × 30일 × (재직일수 / 365)`
- 평균임금: 퇴직일 직전 3개월 임금총액 ÷ 그 기간 총일수 (근로기준법 §2)
- 퇴직 케이스와 연결된 정산 기록 생성 → 검토 → 확정 워크플로우
- 통상임금 비교(평균임금 < 통상임금이면 통상임금 적용) — Phase 1은 경고 표시만

**비목표 (Phase 1 제외)**
- 퇴직소득세 원천징수 계산(간이세액 아님 — 근속연수공제 별도 로직, Phase 2)
- DC/DB 퇴직연금 제도 구분, 중간정산 이력 합산, IRP 이전 처리

## 2. 데이터 근거

- `hr_retire_cases`: employee_id, retire_date, status(confirm 시 resigned 전환) — 트리거 지점
- `hr_employees.hire_date`: 근속 기산일
- `pay_payroll_run_items` + `pay_payroll_runs(status=paid)`: 직전 3개월 임금총액 (direction=earning 합계, 단 비정기성 상여는 3/12 규칙 — Phase 1은 연간상여 항목 플래그 없으므로 전액 포함하고 항목별 포함/제외 설정 테이블로 제어)

## 3. 신규 테이블 (2개)

```
hr_severance_calcs                # 퇴직금 산정 기록
  id, retire_case_id(fk hr_retire_cases, uq), employee_id(fk),
  hire_date, retire_date, service_days,
  avg_wage_base_from, avg_wage_base_to,          # 평균임금 산정 기간
  wage_total_3m, base_days_3m, avg_daily_wage,
  severance_amount, adjustment_amount(수동 조정), adjustment_reason,
  final_amount, status(draft|reviewed|confirmed),
  calculated_at, confirmed_by, confirmed_at, created_at, updated_at

pay_severance_item_rules          # 평균임금 산입 규칙
  id, pay_item_code(uq), include_type(full|prorate_12|exclude), note,
  is_active, created_at, updated_at
```

## 4. 흐름

```
퇴직 케이스 confirm 시:
  └─ [신규] hr_severance_calcs draft 자동 생성 (직전 3개월 paid run 데이터 스냅샷)
     └─ 데이터 부족(입사 3개월 미만/급여이력 없음) 시 draft + warning 플래그
HR 검토 (조정액 입력 가능, 사유 필수) → reviewed → confirmed
confirmed 후 → (Phase 2) 급여 run 특별 지급 or 전표 연계 (PAY_VOUCHER_GL_DESIGN.md와 접점)
```

**의도적 결정**: retire confirm 훅은 `hr_retire_service`(비보호 경로) 안에서 신규 severance 서비스 호출 1줄 추가로 한정. payroll_phase2 서비스는 **읽기만** 한다 (급여 계산 로직 무수정).

## 5. API (신규 라우터 backend/app/api/hr_severance.py)

```
GET  /api/v1/hr/severance/calcs            ?status=&year=
GET  /api/v1/hr/severance/calcs/{id}       (산정 근거 상세: 3개월 임금 내역 포함)
POST /api/v1/hr/severance/calcs/{id}/recalculate
PUT  /api/v1/hr/severance/calcs/{id}       (조정액/사유)
POST /api/v1/hr/severance/calcs/{id}/confirm
GET/POST /api/v1/pay/severance-item-rules  (+batch)
```

## 6. 화면 (2개 — ReadonlyGridManager / AG Grid)

| registryKey | variant | 내용 |
|---|---|---|
| `hr.severance.calcs` | workflow | 산정 목록 + 재계산/조정/확정, 산정근거 상세 패널 |
| `payroll.severance-item-rules` | crud | 평균임금 산입 규칙 관리 |

## 7. 테스트 전략

- 유닛: 근속일수(윤년/중도입사), 평균임금(3개월 경계, 결측 run), 30일분 계산 정밀도, 조정 사유 필수, 상태 전이
- 회귀: 1년 미만 근속(퇴직금 0, 단 1년 이상만 발생 규칙 명시), 재계산 시 스냅샷 갱신
- E2E: 퇴직 confirm → draft 생성 → 확정 체인

## 8. 승인 요청 사항 (R3)

1. Phase 1 범위(산정+기록+확정, 세금·연금 제외) 승인
2. retire confirm 시 draft 자동 생성 훅 (hr_retire_service 1줄) 승인
3. 평균임금 산입 규칙을 item_code 단위 설정 테이블로 두는 방식 승인
4. 테이블 2종 신규 (DB 스키마 = R3)

---

## 9. Phase 2 설계 (v0.2 — 2026-07-09 사용자 순차 진행 지시분): 퇴직소득세

### 9-1. 산출 절차 (소득세법 §48, 2026년 기준)

```
근속연수 = ceil(service_days / 365)          # 1년 미만 절상
근속연수공제:
  ~5년:   100만 × 근속연수
  6~10년: 500만 + 200만 × (근속연수-5)
  11~20년: 1,500만 + 250만 × (근속연수-10)
  20년~:  4,000만 + 300만 × (근속연수-20)
환산급여 = (final_amount - 근속연수공제) × 12 / 근속연수
환산급여공제 (환산급여 구간별):
  ~800만: 전액 / ~7,000만: 800만+60% 초과분 / ~1억: 4,520만+55% / ~3억: 6,170만+45% / 초과: 15,170만+35%
과세표준 = 환산급여 - 환산급여공제
환산산출세액 = 과세표준 × 기본세율(종합소득세율 구간)      # pay_income_tax_brackets(연도별) 재사용
산출세액(income_tax) = 환산산출세액 / 12 × 근속연수
지방소득세(local_income_tax) = income_tax × 10%
실수령(net_severance) = final_amount - income_tax - local_income_tax
```

### 9-2. 데이터 변경 (Alembic 리비전)

- `hr_severance_calcs`에 컬럼 추가: `service_years int`, `income_tax float default 0`, `local_income_tax float default 0`, `net_severance float default 0`, `tax_detail_json text nullable`(산출 단계별 근거 스냅샷)
- 근속연수공제/환산급여공제 구간은 서비스 내 연도 키 상수 테이블(SEVERANCE_TAX_TABLE[2026]) — 세법 개정 시 상수 추가. DB 테이블화는 개정 2회 이상 발생 시 재평가

### 9-3. 흐름/API

- 세액은 산정(create/recalculate) 시 자동 계산되어 저장, 조정액 변경(PUT) 시 재계산
- 기존 API 응답(HrSeveranceCalcItem)에 신규 필드 노출 + detail의 tax_detail 단계별 근거 포함
- 화면(hr.severance.calcs): 상세 패널에 세액 섹션(근속연수공제→환산급여→과세표준→산출세액→지방소득세→실수령) 표시

### 9-4. 검증

- 유닛: 구간 경계(5/10/20년, 환산급여 각 구간), 1년 미만(세액 0), 국세청 예시 케이스 1건 이상 수기 대조, 조정액 변경 시 세액 재계산, confirmed 후 불변
- 기존 confirmed calc 2건은 재계산하지 않음 (신규 컬럼 0 유지 — 확정분 소급 금지)
<!-- IMMUTABLE PRE-CUTOVER ARCHIVE: historical FastAPI/Alembic evidence only; not an executable Spring operating instruction. -->
