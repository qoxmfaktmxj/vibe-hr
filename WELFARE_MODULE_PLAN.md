# 사내복리후생(WEL) 모듈 구현 계획

## 개요

복리후생 신청 → 승인 → 급여 자동 반영 파이프라인을 구현한다.

- **모듈 코드**: `WEL` (Welfare)
- **DB 테이블 prefix**: `wel_`
- **공통 패턴**: 기준관리(Setup) → 신청(Request) → 승인(Approve) → 급여연동(PayLink)

### 핵심 원칙
> 복리후생 신청이 **승인** 상태가 되면, 해당 항목이 **해당 월 급여 공제/지급 항목**으로 자동 등록된다.
> - `is_deduction = True` → `pay_items`에 공제 항목으로 연결
> - `is_deduction = False` → `pay_items`에 지급 항목으로 연결

---

## Phase 1: 공통 기반 테이블 (1개)

### `wel_benefit_types` — 복리후생 유형 마스터

```python
class WelBenefitType(SQLModel, table=True):
    __tablename__ = "wel_benefit_types"
    id: Optional[int]
    code: str          # "SCHOLARSHIP", "CONDOLENCE", "MEDICAL", "LOAN", "PENSION",
                       # "RESORT", "CLUB", "HEALTH_CHECK"
    name: str          # "학자금", "경조금", "의료비", ...
    module_path: str   # "/wel/scholarship", "/wel/condolence", ...
    is_deduction: bool # 공제(True) or 지급(False)
    pay_item_code: str # 연계될 급여 항목 코드 (예: "SCHOLARSHIP_GRANT")
    is_active: bool
    sort_order: int
```

---

## Phase 2: 세부 모듈 (7개 복리후생 유형)

---

### 2-1. 학자금 (SCHOLARSHIP)

#### DB 테이블

**`wel_scholarship_setups`** — 학자금 기준관리
```
- id, year (지급 연도), semester (1/2학기)
- school_level: str  # "elem", "middle", "high", "univ"
- max_amount: int    # 최대 지원금액
- is_active, valid_from, valid_to
- created_at, updated_at
```

**`wel_scholarship_requests`** — 학자금 신청
```
- id, employee_id, setup_id
- school_name, school_level, student_name, relation  # 자녀 등 피부양자
- tuition_amount: int          # 신청 금액
- apply_ym: str (YYYYMM)       # 급여 반영 월
- request_status: "pending" | "approved" | "rejected" | "cancelled"
- approver_employee_id, approved_at, decision_comment
- pay_slip_applied: bool        # 급여명세에 반영됐는지 여부
- created_at, updated_at
```

#### 급여 연동
- 승인 시: `apply_ym` 해당 월 급여에 `SCHOLARSHIP_GRANT` **지급** 항목으로 등록
- `is_deduction = False`

---

### 2-2. 경조금 (CONDOLENCE)

#### DB 테이블

**`wel_condolence_setups`** — 경조금 기준관리
```
- id, event_code: str    # "MARRIAGE", "BIRTH", "DEATH_PARENT", "DEATH_SPOUSE", ...
- event_name: str
- amount: int            # 기준 지급액
- paid_leave_days: float # 경조휴가 일수
- is_active
```

**`wel_condolence_requests`** — 경조금 신청
```
- id, employee_id, setup_id
- event_date: date
- relation: str          # 관계 (본인/배우자/부/모/자녀 ...)
- apply_ym: str (YYYYMM)
- request_status, approver_employee_id, approved_at, decision_comment
- pay_slip_applied: bool
- created_at, updated_at
```

#### 급여 연동
- 승인 시: `apply_ym` 해당 월 급여에 `CONDOLENCE_GRANT` **지급** 항목으로 등록
- `is_deduction = False`

---

### 2-3. 의료비 (MEDICAL)

#### DB 테이블

**`wel_disease_codes`** — 질병코드 관리
```
- id, code: str, name: str
- category: str     # "일반", "중증", "만성" 등
- is_active
```

**`wel_medical_setups`** — 의료비 기준관리
```
- id, year
- disease_category: str   # 질병 카테고리 or "ALL"
- coverage_rate: float    # 지원율 (0.0~1.0), 예: 0.8 = 80% 지원
- max_amount: int         # 연간 최대 지원 한도
- is_active
```

