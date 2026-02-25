from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class TimWorkScheduleCodeItem(BaseModel):
    id: int
    code: str
    name: str
    work_start: str
    work_end: str
    break_minutes: int
    is_overnight: bool
    work_hours: float
    is_active: bool
    sort_order: int
    description: str | None = None
    created_at: datetime
    updated_at: datetime


class TimWorkScheduleCodeListResponse(BaseModel):
    items: list[TimWorkScheduleCodeItem]
    total_count: int


class TimWorkScheduleCodeBatchItem(BaseModel):
    id: int | None = None
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=100)
    work_start: str = Field(pattern=r"^\d{2}:\d{2}$")
    work_end: str = Field(pattern=r"^\d{2}:\d{2}$")
    break_minutes: int = Field(default=60, ge=0)
    is_overnight: bool = False
    work_hours: float = Field(default=8.0, gt=0)
    is_active: bool = True
    sort_order: int = 0
    description: str | None = Field(default=None, max_length=200)


class TimWorkScheduleCodeBatchRequest(BaseModel):
    items: list[TimWorkScheduleCodeBatchItem]
    delete_ids: list[int] = []


class TimWorkScheduleCodeBatchResponse(BaseModel):
    items: list[TimWorkScheduleCodeItem]
    total_count: int
    inserted_count: int
    updated_count: int
    deleted_count: int
