from datetime import date, datetime, timezone

from sqlmodel import Session, SQLModel, create_engine, select

from app.models import AuthUser, HrEmployee, HrRecruitFinalist, OrgDepartment
from app.schemas.hr_appointment_record import HrAppointmentRecordCreateRequest
from app.services.hr_appointment_record_service import confirm_appointment_order, create_appointment_record


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def test_confirm_appointment_order_marks_related_finalist_appointed() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        now = _utc_now()
        department = OrgDepartment(
            code="HQ-HR",
            name="인사본부",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        user = AuthUser(
            login_id="emp900201",
            email="emp900201@example.com",
            password_hash="hash",
            display_name="김합격",
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
            employee_no="EMP-900201",
            department_id=department.id or 0,
            position_title="채용대기",
            hire_date=date(2026, 4, 1),
            employment_status="leave",
            created_at=now,
            updated_at=now,
        )
        finalist = HrRecruitFinalist(
            candidate_no="CAN-900201",
            source_type="manual",
            full_name="김합격",
            hire_type="new",
            login_id=user.login_id,
            employee_no="EMP-900201",
            expected_join_date=date(2026, 4, 1),
            status_code="ready",
            created_at=now,
            updated_at=now,
        )
        session.add(employee)
        session.add(finalist)
        session.commit()
        session.refresh(employee)
        session.refresh(finalist)

        created = create_appointment_record(
            session,
            HrAppointmentRecordCreateRequest(
                employee_id=employee.id or 0,
                order_title="입사발령",
                effective_date=date(2026, 4, 1),
                appointment_kind="permanent",
                action_type="입사",
                start_date=date(2026, 4, 1),
                to_employment_status="active",
                note="finalist lifecycle sync",
            ),
            user_id=user.id or 0,
        )

        response = confirm_appointment_order(session, created.order_id, user_id=user.id or 0)
        synced_finalist = session.exec(
            select(HrRecruitFinalist).where(HrRecruitFinalist.id == finalist.id)
        ).one()

        assert response.applied_count == 1
        assert synced_finalist.status_code == "appointed"
        assert synced_finalist.updated_at is not None
