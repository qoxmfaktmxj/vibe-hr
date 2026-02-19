from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import HrEmployee, OrgDepartment
from app.schemas.organization import (
    OrganizationDepartmentCreateRequest,
    OrganizationDepartmentItem,
    OrganizationDepartmentUpdateRequest,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _build_department_item(
    department: OrgDepartment,
    parent_name_map: dict[int, str],
) -> OrganizationDepartmentItem:
    return OrganizationDepartmentItem(
        id=department.id,
        code=department.code,
        name=department.name,
        parent_id=department.parent_id,
        parent_name=parent_name_map.get(department.parent_id) if department.parent_id else None,
        is_active=department.is_active,
        created_at=department.created_at,
        updated_at=department.updated_at,
    )


def _ensure_parent_exists(session: Session, parent_id: int | None) -> OrgDepartment | None:
    if parent_id is None:
        return None
    parent = session.get(OrgDepartment, parent_id)
    if parent is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid parent_id.")
    return parent


def _ensure_no_cycle(session: Session, department_id: int, parent_id: int | None) -> None:
    current_parent_id = parent_id
    visited: set[int] = set()

    while current_parent_id is not None:
        if current_parent_id == department_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cyclic parent relation is not allowed.")
        if current_parent_id in visited:
            break
        visited.add(current_parent_id)

        parent = session.get(OrgDepartment, current_parent_id)
        if parent is None:
            break
        current_parent_id = parent.parent_id


def list_departments(
    session: Session,
    *,
    code: str | None = None,
    name: str | None = None,
) -> list[OrganizationDepartmentItem]:
    statement = select(OrgDepartment).order_by(OrgDepartment.code)
    if code:
        statement = statement.where(OrgDepartment.code.ilike(f"%{code.strip()}%"))
    if name:
        statement = statement.where(OrgDepartment.name.ilike(f"%{name.strip()}%"))

    departments = session.exec(statement).all()
    parent_name_rows = session.exec(select(OrgDepartment.id, OrgDepartment.name)).all()
    parent_name_map = {department_id: department_name for department_id, department_name in parent_name_rows}

    return [_build_department_item(department, parent_name_map) for department in departments]


def create_department(
    session: Session,
    payload: OrganizationDepartmentCreateRequest,
) -> OrganizationDepartmentItem:
    code = payload.code.strip()
    name = payload.name.strip()

    duplicate = session.exec(select(OrgDepartment.id).where(OrgDepartment.code == code)).first()
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="code already exists.")

    _ensure_parent_exists(session, payload.parent_id)

    department = OrgDepartment(
        code=code,
        name=name,
        parent_id=payload.parent_id,
        is_active=payload.is_active,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(department)
    session.commit()
    session.refresh(department)

    parent_name_map = {}
    if department.parent_id:
        parent = session.get(OrgDepartment, department.parent_id)
        if parent is not None:
            parent_name_map[parent.id] = parent.name

    return _build_department_item(department, parent_name_map)


def update_department(
    session: Session,
    department_id: int,
    payload: OrganizationDepartmentUpdateRequest,
) -> OrganizationDepartmentItem:
    department = session.get(OrgDepartment, department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found.")

    if payload.code is not None:
        next_code = payload.code.strip()
        duplicate = session.exec(
            select(OrgDepartment.id).where(
                OrgDepartment.code == next_code,
                OrgDepartment.id != department_id,
            )
        ).first()
        if duplicate is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="code already exists.")
        department.code = next_code

    if payload.name is not None:
        department.name = payload.name.strip()

    next_parent_id = payload.parent_id
    if next_parent_id == department.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department cannot be its own parent.")
    _ensure_parent_exists(session, next_parent_id)
    _ensure_no_cycle(session, department.id, next_parent_id)
    department.parent_id = next_parent_id

    if payload.is_active is not None:
        department.is_active = payload.is_active

    department.updated_at = _utc_now()
    session.add(department)
    session.commit()
    session.refresh(department)

    parent_name_map = {}
    if department.parent_id:
        parent = session.get(OrgDepartment, department.parent_id)
        if parent is not None:
            parent_name_map[parent.id] = parent.name

    return _build_department_item(department, parent_name_map)


def delete_department(session: Session, department_id: int) -> None:
    department = session.get(OrgDepartment, department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found.")

    has_child = session.exec(select(OrgDepartment.id).where(OrgDepartment.parent_id == department_id)).first()
    if has_child is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete department with child departments.",
        )

    linked_employee = session.exec(select(HrEmployee.id).where(HrEmployee.department_id == department_id)).first()
    if linked_employee is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete department linked to employees.",
        )

    session.delete(department)
    session.commit()
