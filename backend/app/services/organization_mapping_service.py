from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models import AppCode, AppCodeGroup, OrgDepartment, OrgMappingAssignment, OrgMappingTypeItem
from app.schemas.organization import (
    OrgMappingTypeItemCreateRequest,
    OrgMappingTypeItemDetail,
    OrgMappingTypeItemUpdateRequest,
    OrganizationLookupItem,
)

MAPPING_TYPE_GROUP_CODE = "ORG_MAPPING_TYPE"
_OPEN_END_DATE = date.max


def _lookup_item(code: str, name: str) -> OrganizationLookupItem:
    return OrganizationLookupItem(code=code, name=name)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_code(value: str) -> str:
    return value.strip().upper()


def _strip_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _build_mapping_item(row: OrgMappingTypeItem) -> OrgMappingTypeItemDetail:
    return OrgMappingTypeItemDetail(
        id=int(row.id),
        type_code=row.type_code,
        item_code=row.item_code,
        name=row.name,
        effective_from=row.effective_from,
        effective_to=row.effective_to,
        erp_employee_code=row.erp_employee_code,
        cost_center_type=row.cost_center_type,
        remark=row.remark,
        sort_order=row.sort_order,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _validate_closed_period(effective_from: date, effective_to: date | None) -> None:
    if effective_to is not None and effective_to < effective_from:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="effective_to must be on or after effective_from.",
        )


def _ensure_no_item_overlap(
    session: Session,
    *,
    type_code: str,
    item_code: str,
    effective_from: date,
    effective_to: date | None,
    exclude_id: int | None = None,
    ) -> None:
    candidate_end = effective_to or _OPEN_END_DATE
    statement = select(OrgMappingTypeItem.id).where(
        OrgMappingTypeItem.type_code == type_code,
        OrgMappingTypeItem.item_code == item_code,
        OrgMappingTypeItem.effective_from <= candidate_end,
        func.coalesce(OrgMappingTypeItem.effective_to, _OPEN_END_DATE) >= effective_from,
    )
    if exclude_id is not None:
        statement = statement.where(OrgMappingTypeItem.id != exclude_id)

    with session.no_autoflush:
        conflict = session.exec(statement).first()
    if conflict is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Mapping item period overlaps existing record.")


def _item_has_assignments(session: Session, item_id: int) -> bool:
    return session.exec(select(OrgMappingAssignment.id).where(OrgMappingAssignment.item_id == item_id)).first() is not None


def _item_period_contains_assignments(
    session: Session,
    *,
    item_id: int,
    effective_from: date,
    effective_to: date | None,
) -> bool:
    assignments = session.exec(
        select(OrgMappingAssignment).where(OrgMappingAssignment.item_id == item_id)
    ).all()
    if not assignments:
        return True

    for assignment in assignments:
        if assignment.effective_from < effective_from:
            return False
        if effective_to is not None and (
            assignment.effective_to is None or assignment.effective_to > effective_to
        ):
            return False
    return True


def _apply_integrity_guard(session: Session, exc: IntegrityError) -> None:
    session.rollback()
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Mapping item conflict.",
    ) from exc


def _list_mapping_type_codes(session: Session) -> list[OrganizationLookupItem]:
    group = session.exec(
        select(AppCodeGroup).where(AppCodeGroup.code == MAPPING_TYPE_GROUP_CODE, AppCodeGroup.is_active == True)
    ).first()
    if group is None:
        return []

    rows = session.exec(
        select(AppCode)
        .where(AppCode.group_id == group.id, AppCode.is_active == True)
        .order_by(AppCode.sort_order, AppCode.id)
    ).all()
    return [_lookup_item(code=row.code, name=row.name) for row in rows]


def list_mapping_types(session: Session) -> list[OrganizationLookupItem]:
    return _list_mapping_type_codes(session)


def list_mapping_type_options(session: Session) -> list[OrganizationLookupItem]:
    return _list_mapping_type_codes(session)


def list_mapping_item_options(session: Session, *, type_code: str) -> list[OrganizationLookupItem]:
    rows = session.exec(
        select(OrgMappingTypeItem)
        .where(
            OrgMappingTypeItem.type_code == type_code.strip().upper(),
            OrgMappingTypeItem.is_active == True,
        )
        .order_by(OrgMappingTypeItem.sort_order, OrgMappingTypeItem.id)
    ).all()
    return [_lookup_item(code=row.item_code, name=row.name) for row in rows]


def list_mapping_type_items(
    session: Session,
    *,
    page: int | None = None,
    limit: int | None = None,
    type_code: str | None = None,
    reference_date: date | None = None,
) -> tuple[list[OrgMappingTypeItemDetail], int]:
    statement = select(OrgMappingTypeItem).order_by(
        OrgMappingTypeItem.type_code,
        OrgMappingTypeItem.sort_order,
        OrgMappingTypeItem.item_code,
        OrgMappingTypeItem.effective_from,
        OrgMappingTypeItem.id,
    )
    if type_code:
        statement = statement.where(OrgMappingTypeItem.type_code == _normalize_code(type_code))
    if reference_date is not None:
        statement = statement.where(
            OrgMappingTypeItem.effective_from <= reference_date,
            func.coalesce(OrgMappingTypeItem.effective_to, _OPEN_END_DATE) >= reference_date,
        )

    rows = session.exec(statement).all()
    total_count = len(rows)
    if page is not None and limit is not None and limit > 0:
        offset = max(0, (page - 1) * limit)
        rows = rows[offset : offset + limit]

    return [_build_mapping_item(row) for row in rows], total_count


