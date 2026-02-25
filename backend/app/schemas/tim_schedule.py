from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class TimScheduleGenerateRequest(BaseModel):
    target: str = "all"  # all | department | employee
    department_id: int | None = None
    employee_ids: list[int] | None = None
    date_from: date
    date_to: date
    mode: str = "create_if_missing"  # create_if_missing | overwrite


class TimScheduleGenerateResponse(BaseModel):
    created_count: int
    updated_count: int
    skipped_count: int
    version_tag: str


class TimScheduleTodayItem(BaseModel):
    employee_id: int
    work_date: date
    day_type: str
    schedule_source: str
    pattern_code: str | None
    pattern_name: str | None
    work_start: str | None
    work_end: str | None
    break_minutes: int
    expected_minutes: int
    is_holiday: bool
    holiday_name: str | None
    generated_at: datetime | None


class TimScheduleTodayResponse(BaseModel):
    item: TimScheduleTodayItem


class TimSchedulePatternItem(BaseModel):
    id: int
    code: str
    name: str


class TimSchedulePatternListResponse(BaseModel):
    items: list[TimSchedulePatternItem]
    total_count: int


class TimEmployeeScheduleExceptionItem(BaseModel):
    id: int
    employee_id: int
    pattern_id: int
    effective_from: date
    effective_to: date | None
    reason: str | None
    priority: int
    is_active: bool


class TimEmployeeScheduleExceptionListResponse(BaseModel):
    items: list[TimEmployeeScheduleExceptionItem]
    total_count: int


class TimEmployeeScheduleExceptionUpsertRequest(BaseModel):
    id: int | None = None
    employee_id: int
    pattern_id: int
    effective_from: date
    effective_to: date | None = None
    reason: str | None = None
    priority: int = 1000
    is_active: bool = True


class TimEmployeeScheduleExceptionBatchRequest(BaseModel):
    items: list[TimEmployeeScheduleExceptionUpsertRequest]
    delete_ids: list[int] = []


class TimEmployeeScheduleExceptionBatchResponse(BaseModel):
    items: list[TimEmployeeScheduleExceptionItem]
    total_count: int
    inserted_count: int
    updated_count: int
    deleted_count: int
