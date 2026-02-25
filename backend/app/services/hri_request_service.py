from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlmodel import Session, select

from app.models import (
    AuthRole,
    AuthUser,
    AuthUserRole,
    HrEmployee,
    HriApprovalLineStep,
    HriApprovalLineTemplate,
    HriFormType,
    HriFormTypeApprovalMap,
    HriRequestCounter,
    HriRequestHistory,
    HriRequestMaster,
    HriRequestStepSnapshot,
)
from app.schemas.hri_request import (
    HriRequestActionResponse,
    HriRequestDraftUpsertRequest,
    HriRequestItem,
    HriRequestSubmitResponse,
    HriTaskItem,
)

EDITABLE_REQUEST_STATUSES = {"DRAFT", "APPROVAL_REJECTED", "RECEIVE_REJECTED"}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_content(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    if isinstance(parsed, dict):
        return parsed
    return {}


def _serialize_content(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _resolve_requester_org_id(session: Session, user_id: int) -> int | None:
    department_id = session.exec(
        select(HrEmployee.department_id).where(HrEmployee.user_id == user_id)
    ).first()
    if department_id is None:
        return None
    return int(department_id)


def _resolve_admin_fallback_user_id(session: Session) -> int:
    admin_user_id = session.exec(
        select(AuthUserRole.user_id)
        .join(AuthRole, AuthRole.id == AuthUserRole.role_id)
        .where(AuthRole.code == "admin")
        .order_by(AuthUserRole.user_id)
    ).first()
    if admin_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No admin user is available for fallback.",
        )
    return int(admin_user_id)


def _resolve_role_actor_user_id(session: Session, requester_user_id: int, role_code: str) -> int:
    fallback_user_id = _resolve_admin_fallback_user_id(session)
    requester_emp = session.exec(
        select(HrEmployee).where(HrEmployee.user_id == requester_user_id)
    ).first()
    if requester_emp is None:
        return fallback_user_id

    if role_code == "TEAM_LEADER":
        team_leader = session.exec(
            select(HrEmployee)
            .where(
                HrEmployee.department_id == requester_emp.department_id,
                HrEmployee.employment_status == "active",
                HrEmployee.position_title.contains("팀장"),
            )
            .order_by(HrEmployee.id)
        ).first()
        if team_leader is not None:
            return team_leader.user_id

    if role_code == "DEPT_HEAD":
        dept_head = session.exec(
            select(HrEmployee)
            .where(
                HrEmployee.department_id == requester_emp.department_id,
                HrEmployee.employment_status == "active",
                or_(
                    HrEmployee.position_title.contains("부서장"),
                    HrEmployee.position_title.contains("본부장"),
                    HrEmployee.position_title.contains("실장"),
                ),
            )
            .order_by(HrEmployee.id)
        ).first()
        if dept_head is not None:
            return dept_head.user_id

    if role_code == "CEO":
        ceo = session.exec(
            select(HrEmployee)
            .where(
                HrEmployee.employment_status == "active",
                or_(
                    HrEmployee.position_title.contains("대표"),
                    HrEmployee.position_title.ilike("%CEO%"),
                    HrEmployee.position_title.contains("사장"),
                ),
            )
            .order_by(HrEmployee.id)
        ).first()
        if ceo is not None:
            return ceo.user_id

    return fallback_user_id


def _record_history(
    session: Session,
    request_id: int,
    actor_user_id: int,
    event_type: str,
    from_status: str | None,
    to_status: str | None,
    payload: dict[str, Any] | None = None,
) -> None:
    history = HriRequestHistory(
        request_id=request_id,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        actor_user_id=actor_user_id,
        event_payload_json=_serialize_content(payload or {}),
        created_at=_utc_now(),
    )
    session.add(history)


def _build_request_item(session: Session, row: HriRequestMaster) -> HriRequestItem:
    form_type = session.get(HriFormType, row.form_type_id)
    current_actor_name: str | None = None
    if row.current_step_order is not None:
        current_step = session.exec(
            select(HriRequestStepSnapshot).where(
                HriRequestStepSnapshot.request_id == row.id,
                HriRequestStepSnapshot.step_order == row.current_step_order,
            )
        ).first()
        if current_step is not None:
            current_actor_name = current_step.actor_name

    return HriRequestItem(
        id=row.id,
        request_no=row.request_no,
        form_type_id=row.form_type_id,
        form_name=form_type.form_name_ko if form_type else None,
        requester_id=row.requester_id,
        title=row.title,
        status_code=row.status_code,
        current_step_order=row.current_step_order,
        current_actor_name=current_actor_name,
        submitted_at=row.submitted_at,
        completed_at=row.completed_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
        content_json=_parse_content(row.content_json),
    )


def _next_request_no(session: Session, form_type: HriFormType) -> str:
    now = _utc_now()
    counter_key = f"{now:%Y%m}:{form_type.form_code.upper()}"
    counter = session.get(HriRequestCounter, counter_key)
    if counter is None:
        counter = HriRequestCounter(counter_key=counter_key, last_seq=1, updated_at=now)
    else:
        counter.last_seq += 1
        counter.updated_at = now
    session.add(counter)
    session.flush()
    return f"HRI-{now:%Y%m}-{counter.last_seq:06d}"


def _select_approval_template(session: Session, form_type_id: int) -> HriApprovalLineTemplate:
    today = date.today()
    mapped_rows = session.exec(
        select(HriFormTypeApprovalMap)
        .where(
            HriFormTypeApprovalMap.form_type_id == form_type_id,
            HriFormTypeApprovalMap.is_active == True,
            HriFormTypeApprovalMap.effective_from <= today,
            or_(
                HriFormTypeApprovalMap.effective_to == None,  # noqa: E711
                HriFormTypeApprovalMap.effective_to >= today,
            ),
        )
        .order_by(HriFormTypeApprovalMap.effective_from.desc(), HriFormTypeApprovalMap.id.desc())
    ).all()

    candidates: list[HriApprovalLineTemplate] = []
    for mapping in mapped_rows:
        template = session.get(HriApprovalLineTemplate, mapping.template_id)
        if template is not None and template.is_active:
            candidates.append(template)

    if candidates:
        candidates.sort(key=lambda x: (x.priority, x.id), reverse=True)
        return candidates[0]

    fallback = session.exec(
        select(HriApprovalLineTemplate)
        .where(HriApprovalLineTemplate.is_active == True, HriApprovalLineTemplate.is_default == True)
        .order_by(HriApprovalLineTemplate.priority.desc(), HriApprovalLineTemplate.id.desc())
    ).first()
    if fallback is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active approval template is available for this form type.",
        )
    return fallback


