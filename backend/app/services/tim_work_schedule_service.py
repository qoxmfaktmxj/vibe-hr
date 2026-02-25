from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import TimWorkScheduleCode
from app.schemas.tim_work_schedule import (
    TimWorkScheduleCodeBatchItem,
    TimWorkScheduleCodeBatchRequest,
    TimWorkScheduleCodeBatchResponse,
    TimWorkScheduleCodeItem,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _build_item(row: TimWorkScheduleCode) -> TimWorkScheduleCodeItem:
    return TimWorkScheduleCodeItem(
        id=row.id,
        code=row.code,
        name=row.name,
        work_start=row.work_start,
        work_end=row.work_end,
        break_minutes=row.break_minutes,
        is_overnight=row.is_overnight,
        work_hours=row.work_hours,
        is_active=row.is_active,
        sort_order=row.sort_order,
        description=row.description,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def list_work_schedule_codes(session: Session) -> list[TimWorkScheduleCodeItem]:
    rows = session.exec(
        select(TimWorkScheduleCode).order_by(TimWorkScheduleCode.sort_order, TimWorkScheduleCode.id)
    ).all()
    return [_build_item(row) for row in rows]


def _apply_batch_item(row: TimWorkScheduleCode, item: TimWorkScheduleCodeBatchItem) -> None:
    row.code = item.code.strip().upper()
    row.name = item.name.strip()
    row.work_start = item.work_start
    row.work_end = item.work_end
    row.break_minutes = item.break_minutes
    row.is_overnight = item.is_overnight
    row.work_hours = item.work_hours
    row.is_active = item.is_active
    row.sort_order = item.sort_order
    row.description = item.description
    row.updated_at = _utc_now()


def batch_save_work_schedule_codes(
    session: Session, payload: TimWorkScheduleCodeBatchRequest
) -> TimWorkScheduleCodeBatchResponse:
    inserted = 0
    updated = 0
    deleted = 0

    for del_id in payload.delete_ids:
        row = session.get(TimWorkScheduleCode, del_id)
        if row is not None:
            session.delete(row)
            deleted += 1

    for item in payload.items:
        if item.id is not None and item.id > 0:
            row = session.get(TimWorkScheduleCode, item.id)
            if row is not None:
                _apply_batch_item(row, item)
                session.add(row)
                updated += 1
                continue

        code_upper = item.code.strip().upper()
        dup = session.exec(
            select(TimWorkScheduleCode.id).where(TimWorkScheduleCode.code == code_upper)
        ).first()
        if dup is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"근무코드 '{code_upper}'가 이미 존재합니다.",
            )

        row = TimWorkScheduleCode(created_at=_utc_now())
        _apply_batch_item(row, item)
        session.add(row)
        inserted += 1

    session.commit()

    items = list_work_schedule_codes(session)
    return TimWorkScheduleCodeBatchResponse(
        items=items,
        total_count=len(items),
        inserted_count=inserted,
        updated_count=updated,
        deleted_count=deleted,
    )
