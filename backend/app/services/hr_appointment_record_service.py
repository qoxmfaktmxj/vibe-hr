from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import aliased
from sqlmodel import Session, select

from app.models import (
    AppCode,
    AppCodeGroup,
    AuthUser,
    HrAppointmentOrder,
    HrAppointmentOrderItem,
    HrEmployee,
    HrPersonnelHistory,
    OrgDepartment,
)
from app.schemas.hr_appointment_record import (
    HrAppointmentOrderConfirmResponse,
    HrAppointmentRecordCreateRequest,
    HrAppointmentRecordItem,
    HrAppointmentRecordUpdateRequest,
)

APPOINTMENT_CODE_GROUP = "HR_APPOINTMENT_CODE"
VALID_ORDER_STATUSES = {"draft", "confirmed", "cancelled"}
VALID_APPOINTMENT_KINDS = {"permanent", "temporary"}
VALID_EMPLOYMENT_STATUSES = {"active", "leave", "resigned"}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _appointment_group_id(session: Session) -> int | None:
    row = session.exec(select(AppCodeGroup.id).where(AppCodeGroup.code == APPOINTMENT_CODE_GROUP)).first()
    return row


def _validate_appointment_code_id(session: Session, code_id: int | None) -> int | None:
    if code_id is None:
        return None

    group_id = _appointment_group_id(session)
    if group_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Appointment code group not found.")

    exists = session.exec(
        select(AppCode.id).where(AppCode.id == code_id, AppCode.group_id == group_id),
    ).first()
    if exists is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid appointment code.")
    return code_id


def _validate_kind(kind: str) -> str:
    normalized = kind.strip().lower()
    if normalized not in VALID_APPOINTMENT_KINDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid appointment kind.")
    return normalized


def _validate_employment_status(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized not in VALID_EMPLOYMENT_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid employment status.")
    return normalized


def _ensure_end_date_rule(kind: str, end_date) -> None:
    if kind == "temporary" and end_date is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Temporary appointment requires end_date.",
        )


def _ensure_date_range(start_date, end_date) -> None:
    if end_date is not None and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before or equal to end_date.",
        )


def _ensure_order_editable(order: HrAppointmentOrder) -> None:
    if order.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft appointment orders can be modified.",
        )


def _next_appointment_no(session: Session) -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"APT-{today}-"
    rows = session.exec(
        select(HrAppointmentOrder.appointment_no)
        .where(HrAppointmentOrder.appointment_no.like(f"{prefix}%"))
        .order_by(HrAppointmentOrder.appointment_no.desc()),
    ).all()

    max_seq = 0
    for appointment_no in rows:
        if not appointment_no:
            continue
        suffix = appointment_no.replace(prefix, "", 1)
        if suffix.isdigit():
            max_seq = max(max_seq, int(suffix))
    return f"{prefix}{max_seq + 1:04d}"


def _ensure_appointment_no_unique(session: Session, appointment_no: str, exclude_order_id: int | None = None) -> None:
    stmt = select(HrAppointmentOrder.id).where(HrAppointmentOrder.appointment_no == appointment_no)
    if exclude_order_id is not None:
        stmt = stmt.where(HrAppointmentOrder.id != exclude_order_id)
    exists = session.exec(stmt).first()
    if exists is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Appointment number already exists.",
        )


def _employee_context_or_404(session: Session, employee_id: int):
    row = session.exec(
        select(HrEmployee, AuthUser, OrgDepartment)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrEmployee.id == employee_id),
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
    return row


def _record_query_base():
    item_code = aliased(AppCode)
    order_code = aliased(AppCode)
    stmt = (
        select(
            HrAppointmentOrderItem,
            HrAppointmentOrder,
            HrEmployee,
            AuthUser,
            OrgDepartment,
            item_code,
            order_code,
        )
        .join(HrAppointmentOrder, HrAppointmentOrder.id == HrAppointmentOrderItem.order_id)
        .join(HrEmployee, HrEmployee.id == HrAppointmentOrderItem.employee_id)
        .join(AuthUser, AuthUser.id == HrEmployee.user_id)
        .join(OrgDepartment, OrgDepartment.id == HrEmployee.department_id)
        .outerjoin(item_code, item_code.id == HrAppointmentOrderItem.appointment_code_id)
        .outerjoin(order_code, order_code.id == HrAppointmentOrder.appointment_code_id)
    )
    return stmt, item_code, order_code


