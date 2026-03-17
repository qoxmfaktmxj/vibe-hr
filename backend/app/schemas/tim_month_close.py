from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class TimMonthCloseItem(BaseModel):
    id: int | None
    year: int
    month: int
    close_status: str  # 'open' | 'closed'
    employee_count: int
    present_days: int
    absent_days: int
    late_days: int
    leave_days: int
    # ── 근무시간 집계 (분 단위) ──
    total_overtime_minutes: int = 0
    total_night_minutes: int = 0
    total_holiday_work_minutes: int = 0
    total_holiday_overtime_minutes: int = 0
    total_holiday_night_minutes: int = 0
    closed_by: int | None
    closed_by_name: str | None
    closed_at: datetime | None
    reopened_by: int | None
    reopened_by_name: str | None
    reopened_at: datetime | None
    note: str | None
    created_at: datetime | None
    updated_at: datetime | None


class TimMonthCloseListResponse(BaseModel):
    items: list[TimMonthCloseItem]
    year: int
    total_count: int


class TimMonthCloseRequest(BaseModel):
    """마감 요청 본문: year, month, note"""
    year: int
    month: int
    note: str | None = None


class TimMonthCloseActionResponse(BaseModel):
    item: TimMonthCloseItem
