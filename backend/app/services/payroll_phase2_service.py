from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import delete, or_
from sqlmodel import Session, select

from app.models import (
    AuthUser,
    HrEmployee,
    HrEmployeeBasicProfile,
    PayAllowanceDeduction,
    PayEmployeeProfile,
    PayItemGroup,
    PayPayrollCode,
    PayPayrollRun,
    PayPayrollRunEmployee,
    PayPayrollRunEvent,
    PayPayrollRunItem,
    PayTaxRate,
    PayVariableInput,
    WelBenefitRequest,
    WelBenefitType,
)
from app.schemas.payroll_phase2 import (
    PayEmployeeProfileBatchRequest,
    PayEmployeeProfileBatchResponse,
    PayEmployeeProfileItem,
    PayPayrollRunActionResponse,
    PayPayrollRunCreateRequest,
    PayPayrollRunEmployeeDetailItem,
    PayPayrollRunEmployeeDetailResponse,
    PayPayrollRunEmployeeItem,
    PayPayrollRunEmployeeListResponse,
    PayPayrollRunItemSchema,
    PayPayrollRunListResponse,
    PayVariableInputBatchRequest,
    PayVariableInputBatchResponse,
    PayVariableInputItem,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_year_month(value: str) -> tuple[date, date]:
    try:
        yy, mm = value.split("-", 1)
        year = int(yy)
        month = int(mm)
        start = date(year, month, 1)
        end = date(year, month, monthrange(year, month)[1])
        return start, end
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="year_month must be YYYY-MM format.") from exc


def _build_employee_maps(session: Session, employee_ids: list[int]) -> tuple[dict[int, HrEmployee], dict[int, str]]:
    if not employee_ids:
        return {}, {}

    employees = session.exec(select(HrEmployee).where(HrEmployee.id.in_(employee_ids))).all()
    users = session.exec(select(AuthUser).where(AuthUser.id.in_([e.user_id for e in employees]))).all()
    user_name_map = {u.id: u.display_name for u in users}

    emp_map = {e.id: e for e in employees}
    emp_name_map = {e.id: user_name_map.get(e.user_id, "") for e in employees}
    return emp_map, emp_name_map


