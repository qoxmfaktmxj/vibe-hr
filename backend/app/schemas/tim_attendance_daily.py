from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class TimAttendanceDailyItem(BaseModel):
    id: int
    employee_id: int
    employee_no: str
    employee_name: str
    department_id: int
    department_name: str
    work_date: date
    check_in_at: datetime | None = None
    check_out_at: datetime | None = None
    worked_minutes: int | None = None
    attendance_status: str


class TimAttendanceDailyListResponse(BaseModel):
    items: list[TimAttendanceDailyItem]
    total_count: int
    page: int
    limit: int
    total_pages: int


class TimAttendanceTodayResponse(BaseModel):
    item: TimAttendanceDailyItem | None = None


class TimCheckInOutRequest(BaseModel):
    employee_id: int | None = None


class TimTodayScheduleItem(BaseModel):
    work_date: date
    day_type: str
    schedule_code: str
    schedule_name: str
    work_start: str
    work_end: str
    break_minutes: int
    work_hours: float
    is_holiday: bool = False
    holiday_name: str | None = None


class TimTodayDerivedItem(BaseModel):
    is_late: bool
    overtime_minutes: int
    is_weekend_work: bool


class TimTodayScheduleResponse(BaseModel):
    schedule: TimTodayScheduleItem
    attendance: TimAttendanceDailyItem | None = None
    derived: TimTodayDerivedItem


class TimAttendanceCorrectRequest(BaseModel):
    new_status: str
    reason: str = Field(min_length=1, max_length=500)
    new_check_in_at: datetime | None = None
    new_check_out_at: datetime | None = None


class TimAttendanceCorrectionItem(BaseModel):
    id: int
    attendance_id: int
    corrected_by_employee_id: int
    old_status: str
    new_status: str
    old_check_in_at: datetime | None = None
    new_check_in_at: datetime | None = None
    old_check_out_at: datetime | None = None
    new_check_out_at: datetime | None = None
    reason: str
    corrected_at: datetime


class TimAttendanceCorrectionListResponse(BaseModel):
    corrections: list[TimAttendanceCorrectionItem]
    total_count: int
