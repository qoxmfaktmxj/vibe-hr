from __future__ import annotations

import logging
from calendar import monthrange
from datetime import date

from fastapi import HTTPException, status
from sqlmodel import Session, col, func, select

from app.core.time_utils import utc_now
from app.models import AuthUser, HrAttendanceDaily, HrEmployee, TimMonthClose
from app.models.entities import PayEmployeeProfile, PayVariableInput
from app.schemas.tim_month_close import (
    TimMonthCloseActionResponse,
    TimMonthCloseItem,
    TimMonthCloseListResponse,
)

logger = logging.getLogger(__name__)


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
        total_overtime_minutes=row.total_overtime_minutes,
        total_night_minutes=row.total_night_minutes,
        total_holiday_work_minutes=row.total_holiday_work_minutes,
        total_holiday_overtime_minutes=row.total_holiday_overtime_minutes,
        total_holiday_night_minutes=row.total_holiday_night_minutes,
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
        total_overtime_minutes=0,
        total_night_minutes=0,
        total_holiday_work_minutes=0,
        total_holiday_overtime_minutes=0,
        total_holiday_night_minutes=0,
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
    tot_overtime = tot_night = tot_holiday_work = tot_holiday_overtime = tot_holiday_night = 0

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

        tot_overtime += r.overtime_minutes or 0
        tot_night += r.night_minutes or 0
        tot_holiday_work += r.holiday_work_minutes or 0
        tot_holiday_overtime += r.holiday_overtime_minutes or 0
        tot_holiday_night += r.holiday_night_minutes or 0

    return {
        "employee_count": len(employee_ids),
        "present_days": present,
        "late_days": late,
        "absent_days": absent,
        "leave_days": leave,
        "total_overtime_minutes": tot_overtime,
        "total_night_minutes": tot_night,
        "total_holiday_work_minutes": tot_holiday_work,
        "total_holiday_overtime_minutes": tot_holiday_overtime,
        "total_holiday_night_minutes": tot_holiday_night,
    }


_MONTHLY_STATUTORY_HOURS = 209  # 월 소정근로시간


def _generate_pay_variable_inputs(session: Session, year: int, month: int) -> int:
    """개인별 연장/야간/휴일 근무시간을 집계하여 PayVariableInput을 upsert한다.

    Returns:
        생성/갱신된 PayVariableInput 수
    """
    year_month = f"{year:04d}-{month:02d}"
    first_day = date(year, month, 1)
    last_day = date(year, month, monthrange(year, month)[1])

    # 개인별 연장/야간/휴일 합산
    stmt = (
        select(
            HrAttendanceDaily.employee_id,
            func.coalesce(func.sum(col(HrAttendanceDaily.overtime_minutes)), 0).label("overtime"),
            func.coalesce(func.sum(col(HrAttendanceDaily.night_minutes)), 0).label("night"),
            func.coalesce(func.sum(col(HrAttendanceDaily.holiday_work_minutes)), 0).label("holiday_work"),
            func.coalesce(func.sum(col(HrAttendanceDaily.holiday_overtime_minutes)), 0).label("holiday_overtime"),
            func.coalesce(func.sum(col(HrAttendanceDaily.holiday_night_minutes)), 0).label("holiday_night"),
        )
        .where(
            HrAttendanceDaily.work_date >= first_day,
            HrAttendanceDaily.work_date <= last_day,
        )
        .group_by(HrAttendanceDaily.employee_id)
    )
    per_employee = session.exec(stmt).all()

    count = 0
    for row in per_employee:
        emp_id = row[0]
        overtime_min = int(row[1])
        night_min = int(row[2])
        holiday_work_min = int(row[3])
        holiday_overtime_min = int(row[4])
        holiday_night_min = int(row[5])

        # base_hourly 계산: base_salary / 209
        profile = session.exec(
            select(PayEmployeeProfile)
            .where(
                PayEmployeeProfile.employee_id == emp_id,
                PayEmployeeProfile.is_active == True,  # noqa: E712
                PayEmployeeProfile.effective_from <= last_day,
            )
            .order_by(PayEmployeeProfile.effective_from.desc())
            .limit(1)
        ).first()

        if profile is None or profile.base_salary <= 0:
            continue

        base_hourly = profile.base_salary / _MONTHLY_STATUTORY_HOURS

        # (item_code, direction, minutes, multiplier)
        items = [
            ("OTX", "earning", overtime_min, 1.5),
            ("NGT", "earning", night_min, 0.5),
            ("HDW", "earning", holiday_work_min, 1.5),
            ("HDO", "earning", holiday_overtime_min, 2.0),
            ("HDN", "earning", holiday_night_min, 2.0),
        ]

        for item_code, direction, minutes, multiplier in items:
            amount = round(base_hourly * multiplier * (minutes / 60), 0) if minutes > 0 else 0

            existing = session.exec(
                select(PayVariableInput).where(
                    PayVariableInput.year_month == year_month,
                    PayVariableInput.employee_id == emp_id,
                    PayVariableInput.item_code == item_code,
                )
            ).first()

            if existing:
                existing.amount = amount
                existing.direction = direction
                existing.memo = f"월마감 자동생성 ({minutes}분)"
            else:
                if amount <= 0:
                    continue
                session.add(
                    PayVariableInput(
                        year_month=year_month,
                        employee_id=emp_id,
                        item_code=item_code,
                        direction=direction,
                        amount=amount,
                        memo=f"월마감 자동생성 ({minutes}분)",
                    )
                )
            count += 1

    return count


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

    # 마감 전 미계산 레코드 보정
    from app.services.tim_work_hours_calc_service import recalculate_month
    recalc_count = recalculate_month(session, year, month)
    if recalc_count > 0:
        logger.info("월마감 전 근무시간 재계산: %d건", recalc_count)

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

    # 개인별 연장/야간/휴일 → PayVariableInput 자동 생성
    vi_count = _generate_pay_variable_inputs(session, year, month)
    if vi_count > 0:
        logger.info("PayVariableInput 자동생성: %d건", vi_count)

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
