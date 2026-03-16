from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class TimMonthCloseItem(BaseModel):
    id: int
    year: int
    month: int
    close_status: str          # open | closed
    employee_count: int
    present_days: int
    absent_days: int
    late_days: int
    leave_days: int
    closed_by: int | None
    closed_by_name: str | None
    closed_at: datetime | None
    reopened_by: int | None
    reopened_by_name: str | None
    reopened_at: datetime | None
    note: str | None
    created_at: datetime
    updated_at: datetime


class TimMonthCloseListResponse(BaseModel):
    items: list[TimMonthCloseItem]
    total_count: int


class TimMonthCloseRequest(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    note: str | None = Field(default=None, max_length=500)


class TimMonthReopenRequest(BaseModel):
    note: str | None = Field(default=None, max_length=500)
