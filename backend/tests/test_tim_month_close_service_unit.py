from datetime import date, datetime, timezone

import pytest
from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine, select

from app.api.tim_attendance_daily import attendance_correct
from app.models import (
    AuthUser,
    HrAttendanceDaily,
    HrEmployee,
    OrgDepartment,
    PayEmployeeProfile,
    PayPayrollCode,
    PayVariableInput,
    TimMonthClose,
)
from app.schemas.tim_attendance_daily import TimAttendanceCorrectRequest
from app.services.tim_month_close_service import assert_month_not_closed, close_month, reopen_month


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _seed_employee(
    session: Session,
    *,
    login_id: str,
    email: str,
    display_name: str,
    employee_no: str,
) -> HrEmployee:
    department = session.exec(select(OrgDepartment).where(OrgDepartment.code == "HR")) .first()
    if department is None:
        department = OrgDepartment(
            code="HR",
            name="인사팀",
            organization_type="HEADQUARTERS",
            cost_center_code="CC-HR",
            description="인사 운영",
            is_active=True,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(department)
        session.commit()
        session.refresh(department)

    user = AuthUser(
        login_id=login_id,
        email=email,
        password_hash="hash",
        display_name=display_name,
        is_active=True,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(user)
    session.commit()
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


def _seed_payroll_code(session: Session) -> PayPayrollCode:
    payroll_code = PayPayrollCode(
        code="P100",
        name="정기급여",
        pay_type="급여",
        payment_day="25",
        tax_deductible=True,
        social_ins_deductible=True,
        is_active=True,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(payroll_code)
    session.commit()
    session.refresh(payroll_code)
    return payroll_code


def test_close_month_aggregates_attendance_and_upserts_pay_variable_inputs(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    import app.services.tim_work_hours_calc_service as calc_service

    monkeypatch.setattr(calc_service, "recalculate_month", lambda session, year, month: 0)

    with Session(engine) as session:
        employee = _seed_employee(
            session,
            login_id="admin-month-close",
            email="admin-month-close@example.com",
            display_name="월마감 관리자",
            employee_no="HR-1000",
        )
        employee2 = _seed_employee(
            session,
            login_id="staff-month-close",
            email="staff-month-close@example.com",
            display_name="월마감 대상자",
            employee_no="HR-1001",
        )
        payroll_code = _seed_payroll_code(session)

        session.add(
            PayEmployeeProfile(
                employee_id=int(employee.id),
                payroll_code_id=int(payroll_code.id),
                base_salary=2_090_000,
                effective_from=date(2026, 1, 1),
                is_active=True,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
        session.commit()

        workday = HrAttendanceDaily(
            employee_id=int(employee.id),
            work_date=date(2026, 3, 3),
            attendance_status="present",
            overtime_minutes=120,
            night_minutes=60,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        holiday = HrAttendanceDaily(
            employee_id=int(employee.id),
            work_date=date(2026, 3, 4),
            attendance_status="leave",
            holiday_work_minutes=180,
            holiday_overtime_minutes=60,
            holiday_night_minutes=30,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        absent = HrAttendanceDaily(
            employee_id=int(employee2.id),
            work_date=date(2026, 3, 5),
            attendance_status="absent",
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        late = HrAttendanceDaily(
            employee_id=int(employee2.id),
            work_date=date(2026, 3, 6),
            attendance_status="late",
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(workday)
        session.add(holiday)
        session.add(absent)
        session.add(late)
        session.commit()

        closed = close_month(session, 2026, 3, int(employee.user_id), "1차 마감")

        assert closed.item.close_status == "closed"
        assert closed.item.closed_by_name == "월마감 관리자"
        assert closed.item.note == "1차 마감"
        assert closed.item.employee_count == 2
        assert closed.item.present_days == 1
        assert closed.item.late_days == 1
        assert closed.item.absent_days == 1
        assert closed.item.leave_days == 1
        assert closed.item.total_overtime_minutes == 120
        assert closed.item.total_night_minutes == 60
        assert closed.item.total_holiday_work_minutes == 180
        assert closed.item.total_holiday_overtime_minutes == 60
        assert closed.item.total_holiday_night_minutes == 30

        rows = session.exec(
            select(PayVariableInput)
            .where(PayVariableInput.year_month == "2026-03")
            .order_by(PayVariableInput.item_code)
        ).all()
        row_map = {row.item_code: row for row in rows}

        assert len(rows) == 5
        assert row_map["OTX"].amount == 30_000
        assert row_map["NGT"].amount == 5_000
        assert row_map["HDW"].amount == 45_000
        assert row_map["HDO"].amount == 20_000
        assert row_map["HDN"].amount == 10_000
        assert all(row.memo and "월마감 자동생성" in row.memo for row in rows)

        reopened = reopen_month(session, 2026, 3, int(employee.user_id))
        assert reopened.item.close_status == "open"
        assert reopened.item.reopened_by_name == "월마감 관리자"

        workday.overtime_minutes = 180
        workday.night_minutes = 120
        workday.updated_at = _utc_now()
        session.add(workday)
        session.commit()

        reclosed = close_month(session, 2026, 3, int(employee.user_id), "재마감")
        assert reclosed.item.close_status == "closed"
        assert reclosed.item.note == "재마감"

        rows = session.exec(
            select(PayVariableInput)
            .where(PayVariableInput.year_month == "2026-03")
            .order_by(PayVariableInput.item_code)
        ).all()
        row_map = {row.item_code: row for row in rows}

        assert len(rows) == 5
        assert row_map["OTX"].amount == 45_000
        assert row_map["NGT"].amount == 10_000
        assert row_map["HDW"].amount == 45_000
        assert row_map["HDO"].amount == 20_000
        assert row_map["HDN"].amount == 10_000


def test_assert_month_not_closed_blocks_only_closed_months() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        assert_month_not_closed(session, 2026, 4)

        session.add(
            TimMonthClose(
                year=2026,
                month=4,
                close_status="closed",
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
        session.commit()

        with pytest.raises(HTTPException) as exc_info:
            assert_month_not_closed(session, 2026, 4)

        assert exc_info.value.status_code == 423
        assert "마감된 기간" in str(exc_info.value.detail)


def test_attendance_correct_blocks_closed_month_updates() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        admin_employee = _seed_employee(
            session,
            login_id="admin-attendance-lock",
            email="admin-attendance-lock@example.com",
            display_name="근태 관리자",
            employee_no="HR-2000",
        )
        target_employee = _seed_employee(
            session,
            login_id="target-attendance-lock",
            email="target-attendance-lock@example.com",
            display_name="근태 대상자",
            employee_no="HR-2001",
        )
        admin_user = session.get(AuthUser, admin_employee.user_id)
        assert admin_user is not None

        attendance = HrAttendanceDaily(
            employee_id=int(target_employee.id),
            work_date=date(2026, 3, 10),
            attendance_status="present",
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(attendance)
        session.add(
            TimMonthClose(
                year=2026,
                month=3,
                close_status="closed",
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
        session.commit()
        session.refresh(attendance)

        with pytest.raises(HTTPException) as exc_info:
            attendance_correct(
                int(attendance.id),
                TimAttendanceCorrectRequest(new_status="late", reason="마감 후 수정 시도"),
                session,
                admin_user,
            )

        assert exc_info.value.status_code == 423
        assert "마감된 기간" in str(exc_info.value.detail)
