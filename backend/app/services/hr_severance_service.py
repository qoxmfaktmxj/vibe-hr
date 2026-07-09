from __future__ import annotations

import calendar
import json
import math
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
    PayIncomeTaxBracket,
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
    HrSeveranceTaxDetail,
    HrSeveranceWageDetailItem,
    PaySeveranceItemRuleBatchRequest,
    PaySeveranceItemRuleBatchResponse,
    PaySeveranceItemRuleItem,
    PaySeveranceItemRuleListResponse,
)

SERVICE_DAYS_MIN_FOR_ELIGIBILITY = 365
NO_WAGE_HISTORY_WARNING = "직전 3개월 내 확정(paid) 급여 데이터가 없습니다."
NO_TAX_BRACKET_WARNING_TEMPLATE = (
    "{retire_year}년 기본세율 구간이 없어 최신 연도({fallback_year}) 기준으로 계산했습니다."
)

# ── 퇴직소득세 (소득세법 §48, 2026년 기준) ──
# 연도 개정 시 이 딕셔너리에 신규 연도 키를 추가한다 (§9-2).
SEVERANCE_TAX_TABLE: dict[int, dict[str, list[tuple[float, float, float]]]] = {
    2026: {
        # (근속연수 상한, 기본 공제액, 초과분당 공제 배율) — 상한 None은 무제한(최종 구간)
        "service_year_deduction": [
            (5, 0.0, 1_000_000.0),  # ~5년: 100만 * 근속연수
            (10, 5_000_000.0, 2_000_000.0),  # 6~10년: 500만 + 200만 * (근속연수-5)
            (20, 15_000_000.0, 2_500_000.0),  # 11~20년: 1,500만 + 250만 * (근속연수-10)
            (None, 40_000_000.0, 3_000_000.0),  # 20년~: 4,000만 + 300만 * (근속연수-20)
        ],
        # (환산급여 상한, 하한 기준 공제액, 하한, 초과율) — 상한 None은 무제한(최종 구간)
        "conversion_income_deduction": [
            (8_000_000.0, 0.0, 0.0, 1.0),  # ~800만: 전액
            (70_000_000.0, 8_000_000.0, 8_000_000.0, 0.6),  # ~7,000만: 800만 + 60%
            (100_000_000.0, 45_200_000.0, 70_000_000.0, 0.55),  # ~1억: 4,520만 + 55%
            (300_000_000.0, 61_700_000.0, 100_000_000.0, 0.45),  # ~3억: 6,170만 + 45%
            (None, 151_700_000.0, 300_000_000.0, 0.35),  # 초과: 15,170만 + 35%
        ],
    },
}


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


# ── 퇴직소득세 (§9-1) ──


def calc_service_years(service_days: int) -> int:
    """근속연수: service_days / 365, 1년 미만 절상(ceil). 최소 1년."""
    if service_days <= 0:
        return 0
    return max(1, math.ceil(service_days / 365))


def _severance_tax_table_for_year(retire_year: int) -> tuple[dict[str, list[tuple]], int, str | None]:
    """retire_year에 해당하는 세율 테이블. 없으면 최신 연도로 fallback + warning."""
    if retire_year in SEVERANCE_TAX_TABLE:
        return SEVERANCE_TAX_TABLE[retire_year], retire_year, None
    fallback_year = max(SEVERANCE_TAX_TABLE.keys())
    warning = NO_TAX_BRACKET_WARNING_TEMPLATE.format(retire_year=retire_year, fallback_year=fallback_year)
    return SEVERANCE_TAX_TABLE[fallback_year], fallback_year, warning


def calc_service_year_deduction(service_years: int, table: list[tuple[float, float, float]]) -> float:
    """근속연수공제: 구간별 (상한, 기본공제, 배율) 테이블 순회."""
    if service_years <= 0:
        return 0.0
    prev_bound = 0
    for upper, base_deduction, multiplier in table:
        if upper is None or service_years <= upper:
            return base_deduction + multiplier * (service_years - prev_bound)
        prev_bound = upper
    return 0.0


