from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class PayEmployeeProfileItem(BaseModel):
    id: int
    employee_id: int
    employee_no: str | None = None
    employee_name: str | None = None
    payroll_code_id: int
    payroll_code_name: str | None = None
    item_group_id: int | None = None
    item_group_name: str | None = None
    base_salary: float
    pay_type_code: str
    payment_day_type: str
    payment_day_value: int | None = None
    holiday_adjustment: str
    effective_from: date
    effective_to: date | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PayEmployeeProfileListResponse(BaseModel):
    items: list[PayEmployeeProfileItem]
    total_count: int


class PayEmployeeProfileBatchItem(BaseModel):
    id: int | None = None
    employee_id: int
    payroll_code_id: int
    item_group_id: int | None = None
    base_salary: float = Field(default=0, ge=0)
    pay_type_code: str = Field(default="regular", min_length=1, max_length=20)
    payment_day_type: str = Field(default="fixed_day", pattern="^(fixed_day|month_end)$")
    payment_day_value: int | None = Field(default=None, ge=1, le=31)
    holiday_adjustment: str = Field(default="previous_business_day", pattern="^(previous_business_day|next_business_day|none)$")
    effective_from: date
    effective_to: date | None = None
    is_active: bool = True


class PayEmployeeProfileBatchRequest(BaseModel):
    items: list[PayEmployeeProfileBatchItem]
    delete_ids: list[int] = []


class PayEmployeeProfileBatchResponse(BaseModel):
    items: list[PayEmployeeProfileItem]
    total_count: int
    inserted_count: int
    updated_count: int
    deleted_count: int


class PayVariableInputItem(BaseModel):
    id: int
    year_month: str
    employee_id: int
    employee_no: str | None = None
    employee_name: str | None = None
    item_code: str
    item_name: str | None = None
    direction: str
    amount: float
    memo: str | None = None
    created_at: datetime
    updated_at: datetime


class PayVariableInputListResponse(BaseModel):
    items: list[PayVariableInputItem]
    total_count: int


class PayVariableInputBatchItem(BaseModel):
    id: int | None = None
    year_month: str = Field(pattern="^\\d{4}-(0[1-9]|1[0-2])$")
    employee_id: int
    item_code: str = Field(min_length=1, max_length=20)
    direction: str = Field(pattern="^(earning|deduction)$")
    amount: float
    memo: str | None = Field(default=None, max_length=200)


class PayVariableInputBatchRequest(BaseModel):
    items: list[PayVariableInputBatchItem]
    delete_ids: list[int] = []


class PayVariableInputBatchResponse(BaseModel):
    items: list[PayVariableInputItem]
    total_count: int
    inserted_count: int
    updated_count: int
    deleted_count: int


class PayPayrollRunItemSchema(BaseModel):
    id: int
    year_month: str
    payroll_code_id: int
    payroll_code_name: str | None = None
    run_name: str | None = None
    status: str
    total_employees: int
    total_gross: float
    total_deductions: float
    total_net: float
    calculated_at: datetime | None = None
    closed_at: datetime | None = None
    paid_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PayPayrollRunListResponse(BaseModel):
    items: list[PayPayrollRunItemSchema]
    total_count: int


class PayPayrollRunCreateRequest(BaseModel):
    year_month: str = Field(pattern="^\\d{4}-(0[1-9]|1[0-2])$")
    payroll_code_id: int
    run_name: str | None = Field(default=None, max_length=120)


class PayPayrollRunActionResponse(BaseModel):
    run: PayPayrollRunItemSchema


class PayPayrollRunEmployeeItem(BaseModel):
    id: int
    run_id: int
    employee_id: int
    employee_no: str | None = None
    employee_name: str | None = None
    profile_id: int | None = None
    gross_pay: float
    taxable_income: float
    non_taxable_income: float
    total_deductions: float
    net_pay: float
    status: str
    warning_message: str | None = None
    created_at: datetime
    updated_at: datetime


class PayPayrollRunEmployeeListResponse(BaseModel):
    items: list[PayPayrollRunEmployeeItem]
    total_count: int


class PayPayrollRunEmployeeDetailItem(BaseModel):
    id: int
    run_employee_id: int
    item_code: str
    item_name: str
    direction: str
    amount: float
    tax_type: str
    calculation_type: str
    source_type: str
    created_at: datetime


class PayPayrollRunEmployeeDetailResponse(BaseModel):
    employee: PayPayrollRunEmployeeItem
    items: list[PayPayrollRunEmployeeDetailItem]


class PayRunTargetSnapshotItem(BaseModel):
    """스냅샷: Run 생성 시점에 고정된 사원/프로필 데이터."""

    employee_id: int
    employee_no: str | None
    employee_name: str | None
    department_id: int | None
    department_name: str | None
    position_title: str | None
    hire_date: str | None
    employment_status: str | None
    retire_date: str | None
    profile_id: int | None
    payroll_code_id: int | None
    item_group_id: int | None
    base_salary: float | None
    pay_type_code: str | None
    payment_day_type: str | None
    payment_day_value: int | None
    holiday_adjustment: str | None
    effective_from: str | None
    effective_to: str | None
    period_start: str | None
    period_end: str | None
    event_count: int
    review_required: bool


class PayRunTargetEventItem(BaseModel):
    """대상자 이벤트: 스냅샷 수집 시 기록된 인사/발령/급여 이벤트."""

    id: int
    event_code: str
    event_name: str
    source_type: str
    source_table: str
    source_id: int | None
    effective_date: date
    decision_code: str
    payload_json: dict[str, object]
    created_at: datetime


class PayRunTargetDetailResponse(BaseModel):
    """사원 스냅샷 + 이벤트 목록."""

    snapshot: PayRunTargetSnapshotItem
    events: list[PayRunTargetEventItem]
