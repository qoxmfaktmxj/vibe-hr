from datetime import date

from sqlalchemy import text
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


def ensure_auth_user_login_id_schema(session: Session) -> None:
    columns = session.exec(text("PRAGMA table_info(auth_users)")).all()
    column_names = {row[1] for row in columns}

    if "login_id" not in column_names:
        session.exec(text("ALTER TABLE auth_users ADD COLUMN login_id TEXT"))
        session.commit()

    session.exec(
        text(
            """
            UPDATE auth_users
            SET login_id = 'user-' || id
            WHERE login_id IS NULL OR TRIM(login_id) = ''
            """
        )
    )
    session.exec(
        text(
            """
            UPDATE auth_users
            SET login_id = 'admin-local'
            WHERE email = 'admin@vibe-hr.local'
            """
        )
    )
    session.exec(
        text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_auth_users_login_id ON auth_users (login_id)"
        )
    )
    session.commit()


def ensure_roles(session: Session) -> None:
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


def ensure_department(session: Session) -> OrgDepartment:
    dept = session.exec(select(OrgDepartment).where(OrgDepartment.code == "HQ-HR")).first()
    if dept is None:
        dept = OrgDepartment(code="HQ-HR", name="인사팀")
        session.add(dept)
        session.commit()
        session.refresh(dept)
    return dept


def ensure_user(
    session: Session,
    *,
    login_id: str,
    email: str,
    password: str,
    display_name: str,
    reset_password: bool = False,
) -> AuthUser:
    user = session.exec(select(AuthUser).where(AuthUser.login_id == login_id)).first()
    if user is None:
        user = AuthUser(
            login_id=login_id,
            email=email,
            password_hash=hash_password(password),
            display_name=display_name,
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user

    changed = False
    if reset_password:
        user.password_hash = hash_password(password)
        changed = True
    if not user.is_active:
        user.is_active = True
        changed = True
    if changed:
        session.add(user)
        session.commit()
        session.refresh(user)

    return user


def ensure_user_roles(session: Session, user: AuthUser, role_codes: list[str]) -> None:
    roles = session.exec(select(AuthRole).where(AuthRole.code.in_(role_codes))).all()
    role_map = {role.code: role for role in roles}
    links = session.exec(select(AuthUserRole).where(AuthUserRole.user_id == user.id)).all()
    linked_role_ids = {link.role_id for link in links}

    for code in role_codes:
        role = role_map.get(code)
        if role and role.id not in linked_role_ids:
            session.add(AuthUserRole(user_id=user.id, role_id=role.id))
    session.commit()


def ensure_employee(
    session: Session,
    *,
    user: AuthUser,
    employee_no: str,
    department_id: int,
    position_title: str,
) -> HrEmployee:
    employee = session.exec(select(HrEmployee).where(HrEmployee.user_id == user.id)).first()
    if employee is None:
        employee = HrEmployee(
            user_id=user.id,
            employee_no=employee_no,
            department_id=department_id,
            position_title=position_title,
            hire_date=date(2024, 1, 1),
            employment_status="active",
        )
        session.add(employee)
        session.commit()
        session.refresh(employee)
    return employee


def ensure_sample_records(session: Session, employee: HrEmployee) -> None:
    today = date.today()
    today_attendance = session.exec(
        select(HrAttendanceDaily).where(
            HrAttendanceDaily.employee_id == employee.id,
            HrAttendanceDaily.work_date == today,
        )
    ).first()
    if today_attendance is None:
        session.add(
            HrAttendanceDaily(
                employee_id=employee.id,
                work_date=today,
                attendance_status="present",
            )
        )

    pending_leave = session.exec(
        select(HrLeaveRequest).where(
            HrLeaveRequest.employee_id == employee.id,
            HrLeaveRequest.request_status == "pending",
        )
    ).first()
    if pending_leave is None:
        session.add(
            HrLeaveRequest(
                employee_id=employee.id,
                leave_type="annual",
                start_date=today,
                end_date=today,
                reason="샘플 연차 신청",
                request_status="pending",
            )
        )
    session.commit()


def seed_initial_data(session: Session) -> None:
    ensure_auth_user_login_id_schema(session)
    ensure_roles(session)
    department = ensure_department(session)

    admin_local_user = ensure_user(
        session,
        login_id="admin-local",
        email="admin@vibe-hr.local",
        password="admin1234",
        display_name="Vibe HR 관리자",
    )
    quick_admin_user = ensure_user(
        session,
        login_id="admin",
        email="admin2@vibe-hr.local",
        password="admin",
        display_name="기본 관리자",
        reset_password=True,
    )

    ensure_user_roles(session, admin_local_user, ["admin", "employee"])
    ensure_user_roles(session, quick_admin_user, ["admin", "employee"])

    admin_local_employee = ensure_employee(
        session,
        user=admin_local_user,
        employee_no="HR-0001",
        department_id=department.id,
        position_title="HR Director",
    )
    ensure_employee(
        session,
        user=quick_admin_user,
        employee_no="HR-0002",
        department_id=department.id,
        position_title="HR Manager",
    )

    ensure_sample_records(session, admin_local_employee)