def calc_conversion_income(final_amount: float, service_year_deduction: float, service_years: int) -> float:
    """환산급여 = (final_amount - 근속연수공제) * 12 / 근속연수."""
    if service_years <= 0:
        return 0.0
    return max(final_amount - service_year_deduction, 0.0) * 12 / service_years


def calc_conversion_income_deduction(
    conversion_income: float, table: list[tuple[float, float, float, float]]
) -> float:
    """환산급여공제: 구간별 (상한, 하한기준공제, 하한, 초과율) 테이블 순회."""
    for upper, base_deduction, lower_bound, rate in table:
        if upper is None or conversion_income <= upper:
            return base_deduction + max(conversion_income - lower_bound, 0.0) * rate
    return 0.0


def _lookup_base_tax_rate(
    session: Session, taxable_income_annual: float, retire_year: int
) -> tuple[float, float, int, str | None]:
    """과세표준(연간 환산액 기준)에 해당하는 pay_income_tax_brackets 조회 (읽기 전용 재사용).

    retire_date 연도 기준으로 조회하며, 해당 연도 브래킷이 없으면 최신 연도로 fallback.
    Returns: (tax_rate_percent, quick_deduction, used_year, warning)
    """
    bracket_rows = session.exec(
        select(PayIncomeTaxBracket)
        .where(PayIncomeTaxBracket.year == retire_year)
        .order_by(PayIncomeTaxBracket.annual_taxable_from)
    ).all()
    used_year = retire_year
    warning: str | None = None

    if not bracket_rows:
        latest_year_row = session.exec(
            select(PayIncomeTaxBracket.year).order_by(PayIncomeTaxBracket.year.desc())
        ).first()
        if latest_year_row is None:
            # pay_income_tax_brackets가 전혀 세팅되지 않은 환경(예: 유닛 테스트) — 세율 0으로 처리.
            return 0.0, 0.0, retire_year, None
        used_year = latest_year_row
        warning = f"{retire_year}년 기본세율 구간이 없어 최신 연도({used_year}) 기준으로 계산했습니다."
        bracket_rows = session.exec(
            select(PayIncomeTaxBracket)
            .where(PayIncomeTaxBracket.year == used_year)
            .order_by(PayIncomeTaxBracket.annual_taxable_from)
        ).all()

    annual_income = max(float(taxable_income_annual), 0.0)
    for row in bracket_rows:
        upper_bound = float(row.annual_taxable_to) if row.annual_taxable_to is not None else None
        if annual_income < float(row.annual_taxable_from):
            continue
        if upper_bound is not None and annual_income > upper_bound:
            continue
        return float(row.tax_rate), float(row.quick_deduction or 0), used_year, warning

    return 0.0, 0.0, used_year, warning


