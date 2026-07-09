from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import (
    GlAccount,
    HrEmployee,
    OrgDepartment,
    PayAllowanceDeduction,
    PayGlMapping,
    PayPayrollRun,
    PayPayrollRunEmployee,
    PayPayrollRunItem,
    PayVoucher,
    PayVoucherLine,
)
from app.schemas.pay_voucher import (
    GlAccountBatchRequest,
    GlAccountBatchResponse,
    GlAccountItem,
    GlAccountListResponse,
    MappingGapItem,
    MappingGapsResponse,
    PayGlMappingBatchRequest,
    PayGlMappingBatchResponse,
    PayGlMappingItem,
    PayGlMappingListResponse,
    PayVoucherActionResponse,
    PayVoucherDetailResponse,
    PayVoucherItem,
    PayVoucherLineItem,
    PayVoucherListResponse,
)

ROUNDING_TOLERANCE = 1.0  # 1원 미만 반올림 차이 허용
GENERATE_ALLOWED_STATUSES = ("closed", "paid")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ── GL 계정과목 ──


def list_gl_accounts(session: Session) -> GlAccountListResponse:
    rows = session.exec(select(GlAccount).order_by(GlAccount.sort_order, GlAccount.code)).all()
    items = [_to_gl_account_item(row) for row in rows]
    return GlAccountListResponse(items=items, total_count=len(items))


