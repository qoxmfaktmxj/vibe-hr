from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.core.pagination import paginate_items
from app.models import (
    AuthUser,
    HrEmployee,
    HrRetireCase,
    HrSeveranceCalc,
    OrgDepartment,
    PayAllowanceDeduction,
    PayPayrollRun,
    PayPayrollRunEmployee,
    PayPayrollRunItem,
    PaySeveranceItemRule,
)
from app.schemas.hr_severance import (
    HrSeveranceAdjustmentUpdateRequest,
    HrSeveranceCalcDetailResponse,
    HrSeveranceCalcItem,
    HrSeveranceCalcListResponse,
    HrSeveranceWageDetailItem,
    PaySeveranceItemRuleBatchRequest,
    PaySeveranceItemRuleBatchResponse,
    PaySeveranceItemRuleItem,
    PaySeveranceItemRuleListResponse,
)

SERVICE_DAYS_MIN_FOR_ELIGIBILITY = 365
NO_WAGE_HISTORY_WARNING = "직전 3개월 내 확정(paid) 급여 데이터가 없습니다."


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _subtract_months(base: date, months: int) -> date:
    """base 날짜에서 months개월 전의 날짜를 반환한다 (말일 보정 포함)."""
    year = base.year
    month = base.month - months
    while month <= 0:
        month += 12
        year -= 1
    # 말일 보정: 예) 5/31 - 1개월 -> 4/30 (4/31은 없음)
    last_day = calendar.monthrange(year, month)[1]
    day = min(base.day, last_day)
    return date(year, month, day)


def calc_service_days(hire_date: date, retire_date: date) -> int:
    """재직일수: (퇴직일 - 입사일).days + 1 (양끝 포함)."""
    return (retire_date - hire_date).days + 1


def calc_avg_wage_period(retire_date: date) -> tuple[date, date]:
    """평균임금 산정 기간: 퇴직일 전날부터 역산 3개월.

    avg_wage_base_to = retire_date - 1일
    avg_wage_base_from = avg_wage_base_to 기준 3개월 전 + 1일
    """
    base_to = retire_date - timedelta(days=1)
    three_months_before = _subtract_months(base_to, 3)
    base_from = three_months_before + timedelta(days=1)
    return base_from, base_to


def calc_base_days(base_from: date, base_to: date) -> int:
    return (base_to - base_from).days + 1


def _run_overlaps_period(year_month: str, base_from: date, base_to: date) -> bool:
    """run의 year_month(YYYY-MM)가 나타내는 달(1일~말일)이 [base_from, base_to]와 겹치는지."""
    year, month = int(year_month[:4]), int(year_month[5:7])
    last_day = calendar.monthrange(year, month)[1]
    month_start = date(year, month, 1)
    month_end = date(year, month, last_day)
    return month_start <= base_to and month_end >= base_from


def calc_severance_amount(avg_daily_wage: float, service_days: int) -> float:
    if service_days < SERVICE_DAYS_MIN_FOR_ELIGIBILITY:
        return 0.0
    return avg_daily_wage * 30 * (service_days / 365)


def _get_case_or_404(session: Session, case_id: int) -> HrRetireCase:
    case = session.get(HrRetireCase, case_id)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retire case not found.")
    return case


def _get_calc_or_404(session: Session, calc_id: int) -> HrSeveranceCalc:
    calc = session.get(HrSeveranceCalc, calc_id)
    if calc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Severance calc not found.")
    return calc


def _item_rule_map(session: Session) -> dict[str, str]:
    rows = session.exec(
        select(PaySeveranceItemRule).where(PaySeveranceItemRule.is_active == True)  # noqa: E712
    ).all()
    return {row.pay_item_code: row.include_type for row in rows}


