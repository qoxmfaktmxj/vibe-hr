from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import Session, select

from app.models import HrEmployee, OrgCorporation, OrgDepartment
from app.schemas.organization import (
    OrganizationCorporationCreateRequest,
    OrganizationCorporationItem,
    OrganizationCorporationUpdateRequest,
    OrganizationDepartmentCreateRequest,
    OrganizationDepartmentItem,
    OrganizationDepartmentUpdateRequest,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _build_department_item(
    department: OrgDepartment,
    parent_name_map: dict[int, str],
    employee_count_map: dict[int, int],
) -> OrganizationDepartmentItem:
    return OrganizationDepartmentItem(
        id=department.id,
        code=department.code,
        name=department.name,
        parent_id=department.parent_id,
        parent_name=parent_name_map.get(department.parent_id) if department.parent_id else None,
        organization_type=department.organization_type,
        cost_center_code=department.cost_center_code,
        description=department.description,
        employee_count=employee_count_map.get(department.id or 0, 0),
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
    page: int | None = None,
    limit: int | None = None,
    code: str | None = None,
    name: str | None = None,
    organization_type: str | None = None,
    cost_center_code: str | None = None,
) -> tuple[list[OrganizationDepartmentItem], int]:
    statement = select(OrgDepartment).order_by(OrgDepartment.code)
    if code:
        statement = statement.where(OrgDepartment.code.ilike(f"%{code.strip()}%"))
    if name:
        statement = statement.where(OrgDepartment.name.ilike(f"%{name.strip()}%"))
    if organization_type:
        statement = statement.where(OrgDepartment.organization_type.ilike(f"%{organization_type.strip()}%"))
    if cost_center_code:
        statement = statement.where(OrgDepartment.cost_center_code.ilike(f"%{cost_center_code.strip()}%"))

    departments = session.exec(statement).all()
    total_count = len(departments)
    if page is not None and limit is not None and limit > 0:
        offset = max(0, (page - 1) * limit)
        departments = departments[offset : offset + limit]

    parent_name_rows = session.exec(select(OrgDepartment.id, OrgDepartment.name)).all()
    parent_name_map = {department_id: department_name for department_id, department_name in parent_name_rows}
    employee_count_rows = session.exec(
        select(HrEmployee.department_id, func.count(HrEmployee.id)).group_by(HrEmployee.department_id)
    ).all()
    employee_count_map = {
        department_id: int(employee_count)
        for department_id, employee_count in employee_count_rows
        if department_id is not None
    }

    return (
        [_build_department_item(department, parent_name_map, employee_count_map) for department in departments],
        total_count,
    )


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
        organization_type=_strip_or_none(payload.organization_type),
        cost_center_code=_strip_or_none(payload.cost_center_code),
        description=_strip_or_none(payload.description),
        is_active=payload.is_active,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(department)
    session.commit()
    session.refresh(department)

    parent_name_map: dict[int, str] = {}
    if department.parent_id:
        parent = session.get(OrgDepartment, department.parent_id)
        if parent is not None:
            parent_name_map[parent.id] = parent.name

    return _build_department_item(department, parent_name_map, {})


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
    if payload.organization_type is not None:
        department.organization_type = _strip_or_none(payload.organization_type)
    if payload.cost_center_code is not None:
        department.cost_center_code = _strip_or_none(payload.cost_center_code)
    if payload.description is not None:
        department.description = _strip_or_none(payload.description)

    if "parent_id" in payload.model_fields_set:
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

    parent_name_map: dict[int, str] = {}
    if department.parent_id:
        parent = session.get(OrgDepartment, department.parent_id)
        if parent is not None:
            parent_name_map[parent.id] = parent.name

    employee_count = session.exec(
        select(func.count(HrEmployee.id)).where(HrEmployee.department_id == department.id)
    ).one()
    return _build_department_item(department, parent_name_map, {department.id: int(employee_count or 0)})


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


def _normalize_code(value: str) -> str:
    return value.strip().upper()


def _strip_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _build_corporation_item(corporation: OrgCorporation) -> OrganizationCorporationItem:
    return OrganizationCorporationItem(
        id=corporation.id,
        enter_cd=corporation.enter_cd,
        company_code=corporation.company_code,
        corporation_name=corporation.corporation_name,
        corporation_number=corporation.corporation_number,
        business_number=corporation.business_number,
        company_seal_url=corporation.company_seal_url,
        certificate_seal_url=corporation.certificate_seal_url,
        company_logo_url=corporation.company_logo_url,
        is_active=corporation.is_active,
        created_at=corporation.created_at,
        updated_at=corporation.updated_at,
    )


def list_corporations(
    session: Session,
    *,
    page: int | None = None,
    limit: int | None = None,
    enter_cd: str | None = None,
    company_code: str | None = None,
    corporation_name: str | None = None,
) -> tuple[list[OrganizationCorporationItem], int]:
    statement = select(OrgCorporation).order_by(OrgCorporation.enter_cd, OrgCorporation.company_code)
    if enter_cd:
        statement = statement.where(OrgCorporation.enter_cd.ilike(f"%{enter_cd.strip()}%"))
    if company_code:
        statement = statement.where(OrgCorporation.company_code.ilike(f"%{company_code.strip()}%"))
    if corporation_name:
        statement = statement.where(OrgCorporation.corporation_name.ilike(f"%{corporation_name.strip()}%"))

    corporations = session.exec(statement).all()
    total_count = len(corporations)
    if page is not None and limit is not None and limit > 0:
        offset = max(0, (page - 1) * limit)
        corporations = corporations[offset : offset + limit]

    return ([_build_corporation_item(corporation) for corporation in corporations], total_count)


def create_corporation(
    session: Session,
    payload: OrganizationCorporationCreateRequest,
) -> OrganizationCorporationItem:
    enter_cd = _normalize_code(payload.enter_cd)
    company_code = _normalize_code(payload.company_code)

    duplicate_enter_cd = session.exec(select(OrgCorporation.id).where(OrgCorporation.enter_cd == enter_cd)).first()
    if duplicate_enter_cd is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="enter_cd already exists.")

    duplicate_company_code = session.exec(
        select(OrgCorporation.id).where(OrgCorporation.company_code == company_code)
    ).first()
    if duplicate_company_code is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="company_code already exists.")

    corporation = OrgCorporation(
        enter_cd=enter_cd,
        company_code=company_code,
        corporation_name=payload.corporation_name.strip(),
        corporation_number=_strip_or_none(payload.corporation_number),
        business_number=_strip_or_none(payload.business_number),
        company_seal_url=_strip_or_none(payload.company_seal_url),
        certificate_seal_url=_strip_or_none(payload.certificate_seal_url),
        company_logo_url=_strip_or_none(payload.company_logo_url),
        is_active=payload.is_active,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(corporation)
    session.commit()
    session.refresh(corporation)
    return _build_corporation_item(corporation)


def update_corporation(
    session: Session,
    corporation_id: int,
    payload: OrganizationCorporationUpdateRequest,
) -> OrganizationCorporationItem:
    corporation = session.get(OrgCorporation, corporation_id)
    if corporation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corporation not found.")

    if payload.enter_cd is not None:
        next_enter_cd = _normalize_code(payload.enter_cd)
        duplicate_enter_cd = session.exec(
            select(OrgCorporation.id).where(
                OrgCorporation.enter_cd == next_enter_cd,
                OrgCorporation.id != corporation_id,
            )
        ).first()
        if duplicate_enter_cd is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="enter_cd already exists.")
        corporation.enter_cd = next_enter_cd

    if payload.company_code is not None:
        next_company_code = _normalize_code(payload.company_code)
        duplicate_company_code = session.exec(
            select(OrgCorporation.id).where(
                OrgCorporation.company_code == next_company_code,
                OrgCorporation.id != corporation_id,
            )
        ).first()
        if duplicate_company_code is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="company_code already exists.")
        corporation.company_code = next_company_code

    if payload.corporation_name is not None:
        corporation.corporation_name = payload.corporation_name.strip()

    if payload.corporation_number is not None:
        corporation.corporation_number = _strip_or_none(payload.corporation_number)
    if payload.business_number is not None:
        corporation.business_number = _strip_or_none(payload.business_number)
    if payload.company_seal_url is not None:
        corporation.company_seal_url = _strip_or_none(payload.company_seal_url)
    if payload.certificate_seal_url is not None:
        corporation.certificate_seal_url = _strip_or_none(payload.certificate_seal_url)
    if payload.company_logo_url is not None:
        corporation.company_logo_url = _strip_or_none(payload.company_logo_url)
    if payload.is_active is not None:
        corporation.is_active = payload.is_active

    corporation.updated_at = _utc_now()
    session.add(corporation)
    session.commit()
    session.refresh(corporation)
    return _build_corporation_item(corporation)


def delete_corporation(session: Session, corporation_id: int) -> None:
    corporation = session.get(OrgCorporation, corporation_id)
    if corporation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corporation not found.")

    session.delete(corporation)
    session.commit()
