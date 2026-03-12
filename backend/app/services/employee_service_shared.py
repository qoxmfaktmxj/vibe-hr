from __future__ import annotations

from datetime import datetime, timezone
import secrets
import string

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import AuthUser, HrEmployee, OrgDepartment
from app.schemas.employee import EmployeeItem


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


BATCH_DELETE_CHUNK_SIZE = 1000


def chunked(values: list[int], size: int) -> list[list[int]]:
    return [values[index : index + size] for index in range(0, len(values), size)]


def generate_login_id(session: Session) -> str:
    alphabet = string.ascii_lowercase + string.digits
    for _ in range(30):
        token = "".join(secrets.choice(alphabet) for _ in range(10))
        login_id = f"usr-{token}"
        exists = session.exec(select(AuthUser.id).where(AuthUser.login_id == login_id)).first()
        if exists is None:
            return login_id
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate login_id.")


def generate_employee_no(session: Session) -> str:
    for _ in range(30):
        employee_no = f"EMP-{secrets.randbelow(1_000_000):06d}"
        exists = session.exec(select(HrEmployee.id).where(HrEmployee.employee_no == employee_no)).first()
        if exists is None:
            return employee_no
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate employee_no.")


def build_employee_item(employee: HrEmployee, user: AuthUser, department: OrgDepartment) -> EmployeeItem:
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
