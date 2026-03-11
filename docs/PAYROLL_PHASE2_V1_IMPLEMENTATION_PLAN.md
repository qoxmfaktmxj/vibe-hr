# VIBE-HR 급여 Phase 2 (정기급여 V1) 구현 계획

작성일: 2026-03-11  
상태: Draft (검토 완료, 구현 착수용)

---

## 0) 검토 결론 (요약)

제안한 방향은 타당함.
핵심 판단은 아래 3가지로 확정한다.

1. **Phase 2 핵심은 계산식(formula) 고도화가 아니라**  
   **직원 급여프로필 + 월별 Run + 스냅샷 저장**이다.
2. 현재 저장소 구조(설정 CRUD 중심)를 유지하면서 확장 가능하다.
3. V1 범위는 **정기급여(regular)만 마감 가능**으로 제한해야 안전하다.

> 보정사항 1개: 프론트 신규 페이지 경로는 현재 저장소 기준 `frontend/src/app/payroll/*`를 사용한다.  
> (`frontend/src/app/(dashboard)/payroll/*`가 아니라 현행 구조에 맞춤)

---

## 1) 현재 기준선 (As-Is)

### 1-1. 기존 급여 설정 영역
- API: `/api/v1/pay/setup/*`
  - 급여코드
  - 세율/보험요율
  - 수당/공제
  - 항목그룹
- 화면:
  - `/payroll/codes`
  - `/payroll/tax-rates`
  - `/payroll/allowance-deduction-items`
  - `/payroll/item-groups`
- DB 마스터:
  - `pay_payroll_codes`
  - `pay_tax_rates`
  - `pay_allowance_deductions`
  - `pay_item_groups`
  - `pay_item_group_details`
- BFF 프록시:
  - `frontend/src/app/api/pay/[...path]/route.ts`
  - `/api/pay/[...path] -> /api/v1/pay/[...path]`

### 1-2. 원천 데이터 (대상자/근태)
- HR:
  - `hr_employees` (hire_date, employment_status)
  - `hr_employee_basic_profiles` (retire_date)
- TIM:
  - `tim_attendance_daily`
  - `tim_leave_requests`
  - `tim_annual_leaves`

### 1-3. 현재 부재 영역
- 직원 급여 전용 프로필
- 월별 급여 run 헤더/상세
- 계산결과 상세 저장
- 마감/지급 상태관리

---

## 2) Phase 2 목표/범위 (To-Be)

## 포함 (V1)
- 정기급여(Regular)
- 고정항목(fixed), 시간/수량(hourly)
- 월 변동입력
- run 상태: `draft -> calculated -> closed -> paid`
- 명세서 조회/출력(Preview + PDF/Excel)

## 제외 (V1 범위 밖)
- formula 엔진
- 정기상여
- 연차수당 자동산정
- 퇴직정산
- 펌뱅킹 파일
- 연말정산

---

## 3) 프로젝트 강제 규칙 (반드시 준수)

1. 기존 프록시 구조 유지: `/api/pay/* -> /api/v1/pay/*`
2. 비즈니스 로직은 **Service 계층**에 구현 (DB trigger 금지)
3. AG Grid 리스트 화면은 standard-v2 규칙 준수
   - `GRID_SCREEN` 선언
   - `config/grid-screens.json` 등록/갱신
   - shared grid 모듈 재사용
   - 툴바 순서 준수
4. 권한은 서버 API에서 검증 (UI 숨김 대체 금지)
5. 배치 저장 순서: **DELETE -> UPDATE -> INSERT**
6. 검증 게이트: `validate:grid -> lint -> build`
7. 문서 갱신 없는 코드 추가 금지

---

## 4) 신규 화면 설계

| 화면 | URL | 유형 | 핵심 기능 |
|---|---|---|---|
| 직원 급여프로필 관리 | `/payroll/employee-profiles` | AG Grid | 직원별 급여코드/항목그룹/기본급/적용기간 관리 |
| 직원 급여프로필 상세 | `/payroll/employee-profiles/[id]` | Form/Tabs | 기본정보, 고정항목 override, 세무예외, 지급계좌 |
| 월 변동입력 | `/payroll/variable-inputs` | AG Grid | 월별 수당/공제 입력, 근태집계 확인 |
| 급여 run 목록 | `/payroll/runs` | AG Grid | run 생성/조회/계산/마감/엑셀 |
| 급여 run 상세 | `/payroll/runs/[id]` | Master-Detail | 헤더요약, 사원별 결과, 에러/이력 |
| 급여명세서 | `/payroll/payslips` | 조회/미리보기 | run/사원 기준 명세서 preview + 출력 |

