from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import Session, select

from app.models import AuthUser, HrAttendanceDaily, HrEmployee, TimMonthClose
from app.schemas.tim_month_close import (
    TimMonthCloseItem,
    TimMonthCloseListResponse,
    TimMonthCloseRequest,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _build_item(close: TimMonthClose, user_map: dict[int, str]) -> TimMonthCloseItem:
    return TimMonthCloseItem(
        id=close.id or 0,
        year=close.year,
        month=close.month,
        close_status=close.close_status,
        employee_count=close.employee_count,
        present_days=close.present_days,
        absent_days=close.absent_days,
        late_days=close.late_days,
        leave_days=close.leave_days,
        closed_by=close.closed_by,
        closed_by_name=user_map.get(close.closed_by) if close.closed_by else None,
        closed_at=close.closed_at,
        reopened_by=close.reopened_by,
        reopened_by_name=user_map.get(close.reopened_by) if close.reopened_by else None,
        reopened_at=close.reopened_at,
        note=close.note,
        created_at=close.created_at,
        updated_at=close.updated_at,
    )


def _load_user_map(session: Session, closes: list[TimMonthClose]) -> dict[int, str]:
    user_ids: set[int] = set()
    for c in closes:
        if c.closed_by:
            user_ids.add(c.closed_by)
        if c.reopened_by:
            user_ids.add(c.reopened_by)
    if not user_ids:
        return {}
    rows = session.exec(
        select(AuthUser.id, AuthUser.display_name).where(AuthUser.id.in_(list(user_ids)))
    ).all()
    return {uid: name for uid, name in rows}


def _calc_stats(session: Session, year: int, month: int) -> dict[str, int]:
    """해당 년/월 근태 통계 집계"""
    from calendar import monthrange

    first_day = f"{year:04d}-{month:02d}-01"
    last_day_num = monthrange(year, month)[1]
    last_day = f"{year:04d}-{month:02d}-{last_day_num:02d}"

    # 활성 직원 수
    emp_count = session.exec(
        select(func.count(HrEmployee.id)).where(HrEmployee.employment_status == "active")
    ).one() or 0

    # 근태 상태별 집계
    rows = session.exec(
        select(HrAttendanceDaily.attendance_status, func.count(HrAttendanceDaily.id))
        .where(
            HrAttendanceDaily.work_date >= first_day,
            HrAttendanceDaily.work_date <= last_day,
        )
        .group_by(HrAttendanceDaily.attendance_status)
    ).all()

    counts: dict[str, int] = {status_: int(cnt) for status_, cnt in rows}

    return {
        "employee_count": int(emp_count),
        "present_days": counts.get("present", 0),
        "absent_days": counts.get("absent", 0),
        "late_days": counts.get("late", 0),
        "leave_days": counts.get("leave", 0),
    }


def list_month_closes(
    session: Session,
    *,
    year: int | None = None,
) -> TimMonthCloseListResponse:
    stmt = select(TimMonthClose).order_by(TimMonthClose.year.desc(), TimMonthClose.month.desc())
    if year is not None:
        stmt = stmt.where(TimMonthClose.year == year)
    closes = session.exec(stmt).all()
    user_map = _load_user_map(session, list(closes))
    items = [_build_item(c, user_map) for c in closes]
    return TimMonthCloseListResponse(items=items, total_count=len(items))


def close_month(
    session: Session,
    payload: TimMonthCloseRequest,
    user_id: int,
) -> TimMonthCloseItem:
    """월 마감 처리 — 이미 closed이면 409"""
    existing = session.exec(
        select(TimMonthClose).where(
            TimMonthClose.year == payload.year,
            TimMonthClose.month == payload.month,
        )
    ).first()

    if existing and existing.close_status == "closed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{payload.year}년 {payload.month}월은 이미 마감되었습니다.",
        )

    stats = _calc_stats(session, payload.year, payload.month)
    now = _utc_now()

    if existing:
        # reclose (was open, close again)
        existing.close_status = "closed"
        existing.employee_count = stats["employee_count"]
        existing.present_days = stats["present_days"]
        existing.absent_days = stats["absent_days"]
        existing.late_days = stats["late_days"]
        existing.leave_days = stats["leave_days"]
        existing.closed_by = user_id
        existing.closed_at = now
        existing.note = payload.note
        existing.updated_at = now
        session.add(existing)
        session.commit()
        session.refresh(existing)
        close = existing
    else:
        close = TimMonthClose(
            year=payload.year,
            month=payload.month,
            close_status="closed",
            employee_count=stats["employee_count"],
            present_days=stats["present_days"],
            absent_days=stats["absent_days"],
            late_days=stats["late_days"],
            leave_days=stats["leave_days"],
            closed_by=user_id,
            closed_at=now,
            note=payload.note,
            created_at=now,
            updated_at=now,
        )
        session.add(close)
        session.commit()
        session.refresh(close)

    user_map = _load_user_map(session, [close])
    return _build_item(close, user_map)


def reopen_month(
    session: Session,
    year: int,
    month: int,
    user_id: int,
    note: str | None = None,
) -> TimMonthCloseItem:
    """월 마감 취소 — closed가 아니면 409"""
    close = session.exec(
        select(TimMonthClose).where(
            TimMonthClose.year == year,
            TimMonthClose.month == month,
        )
    ).first()

    if not close or close.close_status != "closed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{year}년 {month}월은 마감 상태가 아닙니다.",
        )

    now = _utc_now()
    close.close_status = "open"
    close.reopened_by = user_id
    close.reopened_at = now
    if note is not None:
        close.note = note
    close.updated_at = now
    session.add(close)
    session.commit()
    session.refresh(close)

    user_map = _load_user_map(session, [close])
    return _build_item(close, user_map)


def is_month_closed(session: Session, year: int, month: int) -> bool:
    """근태 수정 API 등에서 마감 여부 확인용"""
    row = session.exec(
        select(TimMonthClose.close_status).where(
            TimMonthClose.year == year,
            TimMonthClose.month == month,
        )
    ).first()
    return row == "closed"
