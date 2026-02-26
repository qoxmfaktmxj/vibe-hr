from __future__ import annotations

from datetime import datetime, time

from sqlmodel import Session, select

from app.core.time_utils import business_today

from app.models import (
    HrEmployee,
    TimDepartmentScheduleAssignment,
    TimEmployeeDailySchedule,
    TimEmployeeScheduleException,
    TimHoliday,
    TimSchedulePattern,
    TimSchedulePatternDay,
)
from app.schemas.tim_schedule import (
    TimEmployeeScheduleExceptionBatchRequest,
    TimEmployeeScheduleExceptionBatchResponse,
    TimEmployeeScheduleExceptionItem,
    TimScheduleGenerateRequest,
    TimScheduleGenerateResponse,
    TimSchedulePatternItem,
    TimScheduleTodayItem,
)


def _in_range(target: date, start: date, end: date | None) -> bool:
    if target < start:
        return False
    if end is not None and target > end:
        return False
    return True


def _to_datetime(work_date: date, hhmm: str | None) -> datetime | None:
    if not hhmm:
        return None
    h, m = hhmm.split(":")
    return datetime.combine(work_date, time(int(h), int(m)))


def _resolve_assignment(session: Session, employee: HrEmployee, work_date: date):
    ex = session.exec(
        select(TimEmployeeScheduleException)
        .where(
            TimEmployeeScheduleException.employee_id == employee.id,
            TimEmployeeScheduleException.is_active == True,
        )
        .order_by(TimEmployeeScheduleException.priority.desc(), TimEmployeeScheduleException.id.desc())
    ).all()
    for row in ex:
        if _in_range(work_date, row.effective_from, row.effective_to):
            return row.pattern_id, "employee_exception"

    deps = session.exec(
        select(TimDepartmentScheduleAssignment)
        .where(
            TimDepartmentScheduleAssignment.department_id == employee.department_id,
            TimDepartmentScheduleAssignment.is_active == True,
        )
        .order_by(TimDepartmentScheduleAssignment.priority.desc(), TimDepartmentScheduleAssignment.id.desc())
    ).all()
    for row in deps:
        if _in_range(work_date, row.effective_from, row.effective_to):
            return row.pattern_id, "department_default"

    default_pattern = session.exec(
        select(TimSchedulePattern)
        .where(TimSchedulePattern.is_active == True)
        .order_by(TimSchedulePattern.id.asc())
    ).first()
    return (default_pattern.id if default_pattern else None), "company_default"


def generate_employee_daily_schedules(session: Session, payload: TimScheduleGenerateRequest) -> TimScheduleGenerateResponse:
    employees_query = select(HrEmployee)
    if payload.target == "department" and payload.department_id:
        employees_query = employees_query.where(HrEmployee.department_id == payload.department_id)
    elif payload.target == "employee" and payload.employee_ids:
        employees_query = employees_query.where(HrEmployee.id.in_(payload.employee_ids))

    employees = session.exec(employees_query).all()
    holidays = {
        item.holiday_date: item
        for item in session.exec(select(TimHoliday).where(TimHoliday.holiday_date >= payload.date_from, TimHoliday.holiday_date <= payload.date_to)).all()
    }

    created = 0
    updated = 0
    skipped = 0
    version_tag = datetime.utcnow().strftime("gen-%Y%m%d-%H%M%S")

    day = payload.date_from
    while day <= payload.date_to:
        weekday = day.weekday()
        for employee in employees:
            pattern_id, source = _resolve_assignment(session, employee, day)
            pattern = session.get(TimSchedulePattern, pattern_id) if pattern_id else None
            pattern_day = None
            if pattern is not None:
                pattern_day = session.exec(
                    select(TimSchedulePatternDay).where(TimSchedulePatternDay.pattern_id == pattern.id, TimSchedulePatternDay.weekday == weekday)
                ).first()

            is_holiday = day in holidays
            holiday_name = holidays[day].name if is_holiday else None

            is_workday = bool(pattern_day.is_workday) if pattern_day else weekday < 5
            if is_holiday:
                is_workday = False

            start_time = pattern_day.start_time if pattern_day else ("09:00" if is_workday else None)
            end_time = pattern_day.end_time if pattern_day else ("18:00" if is_workday else None)
            break_minutes = pattern_day.break_minutes if pattern_day else 60
            expected_minutes = pattern_day.expected_minutes if pattern_day else (480 if is_workday else 0)
            is_overnight = pattern_day.is_overnight if pattern_day else False

            existing = session.exec(
                select(TimEmployeeDailySchedule).where(
                    TimEmployeeDailySchedule.employee_id == employee.id,
                    TimEmployeeDailySchedule.work_date == day,
                )
            ).first()

            if existing and payload.mode != "overwrite":
                skipped += 1
                continue

            target = existing if existing else TimEmployeeDailySchedule(employee_id=employee.id, work_date=day)
            target.schedule_source = source
            target.pattern_id = pattern.id if pattern else None
            target.is_holiday = is_holiday
            target.holiday_name = holiday_name
            target.is_workday = is_workday
            target.planned_start_at = _to_datetime(day, start_time)
            target.planned_end_at = _to_datetime(day, end_time)
            target.break_minutes = break_minutes
            target.expected_minutes = expected_minutes
            target.is_overnight = is_overnight
            target.generated_at = datetime.utcnow()
            target.version_tag = version_tag
            session.add(target)

            if existing:
                updated += 1
            else:
                created += 1

        day = date.fromordinal(day.toordinal() + 1)

    session.commit()
    return TimScheduleGenerateResponse(
        created_count=created,
        updated_count=updated,
        skipped_count=skipped,
        version_tag=version_tag,
    )


