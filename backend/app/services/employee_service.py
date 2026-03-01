from __future__ import annotations

from datetime import datetime, timezone
import secrets
import string

from fastapi import HTTPException, status
from sqlalchemy import delete as sa_delete, func
from sqlmodel import Session, select

from app.core.security import hash_password
from app.core.time_utils import business_today
from app.models import (
    AuthRole,
    AuthUser,
    AuthUserRole,
    HrAttendanceDaily,
    HrEmployee,
    HrLeaveRequest,
    OrgDepartment,
)
from app.schemas.employee import (
    EmployeeBatchRequest,
    EmployeeBatchResponse,
    DepartmentItem,
    EmployeeCreateRequest,
    EmployeeItem,
    EmployeeUpdateRequest,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


BATCH_DELETE_CHUNK_SIZE = 1000


def _chunked(values: list[int], size: int) -> list[list[int]]:
    return [values[index : index + size] for index in range(0, len(values), size)]


def _generate_login_id(session: Session) -> str:
    alphabet = string.ascii_lowercase + string.digits
    for _ in range(30):
        token = "".join(secrets.choice(alphabet) for _ in range(10))
        login_id = f"usr-{token}"
        exists = session.exec(select(AuthUser.id).where(AuthUser.login_id == login_id)).first()
        if exists is None:
            return login_id
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate login_id.")


def _generate_employee_no(session: Session) -> str:
    for _ in range(30):
        employee_no = f"EMP-{secrets.randbelow(1_000_000):06d}"
        exists = session.exec(select(HrEmployee.id).where(HrEmployee.employee_no == employee_no)).first()
        if exists is None:
            return employee_no
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate employee_no.")


def _build_employee_item(employee: HrEmployee, user: AuthUser, department: OrgDepartment) -> EmployeeItem:
    return EmployeeItem(
        id=employee.id,
        employee_no=employee.employee_no,
        login_id=user.login_id,
        display_name=user.display_name,
        email=user.email,
        department_id=department.id,
        department_name=department.name,
        position_title=employee.position_title,
        hire_date=employee.hire_date,
        employment_status=employee.employment_status,
        is_active=user.is_active,
    )


def list_departments(session: Session) -> list[DepartmentItem]:
    rows = session.exec(select(OrgDepartment).order_by(OrgDepartment.code)).all()
    return [DepartmentItem(id=row.id, code=row.code, name=row.name) for row in rows]


def list_employees(
    session: Session,
    *,
    page: int | None = None,
    limit: int | None = None,
    employee_no: str | None = None,
    name: str | None = None,
    department: str | None = None,
    employment_status: str | None = None,
    active: bool | None = None,
) -> tuple[list[EmployeeItem], int]:
    stmt = (
        select(HrEmployee, AuthUser, OrgDepartment)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
    )

    if employee_no:
        stmt = stmt.where(HrEmployee.employee_no.ilike(f"%{employee_no.strip()}%"))
    if name:
        stmt = stmt.where(AuthUser.display_name.ilike(f"%{name.strip()}%"))
    if department:
        stmt = stmt.where(OrgDepartment.name.ilike(f"%{department.strip()}%"))
    if employment_status:
        stmt = stmt.where(HrEmployee.employment_status == employment_status)
    if active is not None:
        stmt = stmt.where(AuthUser.is_active == active)  # noqa: E712

    # DB 레벨 COUNT — 전체 row 로드 없이 카운트
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_count: int = session.exec(count_stmt).one()

    # DB 레벨 OFFSET/LIMIT
    paged_stmt = stmt.order_by(HrEmployee.id)
    if page is not None and limit is not None and limit > 0:
        offset = max(0, (page - 1) * limit)
        paged_stmt = paged_stmt.offset(offset).limit(limit)

    rows = session.exec(paged_stmt).all()
    return ([_build_employee_item(employee, user, department) for employee, user, department in rows], total_count)


def get_employee_by_user_id(session: Session, user_id: int) -> EmployeeItem:
    row = session.exec(
        select(HrEmployee, AuthUser, OrgDepartment)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrEmployee.user_id == user_id)
    ).first()

    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee profile not found.")

    employee, user, department = row
    return _build_employee_item(employee, user, department)


