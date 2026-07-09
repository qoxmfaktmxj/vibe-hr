from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine, select

from app.models import (
    AuthUser,
    HrEmployee,
    HrRetireCase,
    HrRetireCaseItem,
    HrRetireChecklistItem,
    HrSeveranceCalc,
    OrgDepartment,
    PayAllowanceDeduction,
    PayIncomeTaxBracket,
    PayPayrollRun,
    PayPayrollRunEmployee,
    PayPayrollRunItem,
    PayPayrollCode,
    PaySeveranceItemRule,
)
from app.services.hr_retire_service import confirm_retire_case
from app.services.hr_severance_service import (
    SEVERANCE_TAX_TABLE,
    calc_avg_wage_period,
    calc_base_days,
    calc_service_days,
    calc_service_year_deduction,
    calc_service_years,
    calc_severance_amount,
    calc_severance_tax,
    confirm_severance_calc,
    create_draft_from_retire_case,
    recalculate_severance_calc,
    update_severance_adjustment,
)
from app.schemas.hr_severance import HrSeveranceAdjustmentUpdateRequest

FIXED_NOW = datetime(2026, 7, 9, 9, 0, 0, tzinfo=timezone.utc)


def _utc_now() -> datetime:
    return FIXED_NOW


def _make_engine():
    return create_engine("sqlite://")