**`wel_medical_requests`** — 의료비 신청
```
- id, employee_id, setup_id, disease_code_id
- treatment_date: date
- hospital_name: str
- total_amount: int        # 진료비 총액
- apply_amount: int        # 신청 금액 (지원율 적용)
- apply_ym: str (YYYYMM)
- request_status, approver_employee_id, approved_at, decision_comment
- pay_slip_applied: bool
- created_at, updated_at
```

#### 급여 연동
- 승인 시: `apply_ym` 해당 월 급여에 `MEDICAL_GRANT` **지급** 항목으로 등록
- `is_deduction = False`

---

### 2-4. 사내대출 (LOAN)

> 사내대출은 **공제** 항목 (원금상환 + 이자를 매월 급여에서 차감)

#### DB 테이블

**`wel_loan_setups`** — 사내대출 기준관리
```
- id, year
- max_amount: int          # 최대 대출 한도
- interest_rate: float     # 연이율 (예: 0.03 = 3%)
- max_months: int          # 최대 상환 기간 (개월)
- is_active
```

**`wel_loan_requests`** — 사내대출 신청
```
- id, employee_id, setup_id
- loan_amount: int         # 대출 신청 금액
- repayment_months: int    # 상환 기간 (개월)
- loan_start_ym: str       # 대출 시작 월 (YYYYMM)
- monthly_principal: int   # 월 원금상환액 (자동 계산)
- request_status, approver_employee_id, approved_at, decision_comment
- is_completed: bool       # 상환 완료 여부
- created_at, updated_at
```

**`wel_loan_repayments`** — 대출 상환 내역 (매월 자동 생성)
```
- id, loan_request_id, employee_id
- repay_ym: str (YYYYMM)
- principal_amount: int    # 원금
- interest_amount: int     # 이자
- total_amount: int        # 합계
- pay_slip_applied: bool
- created_at
```

**`wel_loan_repayment_requests`** — 사내대출 상환신청 (중도상환)
```
- id, loan_request_id, employee_id
- repay_amount: int        # 중도상환 금액
- apply_ym: str
- request_status, approver_employee_id, approved_at
- created_at, updated_at
```

#### 급여 연동
- 매월 이자생성: `wel_loan_repayments` 생성 → 해당 월 급여에 `LOAN_REPAY` **공제** 항목
- `is_deduction = True`

---

### 2-5. 개인연금 (PENSION)

#### DB 테이블

**`wel_pension_setups`** — 개인연금 기준관리
```
- id, year
- company_contribution_rate: float  # 회사 납입 비율 (예: 0.5 = 직원 부담의 50%)
- max_company_amount: int           # 월 최대 회사 기여금
- is_active
```

**`wel_pension_requests`** — 개인연금 신청 (가입 신청)
```
- id, employee_id, setup_id
- pension_company: str        # 연금 운용사
- account_no: str             # 계좌번호
- employee_monthly_amount: int  # 직원 월 납입액 (급여에서 공제)
- company_monthly_amount: int   # 회사 기여금 (자동 계산)
- start_ym: str
- request_status, approver_employee_id, approved_at
- is_active: bool             # 가입 중 여부
- created_at, updated_at
```

#### 급여 연동
- 승인 후 매월: `PENSION_DEDUCT` **공제** 항목으로 `employee_monthly_amount` 차감
- `is_deduction = True`

---

### 2-6. 리조트 (RESORT)

#### DB 테이블

**`wel_resorts`** — 리조트 관리
```
- id, resort_name, location, room_type, capacity
- check_in_time, check_out_time
- is_active
```

**`wel_resort_peak_seasons`** — 성수기 리조트 관리
```
- id, resort_id, season_name
- peak_from: date, peak_to: date
- available_count: int   # 성수기 배정 가능 룸 수
- priority_rule: str     # 배정 우선순위 ("lottery", "first_come", "seniority")
- is_active
```

**`wel_resort_targets`** — 리조트 지원대상자
```
- id, resort_id, year
- employee_id, eligible_count: int   # 연간 이용 가능 횟수
- used_count: int
```

**`wel_resort_requests`** — 리조트 신청
```
- id, employee_id, resort_id
- check_in_date: date, check_out_date: date
- nights: int, guest_count: int
- is_peak_season: bool
- request_status, approver_employee_id, approved_at, decision_comment
- created_at, updated_at
```

#### 급여 연동
- 리조트는 현물복리후생 → 급여 연동 없음 (또는 선택적 자부담 공제 설정 가능)

---

### 2-7. 동호회 (CLUB)

#### DB 테이블

