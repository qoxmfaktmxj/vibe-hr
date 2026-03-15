from datetime import date, datetime, timezone

from sqlmodel import Session, SQLModel, create_engine, select

from app.models import AuthRole, AuthUser, HrEmployee, HrRecruitFinalist, OrgDepartment
from app.services.hr_recruit_service import create_employees_from_finalists


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _seed_department_and_role(session: Session) -> OrgDepartment:
    now = _utc_now()
    department = OrgDepartment(
        code="HQ-HR",
        name="인사본부",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    role = AuthRole(code="employee", name="Employee", created_at=now)
    session.add(department)
    session.add(role)
    session.commit()
    session.refresh(department)
    return department


def test_create_employees_from_finalists_creates_employee_and_updates_finalist() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        _seed_department_and_role(session)
        finalist = HrRecruitFinalist(
            candidate_no="RC-SEED-1001",
            source_type="manual",
            full_name="홍길동",
            email="hong@example.com",
            hire_type="new",
            career_years=0,
            expected_join_date=date(2026, 3, 20),
            status_code="draft",
            is_active=True,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(finalist)
        session.commit()
        session.refresh(finalist)

        response = create_employees_from_finalists(session, [finalist.id or 0])

        saved_finalist = session.get(HrRecruitFinalist, finalist.id)
        employee = session.exec(select(HrEmployee).where(HrEmployee.employee_no == saved_finalist.employee_no)).first()
        user = session.exec(select(AuthUser).where(AuthUser.login_id == saved_finalist.login_id)).first()

        assert response.created_count == 1
        assert response.skipped_count == 0
        assert response.error_count == 0
        assert saved_finalist is not None
        assert saved_finalist.status_code == "ready"
        assert saved_finalist.employee_no is not None
        assert saved_finalist.login_id is not None
        assert employee is not None
        assert employee.department_id == 1
        assert employee.position_title == "채용대기"
        assert employee.employment_status == "leave"
        assert user is not None
        assert user.display_name == "홍길동"


def test_create_employees_from_finalists_falls_back_for_invalid_seed_email() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        _seed_department_and_role(session)
        finalist = HrRecruitFinalist(
            candidate_no="RC-SEED-1002",
            source_type="if",
            full_name="김민수",
            email="seed.recruit.1002@vibe-hr.local",
            hire_type="experienced",
            career_years=5,
            expected_join_date=date(2026, 3, 22),
            status_code="draft",
            is_active=True,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(finalist)
        session.commit()
        session.refresh(finalist)

        response = create_employees_from_finalists(session, [finalist.id or 0])

        saved_finalist = session.get(HrRecruitFinalist, finalist.id)
        user = session.exec(select(AuthUser).where(AuthUser.login_id == saved_finalist.login_id)).first()

        assert response.created_count == 1
        assert response.skipped_count == 0
        assert response.error_count == 0
        assert saved_finalist is not None
        assert saved_finalist.login_id is not None
        assert user is not None
        assert user.email == f"{saved_finalist.login_id}@hr.minosek91.cloud"


def test_create_employees_from_finalists_skips_when_employee_already_exists() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        department = _seed_department_and_role(session)
        user = AuthUser(
            login_id="emp900010",
            email="emp900010@example.com",
            password_hash="hash",
            display_name="기존사원",
            is_active=True,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        employee = HrEmployee(
            user_id=user.id or 0,
            employee_no="EMP-900010",
            department_id=department.id or 0,
            position_title="사원",
            hire_date=date(2026, 3, 1),
            employment_status="active",
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        finalist = HrRecruitFinalist(
            candidate_no="RC-SEED-1010",
            source_type="manual",
            full_name="기존사원",
            email="emp900010@example.com",
            hire_type="experienced",
            career_years=3,
            login_id="emp900010",
            employee_no="EMP-900010",
            expected_join_date=date(2026, 3, 21),
            status_code="ready",
            is_active=True,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(employee)
        session.add(finalist)
        session.commit()
        session.refresh(finalist)

        response = create_employees_from_finalists(session, [finalist.id or 0])

        all_employees = session.exec(select(HrEmployee)).all()
        assert response.created_count == 0
        assert response.skipped_count == 1
        assert response.error_count == 0
        assert len(all_employees) == 1
        assert response.results[0].outcome == "skipped"