def _to_gl_account_item(row: GlAccount) -> GlAccountItem:
    return GlAccountItem(
        id=row.id,
        code=row.code,
        name=row.name,
        account_type=row.account_type,
        is_net_pay_account=row.is_net_pay_account,
        is_active=row.is_active,
        sort_order=row.sort_order,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def batch_save_gl_accounts(session: Session, payload: GlAccountBatchRequest) -> GlAccountBatchResponse:
    inserted = 0
    updated = 0
    deleted = 0

    for del_id in payload.delete_ids:
        row = session.get(GlAccount, del_id)
        if row:
            session.delete(row)
            deleted += 1

    for item in payload.items:
        if item.id and item.id > 0:
            row = session.get(GlAccount, item.id)
            if row:
                row.code = item.code
                row.name = item.name
                row.account_type = item.account_type
                row.is_net_pay_account = item.is_net_pay_account
                row.is_active = item.is_active
                row.sort_order = item.sort_order
                row.updated_at = _utc_now()
                session.add(row)
                updated += 1
                continue

        dup = session.exec(select(GlAccount).where(GlAccount.code == item.code)).first()
        if dup is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"gl_account code '{item.code}' already exists.",
            )

        session.add(
            GlAccount(
                code=item.code,
                name=item.name,
                account_type=item.account_type,
                is_net_pay_account=item.is_net_pay_account,
                is_active=item.is_active,
                sort_order=item.sort_order,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
        inserted += 1

    session.commit()

    result = list_gl_accounts(session)
    return GlAccountBatchResponse(
        items=result.items,
        total_count=result.total_count,
        inserted_count=inserted,
        updated_count=updated,
        deleted_count=deleted,
    )


# ── 급여항목 → 계정 매핑 ──


def list_gl_mappings(session: Session) -> PayGlMappingListResponse:
    rows = session.exec(select(PayGlMapping).order_by(PayGlMapping.pay_item_code, PayGlMapping.effective_from.desc())).all()
    item_name_map = _allowance_name_map(session)
    account_name_map = _gl_account_name_map(session)
    items = [_to_mapping_item(row, item_name_map, account_name_map) for row in rows]
    return PayGlMappingListResponse(items=items, total_count=len(items))


def _allowance_name_map(session: Session) -> dict[str, str]:
    rows = session.exec(select(PayAllowanceDeduction.code, PayAllowanceDeduction.name)).all()
    return {code: name for code, name in rows}


def _gl_account_name_map(session: Session) -> dict[str, str]:
    rows = session.exec(select(GlAccount.code, GlAccount.name)).all()
    return {code: name for code, name in rows}


def _to_mapping_item(
    row: PayGlMapping,
    item_name_map: dict[str, str],
    account_name_map: dict[str, str],
) -> PayGlMappingItem:
    return PayGlMappingItem(
        id=row.id,
        pay_item_code=row.pay_item_code,
        pay_item_name=item_name_map.get(row.pay_item_code),
        gl_account_code=row.gl_account_code,
        gl_account_name=account_name_map.get(row.gl_account_code),
        effective_from=row.effective_from,
        note=row.note,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def batch_save_gl_mappings(session: Session, payload: PayGlMappingBatchRequest) -> PayGlMappingBatchResponse:
    inserted = 0
    updated = 0
    deleted = 0

    for del_id in payload.delete_ids:
        row = session.get(PayGlMapping, del_id)
        if row:
            session.delete(row)
            deleted += 1

    for item in payload.items:
        if session.exec(select(GlAccount).where(GlAccount.code == item.gl_account_code)).first() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid gl_account_code: {item.gl_account_code}",
            )

        if item.id and item.id > 0:
            row = session.get(PayGlMapping, item.id)
            if row:
                row.pay_item_code = item.pay_item_code
                row.gl_account_code = item.gl_account_code
                row.effective_from = item.effective_from
                row.note = item.note
                row.is_active = item.is_active
                row.updated_at = _utc_now()
                session.add(row)
                updated += 1
                continue

        dup = session.exec(
            select(PayGlMapping).where(
                PayGlMapping.pay_item_code == item.pay_item_code,
                PayGlMapping.effective_from == item.effective_from,
            )
        ).first()
        if dup is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"pay_item_code '{item.pay_item_code}' already has mapping for effective_from '{item.effective_from}'.",
            )

        session.add(
            PayGlMapping(
                pay_item_code=item.pay_item_code,
                gl_account_code=item.gl_account_code,
                effective_from=item.effective_from,
                note=item.note,
                is_active=item.is_active,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
        inserted += 1

    session.commit()

    result = list_gl_mappings(session)
    return PayGlMappingBatchResponse(
        items=result.items,
        total_count=result.total_count,
        inserted_count=inserted,
        updated_count=updated,
        deleted_count=deleted,
    )


# ── 분개 집계 로직 (§4) ──


def _resolve_active_mapping(
    mappings: list[PayGlMapping],
    item_code: str,
    as_of: date,
) -> PayGlMapping | None:
    """item_code에 대해 as_of 이전(<=)이면서 가장 최근인 활성 매핑을 반환."""
    candidates = [
        m for m in mappings
        if m.pay_item_code == item_code and m.is_active and m.effective_from <= as_of
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda m: m.effective_from)


def _resolve_cost_center(session: Session, employee_id: int, dept_cache: dict[int, str | None]) -> str | None:
    """직원의 department_id -> cost_center_code 를 조회한다. dept_cache는 department_id 단위 캐시.

    employee_id별 조회 결과는 여기서 캐시하지 않으므로 호출자가 employee_id -> cost_center
    매핑을 별도로 유지해야 반복 조회를 피할 수 있다 (generate_voucher에서는 employee 단위로 1회만 호출).
    """
    employee = session.get(HrEmployee, employee_id)
    if employee is None:
        return None
    if employee.department_id in dept_cache:
        return dept_cache[employee.department_id]
    department = session.get(OrgDepartment, employee.department_id)
    cost_center = department.cost_center_code if department else None
    dept_cache[employee.department_id] = cost_center
    return cost_center


def find_mapping_gaps(session: Session, run_id: int) -> MappingGapsResponse:
    run = session.get(PayPayrollRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll run not found.")

    run_items, _ = _collect_run_items(session, run_id)
    mappings = session.exec(select(PayGlMapping)).all()
    item_name_map = _allowance_name_map(session)

    as_of = run.closed_at.date() if run.closed_at else date.today()
    seen: set[str] = set()
    gaps: list[MappingGapItem] = []
    for item_code, direction in run_items:
        if item_code in seen:
            continue
        seen.add(item_code)
        if _resolve_active_mapping(mappings, item_code, as_of) is None:
            gaps.append(
                MappingGapItem(
                    item_code=item_code,
                    item_name=item_name_map.get(item_code),
                    direction=direction,
                )
            )

    return MappingGapsResponse(run_id=run_id, missing_item_codes=gaps)


def _collect_run_items(session: Session, run_id: int) -> tuple[list[tuple[str, str]], list[tuple[PayPayrollRunItem, int]]]:
    """run의 모든 run_item과 해당 run_employee.employee_id를 함께 반환.

    첫 번째 반환값은 (item_code, direction) 유니크 목록(매핑 갭 체크용),
    두 번째는 (run_item, employee_id) 전체 목록(분개 집계용).
    """
    run_employees = session.exec(
        select(PayPayrollRunEmployee).where(PayPayrollRunEmployee.run_id == run_id)
    ).all()
    run_employee_ids = [re.id for re in run_employees]
    employee_by_run_employee = {re.id: re.employee_id for re in run_employees}

    if not run_employee_ids:
        return [], []

    run_items = session.exec(
        select(PayPayrollRunItem).where(PayPayrollRunItem.run_employee_id.in_(run_employee_ids))
    ).all()

    unique_items: dict[str, str] = {}
    detailed: list[tuple[PayPayrollRunItem, int]] = []
    for run_item in run_items:
        unique_items[run_item.item_code] = run_item.direction
        detailed.append((run_item, employee_by_run_employee[run_item.run_employee_id]))

    return list(unique_items.items()), detailed


def _next_voucher_no(session: Session, year_month: str) -> str:
    prefix = f"PV-{year_month.replace('-', '')}-"
    existing = session.exec(
        select(PayVoucher.voucher_no).where(PayVoucher.voucher_no.like(f"{prefix}%"))
    ).all()
    max_seq = 0
    for voucher_no in existing:
        suffix = voucher_no.rsplit("-", 1)[-1]
        if suffix.isdigit():
            max_seq = max(max_seq, int(suffix))
    return f"{prefix}{max_seq + 1:04d}"


def generate_voucher(session: Session, run_id: int, created_by: int | None = None) -> PayVoucherActionResponse:
    run = session.get(PayPayrollRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll run not found.")

    if run.status not in GENERATE_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Run status must be one of {GENERATE_ALLOWED_STATUSES} to generate a voucher. Current: {run.status}",
        )

    existing_voucher = session.exec(select(PayVoucher).where(PayVoucher.run_id == run_id)).first()
    if existing_voucher is not None and existing_voucher.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Voucher already confirmed or cancelled for this run; regeneration is only allowed before confirm.",
        )

    _, detailed_items = _collect_run_items(session, run_id)
    if not detailed_items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Run has no payroll items to generate a voucher from.")

    mappings = session.exec(select(PayGlMapping)).all()
    net_pay_account = session.exec(select(GlAccount).where(GlAccount.is_net_pay_account == True)).first()  # noqa: E712
    if net_pay_account is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No GL account flagged as is_net_pay_account.")

    as_of = run.closed_at.date() if run.closed_at else date.today()

    # (item_code, cost_center_code) 단위 집계
    dept_cache: dict[int, str | None] = {}
    employee_cost_center: dict[int, str | None] = {}
    earning_agg: dict[tuple[str, str | None], float] = {}
    deduction_agg: dict[tuple[str, str | None], float] = {}
    net_pay_agg: dict[str | None, float] = {}
    missing_item_codes: set[str] = set()
    item_name_map = _allowance_name_map(session)

    employee_net: dict[int, float] = {}

    for run_item, employee_id in detailed_items:
        if employee_id not in employee_cost_center:
            employee_cost_center[employee_id] = _resolve_cost_center(session, employee_id, dept_cache)
        cost_center = employee_cost_center[employee_id]

        mapping = _resolve_active_mapping(mappings, run_item.item_code, as_of)
        if mapping is None:
            missing_item_codes.add(run_item.item_code)
            continue

        key = (run_item.item_code, cost_center)
        if run_item.direction == "earning":
            earning_agg[key] = earning_agg.get(key, 0.0) + run_item.amount
            employee_net[employee_id] = employee_net.get(employee_id, 0.0) + run_item.amount
        else:
            deduction_agg[key] = deduction_agg.get(key, 0.0) + run_item.amount
            employee_net[employee_id] = employee_net.get(employee_id, 0.0) - run_item.amount

    if missing_item_codes:
        gap_items = [
            MappingGapItem(item_code=code, item_name=item_name_map.get(code), direction="unknown")
            for code in sorted(missing_item_codes)
        ]
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "GL mapping missing for one or more pay items.",
                "missing_item_codes": [g.model_dump() for g in gap_items],
            },
        )

    # 순지급액을 cost_center별로 집계
    for employee_id, net_amount in employee_net.items():
        cost_center = employee_cost_center.get(employee_id)
        net_pay_agg[cost_center] = net_pay_agg.get(cost_center, 0.0) + net_amount

    # 분개 라인 구성
    lines: list[dict[str, object]] = []
    line_no = 1
    total_debit = 0.0
    total_credit = 0.0

    for (item_code, cost_center), amount in sorted(earning_agg.items(), key=lambda kv: kv[0][0]):
        mapping = _resolve_active_mapping(mappings, item_code, as_of)
        rounded = round(amount, 0)
        lines.append(
            {
                "line_no": line_no,
                "gl_account_code": mapping.gl_account_code,
                "cost_center_code": cost_center,
                "debit_amount": rounded,
                "credit_amount": 0.0,
                "summary": f"{run.year_month} 정기급여 {item_name_map.get(item_code, item_code)}",
                "source_item_code": item_code,
            }
        )
        total_debit += rounded
        line_no += 1

    for (item_code, cost_center), amount in sorted(deduction_agg.items(), key=lambda kv: kv[0][0]):
        mapping = _resolve_active_mapping(mappings, item_code, as_of)
        rounded = round(amount, 0)
        lines.append(
            {
                "line_no": line_no,
                "gl_account_code": mapping.gl_account_code,
                "cost_center_code": cost_center,
                "debit_amount": 0.0,
                "credit_amount": rounded,
                "summary": f"{run.year_month} 정기급여 {item_name_map.get(item_code, item_code)}",
                "source_item_code": item_code,
            }
        )
        total_credit += rounded
        line_no += 1

    for cost_center, amount in sorted(net_pay_agg.items(), key=lambda kv: (kv[0] or "")):
        rounded = round(amount, 0)
        lines.append(
            {
                "line_no": line_no,
                "gl_account_code": net_pay_account.code,
                "cost_center_code": cost_center,
                "debit_amount": 0.0,
                "credit_amount": rounded,
                "summary": f"{run.year_month} 정기급여 미지급급여",
                "source_item_code": None,
            }
        )
        total_credit += rounded
        line_no += 1

    # 차대평형 검증 (1원 미만 반올림 차이는 조정 라인 허용)
    diff = round(total_debit - total_credit, 2)
    if abs(diff) > 0 and abs(diff) < ROUNDING_TOLERANCE:
        lines.append(
            {
                "line_no": line_no,
                "gl_account_code": net_pay_account.code,
                "cost_center_code": None,
                "debit_amount": max(-diff, 0.0),
                "credit_amount": max(diff, 0.0),
                "summary": "반올림 조정",
                "source_item_code": None,
            }
        )
        if diff > 0:
            total_credit += diff
        else:
            total_debit += -diff
        line_no += 1

    diff = round(total_debit - total_credit, 2)
    if abs(diff) >= ROUNDING_TOLERANCE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Debit/credit imbalance too large to auto-adjust: debit={total_debit}, credit={total_credit}",
        )

    # draft 재생성: confirm 전이면 기존 draft 삭제 후 재생성
    if existing_voucher is not None:
        old_lines = session.exec(
            select(PayVoucherLine).where(PayVoucherLine.voucher_id == existing_voucher.id)
        ).all()
        for old_line in old_lines:
            session.delete(old_line)
        session.delete(existing_voucher)
        session.flush()

    voucher = PayVoucher(
        voucher_no=_next_voucher_no(session, run.year_month),
        run_id=run_id,
        voucher_date=date.today(),
        status="draft",
        total_debit=round(total_debit, 2),
        total_credit=round(total_credit, 2),
        summary=f"{run.year_month} 급여 전표",
        created_by=created_by,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(voucher)
    session.flush()

    for line in lines:
        session.add(
            PayVoucherLine(
                voucher_id=voucher.id,
                line_no=line["line_no"],
                gl_account_code=line["gl_account_code"],
                cost_center_code=line["cost_center_code"],
                debit_amount=line["debit_amount"],
                credit_amount=line["credit_amount"],
                summary=line["summary"],
                source_item_code=line["source_item_code"],
                created_at=_utc_now(),
            )
        )

    session.commit()
    session.refresh(voucher)

    return PayVoucherActionResponse(voucher=_to_voucher_item(session, voucher))


def _to_voucher_item(session: Session, row: PayVoucher) -> PayVoucherItem:
    run = session.get(PayPayrollRun, row.run_id)
    return PayVoucherItem(
        id=row.id,
        voucher_no=row.voucher_no,
        run_id=row.run_id,
        year_month=run.year_month if run else None,
        voucher_date=row.voucher_date,
        status=row.status,
        total_debit=row.total_debit,
        total_credit=row.total_credit,
        summary=row.summary,
        created_by=row.created_by,
        confirmed_by=row.confirmed_by,
        confirmed_at=row.confirmed_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def list_vouchers(session: Session, year_month: str | None = None, status_value: str | None = None) -> PayVoucherListResponse:
    statement = select(PayVoucher).order_by(PayVoucher.voucher_date.desc(), PayVoucher.id.desc())
    if status_value:
        statement = statement.where(PayVoucher.status == status_value)

    rows = session.exec(statement).all()
    if year_month:
        run_ids = set(
            session.exec(select(PayPayrollRun.id).where(PayPayrollRun.year_month == year_month)).all()
        )
        rows = [row for row in rows if row.run_id in run_ids]

    items = [_to_voucher_item(session, row) for row in rows]
    return PayVoucherListResponse(items=items, total_count=len(items))


def get_voucher_detail(session: Session, voucher_id: int) -> PayVoucherDetailResponse:
    voucher = session.get(PayVoucher, voucher_id)
    if voucher is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher not found.")

    lines = session.exec(
        select(PayVoucherLine).where(PayVoucherLine.voucher_id == voucher_id).order_by(PayVoucherLine.line_no)
    ).all()
    account_name_map = _gl_account_name_map(session)
    line_items = [
        PayVoucherLineItem(
            id=line.id,
            line_no=line.line_no,
            gl_account_code=line.gl_account_code,
            gl_account_name=account_name_map.get(line.gl_account_code),
            cost_center_code=line.cost_center_code,
            debit_amount=line.debit_amount,
            credit_amount=line.credit_amount,
            summary=line.summary,
            source_item_code=line.source_item_code,
            created_at=line.created_at,
        )
        for line in lines
    ]

    return PayVoucherDetailResponse(voucher=_to_voucher_item(session, voucher), lines=line_items)


def confirm_voucher(session: Session, voucher_id: int, confirmed_by: int | None = None) -> PayVoucherActionResponse:
    voucher = session.get(PayVoucher, voucher_id)
    if voucher is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher not found.")

    if voucher.status != "draft":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only draft voucher can be confirmed.")

    voucher.status = "confirmed"
    voucher.confirmed_by = confirmed_by
    voucher.confirmed_at = _utc_now()
    voucher.updated_at = _utc_now()
    session.add(voucher)
    session.commit()
    session.refresh(voucher)

    return PayVoucherActionResponse(voucher=_to_voucher_item(session, voucher))


def cancel_voucher(session: Session, voucher_id: int) -> PayVoucherActionResponse:
    voucher = session.get(PayVoucher, voucher_id)
    if voucher is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher not found.")

    if voucher.status not in ("draft", "confirmed"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only draft or confirmed voucher can be cancelled.")

    voucher.status = "cancelled"
    voucher.updated_at = _utc_now()
    session.add(voucher)
    session.commit()
    session.refresh(voucher)

    return PayVoucherActionResponse(voucher=_to_voucher_item(session, voucher))
