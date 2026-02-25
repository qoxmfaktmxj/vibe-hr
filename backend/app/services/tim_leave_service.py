from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import AuthUser, HrAnnualLeave, HrEmployee, HrLeaveRequest, OrgDepartment, TimHoliday
from app.schemas.tim_leave import TimAnnualLeaveItem, TimLeaveRequestItem


def _to_leave_item(row: HrLeaveRequest, employee: HrEmployee, user: AuthUser, department: OrgDepartment) -> TimLeaveRequestItem:
    return TimLeaveRequestItem(
        id=row.id,
        employee_id=employee.id,
        employee_no=employee.employee_no,
        employee_name=user.display_name,
        department_name=department.name,
        leave_type=row.leave_type,
        start_date=row.start_date,
        end_date=row.end_date,
        leave_days=float((row.end_date - row.start_date).days + 1),
        reason=row.reason,
        request_status=row.request_status,
        approver_employee_id=row.approver_employee_id,
        approved_at=row.approved_at,
        created_at=row.created_at,
    )


def _service_year(hire_date: date, target_year: int) -> int:
    return max(0, target_year - hire_date.year)


def _default_granted_days(hire_date: date, target_year: int) -> float:
    years = _service_year(hire_date, target_year)
    if years <= 0:
        return 11.0
    if years < 3:
        return 15.0
    extra = (years - 1) // 2
    return float(min(15 + extra, 25))


def get_or_create_annual_leave(session: Session, employee_id: int, year: int) -> TimAnnualLeaveItem:
    row = session.exec(
        select(HrAnnualLeave, HrEmployee, AuthUser)
        .join(HrEmployee, HrAnnualLeave.employee_id == HrEmployee.id)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .where(HrAnnualLeave.employee_id == employee_id, HrAnnualLeave.year == year)
    ).first()

    if row is None:
        employee_row = session.exec(
            select(HrEmployee, AuthUser)
            .join(AuthUser, HrEmployee.user_id == AuthUser.id)
            .where(HrEmployee.id == employee_id)
        ).first()
        if employee_row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
        employee, user = employee_row
        granted = _default_granted_days(employee.hire_date, year)

        prev = session.exec(select(HrAnnualLeave).where(HrAnnualLeave.employee_id == employee.id, HrAnnualLeave.year == year - 1)).first()
        carried_over = min(prev.remaining_days, 5.0) if prev else 0.0

        created = HrAnnualLeave(
            employee_id=employee.id,
            year=year,
            granted_days=granted,
            used_days=0.0,
            carried_over_days=carried_over,
            remaining_days=granted + carried_over,
            grant_type="auto",
            updated_at=datetime.now(timezone.utc),
        )
        session.add(created)
        session.commit()
        session.refresh(created)

        return TimAnnualLeaveItem(
            id=created.id,
            employee_id=employee.id,
            employee_no=employee.employee_no,
            employee_name=user.display_name,
            year=created.year,
            granted_days=created.granted_days,
            used_days=created.used_days,
            carried_over_days=created.carried_over_days,
            remaining_days=created.remaining_days,
            grant_type=created.grant_type,
            note=created.note,
        )

    annual, employee, user = row
    return TimAnnualLeaveItem(
        id=annual.id,
        employee_id=employee.id,
        employee_no=employee.employee_no,
        employee_name=user.display_name,
        year=annual.year,
        granted_days=annual.granted_days,
        used_days=annual.used_days,
        carried_over_days=annual.carried_over_days,
        remaining_days=annual.remaining_days,
        grant_type=annual.grant_type,
        note=annual.note,
    )


def adjust_annual_leave(session: Session, *, employee_id: int, year: int, adjustment_days: float, reason: str) -> TimAnnualLeaveItem:
    _ = get_or_create_annual_leave(session, employee_id, year)
    row = session.exec(select(HrAnnualLeave).where(HrAnnualLeave.employee_id == employee_id, HrAnnualLeave.year == year)).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annual leave not found.")

    row.granted_days += adjustment_days
    row.remaining_days += adjustment_days
    row.grant_type = "adjustment"
    row.note = reason
    row.updated_at = datetime.now(timezone.utc)
    session.add(row)
    session.commit()

    return get_or_create_annual_leave(session, employee_id, year)


def _working_days(session: Session, start_date: date, end_date: date) -> float:
    holidays = session.exec(select(TimHoliday.holiday_date).where(TimHoliday.holiday_date >= start_date, TimHoliday.holiday_date <= end_date)).all()
    holiday_set = set(holidays)
    total = 0.0
    current = start_date
    while current <= end_date:
        if current.weekday() < 5 and current not in holiday_set:
            total += 1.0
        current += timedelta(days=1)
    return total


