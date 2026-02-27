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