**`wel_clubs`** — 동호회 관리
```
- id, club_name, club_code
- category: str            # "운동", "문화", "취미" 등
- max_members: int
- monthly_grant_amount: int  # 월 지원금액
- monthly_deduction_amount: int  # 월 회원 공제액 (급여 공제)
- is_active, established_date
```

**`wel_club_memberships`** — 동호회 가입/탈퇴 신청
```
- id, club_id, employee_id
- action_type: "join" | "leave"
- request_status, approver_employee_id, approved_at
- effective_ym: str   # 적용 시작/종료 월
- created_at, updated_at
```

**`wel_club_deduction_consents`** — 급여공제 동의 이력
```
- id, club_id, employee_id
- consent_type: "agree" | "revoke"
- consented_at: datetime
```

**`wel_club_re_registrations`** — 동호회 (재)등록 신청 (연간 갱신)
```
- id, club_id, employee_id, year
- request_status, approver_employee_id, approved_at
- created_at, updated_at
```

**`wel_club_grants`** — 동호회 지원금 신청
```
- id, club_id, apply_ym
- amount: int
- request_status, approver_employee_id, approved_at
- pay_slip_applied: bool
- created_at, updated_at
```

#### 급여 연동
- 승인된 멤버십 → 매월 `CLUB_DEDUCT` **공제** 항목으로 `monthly_deduction_amount` 차감
- `is_deduction = True`

---

### 2-8. 건강검진 (HEALTH_CHECK)

#### DB 테이블

**`wel_health_check_setups`** — 건강검진 기준관리
```
- id, year
- check_type: str     # "일반", "정밀", "종합"
- target_gender: str  # "all", "male", "female"
- age_from, age_to: int
- max_amount: int
- is_active
```

**`wel_health_check_targets`** — 건강검진 대상자 관리
```
- id, setup_id, employee_id, year
- scheduled_date: date
- is_completed: bool
- completed_date: date
- note
```

> 건강검진은 신청/승인 흐름 없이 회사가 대상자를 관리하는 방식 → 급여 연동 없음

---

## Phase 3: 공통 급여 연동 서비스

### `wel_pay_link_service.py`

```python
def apply_welfare_to_payslip(
    session: Session,
    *,
    employee_id: int,
    apply_ym: str,        # "202601"
    benefit_type: str,    # "SCHOLARSHIP", "CONDOLENCE", ...
    amount: int,
    source_request_id: int,
    is_deduction: bool,
) -> None:
    """복리후생 승인 시 해당 월 급여 공제/지급 항목에 자동 등록."""
    # 1. pay_item_code 조회 (WelBenefitType.pay_item_code)
    # 2. 해당 월 PaySlip이 없으면 DRAFT 상태로 생성
    # 3. PaySlipDetail에 공제 또는 지급 항목으로 추가
    # 4. 원천에 pay_slip_applied = True 마킹
```

---

## Phase 4: Backend API 구조

각 모듈별 표준 엔드포인트:

```
GET    /api/v1/wel/{module}/setup           → 기준 조회
POST   /api/v1/wel/{module}/setup/batch     → 기준 저장 (AG Grid 배치)

GET    /api/v1/wel/{module}/requests        → 신청 목록 (my + admin 필터)
POST   /api/v1/wel/{module}/requests        → 신청 생성
DELETE /api/v1/wel/{module}/requests/{id}   → 신청 취소

POST   /api/v1/wel/{module}/requests/{id}/approve  → 승인
POST   /api/v1/wel/{module}/requests/{id}/reject   → 반려
```

사내대출 추가:
```
GET  /api/v1/wel/loan/repayments            → 상환 내역 조회
POST /api/v1/wel/loan/interest-generate     → 이자 생성 (월말 배치)
```

---

## Phase 5: Frontend 화면 구조