추가 원칙:
- `/payroll/item-groups`는 폐기하지 않고 **상세 매핑 편집 UX 강화**
- 그룹 선택 시 기본 항목 preview + 직원별 override UX 제공

---

## 5) 신규 DB 설계 (8개)

1. `pay_employee_profiles`
2. `pay_employee_profile_items`
3. `pay_employee_tax_profiles`
4. `pay_variable_inputs`
5. `pay_payroll_runs`
6. `pay_payroll_run_employees`
7. `pay_payroll_run_items`
8. `pay_payroll_run_events`

### 공통 DB 규칙
- 금액: `NUMERIC(18,2)`
- 수량: `NUMERIC(18,4)`
- 요율: `NUMERIC(9,6)`
- 계산/정산 금액 컬럼에 `float` 금지
- snapshot 컬럼: `JSONB`
- `created_at`, `updated_at` 필수 (`created_by` 권장)
- `pay_employee_profiles`: 동일 직원 유효기간 중복 금지
- `pay_payroll_runs`: `status != draft` hard delete 금지
- run 상세 항목에는 snapshot 필드 필수

### 코드 정규화 (신규 계층)
- `pay_type_code`: `regular | bonus | annual_leave | retro | settlement`
- `payment_day_type`: `fixed_day | month_end`
- `payment_day_value`: `1~31 | NULL(month_end)`

> 기존 `pay_payroll_codes.pay_type/payment_day`는 즉시 파괴적 변경 금지.  
> 신규 계층에서 변환 레이어로 흡수 후 추후 마이그레이션.

---

## 6) 프로세스/상태 머신

### 상태
- `draft`
- `calculated`
- `closed`
- `paid`

### 흐름
기초설정 → 직원 프로필 → 월 변동입력 → run 생성(draft) → snapshot 저장 → 대상자 확정 → 계산 → 검토 → 마감(close) → 명세서 → 지급완료(paid)

### 소급 원칙
- 과거 run 직접 수정 금지
- 다음 달 급여에서 `+/- adjustment` 처리

### 대상자 선정
- `hire_date <= period_end`
- `retire_date IS NULL OR retire_date >= period_start`
- 유효한 급여프로필 존재 필수
- `employment_status`는 참고값, 최종판단은 날짜 기준
- 제외 시 run event/warning 남김

---

## 7) 계산 규칙 (V1)

### 지원 계산형
- `fixed`
- `hourly (qty * unit_price)`

### 미지원
- `formula`
  - 정책: V1에서는 `unsupported_formula_item` 경고 후 skip (또는 대상 그룹에서 사전 차단)

### 계산 순서
1) 대상자 확정  
2) 프로필 snapshot 로드  
3) 그룹 기본항목 전개  
4) override 적용  
5) 월 변동입력 합산  
6) 근태/휴가 기반 수량 반영  
7) 지급합계  
8) 비과세 분리  
9) 과세대상 계산  
10) 보험 공제  
11) 소득세/지방소득세  
12) 기타 공제  
13) 실지급 계산  
14) 사원요약/항목상세 저장  
15) 이벤트 로그 저장

### 엔진 내부 분류 DTO
- `direction`: `earning | deduction`
- `taxability`: `taxable | non_taxable`
- `statutory_kind`: `income_tax | local_income_tax | national_pension | health_insurance | employment_insurance | other`
- `calc_method`: `fixed | hourly | formula`

---

## 8) 스냅샷 원칙 (강제)

run 생성 시 snapshot 저장 대상:
- 급여코드
- 세율/보험요율
- 수당/공제 항목 정의
- 직원 급여프로필
- 직원 세무프로필
- 근무기준 기간
- 계산 정책 버전

재계산(recalculate): **동일 snapshot 기준만 허용**

기준정보 변경 시 허용 동작:
1. draft 상태에서 refresh-targets
2. run 재생성

금지:
- live master 재조회 기반 과거결과 재산출

---

## 9) API 설계 (권장)

