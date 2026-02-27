from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import (
    AuthUser,
    HrEmployee,
    HrEmployeeBasicProfile,
    HrEmployeeInfoRecord,
    HrPersonnelHistory,
    HrRetireAuditLog,
    HrRetireCase,
    HrRetireCaseItem,
    HrRetireChecklistItem,
    OrgDepartment,
)
from app.schemas.hr_retire import (
    HrRetireCaseCancelRequest,
    HrRetireCaseChecklistItemResponse,
    HrRetireCaseChecklistUpdateRequest,
    HrRetireCaseCreateRequest,
    HrRetireCaseDetailResponse,
    HrRetireCaseListItem,
    HrRetireCaseListResponse,
    HrRetireChecklistCreateRequest,
    HrRetireChecklistItemResponse,
    HrRetireChecklistUpdateRequest,
    HrRetireAuditLogItemResponse,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_checklist_item(item: HrRetireChecklistItem) -> HrRetireChecklistItemResponse:
    return HrRetireChecklistItemResponse(
        id=item.id,
        code=item.code,
        title=item.title,
        description=item.description,
        is_required=item.is_required,
        is_active=item.is_active,
        sort_order=item.sort_order,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def list_retire_checklist_items(
    session: Session,
    *,
    include_inactive: bool = False,
) -> list[HrRetireChecklistItemResponse]:
    stmt = select(HrRetireChecklistItem)
    if not include_inactive:
        stmt = stmt.where(HrRetireChecklistItem.is_active == True)
    rows = session.exec(stmt.order_by(HrRetireChecklistItem.sort_order.asc(), HrRetireChecklistItem.id.asc())).all()
    return [_as_checklist_item(row) for row in rows]


def create_retire_checklist_item(
    session: Session,
    payload: HrRetireChecklistCreateRequest,
) -> HrRetireChecklistItemResponse:
    code = payload.code.strip().lower()
    title = payload.title.strip()
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Checklist code is required.")
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Checklist title is required.")

    exists = session.exec(select(HrRetireChecklistItem).where(HrRetireChecklistItem.code == code)).first()
    if exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Checklist code already exists.")

    now = _utc_now()
    row = HrRetireChecklistItem(
        code=code,
        title=title,
        description=payload.description,
        is_required=payload.is_required,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
        created_at=now,
        updated_at=now,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _as_checklist_item(row)


def update_retire_checklist_item(
    session: Session,
    checklist_item_id: int,
    payload: HrRetireChecklistUpdateRequest,
) -> HrRetireChecklistItemResponse:
    row = session.get(HrRetireChecklistItem, checklist_item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist item not found.")

    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Checklist title is required.")
        row.title = title
    if payload.description is not None:
        row.description = payload.description
    if payload.is_required is not None:
        row.is_required = payload.is_required
    if payload.is_active is not None:
        row.is_active = payload.is_active
    if payload.sort_order is not None:
        row.sort_order = payload.sort_order
    row.updated_at = _utc_now()

    session.add(row)
    session.commit()
    session.refresh(row)
    return _as_checklist_item(row)


def _get_case_or_404(session: Session, case_id: int) -> HrRetireCase:
    case = session.get(HrRetireCase, case_id)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retire case not found.")
    return case


def _get_employee_or_404(session: Session, employee_id: int) -> HrEmployee:
    employee = session.get(HrEmployee, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
    return employee


def _write_audit_log(
    session: Session,
    *,
    case_id: int,
    action_type: str,
    actor_user_id: int | None,
    detail: str | None = None,
) -> None:
    session.add(
        HrRetireAuditLog(
            case_id=case_id,
            action_type=action_type,
            actor_user_id=actor_user_id,
            detail=detail,
            created_at=_utc_now(),
        ),
    )


def list_retire_cases(
    session: Session,
    *,
    status_filter: str | None = None,
) -> HrRetireCaseListResponse:
    stmt = (
        select(HrRetireCase, HrEmployee, AuthUser, OrgDepartment)
        .join(HrEmployee, HrRetireCase.employee_id == HrEmployee.id)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
    )
    if status_filter:
        stmt = stmt.where(HrRetireCase.status == status_filter)

    rows = session.exec(stmt.order_by(HrRetireCase.created_at.desc(), HrRetireCase.id.desc())).all()

    return HrRetireCaseListResponse(
        items=[
            HrRetireCaseListItem(
                id=retire_case.id,
                employee_id=employee.id,
                employee_no=employee.employee_no,
                employee_name=user.display_name,
                department_name=department.name,
                position_title=employee.position_title,
                retire_date=retire_case.retire_date,
                reason=retire_case.reason,
                status=retire_case.status,
                created_at=retire_case.created_at,
                confirmed_at=retire_case.confirmed_at,
                cancelled_at=retire_case.cancelled_at,
            )
            for retire_case, employee, user, department in rows
        ]
    )


def create_retire_case(
    session: Session,
    payload: HrRetireCaseCreateRequest,
    *,
    actor_user_id: int,
) -> HrRetireCaseDetailResponse:
    employee = _get_employee_or_404(session, payload.employee_id)
    if employee.employment_status == "resigned":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Employee is already resigned.")

    active_checklist_items = session.exec(
        select(HrRetireChecklistItem)
        .where(HrRetireChecklistItem.is_active == True)
        .order_by(HrRetireChecklistItem.sort_order.asc(), HrRetireChecklistItem.id.asc())
    ).all()
    if not active_checklist_items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active retire checklist items.")

    now = _utc_now()
    retire_case = HrRetireCase(
        employee_id=payload.employee_id,
        retire_date=payload.retire_date,
        reason=payload.reason,
        status="draft",
        requested_by=actor_user_id,
        created_at=now,
        updated_at=now,
    )
    session.add(retire_case)
    session.flush()

    for checklist in active_checklist_items:
        session.add(
            HrRetireCaseItem(
                case_id=retire_case.id,
                checklist_item_id=checklist.id,
                is_required=checklist.is_required,
                is_checked=False,
                created_at=now,
                updated_at=now,
            ),
        )

    _write_audit_log(
        session,
        case_id=retire_case.id,
        action_type="create",
        actor_user_id=actor_user_id,
        detail=f"retire_date={payload.retire_date.isoformat()}",
    )
    session.commit()
    return get_retire_case_detail(session, retire_case.id)


def get_retire_case_detail(session: Session, case_id: int) -> HrRetireCaseDetailResponse:
    retire_case = _get_case_or_404(session, case_id)

    joined = session.exec(
        select(HrRetireCase, HrEmployee, AuthUser, OrgDepartment)
        .join(HrEmployee, HrRetireCase.employee_id == HrEmployee.id)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrRetireCase.id == case_id)
    ).first()
    if joined is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retire case not found.")
    _, employee, user, department = joined

    case_items_rows = session.exec(
        select(HrRetireCaseItem, HrRetireChecklistItem)
        .join(HrRetireChecklistItem, HrRetireCaseItem.checklist_item_id == HrRetireChecklistItem.id)
        .where(HrRetireCaseItem.case_id == case_id)
        .order_by(HrRetireChecklistItem.sort_order.asc(), HrRetireCaseItem.id.asc())
    ).all()

    logs = session.exec(
        select(HrRetireAuditLog)
        .where(HrRetireAuditLog.case_id == case_id)
        .order_by(HrRetireAuditLog.created_at.desc(), HrRetireAuditLog.id.desc())
    ).all()

    return HrRetireCaseDetailResponse(
        id=retire_case.id,
        employee_id=employee.id,
        employee_no=employee.employee_no,
        employee_name=user.display_name,
        department_name=department.name,
        position_title=employee.position_title,
        retire_date=retire_case.retire_date,
        reason=retire_case.reason,
        status=retire_case.status,
        previous_employment_status=retire_case.previous_employment_status,
        requested_by=retire_case.requested_by,
        confirmed_by=retire_case.confirmed_by,
        confirmed_at=retire_case.confirmed_at,
        cancelled_by=retire_case.cancelled_by,
        cancelled_at=retire_case.cancelled_at,
        cancel_reason=retire_case.cancel_reason,
        created_at=retire_case.created_at,
        updated_at=retire_case.updated_at,
        checklist_items=[
            HrRetireCaseChecklistItemResponse(
                id=case_item.id,
                checklist_item_id=checklist.id,
                checklist_code=checklist.code,
                checklist_title=checklist.title,
                checklist_description=checklist.description,
                is_required=case_item.is_required,
                is_checked=case_item.is_checked,
                checked_by=case_item.checked_by,
                checked_at=case_item.checked_at,
                note=case_item.note,
            )
            for case_item, checklist in case_items_rows
        ],
        audit_logs=[
            HrRetireAuditLogItemResponse(
                id=log.id,
                action_type=log.action_type,
                actor_user_id=log.actor_user_id,
                detail=log.detail,
                created_at=log.created_at,
            )
            for log in logs
        ],
    )


def update_retire_case_check_item(
    session: Session,
    *,
    case_id: int,
    case_item_id: int,
    payload: HrRetireCaseChecklistUpdateRequest,
    actor_user_id: int,
) -> HrRetireCaseDetailResponse:
    retire_case = _get_case_or_404(session, case_id)
    if retire_case.status != "draft":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only draft cases can be edited.")

    case_item = session.get(HrRetireCaseItem, case_item_id)
    if case_item is None or case_item.case_id != case_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case checklist item not found.")

    now = _utc_now()
    case_item.is_checked = payload.is_checked
    case_item.note = payload.note
    case_item.checked_by = actor_user_id if payload.is_checked else None
    case_item.checked_at = now if payload.is_checked else None
    case_item.updated_at = now
    retire_case.updated_at = now

    session.add(case_item)
    session.add(retire_case)
    _write_audit_log(
        session,
        case_id=case_id,
        action_type="check" if payload.is_checked else "uncheck",
        actor_user_id=actor_user_id,
        detail=f"case_item_id={case_item_id}",
    )
    session.commit()
    return get_retire_case_detail(session, case_id)


def confirm_retire_case(
    session: Session,
    *,
    case_id: int,
    actor_user_id: int,
) -> HrRetireCaseDetailResponse:
    retire_case = _get_case_or_404(session, case_id)
    if retire_case.status != "draft":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only draft cases can be confirmed.")

    unchecked_required = session.exec(
        select(HrRetireCaseItem.id)
        .where(
            HrRetireCaseItem.case_id == case_id,
            HrRetireCaseItem.is_required == True,
            HrRetireCaseItem.is_checked == False,
        )
    ).all()
    if unchecked_required:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Required checklist items are not completed.",
        )

    employee = _get_employee_or_404(session, retire_case.employee_id)
    now = _utc_now()

    retire_case.previous_employment_status = employee.employment_status
    retire_case.status = "confirmed"
    retire_case.confirmed_by = actor_user_id
    retire_case.confirmed_at = now
    retire_case.updated_at = now

    before_status = employee.employment_status
    employee.employment_status = "resigned"
    employee.updated_at = now

    profile = session.exec(
        select(HrEmployeeBasicProfile).where(HrEmployeeBasicProfile.employee_id == employee.id)
    ).first()
    if profile is None:
        profile = HrEmployeeBasicProfile(employee_id=employee.id, retire_date=retire_case.retire_date)
    else:
        profile.retire_date = retire_case.retire_date
        profile.updated_at = now

    session.add(retire_case)
    session.add(employee)
    session.add(profile)

    session.add(
        HrEmployeeInfoRecord(
            employee_id=employee.id,
            category="appointment",
            record_date=retire_case.retire_date,
            title="퇴직처리",
            type="retire",
            value=retire_case.reason,
            note=f"퇴직처리 확정(case_id={retire_case.id})",
            created_at=now,
        )
    )
    session.add(
        HrPersonnelHistory(
            employee_id=employee.id,
            history_type="retire",
            source_table="hr_retire_cases",
            source_id=retire_case.id,
            effective_date=retire_case.retire_date,
            field_name="employment_status",
            before_value=before_status,
            after_value="resigned",
            description="Retire case confirmed.",
            created_by=actor_user_id,
            created_at=now,
        )
    )
    _write_audit_log(
        session,
        case_id=case_id,
        action_type="confirm",
        actor_user_id=actor_user_id,
        detail=f"employment_status:{before_status}->resigned",
    )
    session.commit()
    return get_retire_case_detail(session, case_id)


def cancel_retire_case(
    session: Session,
    *,
    case_id: int,
    payload: HrRetireCaseCancelRequest,
    actor_user_id: int,
) -> HrRetireCaseDetailResponse:
    retire_case = _get_case_or_404(session, case_id)
    if retire_case.status != "confirmed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only confirmed cases can be cancelled.")

    employee = _get_employee_or_404(session, retire_case.employee_id)
    now = _utc_now()
    restore_status = retire_case.previous_employment_status or "active"
    before_status = employee.employment_status

    retire_case.status = "cancelled"
    retire_case.cancelled_by = actor_user_id
    retire_case.cancelled_at = now
    retire_case.cancel_reason = payload.cancel_reason
    retire_case.updated_at = now

    employee.employment_status = restore_status
    employee.updated_at = now

    profile = session.exec(
        select(HrEmployeeBasicProfile).where(HrEmployeeBasicProfile.employee_id == employee.id)
    ).first()
    if profile is not None:
        profile.retire_date = None
        profile.updated_at = now
        session.add(profile)

    session.add(retire_case)
    session.add(employee)
    session.add(
        HrEmployeeInfoRecord(
            employee_id=employee.id,
            category="appointment",
            record_date=retire_case.retire_date,
            title="퇴직처리 취소",
            type="retire_cancel",
            value=payload.cancel_reason,
            note=f"퇴직처리 취소(case_id={retire_case.id})",
            created_at=now,
        )
    )
    session.add(
        HrPersonnelHistory(
            employee_id=employee.id,
            history_type="retire_cancel",
            source_table="hr_retire_cases",
            source_id=retire_case.id,
            effective_date=retire_case.retire_date,
            field_name="employment_status",
            before_value=before_status,
            after_value=restore_status,
            description="Retire case cancelled.",
            created_by=actor_user_id,
            created_at=now,
        )
    )
    _write_audit_log(
        session,
        case_id=case_id,
        action_type="cancel",
        actor_user_id=actor_user_id,
        detail=f"employment_status:{before_status}->{restore_status}",
    )
    session.commit()
    return get_retire_case_detail(session, case_id)