def _reset_snapshot(session: Session, request_id: int) -> None:
    rows = session.exec(
        select(HriRequestStepSnapshot).where(HriRequestStepSnapshot.request_id == request_id)
    ).all()
    for row in rows:
        session.delete(row)


def _create_snapshot_from_template(
    session: Session,
    request_id: int,
    requester_user_id: int,
    template_id: int,
) -> HriRequestStepSnapshot | None:
    template_steps = session.exec(
        select(HriApprovalLineStep)
        .where(HriApprovalLineStep.template_id == template_id)
        .order_by(HriApprovalLineStep.step_order, HriApprovalLineStep.id)
    ).all()
    if not template_steps:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected approval template has no steps.",
        )

    for template_step in template_steps:
        actor_user_id = template_step.actor_user_id
        if template_step.actor_resolve_type == "ROLE_BASED":
            role_code = template_step.actor_role_code or "TEAM_LEADER"
            actor_user_id = _resolve_role_actor_user_id(session, requester_user_id, role_code)
        if actor_user_id is None:
            actor_user_id = _resolve_admin_fallback_user_id(session)

        actor_user = session.get(AuthUser, actor_user_id)
        actor_name = actor_user.display_name if actor_user else f"USER-{actor_user_id}"
        actor_org_id = _resolve_requester_org_id(session, actor_user_id)

        action_status = "RECEIVED" if template_step.step_type == "REFERENCE" else "WAITING"
        acted_at = _utc_now() if action_status == "RECEIVED" else None
        comment = "AUTO_REFERENCE" if action_status == "RECEIVED" else None
        snapshot = HriRequestStepSnapshot(
            request_id=request_id,
            step_order=template_step.step_order,
            step_type=template_step.step_type,
            actor_user_id=actor_user_id,
            actor_name=actor_name,
            actor_org_id=actor_org_id,
            actor_role_code=template_step.actor_role_code,
            action_status=action_status,
            acted_at=acted_at,
            comment=comment,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(snapshot)

    session.flush()
    first_waiting = session.exec(
        select(HriRequestStepSnapshot)
        .where(
            HriRequestStepSnapshot.request_id == request_id,
            HriRequestStepSnapshot.action_status == "WAITING",
        )
        .order_by(HriRequestStepSnapshot.step_order, HriRequestStepSnapshot.id)
    ).first()
    return first_waiting


def upsert_request_draft(
    session: Session,
    requester_user_id: int,
    payload: HriRequestDraftUpsertRequest,
) -> HriRequestItem:
    form_type = session.get(HriFormType, payload.form_type_id)
    if form_type is None or not form_type.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form type not found.")

    now = _utc_now()
    if payload.request_id is None:
        row = HriRequestMaster(
            request_no=_next_request_no(session, form_type),
            form_type_id=form_type.id,
            requester_id=requester_user_id,
            requester_org_id=_resolve_requester_org_id(session, requester_user_id),
            title=payload.title.strip(),
            content_json=_serialize_content(payload.content_json),
            status_code="DRAFT",
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        session.flush()
        _record_history(
            session=session,
            request_id=row.id,
            actor_user_id=requester_user_id,
            event_type="CREATE",
            from_status=None,
            to_status=row.status_code,
            payload={"title": row.title},
        )
    else:
        row = session.get(HriRequestMaster, payload.request_id)
        if row is None or row.requester_id != requester_user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")
        if row.status_code not in EDITABLE_REQUEST_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot edit request in status '{row.status_code}'.",
            )

        from_status = row.status_code
        row.form_type_id = payload.form_type_id
        row.title = payload.title.strip()
        row.content_json = _serialize_content(payload.content_json)
        row.status_code = "DRAFT"
        row.current_step_order = None
        row.updated_at = now
        session.add(row)
        _record_history(
            session=session,
            request_id=row.id,
            actor_user_id=requester_user_id,
            event_type="DRAFT_SAVE",
            from_status=from_status,
            to_status=row.status_code,
        )

    session.commit()
    session.refresh(row)
    return _build_request_item(session, row)


def submit_request(session: Session, requester_user_id: int, request_id: int) -> HriRequestSubmitResponse:
    row = session.get(HriRequestMaster, request_id)
    if row is None or row.requester_id != requester_user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")
    if row.status_code not in EDITABLE_REQUEST_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot submit request in status '{row.status_code}'.",
        )

    form_type = session.get(HriFormType, row.form_type_id)
    if form_type is None or not form_type.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form type not found.")

    from_status = row.status_code
    _reset_snapshot(session, row.id)
    template = _select_approval_template(session, row.form_type_id)
    first_waiting = _create_snapshot_from_template(
        session=session,
        request_id=row.id,
        requester_user_id=requester_user_id,
        template_id=template.id,
    )

    now = _utc_now()
    row.submitted_at = now
    row.completed_at = None
    if first_waiting is None:
        row.status_code = "COMPLETED"
        row.current_step_order = None
        row.completed_at = now
    else:
        row.current_step_order = first_waiting.step_order
        row.status_code = (
            "APPROVAL_IN_PROGRESS" if first_waiting.step_type == "APPROVAL" else "RECEIVE_IN_PROGRESS"
        )
    row.updated_at = now
    session.add(row)
    _record_history(
        session=session,
        request_id=row.id,
        actor_user_id=requester_user_id,
        event_type="SUBMIT",
        from_status=from_status,
        to_status=row.status_code,
        payload={"template_id": template.id},
    )

    session.commit()
    return HriRequestSubmitResponse(
        request_id=row.id,
        status_code=row.status_code,
        current_step_order=row.current_step_order,
    )


