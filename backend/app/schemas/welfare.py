from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class WelBenefitTypeItem(BaseModel):
    id: int
    code: str
    name: str
    module_path: str
    is_deduction: bool
    pay_item_code: Optional[str]
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class WelBenefitTypeListResponse(BaseModel):
    items: list[WelBenefitTypeItem]
    total_count: int
    page: int
    limit: int


class WelBenefitRequestItem(BaseModel):
    id: int
    request_no: str
    benefit_type_code: str
    benefit_type_name: str
    employee_no: str
    employee_name: str
    department_name: str
    status_code: str
    requested_amount: int
    approved_amount: Optional[int]
    payroll_run_label: Optional[str]
    description: Optional[str]
    requested_at: datetime
    approved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class WelBenefitRequestListResponse(BaseModel):
    items: list[WelBenefitRequestItem]
    total_count: int
    page: int
    limit: int


class WelBenefitTypeRowInput(BaseModel):
    id: Optional[int] = None
    code: str
    name: str
    module_path: str
    is_deduction: bool = False
    pay_item_code: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0
    _status: str = "clean"


class WelBenefitTypeBatchRequest(BaseModel):
    items: list[WelBenefitTypeRowInput]


class WelBenefitTypeBatchResponse(BaseModel):
    created: int
    updated: int
    deleted: int


class WelBenefitRequestCreateRequest(BaseModel):
    benefit_type_code: str
    requested_amount: int
    description: Optional[str] = None


class WelBenefitRequestApproveRequest(BaseModel):
    approved_amount: int
    note: Optional[str] = None


class WelBenefitRequestRejectRequest(BaseModel):
    reason: Optional[str] = None


class WelBenefitRequestActionResponse(BaseModel):
    item: WelBenefitRequestItem
