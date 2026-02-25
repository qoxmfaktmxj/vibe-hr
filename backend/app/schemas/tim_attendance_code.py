from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class TimAttendanceCodeItem(BaseModel):
    id: int
    code: str
    name: str
    category: str
    unit: str
    is_requestable: bool
    min_days: float | None = None
    max_days: float | None = None
    deduct_annual: bool
    is_active: bool
    sort_order: int
    description: str | None = None
    created_at: datetime
    updated_at: datetime


class TimAttendanceCodeListResponse(BaseModel):
    items: list[TimAttendanceCodeItem]
    total_count: int


class TimAttendanceCodeBatchItem(BaseModel):
    id: int | None = None
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=100)
    category: str = Field(pattern="^(leave|work|special)$")
    unit: str = Field(default="day", pattern="^(day|am|pm|hour)$")
    is_requestable: bool = True
    min_days: float | None = None
    max_days: float | None = None
    deduct_annual: bool = False
    is_active: bool = True
    sort_order: int = 0
    description: str | None = Field(default=None, max_length=200)


class TimAttendanceCodeBatchRequest(BaseModel):
    items: list[TimAttendanceCodeBatchItem]
    delete_ids: list[int] = []


class TimAttendanceCodeBatchResponse(BaseModel):
    items: list[TimAttendanceCodeItem]
    total_count: int
    inserted_count: int
    updated_count: int
    deleted_count: int