def withdraw_request(session: Session, requester_user_id: int, request_id: int) -> HriRequestActionResponse:
    row = session.get(HriRequestMaster, request_id)
    if row is None or row.requester_id != requester_user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")
    if row.status_code != "APPROVAL_IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot withdraw request in status '{row.status_code}'.",
        )

    form_type = session.get(HriFormType, row.form_type_id)
    if form_type is not None and not form_type.allow_withdraw:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Withdraw is disabled for this form type.",
        )

    now = _utc_now()
    from_status = row.status_code
    row.status_code = "WITHDRAWN"
    row.current_step_order = None
    row.updated_at = now
    session.add(row)

    waiting_rows = session.exec(
        select(HriRequestStepSnapshot).where(
            HriRequestStepSnapshot.request_id == row.id,
            HriRequestStepSnapshot.action_status == "WAITING",
        )
    ).all()
    for waiting in waiting_rows:
        waiting.action_status = "REJECTED"
        waiting.acted_at = now
        waiting.comment = "WITHDRAWN_BY_REQUESTER"
        waiting.updated_at = now
        session.add(waiting)

    _record_history(
        session=session,
        request_id=row.id,
        actor_user_id=requester_user_id,
        event_type="WITHDRAW",
        from_status=from_status,
        to_status=row.status_code,
    )

    session.commit()
    return HriRequestActionResponse(request_id=row.id, status_code=row.status_code)


