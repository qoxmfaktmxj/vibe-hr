from datetime import date, datetime, timezone

from sqlmodel import Session, SQLModel, create_engine, select

from app.models import (
    AuthUser,
    HrEmployee,
    OrgDepartment,
    PayAllowanceDeduction,
    PayEmployeeProfile,
    PayPayrollCode,
    PayPayrollRun,
    PayPayrollRunEmployee,
    PayPayrollRunItem,
    PayTaxRate,
    PayVariableInput,
    WelBenefitRequest,
    WelBenefitType,
)
from app.services.payroll_phase2_service import calculate_payroll_run


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _seed_payroll_context(
    session: Session,
    *,
    employee_no: str,
    display_name: str,
    base_salary: float,
    effective_from: date,
) -> tuple[OrgDepartment, AuthUser, PayPayrollCode, HrEmployee]:
    department = OrgDepartment(
        code=f"HQ-{employee_no}",
        name="인사본부",
        organization_type="HEADQUARTERS",
        cost_center_code=f"CC-{employee_no}",
        description="인사 운영",
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
    session.add(department)
    session.add(user)
    session.add(payroll_code)
    session.commit()
    session.refresh(department)
    session.refresh(user)
    session.refresh(payroll_code)

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

    session.add(
        PayEmployeeProfile(
            employee_id=int(employee.id),
            payroll_code_id=int(payroll_code.id),
            item_group_id=None,
            base_salary=base_salary,
            pay_type_code="regular",
            payment_day_type="fixed_day",
            payment_day_value=25,
            holiday_adjustment="previous_business_day",
            effective_from=effective_from,
            effective_to=None,
            is_active=True,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
    )
    session.commit()
    return department, user, payroll_code, employee


def _seed_allowance_definitions(session: Session, items: list[tuple[str, str, str, str, int]]) -> None:
    for code, name, item_type, tax_type, sort_order in items:
        calculation_type = "formula" if code in {"PEN", "HIN", "EMP", "LTC", "ITX", "LTX"} else "fixed"
        session.add(
            PayAllowanceDeduction(
                code=code,
                name=name,
                type=item_type,
                tax_type=tax_type,
                calculation_type=calculation_type,
                is_active=True,
                sort_order=sort_order,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
    session.commit()


def _seed_tax_rates(
    session: Session,
    *,
    year: int,
    rows: list[tuple[str, float, int | None, int | None]],
) -> None:
    for rate_type, employee_rate, min_limit, max_limit in rows:
        session.add(
            PayTaxRate(
                year=year,
                rate_type=rate_type,
                employee_rate=employee_rate,
                employer_rate=employee_rate,
                min_limit=min_limit,
                max_limit=max_limit,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
    session.commit()


def test_calculate_payroll_run_projects_welfare_requests_into_pay_items() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        department, user, payroll_code, employee = _seed_payroll_context(
            session,
            employee_no="EMP-900100",
            display_name="복지테스트",
            base_salary=3_500_000,
            effective_from=date(2026, 3, 1),
        )
        _seed_allowance_definitions(
            session,
            [
                ("SCHOLARSHIP_GRANT", "학자금지원", "allowance", "taxable", 100),
                ("LOAN_REPAY", "사내대출상환", "deduction", "tax", 200),
                ("PEN", "국민연금", "deduction", "insurance", 210),
                ("HIN", "건강보험", "deduction", "insurance", 220),
                ("EMP", "고용보험", "deduction", "insurance", 230),
                ("LTC", "장기요양", "deduction", "insurance", 240),
                ("ITX", "소득세", "deduction", "tax", 250),
                ("LTX", "지방소득세", "deduction", "tax", 260),
            ],
        )
        session.add(
            WelBenefitType(
                code="SCHOLARSHIP",
                name="학자금",
                module_path="/wel/scholarship",
                is_deduction=False,
                pay_item_code="SCHOLARSHIP_GRANT",
                is_active=True,
                sort_order=10,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
        session.add(
            WelBenefitType(
                code="LOAN",
                name="사내대출",
                module_path="/wel/loan",
                is_deduction=True,
                pay_item_code="LOAN_REPAY",
                is_active=True,
                sort_order=20,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
        _seed_tax_rates(
            session,
            year=2026,
            rows=[
                ("국민연금", 4.5, None, None),
                ("건강보험", 3.545, None, None),
                ("장기요양", 0.4591, None, None),
                ("고용보험", 0.9, None, None),
                ("소득세", 1.0, None, None),
            ],
        )

        run = PayPayrollRun(
            year_month="2026-03",
            payroll_code_id=int(payroll_code.id),
            run_name="시드 정기급여 계산본",
            status="draft",
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(run)
        session.commit()
        session.refresh(run)

        scholarship_request = WelBenefitRequest(
            request_no="WEL-TEST-0001",
            benefit_type_code="SCHOLARSHIP",
            benefit_type_name="학자금",
            employee_no="EMP-900100",
            employee_name="복지테스트",
            department_name="인사본부",
            status_code="approved",
            requested_amount=200_000,
            approved_amount=200_000,
            payroll_run_label=None,
            description="학자금 지급",
            requested_at=_utc_now().replace(tzinfo=None),
            approved_at=_utc_now().replace(tzinfo=None),
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        loan_request = WelBenefitRequest(
            request_no="WEL-TEST-0002",
            benefit_type_code="LOAN",
            benefit_type_name="사내대출",
            employee_no="EMP-900100",
            employee_name="복지테스트",
            department_name="인사본부",
            status_code="approved",
            requested_amount=50_000,
            approved_amount=50_000,
            payroll_run_label=None,
            description="사내대출 상환",
            requested_at=_utc_now().replace(tzinfo=None),
            approved_at=_utc_now().replace(tzinfo=None),
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(scholarship_request)
        session.add(loan_request)
        session.commit()

        response = calculate_payroll_run(session, int(run.id))

        session.refresh(scholarship_request)
        session.refresh(loan_request)

        assert response.run.status == "calculated"
        assert scholarship_request.status_code == "payroll_reflected"
        assert loan_request.status_code == "payroll_reflected"
        assert scholarship_request.payroll_run_label == "2026-03 정기급여"
        assert loan_request.payroll_run_label == "2026-03 정기급여"

        run_employee = session.exec(
            select(PayPayrollRunEmployee).where(PayPayrollRunEmployee.run_id == run.id)
        ).one()
        run_items = session.exec(
            select(PayPayrollRunItem).where(PayPayrollRunItem.run_employee_id == run_employee.id)
        ).all()

        scholarship_item = next(item for item in run_items if item.item_code == "SCHOLARSHIP_GRANT")
        loan_item = next(item for item in run_items if item.item_code == "LOAN_REPAY")
        ltc_item = next(item for item in run_items if item.item_code == "LTC")

        assert scholarship_item.source_type == "welfare"
        assert scholarship_item.direction == "earning"
        assert scholarship_item.amount == 200_000
        assert loan_item.source_type == "welfare"
        assert loan_item.direction == "deduction"
        assert loan_item.amount == 50_000
        assert ltc_item.direction == "deduction"
        assert ltc_item.amount > 0
        assert run_employee.gross_pay > 3_500_000
        assert run_employee.total_deductions > 50_000


def test_calculate_payroll_run_splits_core_allowances_by_tax_type() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        _, _, payroll_code, employee = _seed_payroll_context(
            session,
            employee_no="EMP-900200",
            display_name="수당테스트",
            base_salary=3_000_000,
            effective_from=date(2026, 3, 1),
        )
        _seed_allowance_definitions(
            session,
            [
                ("MLA", "식대", "allowance", "non-taxable", 20),
                ("OTX", "연장수당", "allowance", "taxable", 30),
                ("NGT", "야간수당", "allowance", "taxable", 40),
                ("POS", "직책수당", "allowance", "taxable", 50),
                ("PEN", "국민연금", "deduction", "insurance", 110),
                ("HIN", "건강보험", "deduction", "insurance", 120),
                ("EMP", "고용보험", "deduction", "insurance", 125),
                ("LTC", "장기요양", "deduction", "insurance", 127),
                ("ITX", "소득세", "deduction", "tax", 130),
                ("LTX", "지방소득세", "deduction", "tax", 135),
            ],
        )
        _seed_tax_rates(
            session,
            year=2026,
            rows=[
                ("국민연금", 4.5, None, None),
                ("건강보험", 3.545, None, None),
                ("장기요양", 0.4591, None, None),
                ("고용보험", 0.9, None, None),
                ("소득세", 1.0, None, None),
            ],
        )

        for item_code, amount in (("MLA", 200_000), ("OTX", 150_000), ("NGT", 80_000), ("POS", 120_000)):
            session.add(
                PayVariableInput(
                    year_month="2026-03",
                    employee_id=int(employee.id),
                    item_code=item_code,
                    direction="earning",
                    amount=amount,
                    memo=f"seed-{item_code.lower()}",
                    created_at=_utc_now(),
                    updated_at=_utc_now(),
                )
            )
        session.commit()

        run = PayPayrollRun(
            year_month="2026-03",
            payroll_code_id=int(payroll_code.id),
            run_name="수당 계산 검증",
            status="draft",
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(run)
        session.commit()
        session.refresh(run)

        response = calculate_payroll_run(session, int(run.id))

        run_employee = session.exec(
            select(PayPayrollRunEmployee).where(PayPayrollRunEmployee.run_id == run.id)
        ).one()
        run_items = session.exec(
            select(PayPayrollRunItem).where(PayPayrollRunItem.run_employee_id == run_employee.id)
        ).all()
        item_map = {item.item_code: item for item in run_items}

        assert response.run.status == "calculated"
        assert item_map["MLA"].tax_type == "non-taxable"
        assert item_map["OTX"].tax_type == "taxable"
        assert item_map["NGT"].tax_type == "taxable"
        assert item_map["POS"].tax_type == "taxable"
        assert run_employee.gross_pay == 3_550_000
        assert run_employee.taxable_income == 3_350_000
        assert run_employee.non_taxable_income == 200_000


def test_calculate_payroll_run_applies_tax_limits_and_filters_welfare_to_run_month() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        department, _, payroll_code, employee = _seed_payroll_context(
            session,
            employee_no="EMP-900300",
            display_name="월반영테스트",
            base_salary=10_000_000,
            effective_from=date(2026, 3, 1),
        )
        _seed_allowance_definitions(
            session,
            [
                ("SCHOLARSHIP_GRANT", "학자금지원", "allowance", "taxable", 100),
                ("PEN", "국민연금", "deduction", "insurance", 110),
                ("HIN", "건강보험", "deduction", "insurance", 120),
                ("EMP", "고용보험", "deduction", "insurance", 125),
                ("LTC", "장기요양", "deduction", "insurance", 127),
                ("ITX", "소득세", "deduction", "tax", 130),
                ("LTX", "지방소득세", "deduction", "tax", 135),
            ],
        )
        session.add(
            WelBenefitType(
                code="SCHOLARSHIP",
                name="학자금",
                module_path="/wel/scholarship",
                is_deduction=False,
                pay_item_code="SCHOLARSHIP_GRANT",
                is_active=True,
                sort_order=10,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
        session.commit()
        _seed_tax_rates(
            session,
            year=2026,
            rows=[
                ("국민연금", 4.5, 390000, 6170000),
                ("건강보험", 3.545, 279266, 4_000_000),
                ("장기요양", 0.4591, None, None),
                ("고용보험", 0.9, None, None),
                ("소득세", 1.0, None, None),
            ],
        )

        current_request = WelBenefitRequest(
            request_no="WEL-TEST-0301",
            benefit_type_code="SCHOLARSHIP",
            benefit_type_name="학자금",
            employee_no="EMP-900300",
            employee_name="월반영테스트",
            department_name=department.name,
            status_code="approved",
            requested_amount=200_000,
            approved_amount=200_000,
            payroll_run_label=None,
            description="3월 지급분",
            requested_at=datetime(2026, 3, 5, 9, 0),
            approved_at=datetime(2026, 3, 7, 9, 0),
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        previous_month_request = WelBenefitRequest(
            request_no="WEL-TEST-0201",
            benefit_type_code="SCHOLARSHIP",
            benefit_type_name="학자금",
            employee_no="EMP-900300",
            employee_name="월반영테스트",
            department_name=department.name,
            status_code="approved",
            requested_amount=300_000,
            approved_amount=300_000,
            payroll_run_label=None,
            description="2월 지급분",
            requested_at=datetime(2026, 2, 5, 9, 0),
            approved_at=datetime(2026, 2, 7, 9, 0),
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        rerun_request = WelBenefitRequest(
            request_no="WEL-TEST-0302",
            benefit_type_code="SCHOLARSHIP",
            benefit_type_name="학자금",
            employee_no="EMP-900300",
            employee_name="월반영테스트",
            department_name=department.name,
            status_code="payroll_reflected",
            requested_amount=50_000,
            approved_amount=50_000,
            payroll_run_label="2026-03 정기급여",
            description="3월 재계산 대상",
            requested_at=datetime(2026, 2, 25, 9, 0),
            approved_at=datetime(2026, 2, 28, 9, 0),
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(current_request)
        session.add(previous_month_request)
        session.add(rerun_request)
        session.commit()

        run = PayPayrollRun(
            year_month="2026-03",
            payroll_code_id=int(payroll_code.id),
            run_name="복리/보험 정합성 검증",
            status="draft",
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(run)
        session.commit()
        session.refresh(run)

        calculate_payroll_run(session, int(run.id))

        session.refresh(current_request)
        session.refresh(previous_month_request)
        session.refresh(rerun_request)

        assert current_request.status_code == "payroll_reflected"
        assert current_request.payroll_run_label == "2026-03 정기급여"
        assert previous_month_request.status_code == "approved"
        assert previous_month_request.payroll_run_label is None
        assert rerun_request.status_code == "payroll_reflected"
        assert rerun_request.payroll_run_label == "2026-03 정기급여"

        run_employee = session.exec(
            select(PayPayrollRunEmployee).where(PayPayrollRunEmployee.run_id == run.id)
        ).one()
        run_items = session.exec(
            select(PayPayrollRunItem).where(PayPayrollRunItem.run_employee_id == run_employee.id)
        ).all()

        welfare_total = sum(item.amount for item in run_items if item.item_code == "SCHOLARSHIP_GRANT")
        pension_item = next(item for item in run_items if item.item_code == "PEN")
        health_item = next(item for item in run_items if item.item_code == "HIN")
        long_term_care_item = next(item for item in run_items if item.item_code == "LTC")

        assert welfare_total == 250_000
        assert pension_item.amount == 277_650
        assert health_item.amount == 141_800
        assert long_term_care_item.amount == round(health_item.amount * (0.4591 / 3.545), 2)
