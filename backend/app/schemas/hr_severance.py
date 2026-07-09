from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


# ── 퇴직금 산정 ──


class HrSeveranceWageDetailItem(BaseModel):
    """산정 근거 상세: 3개월 임금 항목 내역."""

    item_code: str
    item_name: str | None = None
    include_type: str
    raw_amount: float
    included_amount: float


class HrSeveranceCalcItem(BaseModel):
    id: int
    retire_case_id: int
    employee_id: int
    employee_no: str | None = None
    employee_name: str | None = None
    department_name: str | None = None
    hire_date: date
    retire_date: date
    service_days: int
    avg_wage_base_from: date | None = None
    avg_wage_base_to: date | None = None
    wage_total_3m: float
    base_days_3m: int
    avg_daily_wage: float
    severance_amount: float
    adjustment_amount: float
    adjustment_reason: str | None = None
    final_amount: float
    status: str
    warning: str | None = None
    calculated_at: datetime | None = None
    confirmed_by: int | None = None
    confirmed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class HrSeveranceCalcListResponse(BaseModel):
    items: list[HrSeveranceCalcItem]
    total_count: int
    page: int
    limit: int


class HrSeveranceCalcDetailResponse(BaseModel):
    calc: HrSeveranceCalcItem
    wage_details: list[HrSeveranceWageDetailItem]


class HrSeveranceAdjustmentUpdateRequest(BaseModel):
    adjustment_amount: float
    adjustment_reason: str = Field(min_length=1, max_length=500)


class HrSeveranceConfirmResponse(BaseModel):
    calc: HrSeveranceCalcItem


# ── 평균임금 산입 규칙 ──


class PaySeveranceItemRuleItem(BaseModel):
    id: int
    pay_item_code: str
    pay_item_name: str | None = None
    include_type: str
    note: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PaySeveranceItemRuleListResponse(BaseModel):
    items: list[PaySeveranceItemRuleItem]
    total_count: int


class PaySeveranceItemRuleBatchItem(BaseModel):
    id: int | None = None
    pay_item_code: str = Field(min_length=1, max_length=30)
    include_type: str = Field(pattern="^(full|prorate_12|exclude)$")
    note: str | None = Field(default=None, max_length=200)
    is_active: bool = True


class PaySeveranceItemRuleBatchRequest(BaseModel):
    items: list[PaySeveranceItemRuleBatchItem]
    delete_ids: list[int] = []


class PaySeveranceItemRuleBatchResponse(BaseModel):
    items: list[PaySeveranceItemRuleItem]
    total_count: int
    inserted_count: int
    updated_count: int
    deleted_count: int