def _to_record_item(
    row: tuple[
        HrAppointmentOrderItem,
        HrAppointmentOrder,
        HrEmployee,
        AuthUser,
        OrgDepartment,
        AppCode | None,
        AppCode | None,
    ],
) -> HrAppointmentRecordItem:
    item, order, employee, user, department, item_code, order_code = row
    return HrAppointmentRecordItem(
        id=item.id or 0,
        order_id=order.id or 0,
        appointment_no=order.appointment_no,
        order_title=order.title,
        order_description=order.description,
        effective_date=order.effective_date,
        order_status=order.status,
        confirmed_at=order.confirmed_at,
        confirmed_by=order.confirmed_by,
        employee_id=employee.id or 0,
        employee_no=employee.employee_no,
        display_name=user.display_name,
        department_name=department.name,
        employment_status=employee.employment_status,
        appointment_code_id=item.appointment_code_id or order.appointment_code_id,
        appointment_code_name=(item_code.name if item_code else (order_code.name if order_code else None)),
        appointment_kind=item.appointment_kind,
        action_type=item.action_type,
        start_date=item.start_date,
        end_date=item.end_date,
        from_department_id=item.from_department_id,
        to_department_id=item.to_department_id,
        from_position_title=item.from_position_title,
        to_position_title=item.to_position_title,
        from_employment_status=item.from_employment_status,
        to_employment_status=item.to_employment_status,
        apply_status=item.apply_status,
        applied_at=item.applied_at,
        temporary_reason=item.temporary_reason,
        note=item.note,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _record_by_item_id_or_404(session: Session, item_id: int) -> HrAppointmentRecordItem:
    stmt, _, _ = _record_query_base()
    row = session.exec(stmt.where(HrAppointmentOrderItem.id == item_id)).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment record not found.")
    return _to_record_item(row)


def list_appointment_records(
    session: Session,
    *,
    employee_no: str | None = None,
    name: str | None = None,
    department: str | None = None,
    order_status: str | None = None,
    appointment_kind: str | None = None,
    appointment_no: str | None = None,
) -> list[HrAppointmentRecordItem]:
    stmt, _, _ = _record_query_base()

    if employee_no:
        stmt = stmt.where(HrEmployee.employee_no.ilike(f"%{employee_no.strip()}%"))
    if name:
        stmt = stmt.where(AuthUser.display_name.ilike(f"%{name.strip()}%"))
    if department:
        stmt = stmt.where(OrgDepartment.name.ilike(f"%{department.strip()}%"))
    if order_status:
        normalized = order_status.strip().lower()
        if normalized not in VALID_ORDER_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid order status.")
        stmt = stmt.where(HrAppointmentOrder.status == normalized)
    if appointment_kind:
        normalized = _validate_kind(appointment_kind)
        stmt = stmt.where(HrAppointmentOrderItem.appointment_kind == normalized)
    if appointment_no:
        stmt = stmt.where(HrAppointmentOrder.appointment_no.ilike(f"%{appointment_no.strip()}%"))

    rows = session.exec(
        stmt.order_by(
            HrAppointmentOrder.effective_date.desc(),
            HrAppointmentOrder.id.desc(),
            HrAppointmentOrderItem.id.desc(),
        ),
    ).all()
    return [_to_record_item(row) for row in rows]


def create_appointment_record(
    session: Session,
    payload: HrAppointmentRecordCreateRequest,
    user_id: int,
) -> HrAppointmentRecordItem:
    kind = _validate_kind(payload.appointment_kind)
    _ensure_end_date_rule(kind, payload.end_date)
    _ensure_date_range(payload.start_date, payload.end_date)

    to_employment_status = _validate_employment_status(payload.to_employment_status)
    order_code_id = _validate_appointment_code_id(session, payload.order_appointment_code_id)
    item_code_id = _validate_appointment_code_id(session, payload.item_appointment_code_id)
    employee, _, _ = _employee_context_or_404(session, payload.employee_id)

    appointment_no = _normalize_text(payload.appointment_no) or _next_appointment_no(session)
    _ensure_appointment_no_unique(session, appointment_no)

    order = HrAppointmentOrder(
        appointment_no=appointment_no,
        appointment_code_id=order_code_id,
        title=payload.order_title.strip(),
        description=_normalize_text(payload.order_description),
        effective_date=payload.effective_date,
        status="draft",
        confirmed_at=None,
        confirmed_by=None,
        created_by=user_id,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(order)
    session.flush()

    item = HrAppointmentOrderItem(
        order_id=order.id or 0,
        employee_id=employee.id or 0,
        appointment_code_id=item_code_id,
        appointment_kind=kind,
        action_type=payload.action_type.strip(),
        start_date=payload.start_date,
        end_date=payload.end_date,
        from_department_id=employee.department_id,
        to_department_id=payload.to_department_id,
        from_position_title=employee.position_title,
        to_position_title=_normalize_text(payload.to_position_title),
        from_employment_status=employee.employment_status,
        to_employment_status=to_employment_status,
        apply_status="pending",
        applied_at=None,
        temporary_reason=_normalize_text(payload.temporary_reason),
        note=_normalize_text(payload.note),
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(item)
    session.commit()
    return _record_by_item_id_or_404(session, item.id or 0)


def update_appointment_record(
    session: Session,
    item_id: int,
    payload: HrAppointmentRecordUpdateRequest,
) -> HrAppointmentRecordItem:
    item = session.get(HrAppointmentOrderItem, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment record not found.")

    order = session.get(HrAppointmentOrder, item.order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment order not found.")

    _ensure_order_editable(order)

    employee = session.get(HrEmployee, item.employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")

    if payload.employee_id is not None and payload.employee_id != item.employee_id:
        employee, _, _ = _employee_context_or_404(session, payload.employee_id)
        item.employee_id = employee.id or 0
        item.from_department_id = employee.department_id
        item.from_position_title = employee.position_title
        item.from_employment_status = employee.employment_status

    if payload.appointment_no is not None:
        appointment_no = _normalize_text(payload.appointment_no) or _next_appointment_no(session)
        _ensure_appointment_no_unique(session, appointment_no, exclude_order_id=order.id)
        order.appointment_no = appointment_no
    if payload.order_title is not None:
        order.title = payload.order_title.strip()
    if payload.order_description is not None:
        order.description = _normalize_text(payload.order_description)
    if payload.effective_date is not None:
        order.effective_date = payload.effective_date
    if payload.order_appointment_code_id is not None:
        order.appointment_code_id = _validate_appointment_code_id(session, payload.order_appointment_code_id)

    if payload.item_appointment_code_id is not None:
        item.appointment_code_id = _validate_appointment_code_id(session, payload.item_appointment_code_id)
    if payload.appointment_kind is not None:
        item.appointment_kind = _validate_kind(payload.appointment_kind)
    if payload.action_type is not None:
        item.action_type = payload.action_type.strip()
    if payload.start_date is not None:
        item.start_date = payload.start_date
    if payload.end_date is not None:
        item.end_date = payload.end_date
    if payload.to_department_id is not None:
        item.to_department_id = payload.to_department_id
    if payload.to_position_title is not None:
        item.to_position_title = _normalize_text(payload.to_position_title)
    if payload.to_employment_status is not None:
        item.to_employment_status = _validate_employment_status(payload.to_employment_status)
    if payload.temporary_reason is not None:
        item.temporary_reason = _normalize_text(payload.temporary_reason)
    if payload.note is not None:
        item.note = _normalize_text(payload.note)

    _ensure_end_date_rule(item.appointment_kind, item.end_date)
    _ensure_date_range(item.start_date, item.end_date)

    order.updated_at = _utc_now()
    item.updated_at = _utc_now()
    session.add(order)
    session.add(item)
    session.commit()

    return _record_by_item_id_or_404(session, item_id)


def delete_appointment_record(session: Session, item_id: int) -> None:
    item = session.get(HrAppointmentOrderItem, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment record not found.")

    order = session.get(HrAppointmentOrder, item.order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment order not found.")
    _ensure_order_editable(order)

    order_id = order.id or 0
    session.delete(item)
    session.flush()

    remaining = session.exec(
        select(HrAppointmentOrderItem.id).where(HrAppointmentOrderItem.order_id == order_id),
    ).first()
    if remaining is None:
        session.delete(order)

    session.commit()


def confirm_appointment_order(
    session: Session,
    order_id: int,
    user_id: int,
) -> HrAppointmentOrderConfirmResponse:
    order = session.get(HrAppointmentOrder, order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment order not found.")
    if order.status != "draft":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only draft order can be confirmed.")

    items = session.exec(
        select(HrAppointmentOrderItem)
        .where(HrAppointmentOrderItem.order_id == order_id)
        .order_by(HrAppointmentOrderItem.id.asc()),
    ).all()
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No appointment items to confirm.")

    now = _utc_now()
    applied_count = 0

    for item in items:
        if item.apply_status == "cancelled":
            continue

        employee = session.get(HrEmployee, item.employee_id)
        if employee is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")

        changes: list[tuple[str, str | None, str | None]] = []

        if item.to_department_id is not None and item.to_department_id != employee.department_id:
            before = str(employee.department_id)
            after = str(item.to_department_id)
            employee.department_id = item.to_department_id
            changes.append(("department_id", before, after))

        if item.to_position_title is not None and item.to_position_title != employee.position_title:
            before = employee.position_title
            after = item.to_position_title
            employee.position_title = item.to_position_title
            changes.append(("position_title", before, after))

        if item.to_employment_status is not None and item.to_employment_status != employee.employment_status:
            before = employee.employment_status
            after = item.to_employment_status
            employee.employment_status = item.to_employment_status
            changes.append(("employment_status", before, after))

        if changes:
            employee.updated_at = now
            session.add(employee)

        for field_name, before_value, after_value in changes:
            session.add(
                HrPersonnelHistory(
                    employee_id=employee.id or 0,
                    history_type=item.action_type,
                    source_table="hr_appointment_order_items",
                    source_id=item.id or 0,
                    appointment_order_id=order.id,
                    effective_date=item.start_date,
                    field_name=field_name,
                    before_value=before_value,
                    after_value=after_value,
                    description=f"{order.appointment_no} {item.action_type}",
                    created_by=user_id,
                    created_at=now,
                )
            )

        if not changes:
            session.add(
                HrPersonnelHistory(
                    employee_id=employee.id or 0,
                    history_type=item.action_type,
                    source_table="hr_appointment_order_items",
                    source_id=item.id or 0,
                    appointment_order_id=order.id,
                    effective_date=item.start_date,
                    field_name=None,
                    before_value=None,
                    after_value=None,
                    description=f"{order.appointment_no} {item.action_type}",
                    created_by=user_id,
                    created_at=now,
                )
            )

        item.apply_status = "applied"
        item.applied_at = now
        item.updated_at = now
        session.add(item)
        applied_count += 1

    order.status = "confirmed"
    order.confirmed_at = now
    order.confirmed_by = user_id
    order.updated_at = now
    session.add(order)
    session.commit()

    return HrAppointmentOrderConfirmResponse(
        order_id=order.id or 0,
        status=order.status,
        confirmed_at=order.confirmed_at or now,
        confirmed_by=order.confirmed_by,
        applied_count=applied_count,
    )
