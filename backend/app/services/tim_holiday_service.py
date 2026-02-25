from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import TimHoliday
from app.schemas.tim_holiday import (
    TimHolidayBatchItem,
    TimHolidayBatchRequest,
    TimHolidayBatchResponse,
    TimHolidayCopyYearRequest,
    TimHolidayCopyYearResponse,
    TimHolidayItem,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _build_item(row: TimHoliday) -> TimHolidayItem:
    return TimHolidayItem(
        id=row.id,
        holiday_date=row.holiday_date,
        name=row.name,
        holiday_type=row.holiday_type,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def list_holidays(session: Session, year: int) -> list[TimHolidayItem]:
    start = date(year, 1, 1)
    end = date(year, 12, 31)
    rows = session.exec(
        select(TimHoliday)
        .where(TimHoliday.holiday_date >= start, TimHoliday.holiday_date <= end)
        .order_by(TimHoliday.holiday_date)
    ).all()
    return [_build_item(row) for row in rows]


def _apply_batch_item(row: TimHoliday, item: TimHolidayBatchItem) -> None:
    row.holiday_date = item.holiday_date
    row.name = item.name.strip()
    row.holiday_type = item.holiday_type
    row.is_active = item.is_active
    row.updated_at = _utc_now()


def batch_save_holidays(
    session: Session, payload: TimHolidayBatchRequest, year: int
) -> TimHolidayBatchResponse:
    inserted = 0
    updated = 0
    deleted = 0

    for del_id in payload.delete_ids:
        row = session.get(TimHoliday, del_id)
        if row is not None:
            session.delete(row)
            deleted += 1

    for item in payload.items:
        if item.id is not None and item.id > 0:
            row = session.get(TimHoliday, item.id)
            if row is not None:
                _apply_batch_item(row, item)
                session.add(row)
                updated += 1
                continue

        dup = session.exec(
            select(TimHoliday.id).where(TimHoliday.holiday_date == item.holiday_date)
        ).first()
        if dup is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"공휴일 '{item.holiday_date}'가 이미 존재합니다.",
            )

        row = TimHoliday(created_at=_utc_now())
        _apply_batch_item(row, item)
        session.add(row)
        inserted += 1

    session.commit()

    items = list_holidays(session, year)
    return TimHolidayBatchResponse(
        items=items,
        total_count=len(items),
        year=year,
        inserted_count=inserted,
        updated_count=updated,
        deleted_count=deleted,
    )


def copy_year_holidays(
    session: Session, payload: TimHolidayCopyYearRequest
) -> TimHolidayCopyYearResponse:
    if payload.year_from == payload.year_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="복사 원본과 대상 연도가 같을 수 없습니다.",
        )

    source_start = date(payload.year_from, 1, 1)
    source_end = date(payload.year_from, 12, 31)
    source_rows = session.exec(
        select(TimHoliday)
        .where(TimHoliday.holiday_date >= source_start, TimHoliday.holiday_date <= source_end)
        .order_by(TimHoliday.holiday_date)
    ).all()

    if not source_rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{payload.year_from}년 공휴일 데이터가 없습니다.",
        )

    copied = 0
    for src in source_rows:
        target_date = src.holiday_date.replace(year=payload.year_to)
        existing = session.exec(
            select(TimHoliday.id).where(TimHoliday.holiday_date == target_date)
        ).first()
        if existing is not None:
            continue

        row = TimHoliday(
            holiday_date=target_date,
            name=src.name,
            holiday_type=src.holiday_type,
            is_active=src.is_active,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(row)
        copied += 1

    session.commit()
    return TimHolidayCopyYearResponse(copied_count=copied, year_to=payload.year_to)