def _collect_wage_details(
    session: Session,
    *,
    employee_id: int,
    base_from: date,
    base_to: date,
) -> tuple[float, list[HrSeveranceWageDetailItem]]:
    """직전 3개월 기간과 겹치는 paid run 들 중 해당 직원의 earning 항목을 집계한다."""
    paid_runs = session.exec(select(PayPayrollRun).where(PayPayrollRun.status == "paid")).all()
    relevant_run_ids = [
        run.id for run in paid_runs if _run_overlaps_period(run.year_month, base_from, base_to)
    ]
    if not relevant_run_ids:
        return 0.0, []

    run_employees = session.exec(
        select(PayPayrollRunEmployee).where(
            PayPayrollRunEmployee.run_id.in_(relevant_run_ids),
            PayPayrollRunEmployee.employee_id == employee_id,
        )
    ).all()
    run_employee_ids = [re.id for re in run_employees]
    if not run_employee_ids:
        return 0.0, []

    run_items = session.exec(
        select(PayPayrollRunItem).where(
            PayPayrollRunItem.run_employee_id.in_(run_employee_ids),
            PayPayrollRunItem.direction == "earning",
        )
    ).all()
    if not run_items:
        return 0.0, []

    rule_map = _item_rule_map(session)
    item_name_map = {
        row.code: row.name for row in session.exec(select(PayAllowanceDeduction)).all()
    }

    agg_raw: dict[str, float] = {}
    for item in run_items:
        agg_raw[item.item_code] = agg_raw.get(item.item_code, 0.0) + item.amount

    total = 0.0
    details: list[HrSeveranceWageDetailItem] = []
    for item_code, raw_amount in sorted(agg_raw.items()):
        include_type = rule_map.get(item_code, "full")
        if include_type == "exclude":
            included_amount = 0.0
        elif include_type == "prorate_12":
            included_amount = raw_amount * 3 / 12
        else:
            included_amount = raw_amount
        total += included_amount
        details.append(
            HrSeveranceWageDetailItem(
                item_code=item_code,
                item_name=item_name_map.get(item_code),
                include_type=include_type,
                raw_amount=raw_amount,
                included_amount=included_amount,
            )
        )
    return total, details


def create_draft_from_retire_case(session: Session, *, retire_case_id: int) -> HrSeveranceCalc:
    """퇴직 케이스 confirm 시 호출되는 draft 생성 로직 (§4).

    이미 draft/reviewed/confirmed 산정 기록이 있으면 그대로 반환한다 (재호출 안전).
    """
    existing = session.exec(
        select(HrSeveranceCalc).where(HrSeveranceCalc.retire_case_id == retire_case_id)
    ).first()
    if existing is not None:
        return existing

    retire_case = _get_case_or_404(session, retire_case_id)
    employee = session.get(HrEmployee, retire_case.employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")

    calc = _build_calc(session, retire_case=retire_case, employee=employee)
    session.add(calc)
    session.commit()
    session.refresh(calc)
    return calc


def _build_calc(
    session: Session,
    *,
    retire_case: HrRetireCase,
    employee: HrEmployee,
    existing: HrSeveranceCalc | None = None,
) -> HrSeveranceCalc:
    hire_date = employee.hire_date
    retire_date = retire_case.retire_date
    service_days = calc_service_days(hire_date, retire_date)
    base_from, base_to = calc_avg_wage_period(retire_date)
    base_days = calc_base_days(base_from, base_to)

    wage_total, _details = _collect_wage_details(
        session, employee_id=employee.id, base_from=base_from, base_to=base_to
    )
    avg_daily_wage = wage_total / base_days if base_days > 0 else 0.0
    severance_amount = calc_severance_amount(avg_daily_wage, service_days)

    warning: str | None = None
    if wage_total == 0.0:
        warning = NO_WAGE_HISTORY_WARNING
    if service_days < SERVICE_DAYS_MIN_FOR_ELIGIBILITY:
        under_one_year_warning = "근속일수가 1년 미만이라 퇴직금이 발생하지 않습니다."
        warning = f"{warning} {under_one_year_warning}".strip() if warning else under_one_year_warning

    now = _utc_now()
    adjustment_amount = existing.adjustment_amount if existing else 0.0

    if existing is not None:
        existing.hire_date = hire_date
        existing.retire_date = retire_date
        existing.service_days = service_days
        existing.avg_wage_base_from = base_from
        existing.avg_wage_base_to = base_to
        existing.wage_total_3m = wage_total
        existing.base_days_3m = base_days
        existing.avg_daily_wage = avg_daily_wage
        existing.severance_amount = severance_amount
        existing.final_amount = severance_amount + adjustment_amount
        existing.warning = warning
        existing.calculated_at = now
        existing.updated_at = now
        return existing

    return HrSeveranceCalc(
        retire_case_id=retire_case.id,
        employee_id=employee.id,
        hire_date=hire_date,
        retire_date=retire_date,
        service_days=service_days,
        avg_wage_base_from=base_from,
        avg_wage_base_to=base_to,
        wage_total_3m=wage_total,
        base_days_3m=base_days,
        avg_daily_wage=avg_daily_wage,
        severance_amount=severance_amount,
        adjustment_amount=adjustment_amount,
        adjustment_reason=None,
        final_amount=severance_amount + adjustment_amount,
        status="draft",
        warning=warning,
        calculated_at=now,
        created_at=now,
        updated_at=now,
    )


def _employee_info_map(
    session: Session, employee_ids: list[int]
) -> dict[int, tuple[str, str, str]]:
    """employee_id -> (employee_no, employee_name, department_name)."""
    if not employee_ids:
        return {}
    rows = session.exec(
        select(HrEmployee, AuthUser, OrgDepartment)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrEmployee.id.in_(employee_ids))
    ).all()
    return {
        employee.id: (employee.employee_no, user.display_name, department.name)
        for employee, user, department in rows
    }