def _seed_department(session: Session, *, code: str = "DEPT-A") -> OrgDepartment:
    department = OrgDepartment(
        code=code,
        name=f"{code} 부서",
        is_active=True,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(department)
    session.commit()
    session.refresh(department)
    return department


def _seed_employee(
    session: Session,
    *,
    employee_no: str,
    department_id: int,
    hire_date: date,
) -> HrEmployee:
    user = AuthUser(
        login_id=f"user-{employee_no.lower()}",
        email=f"{employee_no.lower()}@vibe-hr.local",
        password_hash="hash",
        display_name=f"직원{employee_no}",
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
        department_id=department_id,
        position_title="사원",
        hire_date=hire_date,
        employment_status="active",
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return employee


def _seed_retire_case(session: Session, *, employee_id: int, retire_date: date, status: str = "draft") -> HrRetireCase:
    retire_case = HrRetireCase(
        employee_id=employee_id,
        retire_date=retire_date,
        status=status,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(retire_case)
    session.commit()
    session.refresh(retire_case)
    return retire_case


def _seed_confirmable_retire_case(session: Session, *, employee_id: int, retire_date: date) -> HrRetireCase:
    """confirm_retire_case가 성공하도록 필수 체크리스트를 모두 완료시킨 케이스를 만든다."""
    checklist = HrRetireChecklistItem(
        code="return-assets",
        title="자산반납",
        is_required=True,
        is_active=True,
        sort_order=1,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(checklist)
    session.commit()
    session.refresh(checklist)

    retire_case = _seed_retire_case(session, employee_id=employee_id, retire_date=retire_date)

    case_item = HrRetireCaseItem(
        case_id=retire_case.id,
        checklist_item_id=checklist.id,
        is_required=True,
        is_checked=True,
        checked_at=_utc_now(),
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(case_item)
    session.commit()
    return retire_case


def _seed_allowance(session: Session, *, code: str, name: str = "항목") -> None:
    session.add(
        PayAllowanceDeduction(
            code=code,
            name=name,
            type="allowance",
            tax_type="taxable",
            calculation_type="fixed",
            is_active=True,
            sort_order=0,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
    )
    session.commit()


def _seed_item_rule(session: Session, *, code: str, include_type: str) -> None:
    session.add(
        PaySeveranceItemRule(
            pay_item_code=code,
            include_type=include_type,
            is_active=True,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
    )
    session.commit()


def _seed_paid_run(session: Session, *, year_month: str) -> PayPayrollRun:
    payroll_code = session.exec(select(PayPayrollCode).where(PayPayrollCode.code == "P100")).first()
    if payroll_code is None:
        payroll_code = PayPayrollCode(
            code="P100",
            name="정규급여",
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

    run = PayPayrollRun(
        year_month=year_month,
        payroll_code_id=int(payroll_code.id),
        status="paid",
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def _seed_run_employee_with_items(
    session: Session,
    *,
    run_id: int,
    employee_id: int,
    items: list[tuple[str, str, float]],
) -> None:
    run_employee = PayPayrollRunEmployee(
        run_id=run_id,
        employee_id=employee_id,
        status="ok",
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(run_employee)
    session.commit()
    session.refresh(run_employee)

    for item_code, direction, amount in items:
        session.add(
            PayPayrollRunItem(
                run_employee_id=run_employee.id,
                item_code=item_code,
                item_name=item_code,
                direction=direction,
                amount=amount,
                created_at=_utc_now(),
            )
        )
    session.commit()


# ── 근속일수 / 1년 미만 ──


def test_service_days_under_one_year_yields_zero_severance() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        dept = _seed_department(session)
        # 입사 2025-12-01, 퇴직 2026-07-09 -> 1년 미만
        employee = _seed_employee(session, employee_no="E001", department_id=int(dept.id), hire_date=date(2025, 12, 1))
        retire_case = _seed_retire_case(session, employee_id=employee.id, retire_date=date(2026, 7, 9))

        calc = create_draft_from_retire_case(session, retire_case_id=retire_case.id)

        assert calc.service_days < 365
        assert calc.severance_amount == 0.0
        assert calc.status == "draft"
        assert calc.warning is not None
        assert "1년 미만" in calc.warning


def test_service_days_exactly_one_year_is_eligible() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        dept = _seed_department(session)
        # 입사 2025-07-10, 퇴직 2026-07-09 -> 정확히 365일 (양끝 포함)
        employee = _seed_employee(session, employee_no="E002", department_id=int(dept.id), hire_date=date(2025, 7, 10))
        retire_case = _seed_retire_case(session, employee_id=employee.id, retire_date=date(2026, 7, 9))

        assert calc_service_days(employee.hire_date, retire_case.retire_date) == 365

        calc = create_draft_from_retire_case(session, retire_case_id=retire_case.id)
        assert calc.service_days == 365
        # 급여이력이 없으므로 평균임금 0 -> 퇴직금 0이지만, "1년 미만" 경고는 없어야 한다
        assert calc.warning is not None
        assert "1년 미만" not in calc.warning


# ── 3개월 경계 (월말 퇴직) ──


def test_avg_wage_period_handles_month_end_retire_date() -> None:
    # 퇴직일 2026-03-31 -> 전날 2026-03-30 -> 3개월전 2025-12-30 -> +1일 = 2025-12-31
    base_from, base_to = calc_avg_wage_period(date(2026, 3, 31))
    assert base_to == date(2026, 3, 30)
    assert base_from == date(2025, 12, 31)
    assert calc_base_days(base_from, base_to) == (base_to - base_from).days + 1


def test_avg_wage_period_ordinary_date() -> None:
    base_from, base_to = calc_avg_wage_period(date(2026, 7, 9))
    assert base_to == date(2026, 7, 8)
    assert base_from == date(2026, 4, 9)
    assert calc_base_days(base_from, base_to) == 91


# ── 평균임금 계산 (고정 날짜) ──


def test_avg_wage_calculation_from_paid_runs_in_period() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        dept = _seed_department(session)
        employee = _seed_employee(session, employee_no="E003", department_id=int(dept.id), hire_date=date(2020, 1, 1))
        retire_case = _seed_retire_case(session, employee_id=employee.id, retire_date=date(2026, 7, 9))
        # avg wage period: 2026-04-09 ~ 2026-07-08 (91일)

        _seed_allowance(session, code="BSC", name="기본급")

        run_april = _seed_paid_run(session, year_month="2026-04")
        run_may = _seed_paid_run(session, year_month="2026-05")
        run_june = _seed_paid_run(session, year_month="2026-06")
        # 2026-07 run은 avg wage 기간(4/9~7/8)과 걸치지 않음 (7/9 이후만 존재한다고 가정) -> 아예 생성하지 않음

        for run in (run_april, run_may, run_june):
            _seed_run_employee_with_items(
                session, run_id=run.id, employee_id=employee.id,
                items=[("BSC", "earning", 3_000_000)],
            )

        calc = create_draft_from_retire_case(session, retire_case_id=retire_case.id)

        assert calc.wage_total_3m == 9_000_000.0
        assert calc.base_days_3m == 91
        expected_avg_daily = 9_000_000.0 / 91
        assert abs(calc.avg_daily_wage - expected_avg_daily) < 1e-6
        expected_severance = expected_avg_daily * 30 * (calc.service_days / 365)
        assert abs(calc.severance_amount - expected_severance) < 1e-6
        assert calc.warning is None


# ── prorate_12 / exclude 규칙 ──


def test_item_rules_prorate_and_exclude_are_applied() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        dept = _seed_department(session)
        employee = _seed_employee(session, employee_no="E004", department_id=int(dept.id), hire_date=date(2020, 1, 1))
        retire_case = _seed_retire_case(session, employee_id=employee.id, retire_date=date(2026, 7, 9))

        _seed_allowance(session, code="BSC", name="기본급")
        _seed_allowance(session, code="BONUS", name="연간상여")
        _seed_allowance(session, code="SPECIAL", name="특별수당")

        _seed_item_rule(session, code="BONUS", include_type="prorate_12")
        _seed_item_rule(session, code="SPECIAL", include_type="exclude")
        # BSC는 규칙 없음 -> full 기본값

        run = _seed_paid_run(session, year_month="2026-06")
        _seed_run_employee_with_items(
            session, run_id=run.id, employee_id=employee.id,
            items=[
                ("BSC", "earning", 3_000_000),
                ("BONUS", "earning", 1_200_000),  # prorate_12 -> 1,200,000 * 3/12 = 300,000
                ("SPECIAL", "earning", 500_000),  # exclude -> 0
            ],
        )

        calc = create_draft_from_retire_case(session, retire_case_id=retire_case.id)

        # BSC(full, 3,000,000) + BONUS(prorate_12, 300,000) + SPECIAL(exclude, 0)
        assert calc.wage_total_3m == 3_000_000.0 + 300_000.0


def test_item_rule_without_explicit_rule_defaults_to_full() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        dept = _seed_department(session)
        employee = _seed_employee(session, employee_no="E005", department_id=int(dept.id), hire_date=date(2020, 1, 1))
        retire_case = _seed_retire_case(session, employee_id=employee.id, retire_date=date(2026, 7, 9))

        _seed_allowance(session, code="UNRULED", name="규칙없는항목")
        run = _seed_paid_run(session, year_month="2026-06")
        _seed_run_employee_with_items(
            session, run_id=run.id, employee_id=employee.id,
            items=[("UNRULED", "earning", 1_000_000)],
        )

        calc = create_draft_from_retire_case(session, retire_case_id=retire_case.id)
        assert calc.wage_total_3m == 1_000_000.0


# ── 상태 전이 ──


def test_status_transitions_draft_reviewed_confirmed() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        dept = _seed_department(session)
        employee = _seed_employee(session, employee_no="E006", department_id=int(dept.id), hire_date=date(2020, 1, 1))
        retire_case = _seed_retire_case(session, employee_id=employee.id, retire_date=date(2026, 7, 9))

        calc = create_draft_from_retire_case(session, retire_case_id=retire_case.id)
        assert calc.status == "draft"

        detail = update_severance_adjustment(
            session,
            calc.id,
            HrSeveranceAdjustmentUpdateRequest(adjustment_amount=50_000, adjustment_reason="근속공로 가산"),
        )
        assert detail.calc.status == "reviewed"
        assert detail.calc.adjustment_amount == 50_000
        assert detail.calc.final_amount == detail.calc.severance_amount + 50_000

        confirmed = confirm_severance_calc(session, calc.id, confirmed_by=1)
        assert confirmed.calc.status == "confirmed"
        assert confirmed.calc.confirmed_by == 1


def test_confirmed_calc_rejects_further_edits() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        dept = _seed_department(session)
        employee = _seed_employee(session, employee_no="E007", department_id=int(dept.id), hire_date=date(2020, 1, 1))
        retire_case = _seed_retire_case(session, employee_id=employee.id, retire_date=date(2026, 7, 9))

        calc = create_draft_from_retire_case(session, retire_case_id=retire_case.id)
        confirm_severance_calc(session, calc.id, confirmed_by=1)

        try:
            update_severance_adjustment(
                session,
                calc.id,
                HrSeveranceAdjustmentUpdateRequest(adjustment_amount=1000, adjustment_reason="사유"),
            )
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 409

        try:
            recalculate_severance_calc(session, calc.id)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 409

        try:
            confirm_severance_calc(session, calc.id, confirmed_by=1)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 409


def test_adjustment_requires_reason() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        dept = _seed_department(session)
        employee = _seed_employee(session, employee_no="E008", department_id=int(dept.id), hire_date=date(2020, 1, 1))
        retire_case = _seed_retire_case(session, employee_id=employee.id, retire_date=date(2026, 7, 9))
        calc = create_draft_from_retire_case(session, retire_case_id=retire_case.id)

        try:
            update_severance_adjustment(
                session,
                calc.id,
                HrSeveranceAdjustmentUpdateRequest(adjustment_amount=1000, adjustment_reason="   "),
            )
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 400


# ── retire confirm 훅 ──


def test_retire_confirm_hook_creates_severance_draft() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        dept = _seed_department(session)
        employee = _seed_employee(session, employee_no="E009", department_id=int(dept.id), hire_date=date(2020, 1, 1))
        retire_case = _seed_confirmable_retire_case(session, employee_id=employee.id, retire_date=date(2026, 7, 20))

        assert session.exec(select(HrSeveranceCalc)).first() is None

        confirm_retire_case(session, case_id=retire_case.id, actor_user_id=1)

        calc = session.exec(
            select(HrSeveranceCalc).where(HrSeveranceCalc.retire_case_id == retire_case.id)
        ).first()
        assert calc is not None
        assert calc.employee_id == employee.id
        assert calc.status == "draft"


def test_retire_confirm_succeeds_even_if_severance_hook_fails(monkeypatch) -> None:
    """훅이 실패해도 retire confirm 트랜잭션 자체는 깨지지 않아야 한다."""
    import app.services.hr_severance_service as severance_service

    def _boom(*args, **kwargs):
        raise RuntimeError("severance service unavailable")

    monkeypatch.setattr(severance_service, "create_draft_from_retire_case", _boom)

    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        dept = _seed_department(session)
        employee = _seed_employee(session, employee_no="E010", department_id=int(dept.id), hire_date=date(2020, 1, 1))
        retire_case = _seed_confirmable_retire_case(session, employee_id=employee.id, retire_date=date(2026, 7, 20))

        detail = confirm_retire_case(session, case_id=retire_case.id, actor_user_id=1)

        assert detail.status == "confirmed"
        # 훅이 실패했으므로 draft는 생성되지 않았어야 한다
        assert session.exec(select(HrSeveranceCalc)).first() is None


# ── 급여이력 없음 warning ──


def test_no_wage_history_sets_warning() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        dept = _seed_department(session)
        employee = _seed_employee(session, employee_no="E011", department_id=int(dept.id), hire_date=date(2020, 1, 1))
        retire_case = _seed_retire_case(session, employee_id=employee.id, retire_date=date(2026, 7, 9))

        calc = create_draft_from_retire_case(session, retire_case_id=retire_case.id)

        assert calc.wage_total_3m == 0.0
        assert calc.avg_daily_wage == 0.0
        assert calc.severance_amount == 0.0
        assert calc.warning is not None
        assert "급여" in calc.warning
        assert calc.status == "draft"


# ── Phase 2: 퇴직소득세 (§9-4) ──


def _seed_income_tax_brackets(session: Session, *, year: int = 2026) -> None:
    """국세청 2026년 종합소득세율표를 그대로 픽스처로 고정 시딩한다 (라이브 브래킷 의존 금지)."""
    rows = [
        (0, 14_000_000, 6.0, 0.0),
        (14_000_000, 50_000_000, 15.0, 1_260_000.0),
        (50_000_000, 88_000_000, 24.0, 5_760_000.0),
        (88_000_000, 150_000_000, 35.0, 15_440_000.0),
        (150_000_000, 300_000_000, 38.0, 19_940_000.0),
        (300_000_000, 500_000_000, 40.0, 25_940_000.0),
        (500_000_000, 1_000_000_000, 42.0, 35_940_000.0),
        (1_000_000_000, None, 45.0, 65_940_000.0),
    ]
    for annual_from, annual_to, tax_rate, quick_deduction in rows:
        session.add(
            PayIncomeTaxBracket(
                year=year,
                annual_taxable_from=annual_from,
                annual_taxable_to=annual_to,
                tax_rate=tax_rate,
                quick_deduction=quick_deduction,
                created_at=_utc_now(),
            )
        )
    session.commit()


# ── 근속연수공제 구간 경계 (5/10/20년) ──


def test_service_year_deduction_boundaries() -> None:
    table = SEVERANCE_TAX_TABLE[2026]["service_year_deduction"]

    assert calc_service_year_deduction(5, table) == 5_000_000.0  # 100만 * 5
    assert calc_service_year_deduction(6, table) == 7_000_000.0  # 500만 + 200만*1
    assert calc_service_year_deduction(10, table) == 15_000_000.0  # 500만 + 200만*5
    assert calc_service_year_deduction(11, table) == 17_500_000.0  # 1,500만 + 250만*1
    assert calc_service_year_deduction(20, table) == 40_000_000.0  # 1,500만 + 250만*10
    assert calc_service_year_deduction(21, table) == 43_000_000.0  # 4,000만 + 300만*1


def test_calc_service_years_ceils_and_has_minimum_one() -> None:
    assert calc_service_years(365) == 1
    assert calc_service_years(366) == 2  # 1년 초과분은 절상
    assert calc_service_years(3650) == 10
    assert calc_service_years(3651) == 11
    assert calc_service_years(0) == 0


# ── 환산급여공제 각 구간 ──


def test_conversion_income_deduction_each_bracket() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_income_tax_brackets(session)

        # ~800만: 전액 산입 -> taxable_base = 0
        r1 = calc_severance_tax(session, final_amount=8_000_000 * 10 / 12, service_days=3650, retire_date=date(2026, 7, 9))
        assert r1["conversion_income_deduction"] == r1["conversion_income"]

        # 환산급여가 5,000만이 되도록 final_amount 역산 (~7,000만 구간: 800만 + 60%초과)
        r2 = calc_severance_tax(session, final_amount=50_000_000 * 10 / 12 + 15_000_000, service_days=3650, retire_date=date(2026, 7, 9))
        assert abs(r2["conversion_income"] - 50_000_000.0) < 1e-3
        expected_deduction_r2 = 8_000_000.0 + (50_000_000.0 - 8_000_000.0) * 0.6
        assert abs(r2["conversion_income_deduction"] - expected_deduction_r2) < 1e-3

        # 환산급여 1억200만 (~1억 구간: 4,520만+55%) — 수기 대조 케이스의 환산급여
        r3 = calc_severance_tax(session, final_amount=100_000_000.0, service_days=3650, retire_date=date(2026, 7, 9))
        assert abs(r3["conversion_income"] - 102_000_000.0) < 1e-3
        expected_deduction_r3 = 61_700_000.0 + (102_000_000.0 - 100_000_000.0) * 0.45
        assert abs(r3["conversion_income_deduction"] - expected_deduction_r3) < 1e-3

        # 환산급여 3억5천 (초과 구간: 15,170만+35%)
        service_year_ded_20 = calc_service_year_deduction(20, SEVERANCE_TAX_TABLE[2026]["service_year_deduction"])
        final_for_350m = 350_000_000.0 * 20 / 12 + service_year_ded_20
        r4 = calc_severance_tax(session, final_amount=final_for_350m, service_days=365 * 20, retire_date=date(2026, 7, 9))
        assert abs(r4["conversion_income"] - 350_000_000.0) < 1e-3
        expected_deduction_r4 = 151_700_000.0 + (350_000_000.0 - 300_000_000.0) * 0.35
        assert abs(r4["conversion_income_deduction"] - expected_deduction_r4) < 1e-3


# ── 1년 미만/0원 세액 0 ──


def test_under_one_year_service_has_zero_tax() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_income_tax_brackets(session)
        result = calc_severance_tax(session, final_amount=5_000_000.0, service_days=200, retire_date=date(2026, 7, 9))

        assert result["income_tax"] == 0.0
        assert result["local_income_tax"] == 0.0
        assert result["net_severance"] == 5_000_000.0


def test_zero_final_amount_has_zero_tax() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_income_tax_brackets(session)
        result = calc_severance_tax(session, final_amount=0.0, service_days=3650, retire_date=date(2026, 7, 9))

        assert result["income_tax"] == 0.0
        assert result["local_income_tax"] == 0.0
        assert result["net_severance"] == 0.0


# ── 조정액 변경 시 세액 재계산 ──


def test_adjustment_change_recalculates_tax() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_income_tax_brackets(session)
        dept = _seed_department(session)
        employee = _seed_employee(session, employee_no="E012", department_id=int(dept.id), hire_date=date(2016, 7, 9))
        retire_case = _seed_retire_case(session, employee_id=employee.id, retire_date=date(2026, 7, 9))

        calc = create_draft_from_retire_case(session, retire_case_id=retire_case.id)
        assert calc.income_tax == 0.0  # 급여이력 없음 -> severance_amount 0 -> 세액 0

        detail = update_severance_adjustment(
            session,
            calc.id,
            HrSeveranceAdjustmentUpdateRequest(adjustment_amount=100_000_000, adjustment_reason="특별공로금"),
        )
        assert detail.calc.final_amount == 100_000_000.0
        assert detail.calc.income_tax > 0.0
        assert detail.calc.net_severance == (
            detail.calc.final_amount - detail.calc.income_tax - detail.calc.local_income_tax
        )
        assert detail.tax_detail is not None
        assert detail.tax_detail.service_years == calc_service_years(calc.service_days)

        # 조정액을 더 늘리면 세액도 늘어나야 한다 (재계산 확인)
        detail2 = update_severance_adjustment(
            session,
            calc.id,
            HrSeveranceAdjustmentUpdateRequest(adjustment_amount=200_000_000, adjustment_reason="추가 조정"),
        )
        assert detail2.calc.income_tax > detail.calc.income_tax


# ── confirmed 후 세액 불변 ──


def test_confirmed_calc_tax_fields_are_immutable() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_income_tax_brackets(session)
        dept = _seed_department(session)
        employee = _seed_employee(session, employee_no="E013", department_id=int(dept.id), hire_date=date(2016, 7, 9))
        retire_case = _seed_retire_case(session, employee_id=employee.id, retire_date=date(2026, 7, 9))

        calc = create_draft_from_retire_case(session, retire_case_id=retire_case.id)
        update_severance_adjustment(
            session,
            calc.id,
            HrSeveranceAdjustmentUpdateRequest(adjustment_amount=100_000_000, adjustment_reason="특별공로금"),
        )

        confirmed = confirm_severance_calc(session, calc.id, confirmed_by=1)
        income_tax_at_confirm = confirmed.calc.income_tax
        net_severance_at_confirm = confirmed.calc.net_severance

        try:
            update_severance_adjustment(
                session,
                calc.id,
                HrSeveranceAdjustmentUpdateRequest(adjustment_amount=999_000_000, adjustment_reason="사유"),
            )
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 409

        try:
            recalculate_severance_calc(session, calc.id)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 409

        reloaded = session.get(HrSeveranceCalc, calc.id)
        assert reloaded.income_tax == income_tax_at_confirm
        assert reloaded.net_severance == net_severance_at_confirm


# ── 수기 대조: 근속 10년, 퇴직금 1억 (국세청 예시 스타일) ──


def test_manual_reconciliation_10_years_100m_won() -> None:
    """근속 10년, 퇴직금 1억원 케이스를 국세청 방식으로 수기 계산해 대조한다.

    근속연수공제 1,500만 (500만 + 200만*5)
    환산급여 = (1억 - 1,500만) * 12 / 10 = 1억200만
    환산급여공제 = 6,170만 + (1억200만 - 1억)*45% = 6,260만
    과세표준 = 1억200만 - 6,260만 = 3,940만
    2026년 기본세율표 15% 구간(1,400만~5,000만, 누진공제 126만):
      환산산출세액 = 3,940만*15% - 126만 = 465만
    산출세액(income_tax) = 465만 / 12 * 10 = 3,875,000
    지방소득세 = 387,500
    실수령 = 1억 - 3,875,000 - 387,500 = 95,737,500
    """
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_income_tax_brackets(session)

        result = calc_severance_tax(
            session, final_amount=100_000_000.0, service_days=3650, retire_date=date(2026, 7, 9)
        )

        assert result["service_years"] == 10
        assert result["service_year_deduction"] == 15_000_000.0
        assert abs(result["conversion_income"] - 102_000_000.0) < 1e-3
        assert abs(result["conversion_income_deduction"] - 62_600_000.0) < 1e-3
        assert abs(result["taxable_base"] - 39_400_000.0) < 1e-3
        assert result["base_tax_rate"] == 15.0
        assert result["quick_deduction"] == 1_260_000.0
        assert abs(result["converted_calculated_tax"] - 4_650_000.0) < 1e-3
        assert abs(result["income_tax"] - 3_875_000.0) < 1e-3
        assert abs(result["local_income_tax"] - 387_500.0) < 1e-3
        assert abs(result["net_severance"] - 95_737_500.0) < 1e-3


# ── 세율 연도 fallback ──


def test_missing_year_bracket_falls_back_to_latest_and_warns() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_income_tax_brackets(session, year=2025)

        result = calc_severance_tax(
            session, final_amount=100_000_000.0, service_days=3650, retire_date=date(2026, 7, 9)
        )

        assert result["bracket_year"] == 2025
        assert result["warning"] is not None
        assert "2025" in result["warning"]
        # 세율 자체는 정상적으로 적용되어야 한다
        assert result["income_tax"] > 0.0