def create_mapping_type_item(
    session: Session,
    payload: OrgMappingTypeItemCreateRequest,
) -> OrgMappingTypeItemDetail:
    type_code = _normalize_code(payload.type_code)
    item_code = _normalize_code(payload.item_code)
    name = payload.name.strip()
    effective_from = payload.effective_from
    effective_to = payload.effective_to
    _validate_closed_period(effective_from, effective_to)
    _ensure_no_item_overlap(
        session,
        type_code=type_code,
        item_code=item_code,
        effective_from=effective_from,
        effective_to=effective_to,
    )

    row = OrgMappingTypeItem(
        type_code=type_code,
        item_code=item_code,
        name=name,
        effective_from=effective_from,
        effective_to=effective_to,
        erp_employee_code=_strip_or_none(payload.erp_employee_code),
        cost_center_type=_strip_or_none(payload.cost_center_type),
        remark=_strip_or_none(payload.remark),
        sort_order=payload.sort_order,
        is_active=payload.is_active,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(row)
    try:
        session.flush()
        session.commit()
    except IntegrityError as exc:
        _apply_integrity_guard(session, exc)
    session.refresh(row)
    return _build_mapping_item(row)


def update_mapping_type_item(
    session: Session,
    item_id: int,
    type_code_or_payload: OrgMappingTypeItemUpdateRequest | str,
    payload: OrgMappingTypeItemUpdateRequest | None = None,
) -> OrgMappingTypeItemDetail:
    if payload is None:
        payload = type_code_or_payload  # type: ignore[assignment]

    row = session.get(OrgMappingTypeItem, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mapping item not found.")

    next_type_code = row.type_code
    next_item_code = row.item_code
    next_effective_from = row.effective_from
    next_effective_to = row.effective_to

    if payload.type_code is not None:
        next_type_code = _normalize_code(payload.type_code)
    if payload.item_code is not None:
        next_item_code = _normalize_code(payload.item_code)
    if payload.effective_from is not None:
        next_effective_from = payload.effective_from
    if payload.effective_to is not None or "effective_to" in payload.model_fields_set:
        next_effective_to = payload.effective_to

    _validate_closed_period(next_effective_from, next_effective_to)

    has_assignments = _item_has_assignments(session, item_id)
    if has_assignments:
        if next_type_code != row.type_code or next_item_code != row.item_code:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Referenced mapping item type_code/item_code cannot be changed.",
            )
        if not _item_period_contains_assignments(
            session,
            item_id=item_id,
            effective_from=next_effective_from,
            effective_to=next_effective_to,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Referenced mapping item period must contain existing assignments.",
            )
        if payload.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Referenced mapping item cannot be deactivated.",
            )

    if payload.type_code is not None:
        row.type_code = next_type_code
    if payload.item_code is not None:
        row.item_code = next_item_code
    if payload.name is not None:
        row.name = payload.name.strip()
    if payload.effective_from is not None:
        row.effective_from = next_effective_from
    if "effective_to" in payload.model_fields_set:
        row.effective_to = next_effective_to
    if "erp_employee_code" in payload.model_fields_set:
        row.erp_employee_code = _strip_or_none(payload.erp_employee_code)
    if "cost_center_type" in payload.model_fields_set:
        row.cost_center_type = _strip_or_none(payload.cost_center_type)
    if payload.sort_order is not None:
        row.sort_order = payload.sort_order
    if "remark" in payload.model_fields_set:
        row.remark = _strip_or_none(payload.remark)
    if payload.is_active is not None:
        row.is_active = payload.is_active

    row.updated_at = _utc_now()
    session.add(row)
    _ensure_no_item_overlap(
        session,
        type_code=row.type_code,
        item_code=row.item_code,
        effective_from=row.effective_from,
        effective_to=row.effective_to,
        exclude_id=row.id,
    )
    try:
        session.flush()
        session.commit()
    except IntegrityError as exc:
        _apply_integrity_guard(session, exc)
    session.refresh(row)
    return _build_mapping_item(row)


def delete_mapping_type_item(session: Session, item_id: int) -> None:
    row = session.get(OrgMappingTypeItem, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mapping item not found.")

    if _item_has_assignments(session, item_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Referenced mapping item cannot be deleted.",
        )

    session.delete(row)
    try:
        session.flush()
        session.commit()
    except IntegrityError as exc:
        _apply_integrity_guard(session, exc)


def list_department_options(session: Session) -> list[OrganizationLookupItem]:
    rows = session.exec(
        select(OrgDepartment)
        .where(OrgDepartment.is_active == True)
        .order_by(OrgDepartment.code, OrgDepartment.id)
    ).all()
    return [_lookup_item(code=row.code, name=row.name) for row in rows]
