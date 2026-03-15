from datetime import date, datetime, timezone

from sqlmodel import Session, SQLModel, create_engine, select

from app.models import (
    AuthUser,
    HrAppointmentOrderItem,
    HrEmployee,
    HrEmployeeInfoRecord,
    OrgDepartment,
)
from app.schemas.hr_appointment_record import HrAppointmentRecordCreateRequest
from app.services.hr_appointment_record_service import (
    confirm_appointment_order,
    create_appointment_record,
)
from app.services.hr_basic_service import get_hr_basic_detail


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _seed_employee(session: Session) -> HrEmployee:
    now = _utc_now()
    department = OrgDepartment(
        code="HQ-HR",
        name="인사본부",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    user = AuthUser(
        login_id="emp900200",
        email="emp900200@example.com",
        password_hash="hash",
        display_name="홍길동",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    session.add(department)
    session.add(user)
    session.commit()
    session.refresh(department)
    session.refresh(user)

    employee = HrEmployee(
        user_id=user.id or 0,
        employee_no="EMP-900200",
        department_id=department.id or 0,
        position_title="채용대기",
        hire_date=date(2026, 3, 20),
        employment_status="leave",
        created_at=now,
        updated_at=now,
    )
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return employee


def test_confirm_appointment_order_creates_legacy_hr_basic_appointment_record() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        employee = _seed_employee(session)

        created = create_appointment_record(
            session,
            HrAppointmentRecordCreateRequest(
                employee_id=employee.id or 0,
                order_title="입사발령",
                effective_date=date(2026, 3, 20),
                appointment_kind="permanent",
                action_type="입사",
                start_date=date(2026, 3, 20),
                to_employment_status="active",
                note="playwright e2e",
            ),
            user_id=employee.user_id,
        )

        response = confirm_appointment_order(session, created.order_id, user_id=employee.user_id)
        session.refresh(employee)

        saved_record = session.exec(
            select(HrEmployeeInfoRecord).where(
                HrEmployeeInfoRecord.employee_id == employee.id,
                HrEmployeeInfoRecord.category == "appointment",
            )
        ).first()
        saved_item = session.exec(
            select(HrAppointmentOrderItem).where(HrAppointmentOrderItem.order_id == created.order_id)
        ).first()
        detail = get_hr_basic_detail(session, employee.id or 0)

        assert response.applied_count == 1
        assert employee.employment_status == "active"
        assert saved_item is not None
        assert saved_item.apply_status == "applied"
        assert saved_record is not None
        assert saved_record.title == "입사발령"
        assert saved_record.type == "입사"
        assert saved_record.value == "active"
        assert detail.appointments
        assert detail.appointments[0].title == "입사발령"
        assert detail.appointments[0].type == "입사"
