from __future__ import annotations

from datetime import date, datetime, timezone
from math import ceil

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import AuthUser, HrAttendanceDaily, HrEmployee, OrgDepartment, TimAttendanceCorrection, TimEmployeeDailySchedule
from app.schemas.tim_attendance_daily import (
    TimAttendanceCorrectionItem,
    TimAttendanceDailyItem,
    TimAttendanceDailyListResponse,
)

ALLOWED_STATUS = {"present", "late", "absent", "leave", "remote"}


def _worked_minutes(check_in_at: datetime | None, check_out_at: datetime | None) -> int | None:
    if not check_in_at or not check_out_at:
        return None
    delta = check_out_at - check_in_at
    minutes = int(delta.total_seconds() // 60)
    return max(minutes, 0)


def _to_item(row: HrAttendanceDaily, employee: HrEmployee, user: AuthUser, department: OrgDepartment) -> TimAttendanceDailyItem:
    return TimAttendanceDailyItem(
        id=row.id,
        employee_id=employee.id,
        employee_no=employee.employee_no,
        employee_name=user.display_name,
        department_id=department.id,
        department_name=department.name,
        work_date=row.work_date,
        check_in_at=row.check_in_at,
        check_out_at=row.check_out_at,
        worked_minutes=_worked_minutes(row.check_in_at, row.check_out_at),
        attendance_status=row.attendance_status,
    )


def _resolve_employee_id(session: Session, current_user: AuthUser, requested_employee_id: int | None) -> int:
    employee = session.exec(select(HrEmployee).where(HrEmployee.user_id == current_user.id)).first()
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee profile not found.")

    if requested_employee_id is None or requested_employee_id == employee.id:
        return employee.id

    return requested_employee_id


def list_attendance_daily(
    session: Session,
    *,
    start_date: date,
    end_date: date,
    employee_id: int | None,
    status_filter: str | None,
    page: int,
    limit: int,
) -> TimAttendanceDailyListResponse:
    base = (
        select(HrAttendanceDaily, HrEmployee, AuthUser, OrgDepartment)
        .join(HrEmployee, HrAttendanceDaily.employee_id == HrEmployee.id)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrAttendanceDaily.work_date >= start_date, HrAttendanceDaily.work_date <= end_date)
    )

    if employee_id is not None:
        base = base.where(HrAttendanceDaily.employee_id == employee_id)

    if status_filter:
        base = base.where(HrAttendanceDaily.attendance_status == status_filter)

    rows_all = session.exec(base).all()
    total_count = len(rows_all)

    offset = (page - 1) * limit
    rows = session.exec(base.order_by(HrAttendanceDaily.work_date.desc(), HrAttendanceDaily.id.desc()).offset(offset).limit(limit)).all()
    items = [_to_item(att, emp, usr, dept) for att, emp, usr, dept in rows]

    return TimAttendanceDailyListResponse(
        items=items,
        total_count=total_count,
        page=page,
        limit=limit,
        total_pages=max(1, ceil(total_count / limit)) if limit > 0 else 1,
    )


def get_attendance_by_id(session: Session, attendance_id: int) -> TimAttendanceDailyItem:
    row = session.exec(
        select(HrAttendanceDaily, HrEmployee, AuthUser, OrgDepartment)
        .join(HrEmployee, HrAttendanceDaily.employee_id == HrEmployee.id)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrAttendanceDaily.id == attendance_id)
        .limit(1)
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="근태 기록을 찾을 수 없습니다.")

    attendance, employee, user, department = row
    return _to_item(attendance, employee, user, department)


def get_today_attendance(session: Session, employee_id: int) -> TimAttendanceDailyItem | None:
    today = date.today()
    row = session.exec(
        select(HrAttendanceDaily, HrEmployee, AuthUser, OrgDepartment)
        .join(HrEmployee, HrAttendanceDaily.employee_id == HrEmployee.id)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrAttendanceDaily.employee_id == employee_id, HrAttendanceDaily.work_date == today)
        .limit(1)
    ).first()
    if row is None:
        return None

    attendance, employee, user, department = row
    return _to_item(attendance, employee, user, department)