def create_leave_request(session: Session, *, employee_id: int, leave_type: str, start_date: date, end_date: date, reason: str) -> TimLeaveRequestItem:
    if start_date > end_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_date는 end_date보다 이후일 수 없습니다.")

    overlap = session.exec(
        select(HrLeaveRequest)
        .where(
            HrLeaveRequest.employee_id == employee_id,
            HrLeaveRequest.request_status.in_(["pending", "approved"]),
            HrLeaveRequest.start_date <= end_date,
            HrLeaveRequest.end_date >= start_date,
        )
        .limit(1)
    ).first()
    if overlap is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="중복 기간 휴가 신청이 존재합니다.")

    days = _working_days(session, start_date, end_date)
    if leave_type == "annual":
        balance = get_or_create_annual_leave(session, employee_id, start_date.year)
        if balance.remaining_days < days:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"연차 부족: 잔여 {balance.remaining_days}일")

    row = HrLeaveRequest(
        employee_id=employee_id,
        leave_type=leave_type,
        start_date=start_date,
        end_date=end_date,
        reason=reason,
        request_status="pending",
    )
    session.add(row)
    session.commit()
    session.refresh(row)

    detail = session.exec(
        select(HrLeaveRequest, HrEmployee, AuthUser, OrgDepartment)
        .join(HrEmployee, HrLeaveRequest.employee_id == HrEmployee.id)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrLeaveRequest.id == row.id)
    ).first()
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")

    leave, employee, user, department = detail
    return _to_leave_item(leave, employee, user, department)


def list_leave_requests(session: Session, *, employee_id: int | None = None, status_filter: str | None = None, pending_only: bool = False) -> list[TimLeaveRequestItem]:
    query = (
        select(HrLeaveRequest, HrEmployee, AuthUser, OrgDepartment)
        .join(HrEmployee, HrLeaveRequest.employee_id == HrEmployee.id)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
    )

    if employee_id is not None:
        query = query.where(HrLeaveRequest.employee_id == employee_id)
    if status_filter:
        query = query.where(HrLeaveRequest.request_status == status_filter)
    if pending_only:
        query = query.where(HrLeaveRequest.request_status == "pending")

    rows = session.exec(query.order_by(HrLeaveRequest.created_at.desc())).all()
    return [_to_leave_item(leave, employee, user, department) for leave, employee, user, department in rows]


def decide_leave_request(session: Session, *, request_id: int, approver_employee_id: int, decision: str, reason: str | None = None) -> TimLeaveRequestItem:
    row = session.get(HrLeaveRequest, request_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")
    if row.request_status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="pending 상태만 처리할 수 있습니다.")

    if decision == "approve":
        row.request_status = "approved"
    elif decision == "reject":
        row.request_status = "rejected"
        if reason:
            row.reason = f"{row.reason or ''} | 반려사유: {reason}".strip()
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="지원하지 않는 결정입니다.")

    row.approver_employee_id = approver_employee_id
    row.approved_at = datetime.now(timezone.utc)

    if decision == "approve" and row.leave_type == "annual":
        days = _working_days(session, row.start_date, row.end_date)
        annual = session.exec(select(HrAnnualLeave).where(HrAnnualLeave.employee_id == row.employee_id, HrAnnualLeave.year == row.start_date.year)).first()
        if annual is None:
            _ = get_or_create_annual_leave(session, row.employee_id, row.start_date.year)
            annual = session.exec(select(HrAnnualLeave).where(HrAnnualLeave.employee_id == row.employee_id, HrAnnualLeave.year == row.start_date.year)).first()
        if annual is None or annual.remaining_days < days:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="연차 잔여가 부족합니다.")
        annual.used_days += days
        annual.remaining_days -= days
        annual.updated_at = datetime.now(timezone.utc)
        session.add(annual)

    session.add(row)
    session.commit()

    detail = session.exec(
        select(HrLeaveRequest, HrEmployee, AuthUser, OrgDepartment)
        .join(HrEmployee, HrLeaveRequest.employee_id == HrEmployee.id)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrLeaveRequest.id == row.id)
    ).first()
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")

    leave, employee, user, department = detail
    return _to_leave_item(leave, employee, user, department)


def cancel_leave_request(session: Session, *, request_id: int, actor_employee_id: int, reason: str | None = None) -> TimLeaveRequestItem:
    row = session.get(HrLeaveRequest, request_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")

    if row.request_status == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 취소된 신청입니다.")

    if row.request_status == "approved" and row.leave_type == "annual":
        days = _working_days(session, row.start_date, row.end_date)
        annual = session.exec(select(HrAnnualLeave).where(HrAnnualLeave.employee_id == row.employee_id, HrAnnualLeave.year == row.start_date.year)).first()
        if annual is not None:
            annual.used_days = max(0.0, annual.used_days - days)
            annual.remaining_days += days
            annual.updated_at = datetime.now(timezone.utc)
            session.add(annual)

    row.request_status = "cancelled"
    row.approver_employee_id = actor_employee_id
    row.approved_at = datetime.now(timezone.utc)
    if reason:
        row.reason = f"{row.reason or ''} | 취소사유: {reason}".strip()

    session.add(row)
    session.commit()

    detail = session.exec(
        select(HrLeaveRequest, HrEmployee, AuthUser, OrgDepartment)
        .join(HrEmployee, HrLeaveRequest.employee_id == HrEmployee.id)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrLeaveRequest.id == row.id)
    ).first()
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")

    leave, employee, user, department = detail
    return _to_leave_item(leave, employee, user, department)
