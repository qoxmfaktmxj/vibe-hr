from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class TimAnnualLeaveItem(BaseModel):
    id: int
    employee_id: int
    employee_no: str
    employee_name: str
    department_name: str | None = None
    year: int
    granted_days: float
    used_days: float
    carried_over_days: float
    remaining_days: float
    grant_type: str
    note: str | None = None


class TimAnnualLeaveResponse(BaseModel):
    item: TimAnnualLeaveItem


class TimAnnualLeaveListResponse(BaseModel):
    items: list[TimAnnualLeaveItem]
    total_count: int


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
    calendar_days: float   # 캘린더 일수 (end - start + 1), 표시용
    deduction_days: float  # 실제 차감 일수 (근무일 기준, 주말/공휴일 제외)
    leave_days: float      # deduction_days와 동일 (하위 호환 유지)
    reason: str | None = None
    request_status: str
    approver_employee_id: int | None = None
    approved_at: datetime | None = None
    decision_comment: str | None = None  # 반려/취소 처리자 코멘트
    decided_by: int | None = None        # 처리자 employee_id
    decided_at: datetime | None = None   # 처리 시각
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