def _get_actionable_step(
    session: Session,
    request_id: int,
    current_step_order: int | None,
    actor_user_id: int,
    step_type: str,
) -> HriRequestStepSnapshot:
    if current_step_order is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Current step is not set.",
        )

    row = session.exec(
        select(HriRequestStepSnapshot).where(
            HriRequestStepSnapshot.request_id == request_id,
            HriRequestStepSnapshot.step_order == current_step_order,
            HriRequestStepSnapshot.actor_user_id == actor_user_id,
            HriRequestStepSnapshot.step_type == step_type,
            HriRequestStepSnapshot.action_status == "WAITING",
        )
    ).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No actionable task for current user.",
        )
    return row


def approve_request(
    session: Session,
    actor_user_id: int,
    request_id: int,
    comment: str | None = None,
) -> HriRequestActionResponse:
    request = session.get(HriRequestMaster, request_id)
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")
    if request.status_code != "APPROVAL_IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot approve request in status '{request.status_code}'.",
        )

    step = _get_actionable_step(
        session=session,
        request_id=request_id,
        current_step_order=request.current_step_order,
        actor_user_id=actor_user_id,
        step_type="APPROVAL",
    )

    now = _utc_now()
    step.action_status = "APPROVED"
    step.acted_at = now
    step.comment = comment
    step.updated_at = now
    session.add(step)

    from_status = request.status_code
    next_approval = session.exec(
        select(HriRequestStepSnapshot).where(
            HriRequestStepSnapshot.request_id == request.id,
            HriRequestStepSnapshot.step_order > step.step_order,
            HriRequestStepSnapshot.step_type == "APPROVAL",
            HriRequestStepSnapshot.action_status == "WAITING",
        )
        .order_by(HriRequestStepSnapshot.step_order)
    ).first()

    if next_approval is not None:
        request.current_step_order = next_approval.step_order
    else:
        next_receive = session.exec(
            select(HriRequestStepSnapshot).where(
                HriRequestStepSnapshot.request_id == request.id,
                HriRequestStepSnapshot.step_type == "RECEIVE",
                HriRequestStepSnapshot.action_status == "WAITING",
            )
            .order_by(HriRequestStepSnapshot.step_order)
        ).first()
        if next_receive is not None:
            request.status_code = "RECEIVE_IN_PROGRESS"
            request.current_step_order = next_receive.step_order
        else:
            request.status_code = "COMPLETED"
            request.current_step_order = None
            request.completed_at = now

    request.updated_at = now
    session.add(request)
    _record_history(
        session=session,
        request_id=request.id,
        actor_user_id=actor_user_id,
        event_type="APPROVE",
        from_status=from_status,
        to_status=request.status_code,
        payload={"comment": comment},
    )

    session.commit()
    return HriRequestActionResponse(request_id=request.id, status_code=request.status_code)


