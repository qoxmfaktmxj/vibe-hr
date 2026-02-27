from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import AppCode, AppCodeGroup
from app.schemas.hr_appointment_code import (
    HrAppointmentCodeCreateRequest,
    HrAppointmentCodeItem,
    HrAppointmentCodeUpdateRequest,
)

APPOINTMENT_CODE_GROUP = "HR_APPOINTMENT_CODE"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_item(row: AppCode) -> HrAppointmentCodeItem:
    return HrAppointmentCodeItem(
        id=row.id or 0,
        code=row.code,
        name=row.name,
        description=row.description,
        is_active=row.is_active,
        sort_order=row.sort_order,
        mapping_key=row.extra_value1,
        mapping_value=row.extra_value2,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _get_or_create_group(session: Session) -> AppCodeGroup:
    group = session.exec(
        select(AppCodeGroup).where(AppCodeGroup.code == APPOINTMENT_CODE_GROUP),
    ).first()
    if group is not None:
        return group

    group = AppCodeGroup(
        code=APPOINTMENT_CODE_GROUP,
        name="발령코드",
        description="발령처리용 코드 그룹",
        is_active=True,
        sort_order=150,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(group)
    session.commit()
    session.refresh(group)
    return group


def _get_code_or_404(session: Session, group_id: int, code_id: int) -> AppCode:
    row = session.get(AppCode, code_id)
    if row is None or row.group_id != group_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment code not found.")
    return row


def list_appointment_codes(session: Session) -> list[HrAppointmentCodeItem]:
    group = _get_or_create_group(session)
    rows = session.exec(
        select(AppCode)
        .where(AppCode.group_id == group.id)
        .order_by(AppCode.sort_order, AppCode.id),
    ).all()
    return [_to_item(row) for row in rows]


def create_appointment_code(
    session: Session,
    payload: HrAppointmentCodeCreateRequest,
) -> HrAppointmentCodeItem:
    group = _get_or_create_group(session)
    code = payload.code.strip().upper()

    duplicate = session.exec(
        select(AppCode.id).where(AppCode.group_id == group.id, AppCode.code == code),
    ).first()
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="appointment code already exists.")

    row = AppCode(
        group_id=group.id or 0,
        code=code,
        name=payload.name.strip(),
        description=payload.description,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
        extra_value1=payload.mapping_key,
        extra_value2=payload.mapping_value,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _to_item(row)


def update_appointment_code(
    session: Session,
    code_id: int,
    payload: HrAppointmentCodeUpdateRequest,
) -> HrAppointmentCodeItem:
    group = _get_or_create_group(session)
    row = _get_code_or_404(session, group.id or 0, code_id)

    if payload.code is not None:
        next_code = payload.code.strip().upper()
        duplicate = session.exec(
            select(AppCode.id).where(
                AppCode.group_id == group.id,
                AppCode.code == next_code,
                AppCode.id != code_id,
            ),
        ).first()
        if duplicate is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="appointment code already exists.")
        row.code = next_code

    if payload.name is not None:
        row.name = payload.name.strip()
    if payload.description is not None:
        row.description = payload.description
    if payload.is_active is not None:
        row.is_active = payload.is_active
    if payload.sort_order is not None:
        row.sort_order = payload.sort_order
    if payload.mapping_key is not None:
        row.extra_value1 = payload.mapping_key
    if payload.mapping_value is not None:
        row.extra_value2 = payload.mapping_value

    row.updated_at = _utc_now()
    session.add(row)
    session.commit()
    session.refresh(row)
    return _to_item(row)


def delete_appointment_code(session: Session, code_id: int) -> None:
    group = _get_or_create_group(session)
    row = _get_code_or_404(session, group.id or 0, code_id)
    session.delete(row)
    session.commit()

