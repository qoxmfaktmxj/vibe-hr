from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine, select

from app.models import (
    AuthUser,
    GlAccount,
    HrEmployee,
    OrgDepartment,
    PayAllowanceDeduction,
    PayGlMapping,
    PayPayrollCode,
    PayPayrollRun,
    PayPayrollRunEmployee,
    PayPayrollRunItem,
    PayVoucher,
    PayVoucherLine,
)
from app.services.pay_voucher_service import (
    build_voucher_export_csv,
    cancel_voucher,
    confirm_voucher,
    find_mapping_gaps,
    generate_disbursement_voucher,
    generate_voucher,
    get_voucher_detail,
)
from app.services.payroll_phase2_service import close_payroll_run

FIXED_NOW = datetime(2026, 7, 9, 9, 0, 0, tzinfo=timezone.utc)


def _utc_now() -> datetime:
    return FIXED_NOW


def _make_engine():
    return create_engine("sqlite://")


def _seed_department(session: Session, *, code: str, cost_center: str | None) -> OrgDepartment:
    department = OrgDepartment(
        code=code,
        name=f"{code} 부서",
        cost_center_code=cost_center,
        is_active=True,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(department)
    session.commit()
    session.refresh(department)
    return department


def _seed_employee(session: Session, *, employee_no: str, department_id: int) -> HrEmployee:
    user = AuthUser(
        login_id=f"user-{employee_no.lower()}",
        email=f"{employee_no.lower()}@vibe-hr.local",
        password_hash="hash",
        display_name=employee_no,
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
        hire_date=date(2026, 1, 1),
        employment_status="active",
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return employee


def _seed_payroll_run(session: Session, *, status: str = "closed") -> PayPayrollRun:
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
        year_month="2026-07",
        payroll_code_id=int(payroll_code.id),
        run_name="테스트 급여",
        status=status,
        total_employees=0,
        total_gross=0,
        total_deductions=0,
        total_net=0,
        closed_at=_utc_now() if status in ("closed", "paid") else None,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def _add_run_employee_with_items(
    session: Session,
    *,
    run_id: int,
    employee_id: int,
    items: list[tuple[str, str, float]],
) -> PayPayrollRunEmployee:
    """items: (item_code, direction, amount) 목록."""
    run_employee = PayPayrollRunEmployee(
        run_id=run_id,
        employee_id=employee_id,
        gross_pay=0,
        taxable_income=0,
        non_taxable_income=0,
        total_deductions=0,
        net_pay=0,
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
                tax_type="taxable",
                calculation_type="fixed",
                source_type="system",
                created_at=_utc_now(),
            )
        )
    session.commit()
    return run_employee


def _seed_gl_accounts(session: Session) -> None:
    session.add(GlAccount(code="5100", name="급여비용", account_type="expense", is_net_pay_account=False, is_cash_account=False, is_active=True, created_at=_utc_now(), updated_at=_utc_now()))
    session.add(GlAccount(code="2230", name="국민연금예수금", account_type="liability", is_net_pay_account=False, is_cash_account=False, is_active=True, created_at=_utc_now(), updated_at=_utc_now()))
    session.add(GlAccount(code="2100", name="미지급급여", account_type="liability", is_net_pay_account=True, is_cash_account=False, is_active=True, created_at=_utc_now(), updated_at=_utc_now()))
    session.add(GlAccount(code="1100", name="보통예금", account_type="asset", is_net_pay_account=False, is_cash_account=True, is_active=True, created_at=_utc_now(), updated_at=_utc_now()))
    session.commit()


def _seed_mapping(session: Session, *, pay_item_code: str, gl_account_code: str) -> None:
    session.add(
        PayGlMapping(
            pay_item_code=pay_item_code,
            gl_account_code=gl_account_code,
            effective_from=date(2020, 1, 1),
            is_active=True,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
    )
    session.commit()


def _seed_allowance(session: Session, *, code: str, name: str, item_type: str) -> None:
    session.add(
        PayAllowanceDeduction(
            code=code,
            name=name,
            type=item_type,
            tax_type="taxable" if item_type == "allowance" else "insurance",
            calculation_type="fixed",
            is_active=True,
            sort_order=0,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
    )
    session.commit()


def test_generate_voucher_aggregates_by_item_and_cost_center_and_balances() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_gl_accounts(session)
        _seed_allowance(session, code="BSC", name="기본급", item_type="allowance")
        _seed_allowance(session, code="PEN", name="국민연금", item_type="deduction")
        _seed_mapping(session, pay_item_code="BSC", gl_account_code="5100")
        _seed_mapping(session, pay_item_code="PEN", gl_account_code="2230")

        dept_a = _seed_department(session, code="DEPT-A", cost_center="CC-A")
        dept_b = _seed_department(session, code="DEPT-B", cost_center="CC-B")
        emp1 = _seed_employee(session, employee_no="E001", department_id=int(dept_a.id))
        emp2 = _seed_employee(session, employee_no="E002", department_id=int(dept_a.id))
        emp3 = _seed_employee(session, employee_no="E003", department_id=int(dept_b.id))

        run = _seed_payroll_run(session, status="closed")
        _add_run_employee_with_items(
            session, run_id=run.id, employee_id=emp1.id,
            items=[("BSC", "earning", 3_000_000), ("PEN", "deduction", 135_000)],
        )
        _add_run_employee_with_items(
            session, run_id=run.id, employee_id=emp2.id,
            items=[("BSC", "earning", 3_500_000), ("PEN", "deduction", 157_500)],
        )
        _add_run_employee_with_items(
            session, run_id=run.id, employee_id=emp3.id,
            items=[("BSC", "earning", 4_000_000), ("PEN", "deduction", 180_000)],
        )

        result = generate_voucher(session, run.id, created_by=None)
        voucher = result.voucher
        assert voucher.status == "draft"
        assert voucher.total_debit == voucher.total_credit

        detail = get_voucher_detail(session, voucher.id)
        # BSC should be aggregated per cost center: CC-A (3.0M+3.5M=6.5M), CC-B (4.0M)
        bsc_lines = {line.cost_center_code: line.debit_amount for line in detail.lines if line.source_item_code == "BSC"}
        assert bsc_lines == {"CC-A": 6_500_000.0, "CC-B": 4_000_000.0}

        pen_lines = {line.cost_center_code: line.credit_amount for line in detail.lines if line.source_item_code == "PEN"}
        assert pen_lines == {"CC-A": 292_500.0, "CC-B": 180_000.0}

        # net pay (미지급급여) lines aggregated by cost center too
        net_pay_lines = {
            line.cost_center_code: line.credit_amount
            for line in detail.lines
            if line.gl_account_code == "2100" and line.source_item_code is None
        }
        assert net_pay_lines == {"CC-A": 6_500_000.0 - 292_500.0, "CC-B": 4_000_000.0 - 180_000.0}

        total_debit = sum(line.debit_amount for line in detail.lines)
        total_credit = sum(line.credit_amount for line in detail.lines)
        assert total_debit == total_credit == voucher.total_debit


def test_generate_voucher_blocks_on_missing_mapping() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_gl_accounts(session)
        _seed_allowance(session, code="BSC", name="기본급", item_type="allowance")
        _seed_allowance(session, code="UNMAPPED", name="미매핑항목", item_type="allowance")
        _seed_mapping(session, pay_item_code="BSC", gl_account_code="5100")
        # UNMAPPED intentionally has no mapping

        dept = _seed_department(session, code="DEPT-A", cost_center="CC-A")
        emp = _seed_employee(session, employee_no="E001", department_id=int(dept.id))
        run = _seed_payroll_run(session, status="closed")
        _add_run_employee_with_items(
            session, run_id=run.id, employee_id=emp.id,
            items=[("BSC", "earning", 1_000_000), ("UNMAPPED", "earning", 50_000)],
        )

        try:
            generate_voucher(session, run.id, created_by=None)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 422
            missing_codes = {item["item_code"] for item in exc.detail["missing_item_codes"]}
            assert missing_codes == {"UNMAPPED"}

        # No voucher should have been persisted
        assert session.exec(select(PayVoucher)).first() is None


def test_find_mapping_gaps_reports_missing_codes_without_generating() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_gl_accounts(session)
        _seed_allowance(session, code="BSC", name="기본급", item_type="allowance")
        _seed_allowance(session, code="UNMAPPED", name="미매핑항목", item_type="allowance")
        _seed_mapping(session, pay_item_code="BSC", gl_account_code="5100")

        dept = _seed_department(session, code="DEPT-A", cost_center="CC-A")
        emp = _seed_employee(session, employee_no="E001", department_id=int(dept.id))
        run = _seed_payroll_run(session, status="closed")
        _add_run_employee_with_items(
            session, run_id=run.id, employee_id=emp.id,
            items=[("BSC", "earning", 1_000_000), ("UNMAPPED", "earning", 50_000)],
        )

        gaps = find_mapping_gaps(session, run.id)
        assert [g.item_code for g in gaps.missing_item_codes] == ["UNMAPPED"]


def test_generate_voucher_rejects_run_not_closed_or_paid() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_gl_accounts(session)
        _seed_allowance(session, code="BSC", name="기본급", item_type="allowance")
        _seed_mapping(session, pay_item_code="BSC", gl_account_code="5100")

        dept = _seed_department(session, code="DEPT-A", cost_center="CC-A")
        emp = _seed_employee(session, employee_no="E001", department_id=int(dept.id))
        run = _seed_payroll_run(session, status="calculated")
        _add_run_employee_with_items(
            session, run_id=run.id, employee_id=emp.id,
            items=[("BSC", "earning", 1_000_000)],
        )

        try:
            generate_voucher(session, run.id, created_by=None)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 409


def test_confirm_and_cancel_voucher_status_transitions() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_gl_accounts(session)
        _seed_allowance(session, code="BSC", name="기본급", item_type="allowance")
        _seed_mapping(session, pay_item_code="BSC", gl_account_code="5100")

        dept = _seed_department(session, code="DEPT-A", cost_center="CC-A")
        emp = _seed_employee(session, employee_no="E001", department_id=int(dept.id))
        run = _seed_payroll_run(session, status="paid")
        _add_run_employee_with_items(
            session, run_id=run.id, employee_id=emp.id,
            items=[("BSC", "earning", 1_000_000)],
        )

        voucher = generate_voucher(session, run.id, created_by=1).voucher
        assert voucher.status == "draft"

        confirmed = confirm_voucher(session, voucher.id, confirmed_by=1).voucher
        assert confirmed.status == "confirmed"
        assert confirmed.confirmed_by == 1

        # Cannot confirm twice
        try:
            confirm_voucher(session, voucher.id, confirmed_by=1)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 409

        # Regeneration blocked once confirmed
        try:
            generate_voucher(session, run.id, created_by=1)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 409

        cancelled = cancel_voucher(session, voucher.id).voucher
        assert cancelled.status == "cancelled"

        # Cannot cancel again
        try:
            cancel_voucher(session, voucher.id)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 409


def test_generate_voucher_regenerates_draft_before_confirm() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_gl_accounts(session)
        _seed_allowance(session, code="BSC", name="기본급", item_type="allowance")
        _seed_mapping(session, pay_item_code="BSC", gl_account_code="5100")

        dept = _seed_department(session, code="DEPT-A", cost_center="CC-A")
        emp = _seed_employee(session, employee_no="E001", department_id=int(dept.id))
        run = _seed_payroll_run(session, status="closed")
        run_employee = _add_run_employee_with_items(
            session, run_id=run.id, employee_id=emp.id,
            items=[("BSC", "earning", 1_000_000)],
        )

        first = generate_voucher(session, run.id, created_by=None).voucher
        assert first.total_debit == 1_000_000.0

        # Add another item and regenerate before confirm -> old draft + lines replaced
        session.add(
            PayPayrollRunItem(
                run_employee_id=run_employee.id,
                item_code="BSC",
                item_name="BSC",
                direction="earning",
                amount=500_000,
                tax_type="taxable",
                calculation_type="fixed",
                source_type="system",
                created_at=_utc_now(),
            )
        )
        session.commit()

        second = generate_voucher(session, run.id, created_by=None).voucher
        assert second.id == first.id  # same voucher row reused? No - recreated, but same run uq
        assert second.total_debit == 1_500_000.0

        # Only one voucher should exist for the run
        vouchers = session.exec(select(PayVoucher).where(PayVoucher.run_id == run.id)).all()
        assert len(vouchers) == 1

        # Only the new lines should exist (old lines deleted)
        lines = session.exec(select(PayVoucherLine).where(PayVoucherLine.voucher_id == vouchers[0].id)).all()
        assert sum(line.debit_amount for line in lines) == 1_500_000.0


def test_generate_voucher_absorbs_one_won_rounding_diff() -> None:
    """부동소수 합산으로 발생하는 1원 이하의 차대 불일치는 조정 라인으로 흡수되어야 한다."""
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_gl_accounts(session)
        _seed_allowance(session, code="BSC", name="기본급", item_type="allowance")
        _seed_allowance(session, code="PEN", name="국민연금", item_type="deduction")
        _seed_mapping(session, pay_item_code="BSC", gl_account_code="5100")
        _seed_mapping(session, pay_item_code="PEN", gl_account_code="2230")

        dept = _seed_department(session, code="DEPT-A", cost_center="CC-A")
        run = _seed_payroll_run(session, status="closed")

        # Use a large number of employees with fractional amounts to force float drift.
        for i in range(50):
            emp = _seed_employee(session, employee_no=f"E{i:03d}", department_id=int(dept.id))
            _add_run_employee_with_items(
                session, run_id=run.id, employee_id=emp.id,
                items=[("BSC", "earning", 100_000.1), ("PEN", "deduction", 33_333.37)],
            )

        result = generate_voucher(session, run.id, created_by=None)
        voucher = result.voucher
        assert voucher.total_debit == voucher.total_credit

        detail = get_voucher_detail(session, voucher.id)
        total_debit = sum(line.debit_amount for line in detail.lines)
        total_credit = sum(line.credit_amount for line in detail.lines)
        assert total_debit == total_credit


# ── Phase 2 §11-1 disbursement voucher ──


def _setup_confirmed_accrual_for_disbursement(session: Session) -> tuple[PayPayrollRun, PayVoucher]:
    """paid run + confirmed accrual voucher (net pay 1,000,000 - 45,000 = 955,000)를 세팅한다."""
    _seed_gl_accounts(session)
    _seed_allowance(session, code="BSC", name="기본급", item_type="allowance")
    _seed_allowance(session, code="PEN", name="국민연금", item_type="deduction")
    _seed_mapping(session, pay_item_code="BSC", gl_account_code="5100")
    _seed_mapping(session, pay_item_code="PEN", gl_account_code="2230")

    dept = _seed_department(session, code="DEPT-A", cost_center="CC-A")
    emp = _seed_employee(session, employee_no="E001", department_id=int(dept.id))
    run = _seed_payroll_run(session, status="closed")
    _add_run_employee_with_items(
        session, run_id=run.id, employee_id=emp.id,
        items=[("BSC", "earning", 1_000_000), ("PEN", "deduction", 45_000)],
    )

    accrual = generate_voucher(session, run.id, created_by=1).voucher
    confirm_voucher(session, accrual.id, confirmed_by=1)

    run.status = "paid"
    session.add(run)
    session.commit()
    session.refresh(run)

    return run, accrual


def test_generate_disbursement_voucher_balances_and_matches_net_pay() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        run, _accrual = _setup_confirmed_accrual_for_disbursement(session)

        result = generate_disbursement_voucher(session, run.id, created_by=1)
        voucher = result.voucher
        assert voucher.voucher_type == "disbursement"
        assert voucher.status == "draft"
        assert voucher.total_debit == voucher.total_credit == 955_000.0

        detail = get_voucher_detail(session, voucher.id)
        assert len(detail.lines) == 2
        debit_line = next(line for line in detail.lines if line.debit_amount > 0)
        credit_line = next(line for line in detail.lines if line.credit_amount > 0)
        assert debit_line.gl_account_code == "2100"  # 미지급급여 (is_net_pay_account)
        assert debit_line.debit_amount == 955_000.0
        assert credit_line.gl_account_code == "1100"  # 보통예금 (is_cash_account)
        assert credit_line.credit_amount == 955_000.0


def test_pay_vouchers_unique_on_run_id_and_voucher_type() -> None:
    """동일 run에 accrual과 disbursement 전표가 공존할 수 있어야 한다 (run_id 단독 유니크였다면 실패)."""
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        run, accrual = _setup_confirmed_accrual_for_disbursement(session)

        disbursement = generate_disbursement_voucher(session, run.id, created_by=1).voucher

        vouchers = session.exec(select(PayVoucher).where(PayVoucher.run_id == run.id)).all()
        assert len(vouchers) == 2
        assert {v.voucher_type for v in vouchers} == {"accrual", "disbursement"}
        assert accrual.id != disbursement.id


def test_generate_disbursement_voucher_rejects_unconfirmed_accrual() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_gl_accounts(session)
        _seed_allowance(session, code="BSC", name="기본급", item_type="allowance")
        _seed_mapping(session, pay_item_code="BSC", gl_account_code="5100")

        dept = _seed_department(session, code="DEPT-A", cost_center="CC-A")
        emp = _seed_employee(session, employee_no="E001", department_id=int(dept.id))
        run = _seed_payroll_run(session, status="closed")
        _add_run_employee_with_items(
            session, run_id=run.id, employee_id=emp.id,
            items=[("BSC", "earning", 1_000_000)],
        )

        # accrual voucher generated but left in draft (not confirmed)
        generate_voucher(session, run.id, created_by=1)

        run.status = "paid"
        session.add(run)
        session.commit()

        try:
            generate_disbursement_voucher(session, run.id, created_by=1)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 409

        # No disbursement voucher should have been persisted
        assert session.exec(
            select(PayVoucher).where(PayVoucher.run_id == run.id, PayVoucher.voucher_type == "disbursement")
        ).first() is None


def test_generate_disbursement_voucher_rejects_run_not_paid() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        run, _accrual = _setup_confirmed_accrual_for_disbursement(session)
        run.status = "closed"  # revert to non-paid
        session.add(run)
        session.commit()

        try:
            generate_disbursement_voucher(session, run.id, created_by=1)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 409


# ── Phase 2 §11-2 close 자동훅 ──


def test_close_payroll_run_auto_creates_accrual_voucher_draft() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_gl_accounts(session)
        _seed_allowance(session, code="BSC", name="기본급", item_type="allowance")
        _seed_mapping(session, pay_item_code="BSC", gl_account_code="5100")

        dept = _seed_department(session, code="DEPT-A", cost_center="CC-A")
        emp = _seed_employee(session, employee_no="E001", department_id=int(dept.id))
        run = _seed_payroll_run(session, status="calculated")
        _add_run_employee_with_items(
            session, run_id=run.id, employee_id=emp.id,
            items=[("BSC", "earning", 1_000_000)],
        )

        close_payroll_run(session, run.id)

        voucher = session.exec(
            select(PayVoucher).where(PayVoucher.run_id == run.id, PayVoucher.voucher_type == "accrual")
        ).first()
        assert voucher is not None
        assert voucher.status == "draft"
        assert voucher.total_debit == voucher.total_credit == 1_000_000.0


def test_close_payroll_run_succeeds_even_when_mapping_missing() -> None:
    """매핑 누락으로 전표 자동 생성이 실패해도 close 자체는 성공해야 한다 (예외 격리)."""
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_gl_accounts(session)
        _seed_allowance(session, code="UNMAPPED", name="미매핑항목", item_type="allowance")
        # Intentionally no mapping for UNMAPPED

        dept = _seed_department(session, code="DEPT-A", cost_center="CC-A")
        emp = _seed_employee(session, employee_no="E001", department_id=int(dept.id))
        run = _seed_payroll_run(session, status="calculated")
        _add_run_employee_with_items(
            session, run_id=run.id, employee_id=emp.id,
            items=[("UNMAPPED", "earning", 500_000)],
        )

        response = close_payroll_run(session, run.id)
        assert response.run.status == "closed"

        # No voucher should have been created due to missing mapping, but close still succeeded
        voucher = session.exec(select(PayVoucher).where(PayVoucher.run_id == run.id)).first()
        assert voucher is None


# ── Phase 2 §11-3 CSV export ──


def test_export_voucher_csv_contains_expected_columns_and_rows() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_gl_accounts(session)
        _seed_allowance(session, code="BSC", name="기본급", item_type="allowance")
        _seed_mapping(session, pay_item_code="BSC", gl_account_code="5100")

        dept = _seed_department(session, code="DEPT-A", cost_center="CC-A")
        emp = _seed_employee(session, employee_no="E001", department_id=int(dept.id))
        run = _seed_payroll_run(session, status="closed")
        _add_run_employee_with_items(
            session, run_id=run.id, employee_id=emp.id,
            items=[("BSC", "earning", 1_000_000)],
        )

        voucher = generate_voucher(session, run.id, created_by=1).voucher
        confirm_voucher(session, voucher.id, confirmed_by=1)

        filename, csv_bytes = build_voucher_export_csv(session, voucher.id)
        assert filename == f"{voucher.voucher_no}.csv"
        assert csv_bytes.startswith("﻿".encode("utf-8"))  # UTF-8 BOM

        text = csv_bytes.decode("utf-8-sig")
        rows = [line for line in text.splitlines() if line]
        header = rows[0].split(",")
        assert header == [
            "voucher_no",
            "voucher_date",
            "line_no",
            "gl_account_code",
            "gl_account_name",
            "cost_center_code",
            "debit",
            "credit",
            "summary",
        ]
        # BSC earning line + net-pay line = 2 data rows
        assert len(rows) == 3
        assert voucher.voucher_no in rows[1]
        assert "5100" in rows[1]


def test_export_voucher_rejects_non_confirmed_voucher() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed_gl_accounts(session)
        _seed_allowance(session, code="BSC", name="기본급", item_type="allowance")
        _seed_mapping(session, pay_item_code="BSC", gl_account_code="5100")

        dept = _seed_department(session, code="DEPT-A", cost_center="CC-A")
        emp = _seed_employee(session, employee_no="E001", department_id=int(dept.id))
        run = _seed_payroll_run(session, status="closed")
        _add_run_employee_with_items(
            session, run_id=run.id, employee_id=emp.id,
            items=[("BSC", "earning", 1_000_000)],
        )

        voucher = generate_voucher(session, run.id, created_by=1).voucher  # left as draft

        try:
            build_voucher_export_csv(session, voucher.id)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 409
