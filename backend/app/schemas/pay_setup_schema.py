from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


# -------------------------------------------------------------------------
# PayPayrollCode Schemas
# -------------------------------------------------------------------------
class PayPayrollCodeItem(BaseModel):
    id: int
    code: str
    name: str
    pay_type: str
    payment_day: str
    tax_deductible: bool
    social_ins_deductible: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PayPayrollCodeListResponse(BaseModel):
    items: list[PayPayrollCodeItem]
    total_count: int


class PayPayrollCodeBatchItem(BaseModel):
    id: int | None = None
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=100)
    pay_type: str = Field(min_length=1, max_length=20)
    payment_day: str = Field(min_length=1, max_length=20)
    tax_deductible: bool = True
    social_ins_deductible: bool = True
    is_active: bool = True


class PayPayrollCodeBatchRequest(BaseModel):
    items: list[PayPayrollCodeBatchItem]
    delete_ids: list[int] = []


class PayPayrollCodeBatchResponse(BaseModel):
    items: list[PayPayrollCodeItem]
    total_count: int
    inserted_count: int
    updated_count: int
    deleted_count: int


# -------------------------------------------------------------------------
# PayTaxRate Schemas
# -------------------------------------------------------------------------
class PayTaxRateItem(BaseModel):
    id: int
    year: int
    rate_type: str
    employee_rate: float | None = None
    employer_rate: float | None = None
    min_limit: int | None = None
    max_limit: int | None = None
    created_at: datetime
    updated_at: datetime


class PayTaxRateListResponse(BaseModel):
    items: list[PayTaxRateItem]
    total_count: int


class PayTaxRateBatchItem(BaseModel):
    id: int | None = None
    year: int
    rate_type: str = Field(min_length=1, max_length=50)
    employee_rate: float | None = None
    employer_rate: float | None = None
    min_limit: int | None = None
    max_limit: int | None = None


class PayTaxRateBatchRequest(BaseModel):
    items: list[PayTaxRateBatchItem]
    delete_ids: list[int] = []


class PayTaxRateBatchResponse(BaseModel):
    items: list[PayTaxRateItem]
    total_count: int
    inserted_count: int
    updated_count: int
    deleted_count: int


# -------------------------------------------------------------------------
# PayAllowanceDeduction Schemas
# -------------------------------------------------------------------------
class PayAllowanceDeductionItem(BaseModel):
    id: int
    code: str
    name: str
    type: str # "allowance" | "deduction"
    tax_type: str # "taxable" | "non-taxable" | "tax" | "insurance"
    calculation_type: str # "fixed" | "hourly" | "formula"
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class PayAllowanceDeductionListResponse(BaseModel):
    items: list[PayAllowanceDeductionItem]
    total_count: int


class PayAllowanceDeductionBatchItem(BaseModel):
    id: int | None = None
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=100)
    type: str = Field(pattern="^(allowance|deduction)$")
    tax_type: str = Field(pattern="^(taxable|non-taxable|tax|insurance)$")
    calculation_type: str = Field(default="fixed", pattern="^(fixed|hourly|formula)$")
    is_active: bool = True
    sort_order: int = 0


class PayAllowanceDeductionBatchRequest(BaseModel):
    items: list[PayAllowanceDeductionBatchItem]
    delete_ids: list[int] = []


class PayAllowanceDeductionBatchResponse(BaseModel):
    items: list[PayAllowanceDeductionItem]
    total_count: int
    inserted_count: int
    updated_count: int
    deleted_count: int


# -------------------------------------------------------------------------
# PayItemGroup & Detail Schemas
# -------------------------------------------------------------------------
class PayItemGroupDetailItem(BaseModel):
    id: int
    group_id: int
    item_id: int
    type: str
    created_at: datetime


class PayItemGroupItem(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PayItemGroupWithDetailsItem(PayItemGroupItem):
    details: list[PayItemGroupDetailItem] = []


class PayItemGroupListResponse(BaseModel):
    items: list[PayItemGroupWithDetailsItem]
    total_count: int


class PayItemGroupDetailBatchItem(BaseModel):
    id: int | None = None
    item_id: int
    type: str = Field(pattern="^(allowance|deduction)$")


class PayItemGroupBatchItem(BaseModel):
    id: int | None = None
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=200)
    is_active: bool = True
    # If submitting details alongside group creation/update
    details: list[PayItemGroupDetailBatchItem] | None = None


class PayItemGroupBatchRequest(BaseModel):
    items: list[PayItemGroupBatchItem]
    delete_ids: list[int] = []


class PayItemGroupBatchResponse(BaseModel):
    items: list[PayItemGroupWithDetailsItem]
    total_count: int
    inserted_count: int
    updated_count: int
    deleted_count: int
