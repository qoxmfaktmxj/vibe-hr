from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import delete as sa_delete
from sqlmodel import Session, select

from app.core.security import hash_password
from app.core.time_utils import business_today
from app.models import (
    AuthRole,
    AuthUser,
    AuthUserRole,
    HrAppointmentOrder,
    HrAppointmentOrderItem,
    HrAnnualLeave,
    HrAttendanceDaily,
    HrEmployee,
    HrEmployeeBasicProfile,
    HrEmployeeInfoRecord,
    HrLeaveRequest,
    HrPersonnelHistory,
    OrgDepartment,
)
from app.schemas.employee import EmployeeCreateRequest, EmployeeItem, EmployeeUpdateRequest
from app.services.employee_service_shared import (
    build_employee_item,
    generate_employee_no,
    generate_login_id,
    utc_now,
)


def create_employee(session: Session, payload: EmployeeCreateRequest) -> EmployeeItem:
    item = create_employee_no_commit(session, payload)
    session.commit()
    return item


def update_employee(session: Session, employee_id: int, payload: EmployeeUpdateRequest) -> EmployeeItem:
    item = update_employee_no_commit(session, employee_id, payload)
    session.commit()
    return item


def delete_employee(session: Session, employee_id: int) -> None:
    delete_employees_no_commit(session, [employee_id])
    session.commit()


def create_employee_no_commit(session: Session, payload: EmployeeCreateRequest) -> EmployeeItem:
    department = session.get(OrgDepartment, payload.department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid department_id.")

    employee_no = payload.employee_no.strip() if payload.employee_no else generate_employee_no(session)
    employee_no_exists = session.exec(select(HrEmployee.id).where(HrEmployee.employee_no == employee_no)).first()
    if employee_no_exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="employee_no already exists.")

    login_id = payload.login_id.strip() if payload.login_id else generate_login_id(session)
    login_exists = session.exec(select(AuthUser.id).where(AuthUser.login_id == login_id)).first()
    if login_exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="login_id already exists.")

    email = payload.email or f"{login_id}@vibe-hr.local"
    email_exists = session.exec(select(AuthUser.id).where(AuthUser.email == email)).first()
    if email_exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email already exists.")

    user = AuthUser(
        login_id=login_id,
        email=email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        is_active=True,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    session.add(user)
    session.flush()

    employee = HrEmployee(
        user_id=user.id,
        employee_no=employee_no,
        department_id=payload.department_id,
        position_title=payload.position_title,
        hire_date=payload.hire_date or business_today(),
        employment_status=payload.employment_status,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    session.add(employee)

    employee_role = session.exec(select(AuthRole).where(AuthRole.code == "employee")).first()
    if employee_role is not None:
        session.add(AuthUserRole(user_id=user.id, role_id=employee_role.id))

    session.flush()

    return build_employee_item(employee, user, department)


def update_employee_no_commit(session: Session, employee_id: int, payload: EmployeeUpdateRequest) -> EmployeeItem:
    employee = session.get(HrEmployee, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")

    user = session.get(AuthUser, employee.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee user not found.")

    if payload.department_id is not None:
        department = session.get(OrgDepartment, payload.department_id)
        if department is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid department_id.")
        employee.department_id = payload.department_id

    if payload.display_name is not None:
        user.display_name = payload.display_name

    if payload.position_title is not None:
        employee.position_title = payload.position_title

    if payload.hire_date is not None:
        employee.hire_date = payload.hire_date

    if payload.employment_status is not None:
        employee.employment_status = payload.employment_status

    if payload.email is not None and payload.email != user.email:
        email_exists = session.exec(select(AuthUser.id).where(AuthUser.email == payload.email)).first()
        if email_exists is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email already exists.")
        user.email = payload.email

    if payload.is_active is not None:
        user.is_active = payload.is_active

    if payload.password:
        user.password_hash = hash_password(payload.password)

    user.updated_at = utc_now()
    employee.updated_at = utc_now()

    session.add(user)
    session.add(employee)
    session.flush()

    department = session.get(OrgDepartment, employee.department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Department not found.")

    return build_employee_item(employee, user, department)


def delete_employees_no_commit(session: Session, employee_ids: list[int]) -> int:
    target_ids = sorted({employee_id for employee_id in employee_ids if employee_id > 0})
    if not target_ids:
        return 0

    rows = session.exec(select(HrEmployee.id, HrEmployee.user_id).where(HrEmployee.id.in_(target_ids))).all()
    existing_employee_ids = {row[0] for row in rows}
    missing_ids = sorted(set(target_ids) - existing_employee_ids)
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee not found: {missing_ids[0]}",
        )

    user_ids = [row[1] for row in rows]
    appointment_order_ids = sorted(
        {
            order_id
            for order_id in session.exec(
                select(HrAppointmentOrderItem.order_id).where(HrAppointmentOrderItem.employee_id.in_(target_ids))
            ).all()
            if order_id is not None
        }
    )

    approved_rows = session.exec(
        select(HrLeaveRequest).where(HrLeaveRequest.approver_employee_id.in_(target_ids))
    ).all()
    for row in approved_rows:
        row.approver_employee_id = None
        row.updated_at = utc_now()
        session.add(row)

    session.exec(sa_delete(HrLeaveRequest).where(HrLeaveRequest.employee_id.in_(target_ids)))
    session.exec(sa_delete(HrAnnualLeave).where(HrAnnualLeave.employee_id.in_(target_ids)))
    session.exec(sa_delete(HrAttendanceDaily).where(HrAttendanceDaily.employee_id.in_(target_ids)))
    session.exec(sa_delete(HrPersonnelHistory).where(HrPersonnelHistory.employee_id.in_(target_ids)))
    session.exec(sa_delete(HrEmployeeInfoRecord).where(HrEmployeeInfoRecord.employee_id.in_(target_ids)))
    session.exec(sa_delete(HrEmployeeBasicProfile).where(HrEmployeeBasicProfile.employee_id.in_(target_ids)))
    session.exec(sa_delete(HrAppointmentOrderItem).where(HrAppointmentOrderItem.employee_id.in_(target_ids)))

    if appointment_order_ids:
        remaining_order_ids = {
            order_id
            for order_id in session.exec(
                select(HrAppointmentOrderItem.order_id).where(HrAppointmentOrderItem.order_id.in_(appointment_order_ids))
            ).all()
            if order_id is not None
        }
        orphan_order_ids = sorted(set(appointment_order_ids) - remaining_order_ids)
        if orphan_order_ids:
            session.exec(sa_delete(HrAppointmentOrder).where(HrAppointmentOrder.id.in_(orphan_order_ids)))

    session.exec(sa_delete(AuthUserRole).where(AuthUserRole.user_id.in_(user_ids)))
    session.exec(sa_delete(HrEmployee).where(HrEmployee.id.in_(target_ids)))
    session.exec(sa_delete(AuthUser).where(AuthUser.id.in_(user_ids)))
    session.flush()
    return len(target_ids)
return len(target_ids)
e(HrEmployee).where(HrEmployee.id.in_(target_ids)))
    session.exec(sa_delete(AuthUser).where(AuthUser.id.in_(user_ids)))
    session.flush()
    return len(target_ids)
return len(target_ids)