def calc_severance_tax(
    session: Session,
    *,
    final_amount: float,
    service_days: int,
    retire_date: date,
) -> dict[str, object]:
    """§9-1 절차 그대로 퇴직소득세를 산출한다.

    1년 미만 또는 0원 퇴직금은 세액 전부 0.
    Returns tax_detail dict (그대로 tax_detail_json에 스냅샷) — income_tax/local_income_tax/
    net_severance/service_years 필드 포함.
    """
    service_years = calc_service_years(service_days)

    if service_days < SERVICE_DAYS_MIN_FOR_ELIGIBILITY or final_amount <= 0:
        return {
            "service_years": service_years,
            "service_year_deduction": 0.0,
            "conversion_income": 0.0,
            "conversion_income_deduction": 0.0,
            "taxable_base": 0.0,
            "base_tax_rate": 0.0,
            "quick_deduction": 0.0,
            "converted_calculated_tax": 0.0,
            "income_tax": 0.0,
            "local_income_tax": 0.0,
            "net_severance": final_amount,
            "tax_table_year": None,
            "warning": None,
        }

    table, table_year, table_warning = _severance_tax_table_for_year(retire_date.year)
    service_year_deduction = calc_service_year_deduction(service_years, table["service_year_deduction"])
    conversion_income = calc_conversion_income(final_amount, service_year_deduction, service_years)
    conversion_income_deduction = calc_conversion_income_deduction(
        conversion_income, table["conversion_income_deduction"]
    )
    taxable_base = max(conversion_income - conversion_income_deduction, 0.0)

    tax_rate_percent, quick_deduction, bracket_year, bracket_warning = _lookup_base_tax_rate(
        session, taxable_base, retire_date.year
    )
    converted_calculated_tax = max(taxable_base * (tax_rate_percent / 100) - quick_deduction, 0.0)
    income_tax = converted_calculated_tax / 12 * service_years
    local_income_tax = income_tax * 0.1
    net_severance = final_amount - income_tax - local_income_tax

    warning = table_warning or bracket_warning

    return {
        "service_years": service_years,
        "service_year_deduction": service_year_deduction,
        "conversion_income": conversion_income,
        "conversion_income_deduction": conversion_income_deduction,
        "taxable_base": taxable_base,
        "base_tax_rate": tax_rate_percent,
        "quick_deduction": quick_deduction,
        "converted_calculated_tax": converted_calculated_tax,
        "income_tax": income_tax,
        "local_income_tax": local_income_tax,
        "net_severance": net_severance,
        "tax_table_year": table_year,
        "bracket_year": bracket_year,
        "warning": warning,
    }


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
    final_amount = severance_amount + adjustment_amount

    tax_detail = calc_severance_tax(
        session, final_amount=final_amount, service_days=service_days, retire_date=retire_date
    )
    tax_warning = tax_detail.get("warning")
    if tax_warning:
        warning = f"{warning} {tax_warning}".strip() if warning else tax_warning

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
        existing.final_amount = final_amount
        existing.warning = warning
        existing.calculated_at = now
        existing.updated_at = now
        existing.service_years = tax_detail["service_years"]
        existing.income_tax = tax_detail["income_tax"]
        existing.local_income_tax = tax_detail["local_income_tax"]
        existing.net_severance = tax_detail["net_severance"]
        existing.tax_detail_json = json.dumps(tax_detail, ensure_ascii=False)
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
        final_amount=final_amount,
        status="draft",
        warning=warning,
        calculated_at=now,
        created_at=now,
        updated_at=now,
        service_years=tax_detail["service_years"],
        income_tax=tax_detail["income_tax"],
        local_income_tax=tax_detail["local_income_tax"],
        net_severance=tax_detail["net_severance"],
        tax_detail_json=json.dumps(tax_detail, ensure_ascii=False),
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
        service_years=calc.service_years,
        income_tax=calc.income_tax,
        local_income_tax=calc.local_income_tax,
        net_severance=calc.net_severance,
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


def _parse_tax_detail(calc: HrSeveranceCalc) -> HrSeveranceTaxDetail | None:
    if not calc.tax_detail_json:
        return None
    try:
        raw = json.loads(calc.tax_detail_json)
    except (TypeError, ValueError):
        return None
    return HrSeveranceTaxDetail(**raw)


def get_severance_calc_detail(session: Session, calc_id: int) -> HrSeveranceCalcDetailResponse:
    calc = _get_calc_or_404(session, calc_id)
    info_map = _employee_info_map(session, [calc.employee_id])
    _wage_total, details = _collect_wage_details(
        session,
        employee_id=calc.employee_id,
        base_from=calc.avg_wage_base_from or calc.retire_date,
        base_to=calc.avg_wage_base_to or calc.retire_date,
    )
    return HrSeveranceCalcDetailResponse(
        calc=_to_calc_item(calc, info_map),
        wage_details=details,
        tax_detail=_parse_tax_detail(calc),
    )


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

    tax_detail = calc_severance_tax(
        session,
        final_amount=calc.final_amount,
        service_days=calc.service_days,
        retire_date=calc.retire_date,
    )
    calc.service_years = tax_detail["service_years"]
    calc.income_tax = tax_detail["income_tax"]
    calc.local_income_tax = tax_detail["local_income_tax"]
    calc.net_severance = tax_detail["net_severance"]
    calc.tax_detail_json = json.dumps(tax_detail, ensure_ascii=False)
    tax_warning = tax_detail.get("warning")
    if tax_warning and tax_warning not in (calc.warning or ""):
        calc.warning = f"{calc.warning} {tax_warning}".strip() if calc.warning else tax_warning

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