- `GET /pay/employee-profiles`
- `POST /pay/employee-profiles/batch`
- `GET /pay/employee-profiles/{id}`
- `GET /pay/variable-inputs`
- `POST /pay/variable-inputs/batch`
- `GET /pay/runs`
- `POST /pay/runs`
- `GET /pay/runs/{id}`
- `GET /pay/runs/{id}/employees`
- `GET /pay/runs/{id}/employees/{runEmployeeId}`
- `POST /pay/runs/{id}/refresh-targets`
- `POST /pay/runs/{id}/calculate`
- `POST /pay/runs/{id}/recalculate`
- `POST /pay/runs/{id}/close`
- `POST /pay/runs/{id}/mark-paid`
- `GET /pay/runs/{id}/events`
- `GET /pay/runs/{id}/export/excel`
- `GET /pay/payslips`

권한 기본선:
- 최소 `payroll_mgr` 또는 `admin`
- 위험 액션(`close`, `mark-paid`)은 추후 세분화

---

## 10) 작업 파일 범위

### Backend
- `backend/app/models/entities.py`
- `backend/app/schemas/pay_employee_profile_schema.py`
- `backend/app/schemas/pay_variable_input_schema.py`
- `backend/app/schemas/payroll_run_schema.py`
- `backend/app/services/pay_employee_profile_service.py`
- `backend/app/services/pay_variable_input_service.py`
- `backend/app/services/pay_engine_service.py`
- `backend/app/services/payroll_run_service.py`
- `backend/app/api/pay_employee_profile.py`
- `backend/app/api/pay_variable_input.py`
- `backend/app/api/payroll_run.py`
- `backend/app/main.py` (router include)
- bootstrap/seed 최소 테스트 데이터

### Frontend
- `frontend/src/app/payroll/employee-profiles/page.tsx`
- `frontend/src/app/payroll/employee-profiles/[id]/page.tsx`
- `frontend/src/app/payroll/variable-inputs/page.tsx`
- `frontend/src/app/payroll/runs/page.tsx`
- `frontend/src/app/payroll/runs/[id]/page.tsx`
- `frontend/src/app/payroll/payslips/page.tsx`
- `frontend/src/components/payroll/*` (필요 컴포넌트)
- `config/grid-screens.json`

---

## 11) 개발 순서 (실행 플로우)

1. DB 테이블/인덱스/제약 추가  
2. 직원 급여프로필 API + 화면  
3. 월 변동입력 API + 화면  
4. run 헤더/상세 API  
5. 계산 엔진(v1)  
6. run 상세 검토 화면  
7. 마감/지급 처리  
8. 명세서 조회/출력  
9. 테스트 가이드/문서 갱신

---

## 12) 금지사항

- V1에서 formula parser 구현 금지
- closed run 덮어쓰기 수정 금지
- 과거 run 결과를 live master 재조회로 흔들기 금지
- 금액 컬럼 float 사용 금지
- UI 숨김으로 권한 대체 금지
- AG Grid 표준 미준수 커스텀 패턴 금지
- 문서 갱신 없는 스키마/API/화면 추가 금지

---

## 13) 산출물/완료 기준 (DoD)

### 필수 산출
- 사원별 요약:
  - `gross_pay`
  - `non_taxable_pay`
  - `taxable_pay`
  - `deduction_total`
  - `net_pay`
- 항목별 상세 + source snapshot
- run event/audit 기록

### 품질 게이트
- `npm run validate:grid` 통과
- `npm run lint` 통과
- `npm run build` 통과
- `PAYROLL_TEST_GUIDE.md` Phase 2 시나리오 확장

---

## 14) 다음 즉시 액션 (착수안)

- [ ] A-1: DB DDL 초안 + ERD 드래프트 작성
- [ ] A-2: API 스펙 초안 (request/response 예시 포함)
- [ ] A-3: 계산 의사코드/정책버전 정의서 작성
- [ ] A-4: `/payroll/employee-profiles` 화면부터 1차 구현 시작

---

## 부록) AI 작업 지시문 (요약본)

- 정기급여 V1 구현
- 직원 급여프로필/월 변동입력/급여 run/계산결과 저장/마감/명세서 조회 개발
- formula/상여/연차수당/퇴직정산 제외
- 프록시 구조 유지
- Service 계층 중심 구현
- AG Grid standard-v2 준수
- 서버 권한 검증 필수
- batch 저장 순서(DELETE->UPDATE->INSERT) 준수
- snapshot 원칙 준수
- 테스트/문서 갱신 포함
