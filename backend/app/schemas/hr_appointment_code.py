from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class HrAppointmentCodeItem(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    is_active: bool
    sort_order: int
    mapping_key: str | None = None
    mapping_value: str | None = None
    created_at: datetime
    updated_at: datetime


class HrAppointmentCodeListResponse(BaseModel):
    items: list[HrAppointmentCodeItem]


class HrAppointmentCodeDetailResponse(BaseModel):
    item: HrAppointmentCodeItem


class HrAppointmentCodeCreateRequest(BaseModel):
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    is_active: bool = True
    sort_order: int = 0
    mapping_key: str | None = Field(default=None, max_length=200)
    mapping_value: str | None = Field(default=None, max_length=200)


class HrAppointmentCodeUpdateRequest(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=30)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    mapping_key: str | None = Field(default=None, max_length=200)
    mapping_value: str | None = Field(default=None, max_length=200)