def reject_request(
    session: Session,
    actor_user_id: int,
    request_id: int,
    comment: str | None = None,
) -> HriRequestActionResponse:
    request = session.get(HriRequestMaster, request_id)
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")
    if request.status_code != "APPROVAL_IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot reject request in status '{request.status_code}'.",
        )

    step = _get_actionable_step(
        session=session,
        request_id=request_id,
        current_step_order=request.current_step_order,
        actor_user_id=actor_user_id,
        step_type="APPROVAL",
    )

    now = _utc_now()
    step.action_status = "REJECTED"
    step.acted_at = now
    step.comment = comment
    step.updated_at = now
    session.add(step)

    from_status = request.status_code
    request.status_code = "APPROVAL_REJECTED"
    request.current_step_order = None
    request.updated_at = now
    session.add(request)
    _record_history(
        session=session,
        request_id=request.id,
        actor_user_id=actor_user_id,
        event_type="REJECT",
        from_status=from_status,
        to_status=request.status_code,
        payload={"comment": comment},
    )

    session.commit()
    return HriRequestActionResponse(request_id=request.id, status_code=request.status_code)


def receive_complete_request(
    session: Session,
    actor_user_id: int,
    request_id: int,
    comment: str | None = None,
) -> HriRequestActionResponse:
    request = session.get(HriRequestMaster, request_id)
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")
    if request.status_code != "RECEIVE_IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot complete receive in status '{request.status_code}'.",
        )

    step = _get_actionable_step(
        session=session,
        request_id=request_id,
        current_step_order=request.current_step_order,
        actor_user_id=actor_user_id,
        step_type="RECEIVE",
    )

    now = _utc_now()
    step.action_status = "RECEIVED"
    step.acted_at = now
    step.comment = comment
    step.updated_at = now
    session.add(step)

    from_status = request.status_code
    next_receive = session.exec(
        select(HriRequestStepSnapshot).where(
            HriRequestStepSnapshot.request_id == request.id,
            HriRequestStepSnapshot.step_order > step.step_order,
            HriRequestStepSnapshot.step_type == "RECEIVE",
            HriRequestStepSnapshot.action_status == "WAITING",
        )
        .order_by(HriRequestStepSnapshot.step_order)
    ).first()
    if next_receive is None:
        request.status_code = "COMPLETED"
        request.current_step_order = None
        request.completed_at = now
    else:
        request.current_step_order = next_receive.step_order
    request.updated_at = now
    session.add(request)
    _record_history(
        session=session,
        request_id=request.id,
        actor_user_id=actor_user_id,
        event_type="RECEIVE_COMPLETE",
        from_status=from_status,
        to_status=request.status_code,
        payload={"comment": comment},
    )

    session.commit()
    return HriRequestActionResponse(request_id=request.id, status_code=request.status_code)


