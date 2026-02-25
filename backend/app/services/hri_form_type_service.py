from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import HriFormType
from app.schemas.hri_form_type import (
    HriFormTypeBatchItem,
    HriFormTypeBatchRequest,
    HriFormTypeBatchResponse,
    HriFormTypeItem,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_item(row: HriFormType) -> HriFormTypeItem:
    return HriFormTypeItem(
        id=row.id,
        form_code=row.form_code,
        form_name_ko=row.form_name_ko,
        form_name_en=row.form_name_en,
        module_code=row.module_code,
        is_active=row.is_active,
        allow_draft=row.allow_draft,
        allow_withdraw=row.allow_withdraw,
        requires_receive=row.requires_receive,
        default_priority=row.default_priority,
        created_by=row.created_by,
        updated_by=row.updated_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def list_form_types(session: Session) -> list[HriFormTypeItem]:
    rows = session.exec(
        select(HriFormType).order_by(HriFormType.module_code, HriFormType.default_priority, HriFormType.id)
    ).all()
    return [_to_item(row) for row in rows]


def _apply_batch_item(row: HriFormType, item: HriFormTypeBatchItem, user_id: int) -> None:
    row.form_code = item.form_code.strip().upper()
    row.form_name_ko = item.form_name_ko.strip()
    row.form_name_en = item.form_name_en.strip() if item.form_name_en else None
    row.module_code = item.module_code.strip().upper()
    row.is_active = item.is_active
    row.allow_draft = item.allow_draft
    row.allow_withdraw = item.allow_withdraw
    row.requires_receive = item.requires_receive
    row.default_priority = item.default_priority
    row.updated_by = user_id
    row.updated_at = _utc_now()


def batch_save_form_types(
    session: Session,
    payload: HriFormTypeBatchRequest,
    user_id: int,
) -> HriFormTypeBatchResponse:
    inserted = 0
    updated = 0
    deleted = 0

    for del_id in payload.delete_ids:
        row = session.get(HriFormType, del_id)
        if row is not None:
            session.delete(row)
            deleted += 1

    for item in payload.items:
        if item.id is not None and item.id > 0:
            row = session.get(HriFormType, item.id)
            if row is not None:
                _apply_batch_item(row, item, user_id)
                session.add(row)
                updated += 1
                continue

        code_upper = item.form_code.strip().upper()
        dup = session.exec(select(HriFormType.id).where(HriFormType.form_code == code_upper)).first()
        if dup is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"form_code '{code_upper}' already exists.",
            )

        row = HriFormType(created_at=_utc_now(), created_by=user_id)
        _apply_batch_item(row, item, user_id)
        session.add(row)
        inserted += 1

    session.commit()

    items = list_form_types(session)
    return HriFormTypeBatchResponse(
        items=items,
        total_count=len(items),
        inserted_count=inserted,
        updated_count=updated,
        deleted_count=deleted,
    )
