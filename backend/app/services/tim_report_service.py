from __future__ import annotations

from datetime import date

from sqlmodel import Session, select

from app.models import HrAttendanceDaily, HrEmployee, HrLeaveRequest, OrgDepartment
from app.schemas.tim_report import (
    TimDepartmentSummaryItem,
    TimLeaveTypeSummaryItem,
    TimReportSummaryResponse,
    TimStatusCount,
)


def get_tim_report_summary(session: Session, start_date: date, end_date: date) -> TimReportSummaryResponse:
    attendance_rows = session.exec(
        select(HrAttendanceDaily, HrEmployee, OrgDepartment)
        .join(HrEmployee, HrAttendanceDaily.employee_id == HrEmployee.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrAttendanceDaily.work_date >= start_date, HrAttendanceDaily.work_date <= end_date)
    ).all()

    leave_rows = session.exec(
        select(HrLeaveRequest)
        .where(HrLeaveRequest.start_date <= end_date, HrLeaveRequest.end_date >= start_date)
    ).all()

    status_counts = {"present": 0, "late": 0, "absent": 0, "leave": 0, "remote": 0}
    by_department: dict[int, dict[str, float]] = {}

    for attendance, employee, department in attendance_rows:
        if attendance.attendance_status in status_counts:
            status_counts[attendance.attendance_status] += 1

        bucket = by_department.setdefault(
            department.id,
            {
                "department_id": department.id,
                "department_name": department.name,
                "attendance_count": 0,
                "present": 0,
                "late": 0,
                "absent": 0,
            },
        )
        bucket["attendance_count"] += 1
        if attendance.attendance_status == "present":
            bucket["present"] += 1
        elif attendance.attendance_status == "late":
            bucket["late"] += 1
        elif attendance.attendance_status == "absent":
            bucket["absent"] += 1

    department_summaries: list[TimDepartmentSummaryItem] = []
    for item in by_department.values():
        total = item["attendance_count"] or 1
        department_summaries.append(
            TimDepartmentSummaryItem(
                department_id=int(item["department_id"]),
                department_name=str(item["department_name"]),
                attendance_count=int(item["attendance_count"]),
                present_rate=round((item["present"] / total) * 100, 2),
                late_rate=round((item["late"] / total) * 100, 2),
                absent_rate=round((item["absent"] / total) * 100, 2),
            )
        )

    leave_map: dict[str, dict[str, int]] = {}
    for leave in leave_rows:
        leave_type = leave.leave_type or "other"
        bucket = leave_map.setdefault(leave_type, {"request_count": 0, "approved_count": 0, "pending_count": 0})
        bucket["request_count"] += 1
        if leave.request_status == "approved":
            bucket["approved_count"] += 1
        if leave.request_status == "pending":
            bucket["pending_count"] += 1

    leave_type_summaries = [
        TimLeaveTypeSummaryItem(
            leave_type=leave_type,
            request_count=counts["request_count"],
            approved_count=counts["approved_count"],
            pending_count=counts["pending_count"],
        )
        for leave_type, counts in sorted(leave_map.items())
    ]

    return TimReportSummaryResponse(
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        total_attendance_records=len(attendance_rows),
        total_leave_requests=len(leave_rows),
        status_counts=TimStatusCount(**status_counts),
        department_summaries=sorted(department_summaries, key=lambda x: x.attendance_count, reverse=True),
        leave_type_summaries=leave_type_summaries,
    )