def receive_reject_request(
    session: Session,
    actor_user_id: int,
    request_id: int,
    comment: str | None = None,
) -> HriRequestActionResponse:
    request = session.get(HriRequestMaster, request_id)
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")
    if request.status_code != "RECEIVE_IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot reject receive in status '{request.status_code}'.",
        )

    step = _get_actionable_step(
        session=session,
        request_id=request_id,
        current_step_order=request.current_step_order,
        actor_user_id=actor_user_id,
        step_type="RECEIVE",
    )

    now = _utc_now()
    step.action_status = "REJECTED"
    step.acted_at = now
    step.comment = comment
    step.updated_at = now
    session.add(step)

    from_status = request.status_code
    request.status_code = "RECEIVE_REJECTED"
    request.current_step_order = None
    request.updated_at = now
    session.add(request)
    _record_history(
        session=session,
        request_id=request.id,
        actor_user_id=actor_user_id,
        event_type="RECEIVE_REJECT",
        from_status=from_status,
        to_status=request.status_code,
        payload={"comment": comment},
    )

    session.commit()
    return HriRequestActionResponse(request_id=request.id, status_code=request.status_code)


def list_my_requests(session: Session, requester_user_id: int) -> list[HriRequestItem]:
    rows = session.exec(
        select(HriRequestMaster)
        .where(HriRequestMaster.requester_id == requester_user_id)
        .order_by(HriRequestMaster.created_at.desc(), HriRequestMaster.id.desc())
    ).all()
    return [_build_request_item(session, row) for row in rows]


def list_my_approval_tasks(session: Session, actor_user_id: int) -> list[HriTaskItem]:
    rows = session.exec(
        select(HriRequestStepSnapshot, HriRequestMaster)
        .join(HriRequestMaster, HriRequestMaster.id == HriRequestStepSnapshot.request_id)
        .where(
            HriRequestStepSnapshot.actor_user_id == actor_user_id,
            HriRequestStepSnapshot.step_type == "APPROVAL",
            HriRequestStepSnapshot.action_status == "WAITING",
            HriRequestMaster.status_code == "APPROVAL_IN_PROGRESS",
        )
        .order_by(HriRequestMaster.created_at.desc(), HriRequestStepSnapshot.step_order)
    ).all()

    items: list[HriTaskItem] = []
    for step, request in rows:
        form_type = session.get(HriFormType, request.form_type_id)
        items.append(
            HriTaskItem(
                request_id=request.id,
                request_no=request.request_no,
                title=request.title,
                status_code=request.status_code,
                step_order=step.step_order,
                step_type=step.step_type,
                requester_id=request.requester_id,
                requested_at=request.created_at,
                form_name=form_type.form_name_ko if form_type else None,
            )
        )
    return items


def list_my_receive_tasks(session: Session, actor_user_id: int) -> list[HriTaskItem]:
    rows = session.exec(
        select(HriRequestStepSnapshot, HriRequestMaster)
        .join(HriRequestMaster, HriRequestMaster.id == HriRequestStepSnapshot.request_id)
        .where(
            HriRequestStepSnapshot.actor_user_id == actor_user_id,
            HriRequestStepSnapshot.step_type == "RECEIVE",
            HriRequestStepSnapshot.action_status == "WAITING",
            HriRequestMaster.status_code == "RECEIVE_IN_PROGRESS",
        )
        .order_by(HriRequestMaster.created_at.desc(), HriRequestStepSnapshot.step_order)
    ).all()

    items: list[HriTaskItem] = []
    for step, request in rows:
        form_type = session.get(HriFormType, request.form_type_id)
        items.append(
            HriTaskItem(
                request_id=request.id,
                request_no=request.request_no,
                title=request.title,
                status_code=request.status_code,
                step_order=step.step_order,
                step_type=step.step_type,
                requester_id=request.requester_id,
                requested_at=request.created_at,
                form_name=form_type.form_name_ko if form_type else None,
            )
        )
    return items
