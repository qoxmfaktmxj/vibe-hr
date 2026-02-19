from __future__ import annotations

from datetime import date, datetime, timezone
import secrets
import string

from fastapi import HTTPException, status
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
from app.schemas.employee import (
    DepartmentItem,
    EmployeeCreateRequest,
    EmployeeItem,
    EmployeeUpdateRequest,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _generate_login_id(session: Session) -> str:
    alphabet = string.ascii_lowercase + string.digits
    for _ in range(30):
        token = "".join(secrets.choice(alphabet) for _ in range(10))
        login_id = f"usr-{token}"
        exists = session.exec(select(AuthUser.id).where(AuthUser.login_id == login_id)).first()
        if exists is None:
            return login_id
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate login_id.")


def _generate_employee_no(session: Session) -> str:
    for _ in range(30):
        employee_no = f"EMP-{secrets.randbelow(1_000_000):06d}"
        exists = session.exec(select(HrEmployee.id).where(HrEmployee.employee_no == employee_no)).first()
        if exists is None:
            return employee_no
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate employee_no.")


def _build_employee_item(employee: HrEmployee, user: AuthUser, department: OrgDepartment) -> EmployeeItem:
    return EmployeeItem(
        id=employee.id,
        employee_no=employee.employee_no,
        login_id=user.login_id,
        display_name=user.display_name,
        email=user.email,
        department_id=department.id,
        department_name=department.name,
        position_title=employee.position_title,
        hire_date=employee.hire_date,
        employment_status=employee.employment_status,
        is_active=user.is_active,
    )


def list_departments(session: Session) -> list[DepartmentItem]:
    rows = session.exec(select(OrgDepartment).order_by(OrgDepartment.code)).all()
    return [DepartmentItem(id=row.id, code=row.code, name=row.name) for row in rows]


def list_employees(session: Session) -> list[EmployeeItem]:
    rows = session.exec(
        select(HrEmployee, AuthUser, OrgDepartment)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .order_by(HrEmployee.id)
    ).all()

    return [_build_employee_item(employee, user, department) for employee, user, department in rows]


def get_employee_by_user_id(session: Session, user_id: int) -> EmployeeItem:
    row = session.exec(
        select(HrEmployee, AuthUser, OrgDepartment)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrEmployee.user_id == user_id)
    ).first()

    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee profile not found.")

    employee, user, department = row
    return _build_employee_item(employee, user, department)


def create_employee(session: Session, payload: EmployeeCreateRequest) -> EmployeeItem:
    department = session.get(OrgDepartment, payload.department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid department_id.")

    login_id = payload.login_id.strip() if payload.login_id else _generate_login_id(session)
    login_exists = session.exec(select(AuthUser.id).where(AuthUser.login_id == login_id)).first()
    if login_exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="login_id already exists.")

    email = payload.email or f"{login_id}@vibe-hr.local"
    email_exists = session.exec(select(AuthUser.id).where(AuthUser.email == email)).first()
    if email_exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email already exists.")

    user = AuthUser(
        login_id=login_id,
        email=email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        is_active=True,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(user)
    session.flush()

    employee = HrEmployee(
        user_id=user.id,
        employee_no=_generate_employee_no(session),
        department_id=payload.department_id,
        position_title=payload.position_title,
        hire_date=payload.hire_date or date.today(),
        employment_status=payload.employment_status,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(employee)

    employee_role = session.exec(select(AuthRole).where(AuthRole.code == "employee")).first()
    if employee_role is not None:
        session.add(AuthUserRole(user_id=user.id, role_id=employee_role.id))

    session.commit()
    session.refresh(user)
    session.refresh(employee)
    session.refresh(department)

    return _build_employee_item(employee, user, department)


def update_employee(session: Session, employee_id: int, payload: EmployeeUpdateRequest) -> EmployeeItem:
    employee = session.get(HrEmployee, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")

    user = session.get(AuthUser, employee.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee user not found.")

    if payload.department_id is not None:
        department = session.get(OrgDepartment, payload.department_id)
        if department is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid department_id.")
        employee.department_id = payload.department_id

    if payload.display_name is not None:
        user.display_name = payload.display_name

    if payload.position_title is not None:
        employee.position_title = payload.position_title

    if payload.hire_date is not None:
        employee.hire_date = payload.hire_date

    if payload.employment_status is not None:
        employee.employment_status = payload.employment_status

    if payload.email is not None and payload.email != user.email:
        email_exists = session.exec(select(AuthUser.id).where(AuthUser.email == payload.email)).first()
        if email_exists is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email already exists.")
        user.email = payload.email

    if payload.is_active is not None:
        user.is_active = payload.is_active

    if payload.password:
        user.password_hash = hash_password(payload.password)

    user.updated_at = _utc_now()
    employee.updated_at = _utc_now()

    session.add(user)
    session.add(employee)
    session.commit()
    session.refresh(user)
    session.refresh(employee)

    department = session.get(OrgDepartment, employee.department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Department not found.")

    return _build_employee_item(employee, user, department)


def delete_employee(session: Session, employee_id: int) -> None:
    employee = session.get(HrEmployee, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")

    user = session.get(AuthUser, employee.user_id)
    user_roles = session.exec(select(AuthUserRole).where(AuthUserRole.user_id == employee.user_id)).all()
    attendance_rows = session.exec(
        select(HrAttendanceDaily).where(HrAttendanceDaily.employee_id == employee.id)
    ).all()
    leave_rows = session.exec(select(HrLeaveRequest).where(HrLeaveRequest.employee_id == employee.id)).all()
    approved_rows = session.exec(
        select(HrLeaveRequest).where(HrLeaveRequest.approver_employee_id == employee.id)
    ).all()

    for row in approved_rows:
        row.approver_employee_id = None
        row.updated_at = _utc_now()
        session.add(row)
    for row in leave_rows:
        session.delete(row)
    for row in attendance_rows:
        session.delete(row)
    for row in user_roles:
        session.delete(row)

    session.delete(employee)
    if user is not None:
        session.delete(user)
    session.commit()
