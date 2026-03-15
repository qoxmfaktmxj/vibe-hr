from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import delete, or_
from sqlmodel import Session, select

from app.models import (
    AuthUser,
    HrAppointmentOrder,
    HrAppointmentOrderItem,
    HrEmployee,
    HrEmployeeBasicProfile,
    HrLeaveRequest,
    OrgDepartment,
    PayAllowanceDeduction,
    PayEmployeeProfile,
    PayIncomeTaxBracket,
    PayItemGroup,
    PayPayrollCode,
    PayPayrollRun,
    PayPayrollRunEmployee,
    PayPayrollRunEvent,
    PayPayrollRunItem,
    PayPayrollRunTarget,
    PayPayrollRunTargetEvent,
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


def _as_date_text(value: date | None) -> str | None:
    return value.isoformat() if value is not None else None


def _as_datetime_text(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _normalize_action_code(value: str | None) -> str:
    return (value or "").replace(" ", "").strip().lower()


def _select_active_payroll_profiles(
    session: Session,
    *,
    payroll_code_id: int,
    period_start: date,
    period_end: date,
) -> dict[int, PayEmployeeProfile]:
    rows = session.exec(
        select(PayEmployeeProfile)
        .where(
            PayEmployeeProfile.payroll_code_id == payroll_code_id,
            PayEmployeeProfile.is_active == True,  # noqa: E712
            PayEmployeeProfile.effective_from <= period_end,
            or_(PayEmployeeProfile.effective_to == None, PayEmployeeProfile.effective_to >= period_start),  # noqa: E711
        )
        .order_by(PayEmployeeProfile.employee_id, PayEmployeeProfile.effective_from.desc(), PayEmployeeProfile.id.desc())
    ).all()

    profile_by_employee: dict[int, PayEmployeeProfile] = {}
    for row in rows:
        profile_by_employee.setdefault(row.employee_id, row)
    return profile_by_employee


def _resolve_payroll_targets(
    session: Session,
    *,
    run: PayPayrollRun,
    period_start: date,
    period_end: date,
) -> list[tuple[HrEmployee, PayEmployeeProfile, str | None, str | None, date | None]]:
    profile_by_employee = _select_active_payroll_profiles(
        session,
        payroll_code_id=run.payroll_code_id,
        period_start=period_start,
        period_end=period_end,
    )
    employee_ids = list(profile_by_employee.keys())
    if not employee_ids:
        return []

    employee_rows = session.exec(
        select(HrEmployee).where(
            HrEmployee.id.in_(employee_ids),
            HrEmployee.hire_date <= period_end,
        )
    ).all()
    employee_map = {employee.id: employee for employee in employee_rows}

    user_rows = session.exec(
        select(AuthUser).where(AuthUser.id.in_([employee.user_id for employee in employee_rows]))
    ).all()
    user_name_map = {user.id: user.display_name for user in user_rows}

    department_ids = sorted({employee.department_id for employee in employee_rows})
    department_rows = session.exec(select(OrgDepartment).where(OrgDepartment.id.in_(department_ids))).all() if department_ids else []
    department_name_map = {department.id: department.name for department in department_rows}

    basic_profiles = session.exec(
        select(HrEmployeeBasicProfile).where(HrEmployeeBasicProfile.employee_id.in_(employee_ids))
    ).all()
    retire_date_map = {profile.employee_id: profile.retire_date for profile in basic_profiles}

    targets: list[tuple[HrEmployee, PayEmployeeProfile, str | None, str | None, date | None]] = []
    for employee_id in employee_ids:
        employee = employee_map.get(employee_id)
        if employee is None:
            continue

        retire_date = retire_date_map.get(employee_id)
        if retire_date is not None and retire_date < period_start:
            continue

        targets.append(
            (
                employee,
                profile_by_employee[employee_id],
                user_name_map.get(employee.user_id),
                department_name_map.get(employee.department_id),
                retire_date,
            )
        )

    return targets


def _build_run_target_snapshot(
    *,
    employee: HrEmployee,
    profile: PayEmployeeProfile,
    employee_name: str | None,
    department_name: str | None,
    retire_date: date | None,
    period_start: date,
    period_end: date,
) -> dict[str, object]:
    return {
        "employee_id": employee.id or 0,
        "employee_no": employee.employee_no,
        "employee_name": employee_name,
        "department_id": employee.department_id,
        "department_name": department_name,
        "position_title": employee.position_title,
        "hire_date": _as_date_text(employee.hire_date),
        "employment_status": employee.employment_status,
        "retire_date": _as_date_text(retire_date),
        "profile_id": profile.id,
        "payroll_code_id": profile.payroll_code_id,
        "item_group_id": profile.item_group_id,
        "base_salary": round(float(profile.base_salary), 2),
        "pay_type_code": profile.pay_type_code,
        "payment_day_type": profile.payment_day_type,
        "payment_day_value": profile.payment_day_value,
        "holiday_adjustment": profile.holiday_adjustment,
        "effective_from": _as_date_text(profile.effective_from),
        "effective_to": _as_date_text(profile.effective_to),
        "period_start": _as_date_text(period_start),
        "period_end": _as_date_text(period_end),
    }


def _build_payroll_target_event_payload(
    *,
    item: HrAppointmentOrderItem,
    order: HrAppointmentOrder,
    department_name_map: dict[int, str],
) -> dict[str, object]:
    return {
        "appointment_no": order.appointment_no,
        "order_title": order.title,
        "appointment_kind": item.appointment_kind,
        "action_type": item.action_type,
        "from_department_id": item.from_department_id,
        "from_department_name": department_name_map.get(item.from_department_id or 0),
        "to_department_id": item.to_department_id,
        "to_department_name": department_name_map.get(item.to_department_id or 0),
        "from_position_title": item.from_position_title,
        "to_position_title": item.to_position_title,
        "from_employment_status": item.from_employment_status,
        "to_employment_status": item.to_employment_status,
        "start_date": _as_date_text(item.start_date),
        "end_date": _as_date_text(item.end_date),
        "temporary_reason": item.temporary_reason,
        "note": item.note,
    }


def _build_payroll_profile_event_payload(
    *,
    previous_profile: PayEmployeeProfile,
    current_profile: PayEmployeeProfile,
    item_group_name_map: dict[int, str],
) -> dict[str, object]:
    return {
        "previous_profile_id": previous_profile.id,
        "current_profile_id": current_profile.id,
        "effective_from": _as_date_text(current_profile.effective_from),
        "effective_to": _as_date_text(current_profile.effective_to),
        "previous_base_salary": round(float(previous_profile.base_salary), 2),
        "current_base_salary": round(float(current_profile.base_salary), 2),
        "previous_item_group_id": previous_profile.item_group_id,
        "previous_item_group_name": item_group_name_map.get(previous_profile.item_group_id or 0),
        "current_item_group_id": current_profile.item_group_id,
        "current_item_group_name": item_group_name_map.get(current_profile.item_group_id or 0),
        "previous_pay_type_code": previous_profile.pay_type_code,
        "current_pay_type_code": current_profile.pay_type_code,
        "previous_payment_day_type": previous_profile.payment_day_type,
        "current_payment_day_type": current_profile.payment_day_type,
        "previous_payment_day_value": previous_profile.payment_day_value,
        "current_payment_day_value": current_profile.payment_day_value,
        "previous_holiday_adjustment": previous_profile.holiday_adjustment,
        "current_holiday_adjustment": current_profile.holiday_adjustment,
    }


def _build_leave_request_event_payload(*, leave_request: HrLeaveRequest) -> dict[str, object]:
    return {
        "leave_type": leave_request.leave_type,
        "start_date": _as_date_text(leave_request.start_date),
        "end_date": _as_date_text(leave_request.end_date),
        "reason": leave_request.reason,
        "request_status": leave_request.request_status,
        "approved_at": _as_datetime_text(leave_request.approved_at),
        "decision_comment": leave_request.decision_comment,
    }


def _build_welfare_request_event_payload(
    *,
    benefit_row: WelBenefitRequest,
    benefit_type: WelBenefitType,
) -> dict[str, object]:
    return {
        "request_no": benefit_row.request_no,
        "benefit_type_code": benefit_row.benefit_type_code,
        "benefit_type_name": benefit_row.benefit_type_name,
        "is_deduction": benefit_type.is_deduction,
        "pay_item_code": benefit_type.pay_item_code,
        "requested_amount": int(benefit_row.requested_amount or 0),
        "approved_amount": int(benefit_row.approved_amount or benefit_row.requested_amount or 0),
        "status_code": benefit_row.status_code,
        "payroll_run_label": benefit_row.payroll_run_label,
        "approved_at": _as_datetime_text(benefit_row.approved_at),
        "description": benefit_row.description,
    }


def _collect_payroll_target_events(
    *,
    item: HrAppointmentOrderItem,
    order: HrAppointmentOrder,
    department_name_map: dict[int, str],
) -> list[tuple[str, str, str, dict[str, object]]]:
    payload = _build_payroll_target_event_payload(item=item, order=order, department_name_map=department_name_map)
    action_code = _normalize_action_code(item.action_type)
    events: list[tuple[str, str, str, dict[str, object]]] = [
        ("appointment_order_confirmed", "발령 오더 확정", "apply", payload),
    ]

    if item.to_department_id is not None and item.to_department_id != item.from_department_id:
        events.append(("department_changed", "부서 변경", "apply", payload))

    if item.to_position_title is not None and item.to_position_title != item.from_position_title:
        events.append(("position_changed", "직위 변경", "apply", payload))

    before_status = (item.from_employment_status or "").strip().lower()
    after_status = (item.to_employment_status or "").strip().lower()
    if item.appointment_kind == "temporary":
        events.append(("temporary_assignment_started", "임시 발령 시작", "review", payload))
        if item.end_date is not None:
            events.append(("temporary_assignment_ended", "임시 발령 종료 예정", "review", payload))

    if "입사" in action_code:
        events.append(("hire_started", "입사 이벤트", "review", payload))

    if after_status and after_status != before_status:
        if after_status == "resigned" or "퇴사" in action_code:
            events.append(("resigned", "퇴사 이벤트", "review", payload))
        elif before_status == "active" and after_status == "leave":
            events.append(("leave_status_started", "휴직 시작", "review", payload))
        elif before_status == "leave" and after_status == "active":
            events.append(("leave_status_ended", "복직/휴직 종료", "review", payload))
        else:
            events.append(("employment_status_changed", "고용상태 변경", "apply", payload))

    unique_events: list[tuple[str, str, str, dict[str, object]]] = []
    seen_codes: set[str] = set()
    for event in events:
        if event[0] in seen_codes:
            continue
        seen_codes.add(event[0])
        unique_events.append(event)
    return unique_events


def _collect_leave_request_events(
    *,
    leave_request: HrLeaveRequest,
) -> list[tuple[str, str, str, dict[str, object]]]:
    if leave_request.request_status != "approved":
        return []

    payload = _build_leave_request_event_payload(leave_request=leave_request)
    if leave_request.leave_type == "unpaid":
        return [("unpaid_leave_approved", "무급휴가 승인", "review", payload)]

    return []


def _collect_payroll_profile_events(
    *,
    previous_profile: PayEmployeeProfile,
    current_profile: PayEmployeeProfile,
    item_group_name_map: dict[int, str],
) -> list[tuple[str, str, str, dict[str, object]]]:
    payload = _build_payroll_profile_event_payload(
        previous_profile=previous_profile,
        current_profile=current_profile,
        item_group_name_map=item_group_name_map,
    )
    events: list[tuple[str, str, str, dict[str, object]]] = []

    if round(float(previous_profile.base_salary), 2) != round(float(current_profile.base_salary), 2):
        events.append(("base_salary_changed", "기본급 변경", "review", payload))

    if previous_profile.item_group_id != current_profile.item_group_id:
        events.append(("pay_item_group_changed", "급여항목 그룹 변경", "review", payload))

    payment_schedule_changed = (
        previous_profile.payment_day_type != current_profile.payment_day_type
        or previous_profile.payment_day_value != current_profile.payment_day_value
        or previous_profile.holiday_adjustment != current_profile.holiday_adjustment
    )
    if payment_schedule_changed:
        events.append(("payment_schedule_changed", "지급기준 변경", "review", payload))

    if previous_profile.pay_type_code != current_profile.pay_type_code:
        events.append(("pay_type_changed", "급여유형 변경", "review", payload))

    return events


def _collect_welfare_request_events(
    *,
    benefit_row: WelBenefitRequest,
    benefit_type: WelBenefitType,
) -> list[tuple[str, str, str, dict[str, object]]]:
    payload = _build_welfare_request_event_payload(benefit_row=benefit_row, benefit_type=benefit_type)
    if benefit_type.is_deduction:
        return [("welfare_deduction_approved", "복리후생 공제 승인", "apply", payload)]
    return [("welfare_allowance_approved", "복리후생 지급 승인", "apply", payload)]


def _add_target_event(
    session: Session,
    *,
    run: PayPayrollRun,
    target: PayPayrollRunTarget,
    employee_id: int,
    source_type: str,
    source_table: str,
    source_id: int | None,
    effective_date: date | None,
    event_code: str,
    event_name: str,
    decision_code: str,
    payload: dict[str, object],
) -> None:
    session.add(
        PayPayrollRunTargetEvent(
            run_id=run.id or 0,
            target_id=target.id,
            employee_id=employee_id,
            event_code=event_code,
            event_name=event_name,
            source_type=source_type,
            source_table=source_table,
            source_id=source_id,
            effective_date=effective_date,
            decision_code=decision_code,
            payload_json=payload,
            created_at=_utc_now(),
        )
    )
    target.event_count += 1
    if decision_code == "review":
        target.review_required = True
    target.updated_at = _utc_now()
    session.add(target)


def _materialize_payroll_targets(
    session: Session,
    *,
    run: PayPayrollRun,
    period_start: date,
    period_end: date,
    replace_existing: bool,
) -> tuple[int, int]:
    if replace_existing:
        session.exec(delete(PayPayrollRunTargetEvent).where(PayPayrollRunTargetEvent.run_id == run.id))
        session.exec(delete(PayPayrollRunTarget).where(PayPayrollRunTarget.run_id == run.id))
        session.flush()

    targets = _resolve_payroll_targets(session, run=run, period_start=period_start, period_end=period_end)
    if not targets:
        return 0, 0

    run_targets: list[PayPayrollRunTarget] = []
    for employee, profile, employee_name, department_name, retire_date in targets:
        run_target = PayPayrollRunTarget(
            run_id=run.id or 0,
            employee_id=employee.id or 0,
            profile_id=profile.id,
            event_count=0,
            review_required=False,
            snapshot_json=_build_run_target_snapshot(
                employee=employee,
                profile=profile,
                employee_name=employee_name,
                department_name=department_name,
                retire_date=retire_date,
                period_start=period_start,
                period_end=period_end,
            ),
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(run_target)
        run_targets.append(run_target)

    session.flush()

    employee_ids = [target.employee_id for target in run_targets]
    department_ids = sorted(
        {
            department_id
            for target in run_targets
            for department_id in (
                int(target.snapshot_json.get("department_id") or 0),
            )
            if department_id > 0
        }
    )
    appointment_rows = session.exec(
        select(HrAppointmentOrderItem, HrAppointmentOrder)
        .join(HrAppointmentOrder, HrAppointmentOrder.id == HrAppointmentOrderItem.order_id)
        .where(
            HrAppointmentOrder.status == "confirmed",
            HrAppointmentOrderItem.employee_id.in_(employee_ids),
            HrAppointmentOrderItem.start_date <= period_end,
            or_(HrAppointmentOrderItem.end_date == None, HrAppointmentOrderItem.end_date >= period_start),  # noqa: E711
        )
        .order_by(HrAppointmentOrderItem.employee_id, HrAppointmentOrderItem.start_date, HrAppointmentOrderItem.id)
    ).all()
    department_ids.extend(
        department_id
        for item, _ in appointment_rows
        for department_id in (item.from_department_id, item.to_department_id)
        if department_id is not None
    )
    department_name_map = {
        department.id: department.name
        for department in session.exec(
            select(OrgDepartment).where(OrgDepartment.id.in_(sorted(set(department_ids))))
        ).all()
    } if department_ids else {}

    target_by_employee = {target.employee_id: target for target in run_targets}
    event_count = 0
    for item, order in appointment_rows:
        target = target_by_employee.get(item.employee_id)
        if target is None:
            continue

        for event_code, event_name, decision_code, payload in _collect_payroll_target_events(
            item=item,
            order=order,
            department_name_map=department_name_map,
        ):
            _add_target_event(
                session,
                run=run,
                target=target,
                employee_id=item.employee_id,
                source_type="appointment",
                source_table="hr_appointment_order_items",
                source_id=item.id,
                effective_date=item.start_date,
                event_code=event_code,
                event_name=event_name,
                decision_code=decision_code,
                payload=payload,
            )
            event_count += 1

    profile_rows = session.exec(
        select(PayEmployeeProfile)
        .where(
            PayEmployeeProfile.employee_id.in_(employee_ids),
            PayEmployeeProfile.payroll_code_id == run.payroll_code_id,
            PayEmployeeProfile.effective_from <= period_end,
        )
        .order_by(PayEmployeeProfile.employee_id, PayEmployeeProfile.effective_from, PayEmployeeProfile.id)
    ).all() if employee_ids else []
    profile_item_group_name_map = {
        item_group.id: item_group.name
        for item_group in session.exec(
            select(PayItemGroup).where(
                PayItemGroup.id.in_(
                    sorted(
                        {
                            item_group_id
                            for row in profile_rows
                            for item_group_id in (row.item_group_id,)
                            if item_group_id is not None
                        }
                    )
                )
            )
        ).all()
    } if profile_rows else {}

    profile_rows_by_employee: dict[int, list[PayEmployeeProfile]] = {}
    for row in profile_rows:
        profile_rows_by_employee.setdefault(row.employee_id, []).append(row)

    for employee_id, employee_profiles in profile_rows_by_employee.items():
        target = target_by_employee.get(employee_id)
        if target is None:
            continue

        previous_profile: PayEmployeeProfile | None = None
        for profile in employee_profiles:
            if previous_profile is not None and period_start <= profile.effective_from <= period_end:
                for event_code, event_name, decision_code, payload in _collect_payroll_profile_events(
                    previous_profile=previous_profile,
                    current_profile=profile,
                    item_group_name_map=profile_item_group_name_map,
                ):
                    _add_target_event(
                        session,
                        run=run,
                        target=target,
                        employee_id=employee_id,
                        source_type="payroll_profile",
                        source_table="pay_employee_profiles",
                        source_id=profile.id,
                        effective_date=profile.effective_from,
                        event_code=event_code,
                        event_name=event_name,
                        decision_code=decision_code,
                        payload=payload,
                    )
                    event_count += 1
            previous_profile = profile

    leave_rows = session.exec(
        select(HrLeaveRequest)
        .where(
            HrLeaveRequest.employee_id.in_(employee_ids),
            HrLeaveRequest.request_status == "approved",
            HrLeaveRequest.start_date <= period_end,
            HrLeaveRequest.end_date >= period_start,
        )
        .order_by(HrLeaveRequest.employee_id, HrLeaveRequest.start_date, HrLeaveRequest.id)
    ).all() if employee_ids else []
    for leave_row in leave_rows:
        target = target_by_employee.get(leave_row.employee_id)
        if target is None:
            continue

        for event_code, event_name, decision_code, payload in _collect_leave_request_events(
            leave_request=leave_row,
        ):
            _add_target_event(
                session,
                run=run,
                target=target,
                employee_id=leave_row.employee_id,
                source_type="tim_leave",
                source_table="tim_leave_requests",
                source_id=leave_row.id,
                effective_date=leave_row.start_date,
                event_code=event_code,
                event_name=event_name,
                decision_code=decision_code,
                payload=payload,
            )
            event_count += 1

    employee_no_to_target = {
        str(target.snapshot_json.get("employee_no")): target
        for target in run_targets
        if target.snapshot_json.get("employee_no")
    }
    benefit_types = {
        row.code: row
        for row in session.exec(select(WelBenefitType).where(WelBenefitType.is_active == True)).all()  # noqa: E712
    } if employee_no_to_target else {}
    welfare_rows = session.exec(
        select(WelBenefitRequest).where(
            WelBenefitRequest.employee_no.in_(list(employee_no_to_target.keys())),
            WelBenefitRequest.status_code.in_(["approved", "payroll_reflected"]),
            or_(
                WelBenefitRequest.payroll_run_label == None,  # noqa: E711
                WelBenefitRequest.payroll_run_label.ilike(f"%{run.year_month}%"),
            ),
        )
    ).all() if employee_no_to_target else []
    for benefit_row in welfare_rows:
        if not _welfare_request_matches_run_month(benefit_row, run):
            continue

        target = employee_no_to_target.get(benefit_row.employee_no)
        benefit_type = benefit_types.get(benefit_row.benefit_type_code)
        if target is None or benefit_type is None:
            continue

        for event_code, event_name, decision_code, payload in _collect_welfare_request_events(
            benefit_row=benefit_row,
            benefit_type=benefit_type,
        ):
            _add_target_event(
                session,
                run=run,
                target=target,
                employee_id=target.employee_id,
                source_type="welfare_request",
                source_table="wel_benefit_requests",
                source_id=benefit_row.id,
                effective_date=(benefit_row.approved_at or benefit_row.requested_at).date(),
                event_code=event_code,
                event_name=event_name,
                decision_code=decision_code,
                payload=payload,
            )
            event_count += 1

    return len(run_targets), event_count


def _ensure_payroll_targets(
    session: Session,
    *,
    run: PayPayrollRun,
    period_start: date,
    period_end: date,
) -> list[PayPayrollRunTarget]:
    targets = session.exec(
        select(PayPayrollRunTarget)
        .where(PayPayrollRunTarget.run_id == run.id)
        .order_by(PayPayrollRunTarget.employee_id, PayPayrollRunTarget.id)
    ).all()
    if targets:
        return targets

    target_count, event_count = _materialize_payroll_targets(
        session,
        run=run,
        period_start=period_start,
        period_end=period_end,
        replace_existing=True,
    )
    session.add(
        PayPayrollRunEvent(
            run_id=run.id,
            event_type="snapshot_backfill",
            message=f"Payroll target snapshot backfilled for {target_count} employees ({event_count} events).",
            created_at=_utc_now(),
        )
    )
    session.commit()
    return session.exec(
        select(PayPayrollRunTarget)
        .where(PayPayrollRunTarget.run_id == run.id)
        .order_by(PayPayrollRunTarget.employee_id, PayPayrollRunTarget.id)
    ).all()


def _build_run_action_response(session: Session, run: PayPayrollRun) -> PayPayrollRunActionResponse:
    code_name = session.exec(select(PayPayrollCode.name).where(PayPayrollCode.id == run.payroll_code_id)).first()
    return PayPayrollRunActionResponse(run=_build_run_item(run, {run.payroll_code_id: code_name or ""}))


def refresh_payroll_run_snapshot(session: Session, run_id: int) -> PayPayrollRunActionResponse:
    run = session.get(PayPayrollRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll run not found.")

    if run.status in {"closed", "paid"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Closed/paid run cannot refresh snapshot.")

    period_start, period_end = _parse_year_month(run.year_month)
    target_count, event_count = _materialize_payroll_targets(
        session,
        run=run,
        period_start=period_start,
        period_end=period_end,
        replace_existing=True,
    )
    run.updated_at = _utc_now()
    session.add(run)
    session.add(
        PayPayrollRunEvent(
            run_id=run.id,
            event_type="snapshot_refreshed",
            message=f"Payroll target snapshot refreshed for {target_count} employees ({event_count} events).",
            created_at=_utc_now(),
        )
    )
    session.commit()

    if run.status == "calculated":
        return calculate_payroll_run(session, run_id)

    session.refresh(run)
    return _build_run_action_response(session, run)


def _snapshot_value(snapshot: dict[str, object], key: str, default: object = None) -> object:
    return snapshot.get(key, default)


def _build_employee_maps(session: Session, employee_ids: list[int]) -> tuple[dict[int, HrEmployee], dict[int, str]]:
    if not employee_ids:
        return {}, {}

    employees = session.exec(select(HrEmployee).where(HrEmployee.id.in_(employee_ids))).all()
    users = session.exec(select(AuthUser).where(AuthUser.id.in_([e.user_id for e in employees]))).all()
    user_name_map = {u.id: u.display_name for u in users}

    emp_map = {e.id: e for e in employees}
    emp_name_map = {e.id: user_name_map.get(e.user_id, "") for e in employees}
    return emp_map, emp_name_map


def _build_run_target_snapshot_map(session: Session, run_id: int) -> dict[int, dict[str, object]]:
    rows = session.exec(
        select(PayPayrollRunTarget).where(PayPayrollRunTarget.run_id == run_id)
    ).all()
    return {row.employee_id: row.snapshot_json for row in rows}


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
    period_start, period_end = _parse_year_month(payload.year_month)

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
    session.flush()

    target_count, event_count = _materialize_payroll_targets(
        session,
        run=run,
        period_start=period_start,
        period_end=period_end,
        replace_existing=True,
    )

    session.add(
        PayPayrollRunEvent(
            run_id=run.id,
            event_type="created",
            message="Payroll run created.",
            created_at=_utc_now(),
        )
    )
    session.add(
        PayPayrollRunEvent(
            run_id=run.id,
            event_type="snapshot_created",
            message=f"Payroll target snapshot created for {target_count} employees ({event_count} events).",
            created_at=_utc_now(),
        )
    )
    session.commit()
    session.refresh(run)

    return PayPayrollRunActionResponse(run=_build_run_item(run, {payload.payroll_code_id: payroll_code.name}))


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


def _find_income_tax_bracket(
    bracket_rows: list[PayIncomeTaxBracket],
    annual_taxable_income: float,
) -> PayIncomeTaxBracket | None:
    annual_income = max(float(annual_taxable_income), 0.0)
    for row in bracket_rows:
        upper_bound = float(row.annual_taxable_to) if row.annual_taxable_to is not None else None
        if annual_income < float(row.annual_taxable_from):
            continue
        if upper_bound is not None and annual_income > upper_bound:
            continue
        return row
    return None


def _calculate_income_tax(
    *,
    taxable_income: float,
    bracket_rows: list[PayIncomeTaxBracket],
    fallback_rate_row: PayTaxRate | None,
) -> tuple[float, list[str]]:
    if taxable_income <= 0:
        return 0.0, []

    annual_taxable_income = float(taxable_income) * 12
    bracket = _find_income_tax_bracket(bracket_rows, annual_taxable_income)
    if bracket is not None:
        annual_income_tax = max(
            annual_taxable_income * (float(bracket.tax_rate) / 100) - float(bracket.quick_deduction or 0),
            0.0,
        )
        return round(annual_income_tax / 12, 2), []

    if fallback_rate_row is not None:
        fallback_tax = round(
            _apply_rate_limits(taxable_income, fallback_rate_row) * float(fallback_rate_row.employee_rate or 0) / 100,
            2,
        )
        return fallback_tax, ["income tax bracket master missing; legacy flat tax rate used"]

    return 0.0, ["income tax bracket master missing"]


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
    income_tax_brackets: list[PayIncomeTaxBracket],
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

    pension = round(pension_base * pension_rate / 100, 2)
    health = round(health_base * health_rate / 100, 2)
    if health > 0 and health_rate > 0 and long_term_care_rate > 0:
        long_term_care = round(health * (long_term_care_rate / health_rate), 2)
    else:
        long_term_care_base = _apply_rate_limits(taxable_income, long_term_care_row)
        long_term_care = round(long_term_care_base * long_term_care_rate / 100, 2)
    employment = round(employment_base * employment_rate / 100, 2)
    income_tax, income_tax_warnings = _calculate_income_tax(
        taxable_income=income_tax_base,
        bracket_rows=income_tax_brackets,
        fallback_rate_row=income_tax_row,
    )
    for warning in income_tax_warnings:
        if warning not in warnings:
            warnings.append(warning)
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
    snapshot_map: dict[int, dict[str, object]] | None = None,
) -> PayPayrollRunEmployeeItem:
    employee = employee_map.get(row.employee_id)
    snapshot = snapshot_map.get(row.employee_id, {}) if snapshot_map is not None else {}
    return PayPayrollRunEmployeeItem(
        id=row.id,
        run_id=row.run_id,
        employee_id=row.employee_id,
        employee_no=employee.employee_no if employee else (_snapshot_value(snapshot, "employee_no") if snapshot else None),
        employee_name=employee_name_map.get(row.employee_id) or (_snapshot_value(snapshot, "employee_name") if snapshot else None),
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
    run_targets = _ensure_payroll_targets(session, run=run, period_start=period_start, period_end=period_end)
    employee_ids = [target.employee_id for target in run_targets]
    employee_map, employee_name_map = _build_employee_maps(session, employee_ids)
    snapshot_map = {target.employee_id: target.snapshot_json for target in run_targets}

    target_event_rows = session.exec(
        select(PayPayrollRunTargetEvent)
        .where(PayPayrollRunTargetEvent.run_id == run_id)
        .order_by(PayPayrollRunTargetEvent.employee_id, PayPayrollRunTargetEvent.effective_date, PayPayrollRunTargetEvent.id)
    ).all()
    target_events_map: dict[int, list[PayPayrollRunTargetEvent]] = {}
    for row in target_event_rows:
        target_events_map.setdefault(row.employee_id, []).append(row)

    variable_rows = session.exec(
        select(PayVariableInput).where(
            PayVariableInput.year_month == run.year_month,
            PayVariableInput.employee_id.in_(employee_ids),
        )
    ).all() if employee_ids else []
    variable_map: dict[int, list[PayVariableInput]] = {}
    for row in variable_rows:
        variable_map.setdefault(row.employee_id, []).append(row)

    allowance_rows = session.exec(select(PayAllowanceDeduction)).all()
    allowance_map = {row.code: row for row in allowance_rows}
    welfare_map = _build_welfare_request_map(session, run=run, employee_map=employee_map)

    tax_rows = session.exec(select(PayTaxRate).where(PayTaxRate.year == period_start.year)).all()
    income_tax_brackets = session.exec(
        select(PayIncomeTaxBracket)
        .where(PayIncomeTaxBracket.year == period_start.year)
        .order_by(PayIncomeTaxBracket.annual_taxable_from)
    ).all()
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

    review_target_count = 0

    for target in run_targets:
        employee_id = target.employee_id
        snapshot = target.snapshot_json
        base_salary = float(_snapshot_value(snapshot, "base_salary", 0) or 0)
        gross_pay = base_salary
        taxable_income = base_salary
        non_taxable_income = 0.0
        deduction_amount = 0.0
        warning_messages: list[str] = []
        review_events = [
            event
            for event in target_events_map.get(employee_id, [])
            if event.decision_code == "review"
        ]
        if review_events:
            warning_messages.append(
                "payroll events: " + ", ".join(event.event_name for event in review_events)
            )
            review_target_count += 1

        run_employee = PayPayrollRunEmployee(
            run_id=run_id,
            employee_id=employee_id,
            profile_id=target.profile_id,
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
                amount=round(base_salary, 2),
                tax_type="taxable",
                calculation_type="fixed",
                source_type="snapshot",
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
            income_tax_brackets=income_tax_brackets,
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
            message=f"Payroll calculated for {total_employees} employees (review targets: {review_target_count}).",
            created_at=_utc_now(),
        )
    )

    session.commit()
    session.refresh(run)

    return _build_run_action_response(session, run)


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

    return _build_run_action_response(session, run)


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

    return _build_run_action_response(session, run)


def list_payroll_run_employees(session: Session, run_id: int) -> PayPayrollRunEmployeeListResponse:
    run = session.get(PayPayrollRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll run not found.")

    rows = session.exec(
        select(PayPayrollRunEmployee).where(PayPayrollRunEmployee.run_id == run_id).order_by(PayPayrollRunEmployee.employee_id)
    ).all()

    employee_ids = [row.employee_id for row in rows]
    employee_map, employee_name_map = _build_employee_maps(session, employee_ids)
    snapshot_map = _build_run_target_snapshot_map(session, run_id)

    items = [_to_run_employee_item(row, employee_map, employee_name_map, snapshot_map) for row in rows]
    return PayPayrollRunEmployeeListResponse(items=items, total_count=len(items))


def get_payroll_run_employee_detail(session: Session, run_id: int, run_employee_id: int) -> PayPayrollRunEmployeeDetailResponse:
    run = session.get(PayPayrollRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll run not found.")

    row = session.get(PayPayrollRunEmployee, run_employee_id)
    if row is None or row.run_id != run_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run employee not found.")

    employee_map, employee_name_map = _build_employee_maps(session, [row.employee_id])
    snapshot_map = _build_run_target_snapshot_map(session, run_id)
    employee_item = _to_run_employee_item(row, employee_map, employee_name_map, snapshot_map)

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