def _to_calc_item(
    calc: HrSeveranceCalc,
    info_map: dict[int, tuple[str, str, str]] | None = None,
) -> HrSeveranceCalcItem:
    info = (info_map or {}).get(calc.employee_id)
    employee_no, employee_name, department_name = info if info else (None, None, None)
    return HrSeveranceCalcItem(
        id=calc.id,
        retire_case_id=calc.retire_case_id,
        employee_id=calc.employee_id,
        employee_no=employee_no,
        employee_name=employee_name,
        department_name=department_name,
        hire_date=calc.hire_date,
        retire_date=calc.retire_date,
        service_days=calc.service_days,
        avg_wage_base_from=calc.avg_wage_base_from,
        avg_wage_base_to=calc.avg_wage_base_to,
        wage_total_3m=calc.wage_total_3m,
        base_days_3m=calc.base_days_3m,
        avg_daily_wage=calc.avg_daily_wage,
        severance_amount=calc.severance_amount,
        adjustment_amount=calc.adjustment_amount,
        adjustment_reason=calc.adjustment_reason,
        final_amount=calc.final_amount,
        status=calc.status,
        warning=calc.warning,
        calculated_at=calc.calculated_at,
        confirmed_by=calc.confirmed_by,
        confirmed_at=calc.confirmed_at,
        created_at=calc.created_at,
        updated_at=calc.updated_at,
    )


def list_severance_calcs(
    session: Session,
    *,
    status_filter: str | None = None,
    year_filter: str | None = None,
    page: int = 1,
    limit: int = 50,
) -> HrSeveranceCalcListResponse:
    stmt = select(HrSeveranceCalc)
    if status_filter:
        stmt = stmt.where(HrSeveranceCalc.status == status_filter)
    rows = session.exec(stmt.order_by(HrSeveranceCalc.created_at.desc(), HrSeveranceCalc.id.desc())).all()

    if year_filter:
        rows = [row for row in rows if row.retire_date.strftime("%Y") == year_filter]

    info_map = _employee_info_map(session, [row.employee_id for row in rows])
    items = [_to_calc_item(row, info_map) for row in rows]
    paged_items, total_count = paginate_items(items, page, limit)
    return HrSeveranceCalcListResponse(items=paged_items, total_count=total_count, page=page, limit=limit)


def get_severance_calc_detail(session: Session, calc_id: int) -> HrSeveranceCalcDetailResponse:
    calc = _get_calc_or_404(session, calc_id)
    info_map = _employee_info_map(session, [calc.employee_id])
    _wage_total, details = _collect_wage_details(
        session,
        employee_id=calc.employee_id,
        base_from=calc.avg_wage_base_from or calc.retire_date,
        base_to=calc.avg_wage_base_to or calc.retire_date,
    )
    return HrSeveranceCalcDetailResponse(calc=_to_calc_item(calc, info_map), wage_details=details)


