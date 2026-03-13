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
    WelBenefitRequest,
    WelBenefitType,
)
from app.services.payroll_phase2_service import calculate_payroll_run


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def test_calculate_payroll_run_projects_welfare_requests_into_pay_items() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        department = OrgDepartment(
            code="HQ-HR",
            name="인사본부",
            organization_type="HEADQUARTERS",
            cost_center_code="CC-HR-001",
            description="인사 운영",
            is_active=True,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        user = AuthUser(
            login_id="pay-seed-user",
            email="pay-seed-user@vibe-hr.local",
            password_hash="hash",
            display_name="복지테스트",
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
            employee_no="EMP-900100",
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
                base_salary=3_500_000,
                pay_type_code="regular",
                payment_day_type="fixed_day",
                payment_day_value=25,
                holiday_adjustment="previous_business_day",
                effective_from=date(2026, 3, 1),
                effective_to=None,
                is_active=True,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
        session.add(
            PayAllowanceDeduction(
                code="SCHOLARSHIP_GRANT",
                name="학자금지원",
                type="allowance",
                tax_type="taxable",
                calculation_type="fixed",
                is_active=True,
                sort_order=100,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
        session.add(
            PayAllowanceDeduction(
                code="LOAN_REPAY",
                name="사내대출상환",
                type="deduction",
                tax_type="tax",
                calculation_type="fixed",
                is_active=True,
                sort_order=200,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
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
        for rate_type, employee_rate in (
            ("국민연금", 4.5),
            ("건강보험", 3.545),
            ("장기요양", 0.4591),
            ("고용보험", 0.9),
            ("소득세", 1.0),
        ):
            session.add(
                PayTaxRate(
                    year=2026,
                    rate_type=rate_type,
                    employee_rate=employee_rate,
                    employer_rate=employee_rate,
                    min_limit=None,
                    max_limit=None,
                    created_at=_utc_now(),
                    updated_at=_utc_now(),
                )
            )
        session.commit()

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
