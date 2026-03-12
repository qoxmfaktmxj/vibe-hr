from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import Session, select

from app.models import AuthUser, HrEmployee, OrgDepartment
from app.schemas.employee import DepartmentItem, EmployeeItem
from app.services.employee_service_shared import build_employee_item


def list_departments(session: Session) -> list[DepartmentItem]:
    rows = session.exec(select(OrgDepartment).order_by(OrgDepartment.code)).all()
    return [DepartmentItem(id=row.id, code=row.code, name=row.name) for row in rows]


def list_employees(
    session: Session,
    *,
    page: int | None = None,
    limit: int | None = None,
    employee_no: str | None = None,
    name: str | None = None,
    department: str | None = None,
    employment_status: str | None = None,
    active: bool | None = None,
) -> tuple[list[EmployeeItem], int]:
    stmt = (
        select(HrEmployee, AuthUser, OrgDepartment)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
    )

    if employee_no:
        stmt = stmt.where(HrEmployee.employee_no.ilike(f"%{employee_no.strip()}%"))
    if name:
        stmt = stmt.where(AuthUser.display_name.ilike(f"%{name.strip()}%"))
    if department:
        stmt = stmt.where(OrgDepartment.name.ilike(f"%{department.strip()}%"))
    if employment_status:
        stmt = stmt.where(HrEmployee.employment_status == employment_status)
    if active is not None:
        stmt = stmt.where(AuthUser.is_active == active)  # noqa: E712

    total_count: int = session.exec(select(func.count()).select_from(stmt.subquery())).one()

    paged_stmt = stmt.order_by(HrEmployee.id)
    if page is not None and limit is not None and limit > 0:
        offset = max(0, (page - 1) * limit)
        paged_stmt = paged_stmt.offset(offset).limit(limit)

    rows = session.exec(paged_stmt).all()
    return ([build_employee_item(employee, user, department) for employee, user, department in rows], total_count)


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
    return build_employee_item(employee, user, department)