def recalculate_severance_calc(session: Session, calc_id: int) -> HrSeveranceCalcDetailResponse:
    calc = _get_calc_or_404(session, calc_id)
    if calc.status == "confirmed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Confirmed calc cannot be recalculated.")

    retire_case = _get_case_or_404(session, calc.retire_case_id)
    employee = session.get(HrEmployee, calc.employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")

    calc = _build_calc(session, retire_case=retire_case, employee=employee, existing=calc)
    session.add(calc)
    session.commit()
    session.refresh(calc)
    return get_severance_calc_detail(session, calc.id)


def update_severance_adjustment(
    session: Session,
    calc_id: int,
    payload: HrSeveranceAdjustmentUpdateRequest,
) -> HrSeveranceCalcDetailResponse:
    calc = _get_calc_or_404(session, calc_id)
    if calc.status == "confirmed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Confirmed calc cannot be modified.")

    reason = payload.adjustment_reason.strip()
    if not reason:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="adjustment_reason is required.")

    calc.adjustment_amount = payload.adjustment_amount
    calc.adjustment_reason = reason
    calc.final_amount = calc.severance_amount + payload.adjustment_amount
    calc.status = "reviewed"
    calc.updated_at = _utc_now()

    session.add(calc)
    session.commit()
    session.refresh(calc)
    return get_severance_calc_detail(session, calc.id)


def confirm_severance_calc(
    session: Session,
    calc_id: int,
    *,
    confirmed_by: int,
) -> HrSeveranceCalcDetailResponse:
    calc = _get_calc_or_404(session, calc_id)
    if calc.status == "confirmed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Calc is already confirmed.")

    now = _utc_now()
    calc.status = "confirmed"
    calc.confirmed_by = confirmed_by
    calc.confirmed_at = now
    calc.updated_at = now

    session.add(calc)
    session.commit()
    session.refresh(calc)
    return get_severance_calc_detail(session, calc.id)


# ── 평균임금 산입 규칙 ──


def list_severance_item_rules(session: Session) -> PaySeveranceItemRuleListResponse:
    rows = session.exec(select(PaySeveranceItemRule).order_by(PaySeveranceItemRule.pay_item_code)).all()
    item_name_map = {
        row.code: row.name for row in session.exec(select(PayAllowanceDeduction)).all()
    }
    items = [_to_rule_item(row, item_name_map) for row in rows]
    return PaySeveranceItemRuleListResponse(items=items, total_count=len(items))


def _to_rule_item(row: PaySeveranceItemRule, item_name_map: dict[str, str]) -> PaySeveranceItemRuleItem:
    return PaySeveranceItemRuleItem(
        id=row.id,
        pay_item_code=row.pay_item_code,
        pay_item_name=item_name_map.get(row.pay_item_code),
        include_type=row.include_type,
        note=row.note,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def batch_save_severance_item_rules(
    session: Session, payload: PaySeveranceItemRuleBatchRequest
) -> PaySeveranceItemRuleBatchResponse:
    inserted = 0
    updated = 0
    deleted = 0

    for del_id in payload.delete_ids:
        row = session.get(PaySeveranceItemRule, del_id)
        if row:
            session.delete(row)
            deleted += 1

    for item in payload.items:
        if item.id and item.id > 0:
            row = session.get(PaySeveranceItemRule, item.id)
            if row:
                row.pay_item_code = item.pay_item_code
                row.include_type = item.include_type
                row.note = item.note
                row.is_active = item.is_active
                row.updated_at = _utc_now()
                session.add(row)
                updated += 1
                continue

        dup = session.exec(
            select(PaySeveranceItemRule).where(PaySeveranceItemRule.pay_item_code == item.pay_item_code)
        ).first()
        if dup is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"pay_item_code '{item.pay_item_code}' already has a severance item rule.",
            )

        session.add(
            PaySeveranceItemRule(
                pay_item_code=item.pay_item_code,
                include_type=item.include_type,
                note=item.note,
                is_active=item.is_active,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
        inserted += 1

    session.commit()

    result = list_severance_item_rules(session)
    return PaySeveranceItemRuleBatchResponse(
        items=result.items,
        total_count=result.total_count,
        inserted_count=inserted,
        updated_count=updated,
        deleted_count=deleted,
    )
