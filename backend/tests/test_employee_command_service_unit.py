from datetime import date, datetime, timezone

import pytest
from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine, select

from app.models import (
    AuthRole,
    HrAppointmentOrder,
    HrAppointmentOrderItem,
    HrEmployee,
    HrEmployeeInfoRecord,
    HrPersonnelHistory,
    OrgDepartment,
)
from app.schemas.hr_appointment_record import HrAppointmentRecordCreateRequest
from app.schemas.employee import EmployeeCreateRequest
from app.services.employee_command_service import create_employee_no_commit, delete_employees_no_commit
from app.services.hr_appointment_record_service import confirm_appointment_order, create_appointment_record


def _seed_department_and_role(session: Session) -> int:
    now = datetime.now(timezone.utc)
    department = OrgDepartment(
        code="HQ-HR",
        name="HR",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    employee_role = AuthRole(code="employee", name="Employee", created_at=now)
    session.add(department)
    session.add(employee_role)
    session.commit()
    return int(department.id)


def test_create_employee_no_commit_persists_requested_employee_no() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        department_id = _seed_department_and_role(session)

        item = create_employee_no_commit(
            session,
            EmployeeCreateRequest(
                employee_no="1234",
                display_name="홍길동",
                department_id=department_id,
                position_title="사원",
                hire_date=date(2026, 3, 12),
                employment_status="active",
                login_id="hong1234",
                email="hong1234@example.com",
                password="admin1234",
            ),
        )

        saved = session.get(HrEmployee, item.id)
        assert saved is not None
        assert saved.employee_no == "1234"
        assert item.employee_no == "1234"


def test_create_employee_no_commit_rejects_duplicate_employee_no() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        department_id = _seed_department_and_role(session)

        create_employee_no_commit(
            session,
            EmployeeCreateRequest(
                employee_no="1234",
                display_name="홍길동",
                department_id=department_id,
                position_title="사원",
                hire_date=date(2026, 3, 12),
                employment_status="active",
                login_id="hong1234",
                email="hong1234@example.com",
                password="admin1234",
            ),
        )

        with pytest.raises(HTTPException) as exc_info:
            create_employee_no_commit(
                session,
                EmployeeCreateRequest(
                    employee_no="1234",
                    display_name="김영희",
                    department_id=department_id,
                    position_title="대리",
                    hire_date=date(2026, 3, 12),
                    employment_status="active",
                    login_id="kim1234",
                    email="kim1234@example.com",
                    password="admin1234",
                ),
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == "employee_no already exists."


def test_delete_employees_no_commit_removes_confirmed_appointment_artifacts() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        department_id = _seed_department_and_role(session)

        item = create_employee_no_commit(
            session,
            EmployeeCreateRequest(
                employee_no="1234",
                display_name="홍길동",
                department_id=department_id,
                position_title="사원",
                hire_date=date(2026, 3, 12),
                employment_status="leave",
                login_id="hong1234",
                email="hong1234@example.com",
                password="admin1234",
            ),
        )
        session.commit()

        employee = session.get(HrEmployee, item.id)
        assert employee is not None

        appointment = create_appointment_record(
            session,
            HrAppointmentRecordCreateRequest(
                employee_id=item.id,
                order_title="입사발령",
                effective_date=date(2026, 3, 12),
                appointment_kind="permanent",
                action_type="입사",
                start_date=date(2026, 3, 12),
                to_department_id=department_id,
                to_position_title="사원",
                to_employment_status="active",
                note="cleanup test",
            ),
            employee.user_id,
        )

        confirm_appointment_order(session, appointment.order_id, employee.user_id)
        deleted_count = delete_employees_no_commit(session, [item.id])
        session.commit()

        assert deleted_count == 1
        assert session.get(HrEmployee, item.id) is None
        assert session.exec(select(HrAppointmentOrderItem)).first() is None
        assert session.exec(select(HrAppointmentOrder).where(HrAppointmentOrder.id == appointment.order_id)).first() is None
        assert session.exec(select(HrPersonnelHistory).where(HrPersonnelHistory.employee_id == item.id)).first() is None
        assert session.exec(select(HrEmployeeInfoRecord).where(HrEmployeeInfoRecord.employee_id == item.id)).first() is None
