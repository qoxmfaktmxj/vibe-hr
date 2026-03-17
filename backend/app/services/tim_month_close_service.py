from __future__ import annotations

from calendar import monthrange
from datetime import date

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.core.time_utils import utc_now
from app.models import AuthUser, HrAttendanceDaily, TimMonthClose
from app.schemas.tim_month_close import (
    TimMonthCloseActionResponse,
    TimMonthCloseItem,
    TimMonthCloseListResponse,
)


def _get_display_name(session: Session, user_id: int | None) -> str | None:
    if user_id is None:
        return None
    user = session.exec(select(AuthUser).where(AuthUser.id == user_id)).first()
    return user.display_name if user else None


def _to_item(session: Session, row: TimMonthClose) -> TimMonthCloseItem:
    return TimMonthCloseItem(
        id=row.id,
        year=row.year,
        month=row.month,
        close_status=row.close_status,
        employee_count=row.employee_count,
        present_days=row.present_days,
        absent_days=row.absent_days,
        late_days=row.late_days,
        leave_days=row.leave_days,
        closed_by=row.closed_by,
        closed_by_name=_get_display_name(session, row.closed_by),
        closed_at=row.closed_at,
        reopened_by=row.reopened_by,
        reopened_by_name=_get_display_name(session, row.reopened_by),
        reopened_at=row.reopened_at,
        note=row.note,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _virtual_open(year: int, month: int) -> TimMonthCloseItem:
    """DB 레코드가 없는 월에 대한 가상 'open' 항목을 반환한다."""
    return TimMonthCloseItem(
        id=None,
        year=year,
        month=month,
        close_status="open",
        employee_count=0,
        present_days=0,
        absent_days=0,
        late_days=0,
        leave_days=0,
        closed_by=None,
        closed_by_name=None,
        closed_at=None,
        reopened_by=None,
        reopened_by_name=None,
        reopened_at=None,
        note=None,
        created_at=None,
        updated_at=None,
    )


def list_month_closes(session: Session, year: int) -> TimMonthCloseListResponse:
    rows = session.exec(
        select(TimMonthClose).where(TimMonthClose.year == year).order_by(TimMonthClose.month)
    ).all()
    row_map = {r.month: r for r in rows}

    items = [
        _to_item(session, row_map[m]) if m in row_map else _virtual_open(year, m)
        for m in range(1, 13)
    ]
    return TimMonthCloseListResponse(items=items, year=year, total_count=12)


def assert_month_not_closed(session: Session, year: int, month: int) -> None:
    """해당 년월이 마감 상태이면 HTTP 423(Locked)을 발생시킨다."""
    row = session.exec(
        select(TimMonthClose).where(
            TimMonthClose.year == year,
            TimMonthClose.month == month,
        )
    ).first()
    if row and row.close_status == "closed":
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"{year}년 {month}월은 마감된 기간입니다. 수정이 제한됩니다.",
        )


def _calc_aggregates(session: Session, year: int, month: int) -> dict[str, int]:
    """해당 년월의 HrAttendanceDaily 집계를 반환한다."""
    first_day = date(year, month, 1)
    last_day = date(year, month, monthrange(year, month)[1])

    rows = session.exec(
        select(HrAttendanceDaily).where(
            HrAttendanceDaily.work_date >= first_day,
            HrAttendanceDaily.work_date <= last_day,
        )
    ).all()

    employee_ids: set[int] = set()
    present = late = absent = leave = 0

    for r in rows:
        employee_ids.add(r.employee_id)
        s = r.attendance_status or ""
        if s == "present":
            present += 1
        elif s == "late":
            late += 1
        elif s == "absent":
            absent += 1
        elif s in ("leave", "half_day"):
            leave += 1

    return {
        "employee_count": len(employee_ids),
        "present_days": present,
        "late_days": late,
        "absent_days": absent,
        "leave_days": leave,
    }


def close_month(
    session: Session,
    year: int,
    month: int,
    closed_by_user_id: int,
    note: str | None,
) -> TimMonthCloseActionResponse:
    row = session.exec(
        select(TimMonthClose).where(
            TimMonthClose.year == year,
            TimMonthClose.month == month,
        )
    ).first()

    if row and row.close_status == "closed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{year}년 {month}월은 이미 마감 상태입니다.",
        )

    agg = _calc_aggregates(session, year, month)
    now = utc_now()

    if row is None:
        row = TimMonthClose(
            year=year,
            month=month,
            close_status="closed",
            closed_by=closed_by_user_id,
            closed_at=now,
            note=note,
            created_at=now,
            updated_at=now,
            **agg,
        )
        session.add(row)
    else:
        row.close_status = "closed"
        row.closed_by = closed_by_user_id
        row.closed_at = now
        row.note = note
        row.updated_at = now
        for k, v in agg.items():
            setattr(row, k, v)

    session.commit()
    session.refresh(row)
    return TimMonthCloseActionResponse(item=_to_item(session, row))


def reopen_month(
    session: Session,
    year: int,
    month: int,
    reopened_by_user_id: int,
) -> TimMonthCloseActionResponse:
    row = session.exec(
        select(TimMonthClose).where(
            TimMonthClose.year == year,
            TimMonthClose.month == month,
        )
    ).first()

    if row is None or row.close_status == "open":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{year}년 {month}월은 마감 상태가 아닙니다.",
        )

    row.close_status = "open"
    row.reopened_by = reopened_by_user_id
    row.reopened_at = utc_now()
    row.updated_at = utc_now()
    session.commit()
    session.refresh(row)
    return TimMonthCloseActionResponse(item=_to_item(session, row))
