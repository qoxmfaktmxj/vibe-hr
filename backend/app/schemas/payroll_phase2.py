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


# ── 셀프서비스 급여 조회 ──

class PayMyPayslipSummary(BaseModel):
    """본인 급여 이력 목록 아이템"""
    run_id: int
    run_employee_id: int
    year_month: str
    run_name: str | None = None
    run_status: str
    gross_pay: float
    taxable_income: float
    non_taxable_income: float
    total_deductions: float
    net_pay: float
    paid_at: datetime | None = None


class PayMyPayslipListResponse(BaseModel):
    items: list[PayMyPayslipSummary]
    total_count: int


class PayMyPayslipDetailResponse(BaseModel):
    summary: PayMyPayslipSummary
    items: list[PayPayrollRunEmployeeDetailItem]
