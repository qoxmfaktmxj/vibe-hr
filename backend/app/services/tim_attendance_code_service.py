from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import TimAttendanceCode
from app.schemas.tim_attendance_code import (
    TimAttendanceCodeBatchItem,
    TimAttendanceCodeBatchRequest,
    TimAttendanceCodeBatchResponse,
    TimAttendanceCodeItem,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _build_item(row: TimAttendanceCode) -> TimAttendanceCodeItem:
    return TimAttendanceCodeItem(
        id=row.id,
        code=row.code,
        name=row.name,
        category=row.category,
        unit=row.unit,
        is_requestable=row.is_requestable,
        min_days=row.min_days,
        max_days=row.max_days,
        deduct_annual=row.deduct_annual,
        is_active=row.is_active,
        sort_order=row.sort_order,
        description=row.description,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _get_or_404(session: Session, item_id: int) -> TimAttendanceCode:
    row = session.get(TimAttendanceCode, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="근태코드를 찾을 수 없습니다.")
    return row


def list_attendance_codes(session: Session) -> list[TimAttendanceCodeItem]:
    rows = session.exec(
        select(TimAttendanceCode).order_by(TimAttendanceCode.sort_order, TimAttendanceCode.id)
    ).all()
    return [_build_item(row) for row in rows]


def _apply_batch_item(row: TimAttendanceCode, item: TimAttendanceCodeBatchItem) -> None:
    row.code = item.code.strip().upper()
    row.name = item.name.strip()
    row.category = item.category
    row.unit = item.unit
    row.is_requestable = item.is_requestable
    row.min_days = item.min_days
    row.max_days = item.max_days
    row.deduct_annual = item.deduct_annual
    row.is_active = item.is_active
    row.sort_order = item.sort_order
    row.description = item.description
    row.updated_at = _utc_now()


def batch_save_attendance_codes(
    session: Session, payload: TimAttendanceCodeBatchRequest
) -> TimAttendanceCodeBatchResponse:
    inserted = 0
    updated = 0
    deleted = 0

    # Delete
    for del_id in payload.delete_ids:
        row = session.get(TimAttendanceCode, del_id)
        if row is not None:
            session.delete(row)
            deleted += 1

    # Upsert
    for item in payload.items:
        if item.id is not None and item.id > 0:
            row = session.get(TimAttendanceCode, item.id)
            if row is not None:
                _apply_batch_item(row, item)
                session.add(row)
                updated += 1
                continue

        # Check duplicate code
        code_upper = item.code.strip().upper()
        dup = session.exec(
            select(TimAttendanceCode.id).where(TimAttendanceCode.code == code_upper)
        ).first()
        if dup is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"근태코드 '{code_upper}'가 이미 존재합니다.",
            )

        row = TimAttendanceCode(created_at=_utc_now())
        _apply_batch_item(row, item)
        session.add(row)
        inserted += 1

    session.commit()

    items = list_attendance_codes(session)
    return TimAttendanceCodeBatchResponse(
        items=items,
        total_count=len(items),
        inserted_count=inserted,
        updated_count=updated,
        deleted_count=deleted,
    )