| 메뉴 경로 | 컴포넌트 | 특이사항 |
|-----------|----------|----------|
| `/wel/scholarship/setup` | 학자금기준관리 | AG Grid 배치 저장 |
| `/wel/scholarship/requests` | 학자금신청 | 개인 신청 폼 |
| `/wel/scholarship/approval` | 학자금승인 | 관리자 승인 그리드 |
| `/wel/condolence/setup` | 경조금기준관리 | 이벤트 유형별 금액 설정 |
| `/wel/condolence/requests` | 경조금신청 | |
| `/wel/condolence/approval` | 경조금승인 | |
| `/wel/medical/disease-codes` | 질병코드관리 | AG Grid |
| `/wel/medical/setup` | 의료비기준관리 | |
| `/wel/medical/requests` | 의료비신청 | |
| `/wel/medical/approval` | 의료비승인 | |
| `/wel/loan/setup` | 사내대출기준관리 | |
| `/wel/loan/requests` | 사내대출신청 | |
| `/wel/loan/approval` | 사내대출승인 | |
| `/wel/loan/repayment-requests` | 사내대출상환신청 | 중도상환 |
| `/wel/loan/repayment-approval` | 사내대출상환승인 | |
| `/wel/loan/interest-manage` | 이자생성관리 | 월말 이자 배치 실행 |
| `/wel/pension/setup` | 개인연금기준관리 | |
| `/wel/pension/requests` | 개인연금신청 | |
| `/wel/pension/approval` | 개인연금승인 | |
| `/wel/pension/status` | 개인연금현황 | 전 직원 가입 현황 |
| `/wel/resort/manage` | 리조트관리 | |
| `/wel/resort/peak` | 성수기리조트관리 | |
| `/wel/resort/targets` | 리조트지원대상자 | |
| `/wel/resort/requests` | 리조트신청 | |
| `/wel/resort/approval` | 리조트승인 | |
| `/wel/club/manage` | 동호회관리 | |
| `/wel/club/membership-requests` | 동호회가입탈퇴신청 | |
| `/wel/club/membership-approval` | 동호회가입탈퇴승인 | |
| `/wel/club/deduction-consent` | 급여공제동의이력 | 조회 전용 |
| `/wel/club/re-registration` | 동호회(재)등록신청 | |
| `/wel/club/re-registration-approval` | 동호회(재)등록승인 | |
| `/wel/club/grant-requests` | 동호회지원금신청 | |
| `/wel/club/grant-approval` | 동호회지원금승인 | |
| `/wel/health-check/setup` | 건강검진기준관리 | |
| `/wel/health-check/targets` | 건강검진대상자관리 | |

---

## Phase 6: 급여 연동 흐름 상세

```
[복리후생 신청]
    ↓ 승인 (approver)
[wel_xxx_requests.request_status = "approved"]
    ↓ approve 서비스 내부
[apply_welfare_to_payslip() 호출]
    ↓
[PaySlip 해당 월 조회/생성 (DRAFT)]
    ↓
[PaySlipDetail 항목 추가]
    - is_deduction=True  → pay_type="deduction", pay_item_code="XXX_DEDUCT"
    - is_deduction=False → pay_type="payment",   pay_item_code="XXX_GRANT"
    ↓
[원천 레코드.pay_slip_applied = True]
```

### 급여 항목 코드 (pay_items) 추가 시드

| benefit_type | pay_item_code | pay_type | name |
|---|---|---|---|
| SCHOLARSHIP | SCHOLARSHIP_GRANT | payment | 학자금지원 |
| CONDOLENCE | CONDOLENCE_GRANT | payment | 경조금 |
| MEDICAL | MEDICAL_GRANT | payment | 의료비지원 |
| LOAN | LOAN_REPAY | deduction | 사내대출상환 |
| PENSION | PENSION_DEDUCT | deduction | 개인연금공제 |
| CLUB | CLUB_DEDUCT | deduction | 동호회회비공제 |

---

## 구현 우선순위

| 순위 | 모듈 | 이유 |
|------|------|------|
| 1 | 공통 기반 (WelBenefitType + 급여연동 서비스) | 모든 모듈의 전제 조건 |
| 2 | 경조금 | 단순 구조, 빠른 검증 |
| 3 | 학자금 | 사용 빈도 높음 |
| 4 | 의료비 | 질병코드 추가 필요 |
| 5 | 개인연금 | 매월 반복 공제 |
| 6 | 동호회 | 복잡한 멤버십 상태 |
| 7 | 사내대출 | 가장 복잡 (이자계산, 상환관리) |
| 8 | 리조트 | 급여 연동 없음 (독립) |
| 9 | 건강검진 | 대상자 관리만 |

---

## 완료 기준 (Definition of Done)

- [ ] DB 테이블 생성 (`create_all` 자동 적용)
- [ ] Bootstrap 시드 데이터 (WelBenefitType + pay_items 코드)
- [ ] Backend API 통합 테스트 (Swagger)
- [ ] 급여 연동 확인 (승인 후 PaySlipDetail 자동 생성)
- [ ] Frontend AG Grid 표준 7버튼 적용
- [ ] `npm run validate:grid` 통과
- [ ] `npm run lint && npm run build` 통과
