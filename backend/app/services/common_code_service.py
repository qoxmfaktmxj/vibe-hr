from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import AppCode, AppCodeGroup
from app.schemas.common_code import (
    ActiveCodeOption,
    CodeCreateRequest,
    CodeGroupCreateRequest,
    CodeGroupItem,
    CodeGroupUpdateRequest,
    CodeItem,
    CodeUpdateRequest,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _group_item(group: AppCodeGroup) -> CodeGroupItem:
    return CodeGroupItem(
        id=group.id,
        code=group.code,
        name=group.name,
        description=group.description,
        is_active=group.is_active,
        sort_order=group.sort_order,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


def _code_item(code: AppCode) -> CodeItem:
    return CodeItem(
        id=code.id,
        group_id=code.group_id,
        code=code.code,
        name=code.name,
        description=code.description,
        is_active=code.is_active,
        sort_order=code.sort_order,
        extra_value1=code.extra_value1,
        extra_value2=code.extra_value2,
        created_at=code.created_at,
        updated_at=code.updated_at,
    )


def _get_group_or_404(session: Session, group_id: int) -> AppCodeGroup:
    group = session.get(AppCodeGroup, group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Code group not found.")
    return group


def _get_code_or_404(session: Session, group_id: int, code_id: int) -> AppCode:
    code = session.get(AppCode, code_id)
    if code is None or code.group_id != group_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Code not found.")
    return code


def list_code_groups(session: Session) -> list[CodeGroupItem]:
    rows = session.exec(select(AppCodeGroup).order_by(AppCodeGroup.sort_order, AppCodeGroup.id)).all()
    return [_group_item(row) for row in rows]


def create_code_group(session: Session, payload: CodeGroupCreateRequest) -> CodeGroupItem:
    code = payload.code.strip().upper()
    name = payload.name.strip()

    duplicate = session.exec(select(AppCodeGroup.id).where(AppCodeGroup.code == code)).first()
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="group code already exists.")

    group = AppCodeGroup(
        code=code,
        name=name,
        description=payload.description,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(group)
    session.commit()
    session.refresh(group)
    return _group_item(group)


def update_code_group(session: Session, group_id: int, payload: CodeGroupUpdateRequest) -> CodeGroupItem:
    group = _get_group_or_404(session, group_id)

    if payload.code is not None:
        next_code = payload.code.strip().upper()
        duplicate = session.exec(
            select(AppCodeGroup.id).where(AppCodeGroup.code == next_code, AppCodeGroup.id != group_id)
        ).first()
        if duplicate is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="group code already exists.")
        group.code = next_code

    if payload.name is not None:
        group.name = payload.name.strip()
    if payload.description is not None:
        group.description = payload.description
    if payload.is_active is not None:
        group.is_active = payload.is_active
    if payload.sort_order is not None:
        group.sort_order = payload.sort_order

    group.updated_at = _utc_now()
    session.add(group)
    session.commit()
    session.refresh(group)
    return _group_item(group)


def delete_code_group(session: Session, group_id: int) -> None:
    group = _get_group_or_404(session, group_id)
    session.delete(group)
    session.commit()


def list_codes(session: Session, group_id: int) -> list[CodeItem]:
    _get_group_or_404(session, group_id)
    rows = session.exec(
        select(AppCode).where(AppCode.group_id == group_id).order_by(AppCode.sort_order, AppCode.id)
    ).all()
    return [_code_item(row) for row in rows]


def create_code(session: Session, group_id: int, payload: CodeCreateRequest) -> CodeItem:
    _get_group_or_404(session, group_id)
    code_value = payload.code.strip().upper()
    name = payload.name.strip()

    duplicate = session.exec(
        select(AppCode.id).where(AppCode.group_id == group_id, AppCode.code == code_value)
    ).first()
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="code already exists in group.")

    row = AppCode(
        group_id=group_id,
        code=code_value,
        name=name,
        description=payload.description,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
        extra_value1=payload.extra_value1,
        extra_value2=payload.extra_value2,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _code_item(row)


def update_code(session: Session, group_id: int, code_id: int, payload: CodeUpdateRequest) -> CodeItem:
    row = _get_code_or_404(session, group_id, code_id)

    if payload.code is not None:
        next_code = payload.code.strip().upper()
        duplicate = session.exec(
            select(AppCode.id).where(
                AppCode.group_id == group_id,
                AppCode.code == next_code,
                AppCode.id != code_id,
            )
        ).first()
        if duplicate is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="code already exists in group.")
        row.code = next_code

    if payload.name is not None:
        row.name = payload.name.strip()
    if payload.description is not None:
        row.description = payload.description
    if payload.is_active is not None:
        row.is_active = payload.is_active
    if payload.sort_order is not None:
        row.sort_order = payload.sort_order
    if payload.extra_value1 is not None:
        row.extra_value1 = payload.extra_value1
    if payload.extra_value2 is not None:
        row.extra_value2 = payload.extra_value2

    row.updated_at = _utc_now()
    session.add(row)
    session.commit()
    session.refresh(row)
    return _code_item(row)


def delete_code(session: Session, group_id: int, code_id: int) -> None:
    row = _get_code_or_404(session, group_id, code_id)
    session.delete(row)
    session.commit()


def list_active_codes(session: Session, group_code: str) -> list[ActiveCodeOption]:
    code = group_code.strip().upper()
    group = session.exec(select(AppCodeGroup).where(AppCodeGroup.code == code)).first()
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Code group not found.")

    rows = session.exec(
        select(AppCode)
        .where(AppCode.group_id == group.id, AppCode.is_active == True)
        .order_by(AppCode.sort_order, AppCode.id)
    ).all()
    return [ActiveCodeOption(code=row.code, name=row.name) for row in rows]