def check_in(session: Session, employee_id: int) -> TimAttendanceDailyItem:
    now = datetime.now(timezone.utc)
    today = now.date()

    daily_schedule = session.exec(
        select(TimEmployeeDailySchedule).where(
            TimEmployeeDailySchedule.employee_id == employee_id,
            TimEmployeeDailySchedule.work_date == today,
        )
    ).first()

    is_late = False
    if daily_schedule and daily_schedule.planned_start_at:
        is_late = now > daily_schedule.planned_start_at

    row = session.exec(select(HrAttendanceDaily).where(HrAttendanceDaily.employee_id == employee_id, HrAttendanceDaily.work_date == today)).first()
    if row is None:
        row = HrAttendanceDaily(
            employee_id=employee_id,
            work_date=today,
            check_in_at=now,
            attendance_status="late" if is_late else "present",
        )
    elif row.check_in_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="오늘 이미 출근 처리되었습니다.")
    else:
        row.check_in_at = now
        row.attendance_status = "late" if is_late else "present"

    session.add(row)
    session.commit()
    session.refresh(row)

    detail = session.exec(
        select(HrAttendanceDaily, HrEmployee, AuthUser, OrgDepartment)
        .join(HrEmployee, HrAttendanceDaily.employee_id == HrEmployee.id)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrAttendanceDaily.id == row.id)
    ).first()
    if detail is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="출근 처리 후 조회 실패")
    attendance, employee, user, department = detail
    return _to_item(attendance, employee, user, department)


def check_out(session: Session, employee_id: int) -> TimAttendanceDailyItem:
    now = datetime.now(timezone.utc)
    today = now.date()

    row = session.exec(select(HrAttendanceDaily).where(HrAttendanceDaily.employee_id == employee_id, HrAttendanceDaily.work_date == today)).first()
    if row is None or row.check_in_at is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="출근 기록이 없어 퇴근 처리할 수 없습니다.")
    if row.check_out_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="오늘 이미 퇴근 처리되었습니다.")

    row.check_out_at = now
    session.add(row)
    session.commit()
    session.refresh(row)

    detail = session.exec(
        select(HrAttendanceDaily, HrEmployee, AuthUser, OrgDepartment)
        .join(HrEmployee, HrAttendanceDaily.employee_id == HrEmployee.id)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrAttendanceDaily.id == row.id)
    ).first()
    if detail is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="퇴근 처리 후 조회 실패")
    attendance, employee, user, department = detail
    return _to_item(attendance, employee, user, department)


def correct_attendance(
    session: Session,
    *,
    attendance_id: int,
    corrected_by_employee_id: int,
    new_status: str,
    reason: str,
    new_check_in_at: datetime | None,
    new_check_out_at: datetime | None,
) -> TimAttendanceCorrectionItem:
    if new_status not in ALLOWED_STATUS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 근태 상태입니다.")

    row = session.get(HrAttendanceDaily, attendance_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="근태 기록을 찾을 수 없습니다.")

    correction = TimAttendanceCorrection(
        attendance_id=row.id,
        corrected_by_employee_id=corrected_by_employee_id,
        old_status=row.attendance_status,
        new_status=new_status,
        old_check_in_at=row.check_in_at,
        new_check_in_at=new_check_in_at,
        old_check_out_at=row.check_out_at,
        new_check_out_at=new_check_out_at,
        reason=reason,
    )

    row.attendance_status = new_status
    if new_check_in_at is not None:
        row.check_in_at = new_check_in_at
    if new_check_out_at is not None:
        row.check_out_at = new_check_out_at

    session.add(row)
    session.add(correction)
    session.commit()
    session.refresh(correction)

    return TimAttendanceCorrectionItem(
        id=correction.id,
        attendance_id=correction.attendance_id,
        corrected_by_employee_id=correction.corrected_by_employee_id,
        old_status=correction.old_status,
        new_status=correction.new_status,
        old_check_in_at=correction.old_check_in_at,
        new_check_in_at=correction.new_check_in_at,
        old_check_out_at=correction.old_check_out_at,
        new_check_out_at=correction.new_check_out_at,
        reason=correction.reason,
        corrected_at=correction.corrected_at,
    )


def list_corrections(session: Session, attendance_id: int) -> list[TimAttendanceCorrectionItem]:
    rows = session.exec(
        select(TimAttendanceCorrection)
        .where(TimAttendanceCorrection.attendance_id == attendance_id)
        .order_by(TimAttendanceCorrection.corrected_at.desc())
    ).all()

    return [
        TimAttendanceCorrectionItem(
            id=row.id,
            attendance_id=row.attendance_id,
            corrected_by_employee_id=row.corrected_by_employee_id,
            old_status=row.old_status,
            new_status=row.new_status,
            old_check_in_at=row.old_check_in_at,
            new_check_in_at=row.new_check_in_at,
            old_check_out_at=row.old_check_out_at,
            new_check_out_at=row.new_check_out_at,
            reason=row.reason,
            corrected_at=row.corrected_at,
        )
        for row in rows
    ]


def resolve_target_employee_id(session: Session, current_user: AuthUser, requested_employee_id: int | None) -> int:
    return _resolve_employee_id(session, current_user, requested_employee_id)
