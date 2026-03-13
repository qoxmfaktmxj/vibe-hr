from __future__ import annotations

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.time_utils import APP_TZ, business_today

from app.models import (
    AuthUser,
    HrEmployee,
    OrgDepartment,
    TimDepartmentScheduleAssignment,
    TimEmployeeDailySchedule,
    TimEmployeeScheduleException,
    TimHoliday,
    TimSchedulePattern,
    TimSchedulePatternDay,
)
from app.schemas.tim_schedule import (
    TimDepartmentScheduleAssignmentBatchRequest,
    TimDepartmentScheduleAssignmentBatchResponse,
    TimDepartmentScheduleAssignmentItem,
    TimEmployeeScheduleExceptionBatchRequest,
    TimEmployeeScheduleExceptionBatchResponse,
    TimEmployeeScheduleExceptionItem,
    TimScheduleGenerateRequest,
    TimScheduleGenerateResponse,
    TimSchedulePatternItem,
    TimScheduleTodayItem,
)


def _fmt_kst(dt: datetime) -> str:
    """datetime 을 KST HH:MM 문자열로 변환한다.

    - UTC aware datetime: UTC → KST 변환 후 포맷
    - naive datetime (구 데이터 호환): KST 로 가정하여 그대로 포맷
    """
    if dt.tzinfo is None:
        # 구 방식으로 저장된 naive datetime: KST 로 간주
        return dt.strftime("%H:%M")
    return dt.astimezone(APP_TZ).strftime("%H:%M")


def _in_range(target: date, start: date, end: date | None) -> bool:
    if target < start:
        return False
    if end is not None and target > end:
        return False
    return True


