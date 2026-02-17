from datetime import date

from sqlmodel import Session, select

from app.core.security import hash_password
from app.models import (
    AuthRole,
    AuthUser,
    AuthUserRole,
    HrAttendanceDaily,
    HrEmployee,
    HrLeaveRequest,
    OrgDepartment,
)


def seed_initial_data(session: Session) -> None:
    role_map = {
        "admin": "관리자",
        "hr_manager": "인사담당자",
        "employee": "일반직원",
    }
    for code, name in role_map.items():
        existing_role = session.exec(select(AuthRole).where(AuthRole.code == code)).first()
        if existing_role is None:
            session.add(AuthRole(code=code, name=name))
    session.commit()

    dept = session.exec(select(OrgDepartment).where(OrgDepartment.code == "HQ-HR")).first()
    if dept is None:
        dept = OrgDepartment(code="HQ-HR", name="인사팀")
        session.add(dept)
        session.commit()
        session.refresh(dept)

    admin_user = session.exec(select(AuthUser).where(AuthUser.email == "admin@vibe-hr.local")).first()
    if admin_user is None:
        admin_user = AuthUser(
            email="admin@vibe-hr.local",
            password_hash=hash_password("admin1234"),
            display_name="Vibe HR 관리자",
        )
        session.add(admin_user)
        session.commit()
        session.refresh(admin_user)

    admin_employee = session.exec(select(HrEmployee).where(HrEmployee.user_id == admin_user.id)).first()
    if admin_employee is None:
        admin_employee = HrEmployee(
            user_id=admin_user.id,
            employee_no="HR-0001",
            department_id=dept.id,
            position_title="HR Director",
            hire_date=date(2024, 1, 1),
            employment_status="active",
        )
        session.add(admin_employee)
        session.commit()
        session.refresh(admin_employee)

    admin_role = session.exec(select(AuthRole).where(AuthRole.code == "admin")).one()
    employee_role = session.exec(select(AuthRole).where(AuthRole.code == "employee")).one()
    role_links = session.exec(
        select(AuthUserRole).where(AuthUserRole.user_id == admin_user.id)
    ).all()
    linked_role_ids = {link.role_id for link in role_links}
    for role in [admin_role, employee_role]:
        if role.id not in linked_role_ids:
            session.add(AuthUserRole(user_id=admin_user.id, role_id=role.id))
    session.commit()

    today = date.today()
    today_attendance = session.exec(
        select(HrAttendanceDaily).where(
            HrAttendanceDaily.employee_id == admin_employee.id,
            HrAttendanceDaily.work_date == today,
        )
    ).first()
    if today_attendance is None:
        session.add(
            HrAttendanceDaily(
                employee_id=admin_employee.id,
                work_date=today,
                attendance_status="present",
            )
        )

    pending_leave = session.exec(
        select(HrLeaveRequest).where(
            HrLeaveRequest.employee_id == admin_employee.id,
            HrLeaveRequest.request_status == "pending",
        )
    ).first()
    if pending_leave is None:
        session.add(
            HrLeaveRequest(
                employee_id=admin_employee.id,
                leave_type="annual",
                start_date=today,
                end_date=today,
                reason="샘플 휴가 요청",
                request_status="pending",
            )
        )
    session.commit()
