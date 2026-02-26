from __future__ import annotations

from collections import defaultdict

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.core.time_utils import now_utc
from app.models import HriApprovalLineStep, HriApprovalLineTemplate
from app.schemas.hri_approval_template import (
    HriApprovalTemplateBatchItem,
    HriApprovalTemplateBatchRequest,
    HriApprovalTemplateBatchResponse,
    HriApprovalTemplateItem,
    HriApprovalTemplateStepBatchItem,
    HriApprovalTemplateStepItem,
)


def _to_step_item(row: HriApprovalLineStep) -> HriApprovalTemplateStepItem:
    return HriApprovalTemplateStepItem(
        id=row.id,
        step_order=row.step_order,
        step_type=row.step_type,
        actor_resolve_type=row.actor_resolve_type,
        actor_role_code=row.actor_role_code,
        actor_user_id=row.actor_user_id,
        allow_delegate=row.allow_delegate,
        required_action=row.required_action,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _list_template_steps(session: Session, template_id: int) -> list[HriApprovalTemplateStepItem]:
    """단일 템플릿 steps 조회 (단건 조회 시 사용)."""
    rows = session.exec(
        select(HriApprovalLineStep)
        .where(HriApprovalLineStep.template_id == template_id)
        .order_by(HriApprovalLineStep.step_order, HriApprovalLineStep.id)
    ).all()
    return [_to_step_item(row) for row in rows]


def _to_item_with_steps(row: HriApprovalLineTemplate, steps: list[HriApprovalTemplateStepItem]) -> HriApprovalTemplateItem:
    return HriApprovalTemplateItem(
        id=row.id,
        template_code=row.template_code,
        template_name=row.template_name,
        scope_type=row.scope_type,
        scope_id=row.scope_id,
        is_default=row.is_default,
        is_active=row.is_active,
        priority=row.priority,
        created_at=row.created_at,
        updated_at=row.updated_at,
        steps=steps,
    )


def list_approval_templates(session: Session) -> list[HriApprovalTemplateItem]:
    """N+1 없이 템플릿 + 전체 스텝을 2번의 쿼리로 로드한다."""
    templates = session.exec(
        select(HriApprovalLineTemplate).order_by(
            HriApprovalLineTemplate.scope_type,
            HriApprovalLineTemplate.priority.desc(),
            HriApprovalLineTemplate.id,
        )
    ).all()

    if not templates:
        return []

    # 모든 스텝을 한 번에 로드
    template_ids = [t.id for t in templates]
    all_steps = session.exec(
        select(HriApprovalLineStep)
        .where(HriApprovalLineStep.template_id.in_(template_ids))
        .order_by(HriApprovalLineStep.template_id, HriApprovalLineStep.step_order, HriApprovalLineStep.id)
    ).all()

    # template_id → steps 그룹핑
    steps_by_template: dict[int, list[HriApprovalTemplateStepItem]] = defaultdict(list)
    for step in all_steps:
        steps_by_template[step.template_id].append(_to_step_item(step))

    return [_to_item_with_steps(t, steps_by_template[t.id]) for t in templates]


def _apply_template_fields(row: HriApprovalLineTemplate, item: HriApprovalTemplateBatchItem) -> None:
    row.template_code = item.template_code.strip().upper()
    row.template_name = item.template_name.strip()
    row.scope_type = item.scope_type
    row.scope_id = item.scope_id.strip() if item.scope_id else None
    row.is_default = item.is_default
    row.is_active = item.is_active
    row.priority = item.priority
    row.updated_at = now_utc()


def _replace_template_steps(
    session: Session,
    template_id: int,
    steps: list[HriApprovalTemplateStepBatchItem],
) -> None:
    existing_rows = session.exec(
        select(HriApprovalLineStep).where(HriApprovalLineStep.template_id == template_id)
    ).all()
    for existing in existing_rows:
        session.delete(existing)

    for step in sorted(steps, key=lambda x: x.step_order):
        row = HriApprovalLineStep(
            template_id=template_id,
            step_order=step.step_order,
            step_type=step.step_type,
            actor_resolve_type=step.actor_resolve_type,
            actor_role_code=step.actor_role_code.strip().upper() if step.actor_role_code else None,
            actor_user_id=step.actor_user_id,
            allow_delegate=step.allow_delegate,
            required_action=step.required_action,
            created_at=now_utc(),
            updated_at=now_utc(),
        )
        session.add(row)


def batch_save_approval_templates(
    session: Session,
    payload: HriApprovalTemplateBatchRequest,
) -> HriApprovalTemplateBatchResponse:
    inserted = 0
    updated = 0
    deleted = 0

    for del_id in payload.delete_ids:
        row = session.get(HriApprovalLineTemplate, del_id)
        if row is None:
            continue

        steps = session.exec(
            select(HriApprovalLineStep).where(HriApprovalLineStep.template_id == row.id)
        ).all()
        for step in steps:
            session.delete(step)
        session.delete(row)
        deleted += 1

    for item in payload.items:
        if item.id is not None and item.id > 0:
            row = session.get(HriApprovalLineTemplate, item.id)
            if row is not None:
                _apply_template_fields(row, item)
                session.add(row)
                session.flush()
                _replace_template_steps(session, row.id, item.steps)
                updated += 1
                continue

        template_code = item.template_code.strip().upper()
        dup = session.exec(
            select(HriApprovalLineTemplate.id).where(HriApprovalLineTemplate.template_code == template_code)
        ).first()
        if dup is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"template_code '{template_code}' already exists.",
            )

        row = HriApprovalLineTemplate(created_at=now_utc())
        _apply_template_fields(row, item)
        session.add(row)
        session.flush()
        _replace_template_steps(session, row.id, item.steps)
        inserted += 1

    session.commit()

    items = list_approval_templates(session)
    return HriApprovalTemplateBatchResponse(
        items=items,
        total_count=len(items),
        inserted_count=inserted,
        updated_count=updated,
        deleted_count=deleted,
    )
