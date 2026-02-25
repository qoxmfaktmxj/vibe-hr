from __future__ import annotations

from pydantic import BaseModel


class TimStatusCount(BaseModel):
    present: int
    late: int
    absent: int
    leave: int
    remote: int


class TimDepartmentSummaryItem(BaseModel):
    department_id: int
    department_name: str
    attendance_count: int
    present_rate: float
    late_rate: float
    absent_rate: float


class TimLeaveTypeSummaryItem(BaseModel):
    leave_type: str
    request_count: int
    approved_count: int
    pending_count: int


class TimReportSummaryResponse(BaseModel):
    start_date: str
    end_date: str
    total_attendance_records: int
    total_leave_requests: int
    status_counts: TimStatusCount
    department_summaries: list[TimDepartmentSummaryItem]
    leave_type_summaries: list[TimLeaveTypeSummaryItem]