def _to_datetime(work_date: date, hhmm: str | None) -> datetime | None:
    """KST 기준 HH:MM 문자열을 UTC aware datetime으로 변환한다.

    planned_start_at/planned_end_at 은 DB 의 다른 타임스탬프(check_in_at 등)와
    동일하게 UTC aware 로 저장하여 비교 시 timezone 불일치를 방지한다.
    """
    if not hhmm:
        return None
    h, m = hhmm.split(":")
    # 1) KST aware datetime 생성
    kst_dt = datetime.combine(work_date, time(int(h), int(m)), tzinfo=APP_TZ)
    # 2) UTC 로 변환하여 반환
    return kst_dt.astimezone(ZoneInfo("UTC"))


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
    employee_ids = [employee.id for employee in employees if employee.id is not None]
    holidays = {
        item.holiday_date: item
        for item in session.exec(select(TimHoliday).where(TimHoliday.holiday_date >= payload.date_from, TimHoliday.holiday_date <= payload.date_to)).all()
    }
    existing_schedule_map = {
        (item.employee_id, item.work_date): item
        for item in (
            session.exec(
                select(TimEmployeeDailySchedule).where(
                    TimEmployeeDailySchedule.employee_id.in_(employee_ids),
                    TimEmployeeDailySchedule.work_date >= payload.date_from,
                    TimEmployeeDailySchedule.work_date <= payload.date_to,
                )
            ).all()
            if employee_ids
            else []
        )
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

            existing = existing_schedule_map.get((employee.id, day))

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
            existing_schedule_map[(employee.id, day)] = target

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
        work_start=_fmt_kst(row.planned_start_at) if row and row.planned_start_at else None,
        work_end=_fmt_kst(row.planned_end_at) if row and row.planned_end_at else None,
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


def list_department_schedule_assignments(
    session: Session,
    department_id: int | None = None,
) -> list[TimDepartmentScheduleAssignmentItem]:
    query = (
        select(TimDepartmentScheduleAssignment)
        .order_by(
            TimDepartmentScheduleAssignment.is_active.desc(),
            TimDepartmentScheduleAssignment.priority.desc(),
            TimDepartmentScheduleAssignment.department_id.asc(),
            TimDepartmentScheduleAssignment.effective_from.desc(),
            TimDepartmentScheduleAssignment.id.desc(),
        )
    )
    if department_id is not None:
        query = query.where(TimDepartmentScheduleAssignment.department_id == department_id)

    rows = session.exec(query).all()
    if not rows:
        return []

    department_map = {
        row.id: row
        for row in session.exec(select(OrgDepartment)).all()
    }
    pattern_map = {
        row.id: row
        for row in session.exec(select(TimSchedulePattern)).all()
    }
    employee_count_rows = session.exec(
        select(HrEmployee.department_id, func.count(HrEmployee.id)).group_by(HrEmployee.department_id)
    ).all()
    employee_count_map = {
        department_key: int(employee_count)
        for department_key, employee_count in employee_count_rows
        if department_key is not None
    }

    items: list[TimDepartmentScheduleAssignmentItem] = []
    for row in rows:
        department = department_map.get(row.department_id)
        pattern = pattern_map.get(row.pattern_id)
        items.append(
            TimDepartmentScheduleAssignmentItem(
                id=row.id,
                department_id=row.department_id,
                department_code=department.code if department else f"DEPT-{row.department_id}",
                department_name=department.name if department else "미확인 조직",
                organization_type=department.organization_type if department else None,
                cost_center_code=department.cost_center_code if department else None,
                employee_count=employee_count_map.get(row.department_id, 0),
                pattern_id=row.pattern_id,
                pattern_code=pattern.code if pattern else None,
                pattern_name=pattern.name if pattern else None,
                effective_from=row.effective_from,
                effective_to=row.effective_to,
                priority=row.priority,
                is_active=row.is_active,
            )
        )
    return items


def batch_save_department_schedule_assignments(
    session: Session,
    payload: TimDepartmentScheduleAssignmentBatchRequest,
) -> TimDepartmentScheduleAssignmentBatchResponse:
    inserted = 0
    updated = 0
    deleted = 0

    if payload.delete_ids:
        targets = session.exec(
            select(TimDepartmentScheduleAssignment).where(TimDepartmentScheduleAssignment.id.in_(payload.delete_ids))
        ).all()
        for row in targets:
            session.delete(row)
        deleted = len(targets)

    for item in payload.items:
        row = session.get(TimDepartmentScheduleAssignment, item.id) if item.id else None
        if row is None:
            row = TimDepartmentScheduleAssignment(
                department_id=item.department_id,
                pattern_id=item.pattern_id,
                effective_from=item.effective_from,
                effective_to=item.effective_to,
                priority=item.priority,
                is_active=item.is_active,
            )
            session.add(row)
            inserted += 1
        else:
            row.department_id = item.department_id
            row.pattern_id = item.pattern_id
            row.effective_from = item.effective_from
            row.effective_to = item.effective_to
            row.priority = item.priority
            row.is_active = item.is_active
            session.add(row)
            updated += 1

    session.commit()
    items = list_department_schedule_assignments(session)
    return TimDepartmentScheduleAssignmentBatchResponse(
        items=items,
        total_count=len(items),
        inserted_count=inserted,
        updated_count=updated,
        deleted_count=deleted,
    )


def list_employee_schedule_exceptions(session: Session, employee_id: int | None = None) -> list[TimEmployeeScheduleExceptionItem]:
    query = select(TimEmployeeScheduleException).order_by(TimEmployeeScheduleException.effective_from.desc(), TimEmployeeScheduleException.id.desc())
    if employee_id is not None:
        query = query.where(TimEmployeeScheduleException.employee_id == employee_id)
    rows = session.exec(query).all()

    if not rows:
        return []

    employee_ids = [row.employee_id for row in rows]
    pattern_ids = [row.pattern_id for row in rows]
    employee_map = {
        row.id: row
        for row in session.exec(select(HrEmployee).where(HrEmployee.id.in_(employee_ids))).all()
    }
    user_ids = [row.user_id for row in employee_map.values() if row.user_id is not None]
    user_name_map = {
        row.id: row.display_name
        for row in session.exec(select(AuthUser).where(AuthUser.id.in_(user_ids))).all()
    }
    department_map = {
        row.id: row
        for row in session.exec(select(OrgDepartment)).all()
    }
    pattern_map = {
        row.id: row
        for row in session.exec(select(TimSchedulePattern).where(TimSchedulePattern.id.in_(pattern_ids))).all()
    }

    return [
        TimEmployeeScheduleExceptionItem(
            id=row.id,
            employee_id=row.employee_id,
            employee_no=employee_map.get(row.employee_id).employee_no if employee_map.get(row.employee_id) else None,
            employee_name=user_name_map.get(employee_map.get(row.employee_id).user_id) if employee_map.get(row.employee_id) else None,
            department_id=employee_map.get(row.employee_id).department_id if employee_map.get(row.employee_id) else None,
            department_code=department_map.get(employee_map.get(row.employee_id).department_id).code
            if employee_map.get(row.employee_id) and department_map.get(employee_map.get(row.employee_id).department_id)
            else None,
            department_name=department_map.get(employee_map.get(row.employee_id).department_id).name
            if employee_map.get(row.employee_id) and department_map.get(employee_map.get(row.employee_id).department_id)
            else None,
            pattern_id=row.pattern_id,
            pattern_code=pattern_map.get(row.pattern_id).code if pattern_map.get(row.pattern_id) else None,
            pattern_name=pattern_map.get(row.pattern_id).name if pattern_map.get(row.pattern_id) else None,
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