def get_my_today_schedule(session: Session, employee_id: int) -> TimScheduleTodayItem:
    today = business_today()
    row = session.exec(
        select(TimEmployeeDailySchedule).where(
            TimEmployeeDailySchedule.employee_id == employee_id,
            TimEmployeeDailySchedule.work_date == today,
        )
    ).first()

    pattern = session.get(TimSchedulePattern, row.pattern_id) if row and row.pattern_id else None
    day_type = "holiday" if row and row.is_holiday else ("workday" if row and row.is_workday else "weekend")

    return TimScheduleTodayItem(
        employee_id=employee_id,
        work_date=today,
        day_type=day_type,
        schedule_source=row.schedule_source if row else "company_default",
        pattern_code=pattern.code if pattern else None,
        pattern_name=pattern.name if pattern else None,
        work_start=row.planned_start_at.strftime("%H:%M") if row and row.planned_start_at else None,
        work_end=row.planned_end_at.strftime("%H:%M") if row and row.planned_end_at else None,
        break_minutes=row.break_minutes if row else 60,
        expected_minutes=row.expected_minutes if row else 0,
        is_holiday=row.is_holiday if row else False,
        holiday_name=row.holiday_name if row else None,
        generated_at=row.generated_at if row else None,
    )


def list_schedule_patterns(session: Session) -> list[TimSchedulePatternItem]:
    rows = session.exec(
        select(TimSchedulePattern)
        .where(TimSchedulePattern.is_active == True)
        .order_by(TimSchedulePattern.id.asc())
    ).all()
    return [TimSchedulePatternItem(id=row.id, code=row.code, name=row.name) for row in rows]


def list_employee_schedule_exceptions(session: Session, employee_id: int | None = None) -> list[TimEmployeeScheduleExceptionItem]:
    query = select(TimEmployeeScheduleException).order_by(TimEmployeeScheduleException.effective_from.desc(), TimEmployeeScheduleException.id.desc())
    if employee_id is not None:
        query = query.where(TimEmployeeScheduleException.employee_id == employee_id)
    rows = session.exec(query).all()
    return [
        TimEmployeeScheduleExceptionItem(
            id=row.id,
            employee_id=row.employee_id,
            pattern_id=row.pattern_id,
            effective_from=row.effective_from,
            effective_to=row.effective_to,
            reason=row.reason,
            priority=row.priority,
            is_active=row.is_active,
        )
        for row in rows
    ]


def batch_save_employee_schedule_exceptions(
    session: Session,
    payload: TimEmployeeScheduleExceptionBatchRequest,
) -> TimEmployeeScheduleExceptionBatchResponse:
    inserted = 0
    updated = 0
    deleted = 0

    if payload.delete_ids:
        targets = session.exec(select(TimEmployeeScheduleException).where(TimEmployeeScheduleException.id.in_(payload.delete_ids))).all()
        for row in targets:
            session.delete(row)
        deleted = len(targets)

    for item in payload.items:
        row = session.get(TimEmployeeScheduleException, item.id) if item.id else None
        if row is None:
            row = TimEmployeeScheduleException(
                employee_id=item.employee_id,
                pattern_id=item.pattern_id,
                effective_from=item.effective_from,
                effective_to=item.effective_to,
                reason=item.reason,
                priority=item.priority,
                is_active=item.is_active,
            )
            session.add(row)
            inserted += 1
        else:
            row.employee_id = item.employee_id
            row.pattern_id = item.pattern_id
            row.effective_from = item.effective_from
            row.effective_to = item.effective_to
            row.reason = item.reason
            row.priority = item.priority
            row.is_active = item.is_active
            session.add(row)
            updated += 1

    session.commit()
    items = list_employee_schedule_exceptions(session)
    return TimEmployeeScheduleExceptionBatchResponse(
        items=items,
        total_count=len(items),
        inserted_count=inserted,
        updated_count=updated,
        deleted_count=deleted,
    )