def _create_employee_no_commit(session: Session, payload: EmployeeCreateRequest) -> EmployeeItem:
    department = session.get(OrgDepartment, payload.department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid department_id.")

    login_id = payload.login_id.strip() if payload.login_id else _generate_login_id(session)
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
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(user)
    session.flush()

    employee = HrEmployee(
        user_id=user.id,
        employee_no=_generate_employee_no(session),
        department_id=payload.department_id,
        position_title=payload.position_title,
        hire_date=payload.hire_date or business_today(),
        employment_status=payload.employment_status,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(employee)

    employee_role = session.exec(select(AuthRole).where(AuthRole.code == "employee")).first()
    if employee_role is not None:
        session.add(AuthUserRole(user_id=user.id, role_id=employee_role.id))

    session.flush()

    return _build_employee_item(employee, user, department)


def create_employee(session: Session, payload: EmployeeCreateRequest) -> EmployeeItem:
    item = _create_employee_no_commit(session, payload)
    session.commit()
    return item


def _update_employee_no_commit(session: Session, employee_id: int, payload: EmployeeUpdateRequest) -> EmployeeItem:
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

    user.updated_at = _utc_now()
    employee.updated_at = _utc_now()

    session.add(user)
    session.add(employee)
    session.flush()

    department = session.get(OrgDepartment, employee.department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Department not found.")

    return _build_employee_item(employee, user, department)


def update_employee(session: Session, employee_id: int, payload: EmployeeUpdateRequest) -> EmployeeItem:
    item = _update_employee_no_commit(session, employee_id, payload)
    session.commit()
    return item


def _delete_employees_no_commit(session: Session, employee_ids: list[int]) -> int:
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

    approved_rows = session.exec(
        select(HrLeaveRequest).where(HrLeaveRequest.approver_employee_id.in_(target_ids))
    ).all()
    for row in approved_rows:
        row.approver_employee_id = None
        row.updated_at = _utc_now()
        session.add(row)

    session.exec(sa_delete(HrLeaveRequest).where(HrLeaveRequest.employee_id.in_(target_ids)))
    session.exec(sa_delete(HrAttendanceDaily).where(HrAttendanceDaily.employee_id.in_(target_ids)))
    session.exec(sa_delete(AuthUserRole).where(AuthUserRole.user_id.in_(user_ids)))
    session.exec(sa_delete(HrEmployee).where(HrEmployee.id.in_(target_ids)))
    session.exec(sa_delete(AuthUser).where(AuthUser.id.in_(user_ids)))
    session.flush()
    return len(target_ids)


def delete_employee(session: Session, employee_id: int) -> None:
    _delete_employees_no_commit(session, [employee_id])
    session.commit()


def batch_save_employees(session: Session, payload: EmployeeBatchRequest) -> EmployeeBatchResponse:
    if payload.mode != "atomic":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported batch mode.")

    delete_ids = sorted({employee_id for employee_id in payload.delete if employee_id > 0})
    update_items = payload.update
    insert_items = payload.insert

    for index, row in enumerate(update_items, start=1):
        if row.id is None or row.id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"update[{index}] requires valid id.",
            )

    inserted_count = 0
    updated_count = 0
    deleted_count = 0

    try:
        with session.begin():
            if delete_ids:
                for chunk in _chunked(delete_ids, BATCH_DELETE_CHUNK_SIZE):
                    deleted_count += _delete_employees_no_commit(session, chunk)

            for row in update_items:
                _update_employee_no_commit(session, row.id, row)
                updated_count += 1

            for row in insert_items:
                _create_employee_no_commit(session, row)
                inserted_count += 1
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Batch save failed: {str(exc)}",
        ) from exc

    return EmployeeBatchResponse(
        inserted_count=inserted_count,
        updated_count=updated_count,
        deleted_count=deleted_count,
    )
