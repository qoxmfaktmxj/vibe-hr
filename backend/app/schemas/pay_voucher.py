from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


# ── GL 계정과목 ──


class GlAccountItem(BaseModel):
    id: int
    code: str
    name: str
    account_type: str
    is_net_pay_account: bool
    is_cash_account: bool
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class GlAccountListResponse(BaseModel):
    items: list[GlAccountItem]
    total_count: int


class GlAccountBatchItem(BaseModel):
    id: int | None = None
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=100)
    account_type: str = Field(pattern="^(expense|liability|asset|equity|revenue)$")
    is_net_pay_account: bool = False
    is_cash_account: bool = False
    is_active: bool = True
    sort_order: int = 0


class GlAccountBatchRequest(BaseModel):
    items: list[GlAccountBatchItem]
    delete_ids: list[int] = []


class GlAccountBatchResponse(BaseModel):
    items: list[GlAccountItem]
    total_count: int
    inserted_count: int
    updated_count: int
    deleted_count: int


# ── 급여항목 → 계정 매핑 ──


class PayGlMappingItem(BaseModel):
    id: int
    pay_item_code: str
    pay_item_name: str | None = None
    gl_account_code: str
    gl_account_name: str | None = None
    effective_from: date
    note: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PayGlMappingListResponse(BaseModel):
    items: list[PayGlMappingItem]
    total_count: int


class PayGlMappingBatchItem(BaseModel):
    id: int | None = None
    pay_item_code: str = Field(min_length=1, max_length=30)
    gl_account_code: str = Field(min_length=1, max_length=20)
    effective_from: date
    note: str | None = Field(default=None, max_length=200)
    is_active: bool = True


class PayGlMappingBatchRequest(BaseModel):
    items: list[PayGlMappingBatchItem]
    delete_ids: list[int] = []


class PayGlMappingBatchResponse(BaseModel):
    items: list[PayGlMappingItem]
    total_count: int
    inserted_count: int
    updated_count: int
    deleted_count: int


# ── 전표 ──


class PayVoucherLineItem(BaseModel):
    id: int
    line_no: int
    gl_account_code: str
    gl_account_name: str | None = None
    cost_center_code: str | None = None
    debit_amount: float
    credit_amount: float
    summary: str | None = None
    source_item_code: str | None = None
    created_at: datetime


class PayVoucherItem(BaseModel):
    id: int
    voucher_no: str
    run_id: int
    voucher_type: str
    year_month: str | None = None
    voucher_date: date
    status: str
    total_debit: float
    total_credit: float
    summary: str | None = None
    created_by: int | None = None
    confirmed_by: int | None = None
    confirmed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PayVoucherListResponse(BaseModel):
    items: list[PayVoucherItem]
    total_count: int


class PayVoucherDetailResponse(BaseModel):
    voucher: PayVoucherItem
    lines: list[PayVoucherLineItem]


class PayVoucherGenerateRequest(BaseModel):
    run_id: int


class PayVoucherGenerateDisbursementRequest(BaseModel):
    run_id: int


class PayVoucherActionResponse(BaseModel):
    voucher: PayVoucherItem


class MappingGapItem(BaseModel):
    item_code: str
    item_name: str | None = None
    direction: str


class MappingGapsResponse(BaseModel):
    run_id: int
    missing_item_codes: list[MappingGapItem]
