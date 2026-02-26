from sqlalchemy import func
from sqlmodel import Session, select

from app.core.time_utils import business_today
from app.models import HrAttendanceDaily, HrEmployee, HrLeaveRequest, OrgDepartment
from app.schemas.dashboard import DashboardSummaryResponse


def load_dashboard_summary(session: Session) -> DashboardSummaryResponse:
    today = business_today()

    total_employees = session.exec(select(func.count(HrEmployee.id))).one()
    total_departments = session.exec(select(func.count(OrgDepartment.id))).one()

    attendance_present_today = session.exec(
        select(func.count(HrAttendanceDaily.id)).where(
            HrAttendanceDaily.work_date == today,
            HrAttendanceDaily.attendance_status == "present",
        )
    ).one()

    attendance_late_today = session.exec(
        select(func.count(HrAttendanceDaily.id)).where(
            HrAttendanceDaily.work_date == today,
            HrAttendanceDaily.attendance_status == "late",
        )
    ).one()

    attendance_absent_today = session.exec(
        select(func.count(HrAttendanceDaily.id)).where(
            HrAttendanceDaily.work_date == today,
            HrAttendanceDaily.attendance_status == "absent",
        )
    ).one()

    pending_leave_requests = session.exec(
        select(func.count(HrLeaveRequest.id)).where(
            HrLeaveRequest.request_status == "pending",
        )
    ).one()

    return DashboardSummaryResponse(
        total_employees=total_employees,
        total_departments=total_departments,
        attendance_present_today=attendance_present_today,
        attendance_late_today=attendance_late_today,
        attendance_absent_today=attendance_absent_today,
        pending_leave_requests=pending_leave_requests,
    )

