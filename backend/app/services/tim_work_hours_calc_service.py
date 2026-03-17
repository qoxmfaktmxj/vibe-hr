"""근무시간 자동계산 엔진.

출퇴근 기록(HrAttendanceDaily)과 일별스케줄(TimEmployeeDailySchedule)을 비교하여
연장/야간/휴일 근무시간을 자동 판정·저장한다.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlmodel import Session, select

from app.core.time_utils import APP_TZ
from app.models import HrAttendanceDaily, TimEmployeeDailySchedule

# 야간근무 구간 (KST 기준 22:00 ~ 06:00)
_NIGHT_START = time(22, 0)
_NIGHT_END = time(6, 0)

# 휴일근무 기본 시간 기준 (8시간 = 480분)
_HOLIDAY_BASE_MINUTES = 480


def _ensure_utc_aware(dt: datetime) -> datetime:
    """naive datetime → UTC aware (KST 가정)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=APP_TZ).astimezone(timezone.utc)
    return dt.astimezone(timezone.utc)


def _to_kst(dt: datetime) -> datetime:
    """UTC aware → KST aware."""
    return _ensure_utc_aware(dt).astimezone(APP_TZ)


def _calc_night_overlap_minutes(start_kst: datetime, end_kst: datetime) -> int:
    """실제 근무 구간과 야간 구간(22:00~06:00 KST)의 교차 시간(분)을 계산."""
    if start_kst >= end_kst:
        return 0

    total = 0
    current_date = start_kst.date()
    end_date = end_kst.date() + timedelta(days=1)  # 다음날까지 포함

    while current_date <= end_date:
        # 이 날짜의 야간 구간: 전날 22:00 ~ 이 날 06:00, 그리고 이 날 22:00 ~ 다음날 06:00
        # 두 구간으로 나눠서 계산

        # 구간 1: current_date 새벽 00:00 ~ 06:00 (전날 야간의 연장)
        night_seg_start = datetime.combine(current_date, time(0, 0), tzinfo=APP_TZ)
        night_seg_end = datetime.combine(current_date, _NIGHT_END, tzinfo=APP_TZ)
        overlap_start = max(start_kst, night_seg_start)
        overlap_end = min(end_kst, night_seg_end)
        if overlap_start < overlap_end:
            total += int((overlap_end - overlap_start).total_seconds() // 60)

        # 구간 2: current_date 22:00 ~ 다음날 00:00
        night_seg_start = datetime.combine(current_date, _NIGHT_START, tzinfo=APP_TZ)
        night_seg_end = datetime.combine(current_date + timedelta(days=1), time(0, 0), tzinfo=APP_TZ)
        overlap_start = max(start_kst, night_seg_start)
        overlap_end = min(end_kst, night_seg_end)
        if overlap_start < overlap_end:
            total += int((overlap_end - overlap_start).total_seconds() // 60)

        current_date += timedelta(days=1)

    return total


def calculate_work_hours(
    session: Session,
    attendance: HrAttendanceDaily,
) -> dict:
    """단일 근태 레코드의 근무시간을 계산하여 dict로 반환.

    Returns:
        dict with keys: actual_minutes, regular_minutes, overtime_minutes,
        night_minutes, holiday_work_minutes, holiday_overtime_minutes,
        holiday_night_minutes, is_holiday_work
    """
    result = {
        "actual_minutes": 0,
        "regular_minutes": 0,
        "overtime_minutes": 0,
        "night_minutes": 0,
        "holiday_work_minutes": 0,
        "holiday_overtime_minutes": 0,
        "holiday_night_minutes": 0,
        "is_holiday_work": False,
    }

    if not attendance.check_in_at or not attendance.check_out_at:
        return result

    if attendance.attendance_status in ("absent", "leave"):
        return result

    # 일별 스케줄 조회
    schedule = session.exec(
        select(TimEmployeeDailySchedule).where(
            TimEmployeeDailySchedule.employee_id == attendance.employee_id,
            TimEmployeeDailySchedule.work_date == attendance.work_date,
        )
    ).first()

    check_in_kst = _to_kst(attendance.check_in_at)
    check_out_kst = _to_kst(attendance.check_out_at)

    # 휴식시간 (분)
    break_minutes = schedule.break_minutes if schedule else 60
    expected_minutes = schedule.expected_minutes if schedule else 480
    is_holiday = (schedule.is_holiday if schedule else False) or (
        not schedule and attendance.work_date.weekday() >= 5
    )
    is_workday = schedule.is_workday if schedule else (attendance.work_date.weekday() < 5)

    # 실제 근무시간 (분) = 퇴근 - 출근 - 휴식
    raw_minutes = int((check_out_kst - check_in_kst).total_seconds() // 60)
    actual = max(raw_minutes - break_minutes, 0)

    result["actual_minutes"] = actual

    # 야간근무시간 계산 (22:00~06:00 KST)
    night_total = _calc_night_overlap_minutes(check_in_kst, check_out_kst)

    if is_holiday or not is_workday:
        # ── 휴일/비근무일 근무 ──
        result["is_holiday_work"] = True
        result["holiday_work_minutes"] = min(actual, _HOLIDAY_BASE_MINUTES)
        result["holiday_overtime_minutes"] = max(actual - _HOLIDAY_BASE_MINUTES, 0)
        result["holiday_night_minutes"] = night_total
    else:
        # ── 평일 근무일 ──
        result["regular_minutes"] = min(actual, expected_minutes)
        result["overtime_minutes"] = max(actual - expected_minutes, 0)
        result["night_minutes"] = night_total

    return result


def apply_work_hours(
    attendance: HrAttendanceDaily,
    hours: dict,
) -> None:
    """계산 결과를 HrAttendanceDaily 레코드에 반영."""
    attendance.actual_minutes = hours["actual_minutes"]
    attendance.regular_minutes = hours["regular_minutes"]
    attendance.overtime_minutes = hours["overtime_minutes"]
    attendance.night_minutes = hours["night_minutes"]
    attendance.holiday_work_minutes = hours["holiday_work_minutes"]
    attendance.holiday_overtime_minutes = hours["holiday_overtime_minutes"]
    attendance.holiday_night_minutes = hours["holiday_night_minutes"]
    attendance.is_holiday_work = hours["is_holiday_work"]
    attendance.calculated_at = datetime.now(timezone.utc)


def calculate_and_save(session: Session, attendance: HrAttendanceDaily) -> dict:
    """단일 레코드 계산 + 저장."""
    hours = calculate_work_hours(session, attendance)
    apply_work_hours(attendance, hours)
    session.add(attendance)
    return hours


def recalculate_month(session: Session, year: int, month: int) -> int:
    """한 달 전체 근태 레코드를 재계산. 반환값: 처리 건수."""
    first_day = date(year, month, 1)
    last_day = date(year, month, monthrange(year, month)[1])

    rows = session.exec(
        select(HrAttendanceDaily).where(
            HrAttendanceDaily.work_date >= first_day,
            HrAttendanceDaily.work_date <= last_day,
        )
    ).all()

    count = 0
    for attendance in rows:
        if attendance.check_in_at and attendance.check_out_at:
            calculate_and_save(session, attendance)
            count += 1

    session.flush()
    return count
