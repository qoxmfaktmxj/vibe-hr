from __future__ import annotations

from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.core.time_utils import now_utc
from app.models import AuthUser, HrAnnualLeave, HrEmployee, HrLeaveRequest, OrgDepartment, TimHoliday
from app.schemas.tim_leave import TimAnnualLeaveItem, TimLeaveRequestItem


def _working_days(session: Session, start_date: date, end_date: date) -> float:
    """근무일 수 계산 (주말 + 공휴일 제외). 연차 차감 기준으로 사용."""
    holidays = session.exec(select(TimHoliday.holiday_date).where(TimHoliday.holiday_date >= start_date, TimHoliday.holiday_date <= end_date)).all()
    holiday_set = set(holidays)
    total = 0.0
    current = start_date
    while current <= end_date:
        if current.weekday() < 5 and current not in holiday_set:
            total += 1.0
        current += timedelta(days=1)
    return total


def _to_leave_item(session: Session, row: HrLeaveRequest, employee: HrEmployee, user: AuthUser, department: OrgDepartment) -> TimLeaveRequestItem:
    """HrLeaveRequest → TimLeaveRequestItem 변환.

    - calendar_days: 캘린더 일수 (end - start + 1), 화면 표시용
    - deduction_days: 실제 차감 일수 (근무일 기준, 주말/공휴일 제외)
    - leave_days: deduction_days와 동일 (하위 호환 유지)
    """
    calendar_days = float((row.end_date - row.start_date).days + 1)
    deduction_days = _working_days(session, row.start_date, row.end_date)
    return TimLeaveRequestItem(
        id=row.id,
        employee_id=employee.id,
        employee_no=employee.employee_no,
        employee_name=user.display_name,
        department_name=department.name,
        leave_type=row.leave_type,
        start_date=row.start_date,
        end_date=row.end_date,
        calendar_days=calendar_days,
        deduction_days=deduction_days,
        leave_days=deduction_days,  # 차감 기준으로 통일
        reason=row.reason,
        request_status=row.request_status,
        approver_employee_id=row.approver_employee_id,
        approved_at=row.approved_at,
        decision_comment=row.decision_comment,
        decided_by=row.decided_by,
        decided_at=row.decided_at,
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
        select(HrAnnualLeave, HrEmployee, AuthUser, OrgDepartment)
        .join(HrEmployee, HrAnnualLeave.employee_id == HrEmployee.id)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrAnnualLeave.employee_id == employee_id, HrAnnualLeave.year == year)
    ).first()

    if row is None:
        employee_row = session.exec(
            select(HrEmployee, AuthUser, OrgDepartment)
            .join(AuthUser, HrEmployee.user_id == AuthUser.id)
            .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
            .where(HrEmployee.id == employee_id)
        ).first()
        if employee_row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
        employee, user, department = employee_row
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
            updated_at=now_utc(),
        )
        session.add(created)
        session.commit()
        session.refresh(created)

        return TimAnnualLeaveItem(
            id=created.id,
            employee_id=employee.id,
            employee_no=employee.employee_no,
            employee_name=user.display_name,
            department_name=department.name,
            year=created.year,
            granted_days=created.granted_days,
            used_days=created.used_days,
            carried_over_days=created.carried_over_days,
            remaining_days=created.remaining_days,
            grant_type=created.grant_type,
            note=created.note,
        )

    annual, employee, user, department = row
    return TimAnnualLeaveItem(
        id=annual.id,
        employee_id=employee.id,
        employee_no=employee.employee_no,
        employee_name=user.display_name,
        department_name=department.name,
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
    row.updated_at = now_utc()
    session.add(row)
    session.commit()

    return get_or_create_annual_leave(session, employee_id, year)


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
    return _to_leave_item(session, leave, employee, user, department)


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
    return [_to_leave_item(session, leave, employee, user, department) for leave, employee, user, department in rows]


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
        # reason → decision_comment 분리 (원래 신청 사유 보존)
        row.decision_comment = reason
        row.decided_by = approver_employee_id
        row.decided_at = now_utc()
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="지원하지 않는 결정입니다.")

    row.approver_employee_id = approver_employee_id
    row.approved_at = now_utc()

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
        annual.updated_at = now_utc()
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
    return _to_leave_item(session, leave, employee, user, department)


def list_annual_leaves(
    session: Session,
    *,
    year: int,
    department_id: int | None = None,
    keyword: str | None = None,
) -> list[TimAnnualLeaveItem]:
    query = (
        select(HrAnnualLeave, HrEmployee, AuthUser, OrgDepartment)
        .join(HrEmployee, HrAnnualLeave.employee_id == HrEmployee.id)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrAnnualLeave.year == year)
    )

    if department_id is not None:
        query = query.where(HrEmployee.department_id == department_id)

    if keyword:
        like = f"%{keyword}%"
        query = query.where((HrEmployee.employee_no.like(like)) | (AuthUser.display_name.like(like)))

    rows = session.exec(query.order_by(OrgDepartment.name.asc(), HrEmployee.employee_no.asc())).all()
    return [
        TimAnnualLeaveItem(
            id=annual.id,
            employee_id=employee.id,
            employee_no=employee.employee_no,
            employee_name=user.display_name,
            department_name=department.name,
            year=annual.year,
            granted_days=annual.granted_days,
            used_days=annual.used_days,
            carried_over_days=annual.carried_over_days,
            remaining_days=annual.remaining_days,
            grant_type=annual.grant_type,
            note=annual.note,
        )
        for annual, employee, user, department in rows
    ]


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
            annual.updated_at = now_utc()
            session.add(annual)

    row.request_status = "cancelled"
    row.approver_employee_id = actor_employee_id
    row.approved_at = now_utc()
    # reason → decision_comment 분리 (원래 신청 사유 보존)
    row.decision_comment = reason
    row.decided_by = actor_employee_id
    row.decided_at = now_utc()

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
    return _to_leave_item(session, leave, employee, user, department)
