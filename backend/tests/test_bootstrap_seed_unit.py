from datetime import date, datetime, timezone

from sqlmodel import Session, SQLModel, create_engine, select

from app.bootstrap import _build_wel_benefit_request_seed_rows, ensure_payroll_detail_visual_samples
from app.models import AuthUser, HrEmployee, OrgDepartment, PayVariableInput


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _seed_employee(session: Session, *, employee_no: str, display_name: str) -> HrEmployee:
    department = OrgDepartment(
        code=f"DEPT-{employee_no}",
        name=f"Department {employee_no}",
        organization_type="TEAM",
        cost_center_code=f"CC-{employee_no}",
        description="seed department",
        is_active=True,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    user = AuthUser(
        login_id=f"user-{employee_no.lower()}",
        email=f"{employee_no.lower()}@vibe-hr.local",
        password_hash="hash",
        display_name=display_name,
        is_active=True,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(department)
    session.add(user)
    session.commit()
    session.refresh(department)
    session.refresh(user)

    employee = HrEmployee(
        user_id=int(user.id),
        employee_no=employee_no,
        department_id=int(department.id),
        position_title="사원",
        hire_date=date(2026, 1, 1),
        employment_status="active",
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return employee


def test_build_welfare_seed_rows_follow_reference_month() -> None:
    rows = _build_wel_benefit_request_seed_rows(date(2026, 4, 15))

    assert rows[0]["request_no"] == "WEL-202604-001"
    assert rows[0]["payroll_run_label"] == "2026-04 정기급여"
    assert rows[0]["requested_at"] == datetime(2026, 4, 4, 9, 0, 0)
    assert rows[0]["approved_at"] == datetime(2026, 4, 5, 11, 30, 0)

    loan_row = next(row for row in rows if row["benefit_type_code"] == "LOAN")
    assert loan_row["request_no"] == "WEL-202604-003"
    assert loan_row["payroll_run_label"] == "2026-05 공제 예정"
    assert loan_row["approved_amount"] == 3_000_000


def test_ensure_payroll_detail_visual_samples_upserts_target_inputs() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        employees = {
            "HR-0001": _seed_employee(session, employee_no="HR-0001", display_name="Admin"),
            "KR-0004": _seed_employee(session, employee_no="KR-0004", display_name="서예우"),
            "KR-0008": _seed_employee(session, employee_no="KR-0008", display_name="김하림"),
        }

        ensure_payroll_detail_visual_samples(session)

        year_month = date.today().replace(day=1).strftime("%Y-%m")
        variable_rows = session.exec(
            select(PayVariableInput).where(PayVariableInput.year_month == year_month)
        ).all()

        item_map = {
            (employee_no, row.item_code): row
            for employee_no, employee in employees.items()
            for row in variable_rows
            if row.employee_id == employee.id
        }

        assert item_map[("HR-0001", "MLA")].amount == 130_000.0
        assert item_map[("KR-0004", "MLA")].amount == 140_000.0
        assert item_map[("KR-0004", "POS")].amount == 150_000.0
        assert item_map[("KR-0004", "OTX")].amount == 125_000.0
        assert item_map[("KR-0008", "NGT")].amount == 70_000.0