def _build_profile_item(
    profile: PayEmployeeProfile,
    employee_map: dict[int, HrEmployee],
    employee_name_map: dict[int, str],
    payroll_code_name_map: dict[int, str],
    item_group_name_map: dict[int, str],
) -> PayEmployeeProfileItem:
    employee = employee_map.get(profile.employee_id)
    return PayEmployeeProfileItem(
        id=profile.id,
        employee_id=profile.employee_id,
        employee_no=employee.employee_no if employee else None,
        employee_name=employee_name_map.get(profile.employee_id),
        payroll_code_id=profile.payroll_code_id,
        payroll_code_name=payroll_code_name_map.get(profile.payroll_code_id),
        item_group_id=profile.item_group_id,
        item_group_name=item_group_name_map.get(profile.item_group_id) if profile.item_group_id else None,
        base_salary=profile.base_salary,
        pay_type_code=profile.pay_type_code,
        payment_day_type=profile.payment_day_type,
        payment_day_value=profile.payment_day_value,
        holiday_adjustment=profile.holiday_adjustment,
        effective_from=profile.effective_from,
        effective_to=profile.effective_to,
        is_active=profile.is_active,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


def list_employee_profiles(session: Session) -> list[PayEmployeeProfileItem]:
    rows = session.exec(select(PayEmployeeProfile).order_by(PayEmployeeProfile.employee_id, PayEmployeeProfile.effective_from.desc())).all()
    employee_ids = [r.employee_id for r in rows]

    employee_map, employee_name_map = _build_employee_maps(session, employee_ids)
    payroll_codes = session.exec(select(PayPayrollCode.id, PayPayrollCode.name)).all()
    item_groups = session.exec(select(PayItemGroup.id, PayItemGroup.name)).all()

    payroll_code_name_map = {code_id: name for code_id, name in payroll_codes}
    item_group_name_map = {group_id: name for group_id, name in item_groups}

    return [
        _build_profile_item(row, employee_map, employee_name_map, payroll_code_name_map, item_group_name_map)
        for row in rows
    ]


def batch_save_employee_profiles(
    session: Session,
    payload: PayEmployeeProfileBatchRequest,
) -> PayEmployeeProfileBatchResponse:
    inserted = 0
    updated = 0
    deleted = 0

    for del_id in payload.delete_ids:
        row = session.get(PayEmployeeProfile, del_id)
        if row:
            session.delete(row)
            deleted += 1

    for item in payload.items:
        payroll_code = session.get(PayPayrollCode, item.payroll_code_id)
        if payroll_code is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid payroll_code_id: {item.payroll_code_id}")

        if item.item_group_id is not None and session.get(PayItemGroup, item.item_group_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid item_group_id: {item.item_group_id}")

        if item.id and item.id > 0:
            row = session.get(PayEmployeeProfile, item.id)
            if row:
                row.employee_id = item.employee_id
                row.payroll_code_id = item.payroll_code_id
                row.item_group_id = item.item_group_id
                row.base_salary = item.base_salary
                row.pay_type_code = item.pay_type_code
                row.payment_day_type = item.payment_day_type
                row.payment_day_value = item.payment_day_value
                row.holiday_adjustment = item.holiday_adjustment
                row.effective_from = item.effective_from
                row.effective_to = item.effective_to
                row.is_active = item.is_active
                row.updated_at = _utc_now()
                session.add(row)
                updated += 1
                continue

        dup = session.exec(
            select(PayEmployeeProfile).where(
                PayEmployeeProfile.employee_id == item.employee_id,
                PayEmployeeProfile.effective_from == item.effective_from,
            )
        ).first()
        if dup is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"employee_id '{item.employee_id}' already has profile for effective_from '{item.effective_from}'.",
            )

        session.add(
            PayEmployeeProfile(
                employee_id=item.employee_id,
                payroll_code_id=item.payroll_code_id,
                item_group_id=item.item_group_id,
                base_salary=item.base_salary,
                pay_type_code=item.pay_type_code,
                payment_day_type=item.payment_day_type,
                payment_day_value=item.payment_day_value,
                holiday_adjustment=item.holiday_adjustment,
                effective_from=item.effective_from,
                effective_to=item.effective_to,
                is_active=item.is_active,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
        inserted += 1

    session.commit()

    items = list_employee_profiles(session)
    return PayEmployeeProfileBatchResponse(
        items=items,
        total_count=len(items),
        inserted_count=inserted,
        updated_count=updated,
        deleted_count=deleted,
    )


def _build_variable_item(
    row: PayVariableInput,
    employee_map: dict[int, HrEmployee],
    employee_name_map: dict[int, str],
    item_name_map: dict[str, str],
) -> PayVariableInputItem:
    employee = employee_map.get(row.employee_id)
    return PayVariableInputItem(
        id=row.id,
        year_month=row.year_month,
        employee_id=row.employee_id,
        employee_no=employee.employee_no if employee else None,
        employee_name=employee_name_map.get(row.employee_id),
        item_code=row.item_code,
        item_name=item_name_map.get(row.item_code),
        direction=row.direction,
        amount=row.amount,
        memo=row.memo,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def list_variable_inputs(session: Session, year_month: str | None = None) -> list[PayVariableInputItem]:
    statement = select(PayVariableInput).order_by(PayVariableInput.year_month.desc(), PayVariableInput.employee_id)
    if year_month:
        statement = statement.where(PayVariableInput.year_month == year_month)

    rows = session.exec(statement).all()
    employee_ids = [r.employee_id for r in rows]
    employee_map, employee_name_map = _build_employee_maps(session, employee_ids)
    allowance_items = session.exec(select(PayAllowanceDeduction.code, PayAllowanceDeduction.name)).all()
    item_name_map = {code: name for code, name in allowance_items}

    return [_build_variable_item(row, employee_map, employee_name_map, item_name_map) for row in rows]


def batch_save_variable_inputs(
    session: Session,
    payload: PayVariableInputBatchRequest,
) -> PayVariableInputBatchResponse:
    inserted = 0
    updated = 0
    deleted = 0

    for del_id in payload.delete_ids:
        row = session.get(PayVariableInput, del_id)
        if row:
            session.delete(row)
            deleted += 1

    for item in payload.items:
        _parse_year_month(item.year_month)

        if session.get(HrEmployee, item.employee_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid employee_id: {item.employee_id}")

        if session.exec(select(PayAllowanceDeduction.id).where(PayAllowanceDeduction.code == item.item_code)).first() is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid item_code: {item.item_code}")

        if item.id and item.id > 0:
            row = session.get(PayVariableInput, item.id)
            if row:
                row.year_month = item.year_month
                row.employee_id = item.employee_id
                row.item_code = item.item_code.strip()
                row.direction = item.direction
                row.amount = item.amount
                row.memo = item.memo
                row.updated_at = _utc_now()
                session.add(row)
                updated += 1
                continue

        dup = session.exec(
            select(PayVariableInput).where(
                PayVariableInput.year_month == item.year_month,
                PayVariableInput.employee_id == item.employee_id,
                PayVariableInput.item_code == item.item_code.strip(),
            )
        ).first()
        if dup is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"year_month '{item.year_month}', employee_id '{item.employee_id}', "
                    f"item_code '{item.item_code}' already exists."
                ),
            )

        session.add(
            PayVariableInput(
                year_month=item.year_month,
                employee_id=item.employee_id,
                item_code=item.item_code.strip(),
                direction=item.direction,
                amount=item.amount,
                memo=item.memo,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
        inserted += 1

    session.commit()

    year_months = [item.year_month for item in payload.items]
    list_month = year_months[0] if len(set(year_months)) == 1 and year_months else None
    items = list_variable_inputs(session, year_month=list_month)
    return PayVariableInputBatchResponse(
        items=items,
        total_count=len(items),
        inserted_count=inserted,
        updated_count=updated,
        deleted_count=deleted,
    )


def _build_run_item(run: PayPayrollRun, code_name_map: dict[int, str]) -> PayPayrollRunItemSchema:
    return PayPayrollRunItemSchema(
        id=run.id,
        year_month=run.year_month,
        payroll_code_id=run.payroll_code_id,
        payroll_code_name=code_name_map.get(run.payroll_code_id),
        run_name=run.run_name,
        status=run.status,
        total_employees=run.total_employees,
        total_gross=run.total_gross,
        total_deductions=run.total_deductions,
        total_net=run.total_net,
        calculated_at=run.calculated_at,
        closed_at=run.closed_at,
        paid_at=run.paid_at,
        created_at=run.created_at,
        updated_at=run.updated_at,
    )


def list_payroll_runs(session: Session, year_month: str | None = None, status_value: str | None = None) -> PayPayrollRunListResponse:
    statement = select(PayPayrollRun).order_by(PayPayrollRun.year_month.desc(), PayPayrollRun.id.desc())
    if year_month:
        statement = statement.where(PayPayrollRun.year_month == year_month)
    if status_value:
        statement = statement.where(PayPayrollRun.status == status_value)

    rows = session.exec(statement).all()
    code_rows = session.exec(select(PayPayrollCode.id, PayPayrollCode.name)).all()
    code_name_map = {code_id: name for code_id, name in code_rows}

    items = [_build_run_item(row, code_name_map) for row in rows]
    return PayPayrollRunListResponse(items=items, total_count=len(items))


def create_payroll_run(session: Session, payload: PayPayrollRunCreateRequest) -> PayPayrollRunActionResponse:
    _parse_year_month(payload.year_month)

    payroll_code = session.get(PayPayrollCode, payload.payroll_code_id)
    if payroll_code is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid payroll_code_id: {payload.payroll_code_id}")

    duplicate = session.exec(
        select(PayPayrollRun.id).where(
            PayPayrollRun.year_month == payload.year_month,
            PayPayrollRun.payroll_code_id == payload.payroll_code_id,
        )
    ).first()
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payroll run already exists for year_month + payroll_code.")

    run = PayPayrollRun(
        year_month=payload.year_month,
        payroll_code_id=payload.payroll_code_id,
        run_name=payload.run_name,
        status="draft",
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(run)
    session.commit()
    session.refresh(run)

    session.add(
        PayPayrollRunEvent(
            run_id=run.id,
            event_type="created",
            message="Payroll run created.",
            created_at=_utc_now(),
        )
    )
    session.commit()

    return PayPayrollRunActionResponse(
        run=_build_run_item(run, {payload.payroll_code_id: payroll_code.name}),
    )


def _find_rate(rate_rows: list[PayTaxRate], *keywords: str) -> float:
    row = _find_rate_row(rate_rows, *keywords)
    return float(row.employee_rate or 0) if row is not None else 0.0


def _find_rate_row(rate_rows: list[PayTaxRate], *keywords: str) -> PayTaxRate | None:
    lowered_keywords = [k.replace(" ", "").lower() for k in keywords]

    for row in rate_rows:
        text = (row.rate_type or "").replace(" ", "").lower()
        if any(keyword in text for keyword in lowered_keywords):
            return row
    return None


def _apply_rate_limits(base_amount: float, rate_row: PayTaxRate | None) -> float:
    if base_amount <= 0:
        return 0.0

    if rate_row is None:
        return round(base_amount, 2)

    adjusted = float(base_amount)
    if rate_row.min_limit is not None:
        adjusted = max(adjusted, float(rate_row.min_limit))
    if rate_row.max_limit is not None:
        adjusted = min(adjusted, float(rate_row.max_limit))
    return round(adjusted, 2)


def _apply_item_amount(
    *,
    amount: float,
    direction: str,
    tax_type: str,
    gross_pay: float,
    taxable_income: float,
    non_taxable_income: float,
    deduction_amount: float,
) -> tuple[float, float, float, float]:
    if amount <= 0:
        return gross_pay, taxable_income, non_taxable_income, deduction_amount

    if direction == "earning":
        gross_pay += amount
        if tax_type == "non-taxable":
            non_taxable_income += amount
        else:
            taxable_income += amount
        return gross_pay, taxable_income, non_taxable_income, deduction_amount

    deduction_amount += amount
    return gross_pay, taxable_income, non_taxable_income, deduction_amount


def _welfare_request_matches_run_month(benefit_row: WelBenefitRequest, run: PayPayrollRun) -> bool:
    if benefit_row.payroll_run_label and run.year_month in benefit_row.payroll_run_label:
        return True

    if benefit_row.status_code == "payroll_reflected":
        return False

    basis_at = benefit_row.approved_at or benefit_row.requested_at or benefit_row.updated_at or benefit_row.created_at
    return basis_at.strftime("%Y-%m") == run.year_month


def _build_statutory_deductions(
    *,
    taxable_income: float,
    allowance_map: dict[str, PayAllowanceDeduction],
    tax_rows: list[PayTaxRate],
) -> tuple[list[tuple[str, str, float, str, str]], list[str]]:
    warnings: list[str] = []

    pension_row = _find_rate_row(tax_rows, "국민연금", "pension")
    health_row = _find_rate_row(tax_rows, "건강보험", "health")
    long_term_care_row = _find_rate_row(tax_rows, "장기요양", "long_term_care")
    employment_row = _find_rate_row(tax_rows, "고용보험", "employment")
    income_tax_row = _find_rate_row(tax_rows, "소득세", "income_tax")

    missing_rates = [
        label
        for label, row in (
            ("국민연금", pension_row),
            ("건강보험", health_row),
            ("장기요양", long_term_care_row),
            ("고용보험", employment_row),
            ("소득세", income_tax_row),
        )
        if row is None
    ]
    if missing_rates:
        warnings.append(f"missing tax rate master: {', '.join(missing_rates)}")

    pension_base = _apply_rate_limits(taxable_income, pension_row)
    health_base = _apply_rate_limits(taxable_income, health_row)
    employment_base = _apply_rate_limits(taxable_income, employment_row)
    income_tax_base = _apply_rate_limits(taxable_income, income_tax_row)

    pension_rate = float(pension_row.employee_rate or 0) if pension_row is not None else 0.0
    health_rate = float(health_row.employee_rate or 0) if health_row is not None else 0.0
    long_term_care_rate = float(long_term_care_row.employee_rate or 0) if long_term_care_row is not None else 0.0
    employment_rate = float(employment_row.employee_rate or 0) if employment_row is not None else 0.0
    income_tax_rate = float(income_tax_row.employee_rate or 0) if income_tax_row is not None else 0.0

    pension = round(pension_base * pension_rate / 100, 2)
    health = round(health_base * health_rate / 100, 2)
    if health > 0 and health_rate > 0 and long_term_care_rate > 0:
        long_term_care = round(health * (long_term_care_rate / health_rate), 2)
    else:
        long_term_care_base = _apply_rate_limits(taxable_income, long_term_care_row)
        long_term_care = round(long_term_care_base * long_term_care_rate / 100, 2)
    employment = round(employment_base * employment_rate / 100, 2)
    income_tax = round(income_tax_base * income_tax_rate / 100, 2)
    local_income_tax = round(income_tax * 0.1, 2)

    deductions: list[tuple[str, str, float, str, str]] = []
    for code, fallback_name, amount in (
        ("PEN", "국민연금", pension),
        ("HIN", "건강보험", health),
        ("LTC", "장기요양", long_term_care),
        ("EMP", "고용보험", employment),
        ("ITX", "소득세", income_tax),
        ("LTX", "지방소득세", local_income_tax),
    ):
        if amount <= 0:
            continue

        definition = allowance_map.get(code)
        deductions.append(
            (
                code,
                definition.name if definition else fallback_name,
                amount,
                definition.tax_type if definition else ("insurance" if code in {"PEN", "HIN", "LTC", "EMP"} else "tax"),
                definition.calculation_type if definition else "formula",
            )
        )

    return deductions, warnings


def _run_label(year_month: str) -> str:
    return f"{year_month} 정기급여"


def _build_welfare_request_map(
    session: Session,
    *,
    run: PayPayrollRun,
    employee_map: dict[int, HrEmployee],
) -> dict[int, list[tuple[WelBenefitRequest, WelBenefitType]]]:
    if not employee_map:
        return {}

    run_label = _run_label(run.year_month)
    employee_no_to_id = {
        employee.employee_no: employee.id
        for employee in employee_map.values()
        if employee.id is not None
    }
    if not employee_no_to_id:
        return {}

    benefit_types = {
        row.code: row
        for row in session.exec(select(WelBenefitType).where(WelBenefitType.is_active == True)).all()  # noqa: E712
    }
    benefit_rows = session.exec(
        select(WelBenefitRequest).where(
            WelBenefitRequest.employee_no.in_(list(employee_no_to_id.keys())),
            WelBenefitRequest.status_code.in_(["approved", "payroll_reflected"]),
            or_(
                WelBenefitRequest.payroll_run_label == None,  # noqa: E711
                WelBenefitRequest.payroll_run_label.ilike(f"%{run.year_month}%"),
            ),
        )
    ).all()

    welfare_map: dict[int, list[tuple[WelBenefitRequest, WelBenefitType]]] = {}
    for benefit_row in benefit_rows:
        if not _welfare_request_matches_run_month(benefit_row, run):
            continue

        employee_id = employee_no_to_id.get(benefit_row.employee_no)
        benefit_type = benefit_types.get(benefit_row.benefit_type_code)
        if employee_id is None or benefit_type is None:
            continue

        benefit_row.payroll_run_label = run_label
        benefit_row.status_code = "payroll_reflected"
        benefit_row.updated_at = _utc_now()
        session.add(benefit_row)
        welfare_map.setdefault(employee_id, []).append((benefit_row, benefit_type))

    return welfare_map


def _to_run_employee_item(
    row: PayPayrollRunEmployee,
    employee_map: dict[int, HrEmployee],
    employee_name_map: dict[int, str],
) -> PayPayrollRunEmployeeItem:
    employee = employee_map.get(row.employee_id)
    return PayPayrollRunEmployeeItem(
        id=row.id,
        run_id=row.run_id,
        employee_id=row.employee_id,
        employee_no=employee.employee_no if employee else None,
        employee_name=employee_name_map.get(row.employee_id),
        profile_id=row.profile_id,
        gross_pay=row.gross_pay,
        taxable_income=row.taxable_income,
        non_taxable_income=row.non_taxable_income,
        total_deductions=row.total_deductions,
        net_pay=row.net_pay,
        status=row.status,
        warning_message=row.warning_message,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def calculate_payroll_run(session: Session, run_id: int) -> PayPayrollRunActionResponse:
    run = session.get(PayPayrollRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll run not found.")

    if run.status in {"closed", "paid"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Closed/paid run cannot be recalculated.")

    period_start, period_end = _parse_year_month(run.year_month)

    profiles = session.exec(
        select(PayEmployeeProfile).where(
            PayEmployeeProfile.payroll_code_id == run.payroll_code_id,
            PayEmployeeProfile.is_active == True,  # noqa: E712
            PayEmployeeProfile.effective_from <= period_end,
            or_(PayEmployeeProfile.effective_to == None, PayEmployeeProfile.effective_to >= period_start),  # noqa: E711
        )
    ).all()

    profile_by_employee = {profile.employee_id: profile for profile in profiles}
    employee_ids = list(profile_by_employee.keys())

    employee_rows = session.exec(
        select(HrEmployee).where(
            HrEmployee.id.in_(employee_ids),
            HrEmployee.hire_date <= period_end,
        )
    ).all() if employee_ids else []
    employee_map = {employee.id: employee for employee in employee_rows}

    basic_profiles = session.exec(
        select(HrEmployeeBasicProfile).where(HrEmployeeBasicProfile.employee_id.in_(employee_ids))
    ).all() if employee_ids else []
    retire_date_map = {bp.employee_id: bp.retire_date for bp in basic_profiles}

    eligible_employee_ids = []
    for employee_id in employee_ids:
        employee = employee_map.get(employee_id)
        if employee is None:
            continue

        retire_date = retire_date_map.get(employee_id)
        if retire_date is not None and retire_date < period_start:
            continue

        eligible_employee_ids.append(employee_id)

    variable_rows = session.exec(
        select(PayVariableInput).where(
            PayVariableInput.year_month == run.year_month,
            PayVariableInput.employee_id.in_(eligible_employee_ids),
        )
    ).all() if eligible_employee_ids else []
    variable_map: dict[int, list[PayVariableInput]] = {}
    for row in variable_rows:
        variable_map.setdefault(row.employee_id, []).append(row)

    allowance_rows = session.exec(select(PayAllowanceDeduction)).all()
    allowance_map = {row.code: row for row in allowance_rows}
    welfare_map = _build_welfare_request_map(session, run=run, employee_map=employee_map)

    tax_rows = session.exec(select(PayTaxRate).where(PayTaxRate.year == period_start.year)).all()
    existing_run_employee_ids = session.exec(
        select(PayPayrollRunEmployee.id).where(PayPayrollRunEmployee.run_id == run_id)
    ).all()
    if existing_run_employee_ids:
        session.exec(
            delete(PayPayrollRunItem).where(PayPayrollRunItem.run_employee_id.in_(existing_run_employee_ids))
        )
        session.exec(
            delete(PayPayrollRunEmployee).where(PayPayrollRunEmployee.id.in_(existing_run_employee_ids))
        )
        session.flush()

    total_gross = 0.0
    total_deductions = 0.0
    total_net = 0.0
    total_employees = 0

    for employee_id in eligible_employee_ids:
        profile = profile_by_employee[employee_id]
        gross_pay = float(profile.base_salary)
        taxable_income = float(profile.base_salary)
        non_taxable_income = 0.0
        deduction_amount = 0.0
        warning_messages: list[str] = []

        run_employee = PayPayrollRunEmployee(
            run_id=run_id,
            employee_id=employee_id,
            profile_id=profile.id,
            gross_pay=0,
            taxable_income=0,
            non_taxable_income=0,
            total_deductions=0,
            net_pay=0,
            status="ok",
            warning_message=None,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(run_employee)
        session.flush()

        session.add(
            PayPayrollRunItem(
                run_employee_id=run_employee.id,
                item_code="BSC",
                item_name="기본급",
                direction="earning",
                amount=round(float(profile.base_salary), 2),
                tax_type="taxable",
                calculation_type="fixed",
                source_type="profile",
                created_at=_utc_now(),
            )
        )

        for variable in variable_map.get(employee_id, []):
            definition = allowance_map.get(variable.item_code)
            item_name = definition.name if definition else variable.item_code
            tax_type = definition.tax_type if definition else "taxable"
            calc_type = definition.calculation_type if definition else "manual"
            gross_pay, taxable_income, non_taxable_income, deduction_amount = _apply_item_amount(
                amount=float(variable.amount),
                direction=variable.direction,
                tax_type=tax_type,
                gross_pay=gross_pay,
                taxable_income=taxable_income,
                non_taxable_income=non_taxable_income,
                deduction_amount=deduction_amount,
            )

            session.add(
                PayPayrollRunItem(
                    run_employee_id=run_employee.id,
                    item_code=variable.item_code,
                    item_name=item_name,
                    direction=variable.direction,
                    amount=round(float(variable.amount), 2),
                    tax_type=tax_type,
                    calculation_type=calc_type,
                    source_type="variable",
                    created_at=_utc_now(),
                )
            )

        for welfare_request, benefit_type in welfare_map.get(employee_id, []):
            amount = float(welfare_request.approved_amount or welfare_request.requested_amount or 0)
            if amount <= 0:
                continue

            item_code = benefit_type.pay_item_code or welfare_request.benefit_type_code
            definition = allowance_map.get(item_code)
            direction = "deduction" if benefit_type.is_deduction else "earning"
            item_name = definition.name if definition else (welfare_request.benefit_type_name or benefit_type.name)
            tax_type = definition.tax_type if definition else ("tax" if direction == "deduction" else "taxable")
            calculation_type = definition.calculation_type if definition else "fixed"
            gross_pay, taxable_income, non_taxable_income, deduction_amount = _apply_item_amount(
                amount=amount,
                direction=direction,
                tax_type=tax_type,
                gross_pay=gross_pay,
                taxable_income=taxable_income,
                non_taxable_income=non_taxable_income,
                deduction_amount=deduction_amount,
            )

            session.add(
                PayPayrollRunItem(
                    run_employee_id=run_employee.id,
                    item_code=item_code,
                    item_name=item_name,
                    direction=direction,
                    amount=round(amount, 2),
                    tax_type=tax_type,
                    calculation_type=calculation_type,
                    source_type="welfare",
                    created_at=_utc_now(),
                )
            )

        statutory_deductions, system_warnings = _build_statutory_deductions(
            taxable_income=taxable_income,
            allowance_map=allowance_map,
            tax_rows=tax_rows,
        )
        for warning in system_warnings:
            if warning not in warning_messages:
                warning_messages.append(warning)

        for code, name, amount, tax_type, calculation_type in statutory_deductions:
            gross_pay, taxable_income, non_taxable_income, deduction_amount = _apply_item_amount(
                amount=amount,
                direction="deduction",
                tax_type=tax_type,
                gross_pay=gross_pay,
                taxable_income=taxable_income,
                non_taxable_income=non_taxable_income,
                deduction_amount=deduction_amount,
            )
            session.add(
                PayPayrollRunItem(
                    run_employee_id=run_employee.id,
                    item_code=code,
                    item_name=name,
                    direction="deduction",
                    amount=amount,
                    tax_type=tax_type,
                    calculation_type=calculation_type,
                    source_type="system",
                    created_at=_utc_now(),
                )
            )

        net_pay = round(gross_pay - deduction_amount, 2)
        if net_pay < 0:
            warning_messages.append("net_pay is negative")

        run_employee.gross_pay = round(gross_pay, 2)
        run_employee.taxable_income = round(taxable_income, 2)
        run_employee.non_taxable_income = round(non_taxable_income, 2)
        run_employee.total_deductions = round(deduction_amount, 2)
        run_employee.net_pay = net_pay
        run_employee.status = "warning" if warning_messages else "ok"
        run_employee.warning_message = "; ".join(warning_messages) if warning_messages else None
        run_employee.updated_at = _utc_now()
        session.add(run_employee)

        total_employees += 1
        total_gross += run_employee.gross_pay
        total_deductions += run_employee.total_deductions
        total_net += run_employee.net_pay

    run.total_employees = total_employees
    run.total_gross = round(total_gross, 2)
    run.total_deductions = round(total_deductions, 2)
    run.total_net = round(total_net, 2)
    run.status = "calculated"
    run.calculated_at = _utc_now()
    run.updated_at = _utc_now()
    session.add(run)

    session.add(
        PayPayrollRunEvent(
            run_id=run.id,
            event_type="calculated",
            message=f"Payroll calculated for {total_employees} employees.",
            created_at=_utc_now(),
        )
    )

    session.commit()
    session.refresh(run)

    code_name = session.exec(select(PayPayrollCode.name).where(PayPayrollCode.id == run.payroll_code_id)).first()
    return PayPayrollRunActionResponse(run=_build_run_item(run, {run.payroll_code_id: code_name or ""}))


def close_payroll_run(session: Session, run_id: int) -> PayPayrollRunActionResponse:
    run = session.get(PayPayrollRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll run not found.")

    if run.status != "calculated":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only calculated run can be closed.")

    run.status = "closed"
    run.closed_at = _utc_now()
    run.updated_at = _utc_now()
    session.add(run)

    session.add(
        PayPayrollRunEvent(
            run_id=run.id,
            event_type="closed",
            message="Payroll run closed.",
            created_at=_utc_now(),
        )
    )
    session.commit()
    session.refresh(run)

    code_name = session.exec(select(PayPayrollCode.name).where(PayPayrollCode.id == run.payroll_code_id)).first()
    return PayPayrollRunActionResponse(run=_build_run_item(run, {run.payroll_code_id: code_name or ""}))


def mark_payroll_run_paid(session: Session, run_id: int) -> PayPayrollRunActionResponse:
    run = session.get(PayPayrollRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll run not found.")

    if run.status != "closed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only closed run can be marked paid.")

    run.status = "paid"
    run.paid_at = _utc_now()
    run.updated_at = _utc_now()
    session.add(run)

    session.add(
        PayPayrollRunEvent(
            run_id=run.id,
            event_type="paid",
            message="Payroll run marked as paid.",
            created_at=_utc_now(),
        )
    )

    session.commit()
    session.refresh(run)

    code_name = session.exec(select(PayPayrollCode.name).where(PayPayrollCode.id == run.payroll_code_id)).first()
    return PayPayrollRunActionResponse(run=_build_run_item(run, {run.payroll_code_id: code_name or ""}))


def list_payroll_run_employees(session: Session, run_id: int) -> PayPayrollRunEmployeeListResponse:
    run = session.get(PayPayrollRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll run not found.")

    rows = session.exec(
        select(PayPayrollRunEmployee).where(PayPayrollRunEmployee.run_id == run_id).order_by(PayPayrollRunEmployee.employee_id)
    ).all()

    employee_ids = [row.employee_id for row in rows]
    employee_map, employee_name_map = _build_employee_maps(session, employee_ids)

    items = [_to_run_employee_item(row, employee_map, employee_name_map) for row in rows]
    return PayPayrollRunEmployeeListResponse(items=items, total_count=len(items))


def get_payroll_run_employee_detail(session: Session, run_id: int, run_employee_id: int) -> PayPayrollRunEmployeeDetailResponse:
    run = session.get(PayPayrollRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll run not found.")

    row = session.get(PayPayrollRunEmployee, run_employee_id)
    if row is None or row.run_id != run_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run employee not found.")

    employee_map, employee_name_map = _build_employee_maps(session, [row.employee_id])
    employee_item = _to_run_employee_item(row, employee_map, employee_name_map)

    run_items = session.exec(
        select(PayPayrollRunItem).where(PayPayrollRunItem.run_employee_id == run_employee_id).order_by(PayPayrollRunItem.id)
    ).all()

    detail_items = [
        PayPayrollRunEmployeeDetailItem(
            id=item.id,
            run_employee_id=item.run_employee_id,
            item_code=item.item_code,
            item_name=item.item_name,
            direction=item.direction,
            amount=item.amount,
            tax_type=item.tax_type,
            calculation_type=item.calculation_type,
            source_type=item.source_type,
            created_at=item.created_at,
        )
        for item in run_items
    ]

    return PayPayrollRunEmployeeDetailResponse(employee=employee_item, items=detail_items)


# ── 셀프서비스 급여 조회 ──────────────────────────────────────────────────────

def list_my_payslips(session: Session, employee_id: int) -> "PayMyPayslipListResponse":
    """본인 급여 이력 목록 (closed/paid Run만)"""
    from app.schemas.payroll_phase2 import PayMyPayslipListResponse, PayMyPayslipSummary

    rows = session.exec(
        select(PayPayrollRunEmployee, PayPayrollRun)
        .join(PayPayrollRun, PayPayrollRunEmployee.run_id == PayPayrollRun.id)
        .where(
            PayPayrollRunEmployee.employee_id == employee_id,
            PayPayrollRun.status.in_(["closed", "paid"]),
        )
        .order_by(PayPayrollRun.year_month.desc())
    ).all()

    items = [
        PayMyPayslipSummary(
            run_id=run.id,
            run_employee_id=re.id,
            year_month=run.year_month,
            run_name=run.run_name,
            run_status=run.status,
            gross_pay=re.gross_pay,
            taxable_income=re.taxable_income,
            non_taxable_income=re.non_taxable_income,
            total_deductions=re.total_deductions,
            net_pay=re.net_pay,
            paid_at=run.paid_at,
        )
        for re, run in rows
    ]
    return PayMyPayslipListResponse(items=items, total_count=len(items))


def get_my_payslip_detail(session: Session, employee_id: int, run_id: int) -> "PayMyPayslipDetailResponse":
    """본인 급여 상세 (항목별)"""
    from app.schemas.payroll_phase2 import PayMyPayslipDetailResponse, PayMyPayslipSummary, PayPayrollRunEmployeeDetailItem

    run = session.get(PayPayrollRun, run_id)
    if run is None or run.status not in ("closed", "paid"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="급여 정보를 찾을 수 없습니다.")

    re = session.exec(
        select(PayPayrollRunEmployee).where(
            PayPayrollRunEmployee.run_id == run_id,
            PayPayrollRunEmployee.employee_id == employee_id,
        )
    ).first()
    if re is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="급여 정보를 찾을 수 없습니다.")

    summary = PayMyPayslipSummary(
        run_id=run.id,
        run_employee_id=re.id,
        year_month=run.year_month,
        run_name=run.run_name,
        run_status=run.status,
        gross_pay=re.gross_pay,
        taxable_income=re.taxable_income,
        non_taxable_income=re.non_taxable_income,
        total_deductions=re.total_deductions,
        net_pay=re.net_pay,
        paid_at=run.paid_at,
    )

    run_items = session.exec(
        select(PayPayrollRunItem).where(PayPayrollRunItem.run_employee_id == re.id).order_by(PayPayrollRunItem.id)
    ).all()

    detail_items = [
        PayPayrollRunEmployeeDetailItem(
            id=item.id,
            run_employee_id=item.run_employee_id,
            item_code=item.item_code,
            item_name=item.item_name,
            direction=item.direction,
            amount=item.amount,
            tax_type=item.tax_type,
            calculation_type=item.calculation_type,
            source_type=item.source_type,
            created_at=item.created_at,
        )
        for item in run_items
    ]

    return PayMyPayslipDetailResponse(summary=summary, items=detail_items)
