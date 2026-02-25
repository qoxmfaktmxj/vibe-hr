from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class TimAnnualLeaveItem(BaseModel):
    id: int
    employee_id: int
    employee_no: str
    employee_name: str
    year: int
    granted_days: float
    used_days: float
    carried_over_days: float
    remaining_days: float
    grant_type: str
    note: str | None = None


class TimAnnualLeaveResponse(BaseModel):
    item: TimAnnualLeaveItem


class TimAnnualLeaveAdjustRequest(BaseModel):
    employee_id: int
    year: int
    adjustment_days: float
    reason: str = Field(min_length=1, max_length=500)


class TimLeaveRequestItem(BaseModel):
    id: int
    employee_id: int
    employee_no: str
    employee_name: str
    department_name: str
    leave_type: str
    start_date: date
    end_date: date
    leave_days: float
    reason: str | None = None
    request_status: str
    approver_employee_id: int | None = None
    approved_at: datetime | None = None
    created_at: datetime


class TimLeaveRequestListResponse(BaseModel):
    items: list[TimLeaveRequestItem]
    total_count: int


class TimLeaveRequestCreateRequest(BaseModel):
    leave_type: str = Field(pattern="^(annual|sick|half_day|unpaid|other)$")
    start_date: date
    end_date: date
    reason: str = Field(min_length=1, max_length=500)


class TimLeaveDecisionRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)
