"""조직개편 서비스 (A안: 개편안 관리 + B안: 직접 수정 이력은 organization_service.py에서 호출)."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import (
    AuthUser,
    OrgDeptChangeHistory,
    OrgDepartment,
    OrgRestructurePlan,
    OrgRestructurePlanItem,
)
from app.schemas.organization import (
    OrgDeptChangeHistoryItem,
    OrgDeptChangeHistoryListResponse,
    OrgRestructureApplyResponse,
    OrgRestructurePlanCreateRequest,
    OrgRestructurePlanItem as OrgRestructurePlanItemSchema,
    OrgRestructurePlanItemCreateRequest,
    OrgRestructurePlanItemDetail,
    OrgRestructurePlanItemListResponse,
    OrgRestructurePlanItemUpdateRequest,
    OrgRestructurePlanListResponse,
    OrgRestructurePlanUpdateRequest,
)

VALID_PLAN_STATUSES = {"draft", "reviewing", "applied", "cancelled"}
VALID_ACTION_TYPES = {"move", "rename", "create", "deactivate", "reactivate"}
MANUAL_TRANSITION_STATUSES = {"draft", "reviewing", "cancelled"}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _dept_name(session: Session, dept_id: int | None) -> str | None:
    if dept_id is None:
        return None
    dept = session.get(OrgDepartment, dept_id)
    return dept.name if dept else None


def _dept_code(session: Session, dept_id: int | None) -> str | None:
    if dept_id is None:
        return None
    dept = session.get(OrgDepartment, dept_id)
    return dept.code if dept else None


def _user_name(session: Session, user_id: int | None) -> str | None:
    if user_id is None:
        return None
    user = session.get(AuthUser, user_id)
    return user.display_name if user else None


# ---------------------------------------------------------------------------
# B안: 부서 변경 이력 (organization_service.py에서 호출)
# ---------------------------------------------------------------------------

def record_dept_change(
    session: Session,
    *,
    department_id: int,
    changed_by: int | None,
    field_name: str,
    before_value: str | None,
    after_value: str | None,
    change_reason: str | None = None,
    auto_commit: bool = False,
) -> None:
    """단일 필드 변경 이력 기록. before == after이면 기록하지 않음."""
    if before_value == after_value:
        return
    session.add(
        OrgDeptChangeHistory(
            department_id=department_id,
            changed_by=changed_by,
            field_name=field_name,
            before_value=before_value,
            after_value=after_value,
            change_reason=change_reason,
            changed_at=_utc_now(),
        )
    )
    if auto_commit:
        session.commit()


def list_dept_change_history(
    session: Session,
    department_id: int | None = None,
    limit: int = 200,
) -> OrgDeptChangeHistoryListResponse:
    stmt = select(OrgDeptChangeHistory).order_by(OrgDeptChangeHistory.changed_at.desc())
    if department_id is not None:
        stmt = stmt.where(OrgDeptChangeHistory.department_id == department_id)
    stmt = stmt.limit(limit)
    rows = session.exec(stmt).all()

    items = [
        OrgDeptChangeHistoryItem(
            id=row.id,
            department_id=row.department_id,
            department_name=_dept_name(session, row.department_id),
            changed_by=row.changed_by,
            changed_by_name=_user_name(session, row.changed_by),
            field_name=row.field_name,
            before_value=row.before_value,
            after_value=row.after_value,
            change_reason=row.change_reason,
            changed_at=row.changed_at,
        )
        for row in rows
    ]
    return OrgDeptChangeHistoryListResponse(items=items, total_count=len(items))


# ---------------------------------------------------------------------------
# A안: 조직개편안 (Plan) CRUD
# ---------------------------------------------------------------------------

def _item_count(session: Session, plan_id: int) -> int:
    rows = session.exec(
        select(OrgRestructurePlanItem.id).where(OrgRestructurePlanItem.plan_id == plan_id)
    ).all()
    return len(rows)


def _to_plan_schema(session: Session, plan: OrgRestructurePlan) -> OrgRestructurePlanItemSchema:
    return OrgRestructurePlanItemSchema(
        id=plan.id,
        title=plan.title,
        description=plan.description,
        planned_date=plan.planned_date,
        status=plan.status,
        applied_at=plan.applied_at,
        applied_by=plan.applied_by,
        created_by=plan.created_by,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
        item_count=_item_count(session, plan.id or 0),
    )


def list_restructure_plans(
    session: Session,
    status_filter: str | None = None,
) -> OrgRestructurePlanListResponse:
    stmt = select(OrgRestructurePlan).order_by(OrgRestructurePlan.created_at.desc())
    if status_filter:
        stmt = stmt.where(OrgRestructurePlan.status == status_filter)
    plans = session.exec(stmt).all()
    return OrgRestructurePlanListResponse(
        items=[_to_plan_schema(session, p) for p in plans],
        total_count=len(plans),
    )


def create_restructure_plan(
    session: Session,
    payload: OrgRestructurePlanCreateRequest,
    user_id: int,
) -> OrgRestructurePlanItemSchema:
    plan = OrgRestructurePlan(
        title=payload.title.strip(),
        description=payload.description,
        planned_date=payload.planned_date,
        status="draft",
        created_by=user_id,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(plan)
    session.commit()
    session.refresh(plan)
    return _to_plan_schema(session, plan)


def update_restructure_plan(
    session: Session,
    plan_id: int,
    payload: OrgRestructurePlanUpdateRequest,
) -> OrgRestructurePlanItemSchema:
    plan = session.get(OrgRestructurePlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="조직개편안을 찾을 수 없습니다.")
    if plan.status in ("applied", "cancelled"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 적용됐거나 취소된 개편안은 수정할 수 없습니다.")

    if payload.title is not None:
        plan.title = payload.title.strip()
    if payload.description is not None:
        plan.description = payload.description
    if payload.planned_date is not None:
        plan.planned_date = payload.planned_date
    if payload.status is not None:
        new_status = payload.status
        if new_status not in MANUAL_TRANSITION_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="상태는 draft/reviewing/cancelled만 직접 변경 가능합니다.")
        plan.status = new_status

    plan.updated_at = _utc_now()
    session.add(plan)
    session.commit()
    session.refresh(plan)
    return _to_plan_schema(session, plan)


def delete_restructure_plan(session: Session, plan_id: int) -> None:
    plan = session.get(OrgRestructurePlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="조직개편안을 찾을 수 없습니다.")
    if plan.status == "applied":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 적용된 개편안은 삭제할 수 없습니다.")
    # 항목도 함께 삭제
    items = session.exec(
        select(OrgRestructurePlanItem).where(OrgRestructurePlanItem.plan_id == plan_id)
    ).all()
    for item in items:
        session.delete(item)
    session.delete(plan)
    session.commit()


# ---------------------------------------------------------------------------
# A안: 개편안 항목 CRUD
# ---------------------------------------------------------------------------

def _to_plan_item_detail(session: Session, item: OrgRestructurePlanItem) -> OrgRestructurePlanItemDetail:
    return OrgRestructurePlanItemDetail(
        id=item.id,
        plan_id=item.plan_id,
        action_type=item.action_type,
        target_dept_id=item.target_dept_id,
        target_dept_name=_dept_name(session, item.target_dept_id),
        target_dept_code=_dept_code(session, item.target_dept_id),
        new_parent_id=item.new_parent_id,
        new_parent_name=_dept_name(session, item.new_parent_id),
        new_name=item.new_name,
        new_code=item.new_code,
        new_organization_type=item.new_organization_type,
        new_cost_center_code=item.new_cost_center_code,
        sort_order=item.sort_order,
        item_status=item.item_status,
        memo=item.memo,
        applied_at=item.applied_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def list_plan_items(session: Session, plan_id: int) -> OrgRestructurePlanItemListResponse:
    _get_plan_or_404(session, plan_id)
    items = session.exec(
        select(OrgRestructurePlanItem)
        .where(OrgRestructurePlanItem.plan_id == plan_id)
        .order_by(OrgRestructurePlanItem.sort_order, OrgRestructurePlanItem.id)
    ).all()
    return OrgRestructurePlanItemListResponse(
        items=[_to_plan_item_detail(session, i) for i in items],
        total_count=len(items),
    )


def _get_plan_or_404(session: Session, plan_id: int) -> OrgRestructurePlan:
    plan = session.get(OrgRestructurePlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="조직개편안을 찾을 수 없습니다.")
    return plan


def _validate_plan_editable(plan: OrgRestructurePlan) -> None:
    if plan.status in ("applied", "cancelled"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="적용됐거나 취소된 개편안에는 항목을 추가/수정할 수 없습니다.")


def add_plan_item(
    session: Session,
    plan_id: int,
    payload: OrgRestructurePlanItemCreateRequest,
) -> OrgRestructurePlanItemDetail:
    plan = _get_plan_or_404(session, plan_id)
    _validate_plan_editable(plan)
    _validate_plan_item_payload(session, payload.action_type, payload.target_dept_id, payload.new_parent_id, payload.new_name, payload.new_code)

    item = OrgRestructurePlanItem(
        plan_id=plan_id,
        action_type=payload.action_type,
        target_dept_id=payload.target_dept_id,
        new_parent_id=payload.new_parent_id,
        new_name=payload.new_name,
        new_code=payload.new_code,
        new_organization_type=payload.new_organization_type,
        new_cost_center_code=payload.new_cost_center_code,
        sort_order=payload.sort_order,
        item_status="pending",
        memo=payload.memo,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return _to_plan_item_detail(session, item)


def update_plan_item(
    session: Session,
    plan_id: int,
    item_id: int,
    payload: OrgRestructurePlanItemUpdateRequest,
) -> OrgRestructurePlanItemDetail:
    plan = _get_plan_or_404(session, plan_id)
    _validate_plan_editable(plan)

    item = session.get(OrgRestructurePlanItem, item_id)
    if item is None or item.plan_id != plan_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="항목을 찾을 수 없습니다.")
    if item.item_status == "applied":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 적용된 항목은 수정할 수 없습니다.")

    if payload.action_type is not None:
        item.action_type = payload.action_type
    if payload.target_dept_id is not None:
        item.target_dept_id = payload.target_dept_id
    if payload.new_parent_id is not None:
        item.new_parent_id = payload.new_parent_id
    if payload.new_name is not None:
        item.new_name = payload.new_name
    if payload.new_code is not None:
        item.new_code = payload.new_code
    if payload.new_organization_type is not None:
        item.new_organization_type = payload.new_organization_type
    if payload.new_cost_center_code is not None:
        item.new_cost_center_code = payload.new_cost_center_code
    if payload.sort_order is not None:
        item.sort_order = payload.sort_order
    if payload.memo is not None:
        item.memo = payload.memo

    item.updated_at = _utc_now()
    session.add(item)
    session.commit()
    session.refresh(item)
    return _to_plan_item_detail(session, item)


def delete_plan_item(session: Session, plan_id: int, item_id: int) -> None:
    plan = _get_plan_or_404(session, plan_id)
    _validate_plan_editable(plan)

    item = session.get(OrgRestructurePlanItem, item_id)
    if item is None or item.plan_id != plan_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="항목을 찾을 수 없습니다.")
    session.delete(item)
    session.commit()


def _validate_plan_item_payload(
    session: Session,
    action_type: str,
    target_dept_id: int | None,
    new_parent_id: int | None,
    new_name: str | None,
    new_code: str | None,
) -> None:
    """액션 타입별 필수 필드 검증."""
    if action_type in ("move", "rename", "deactivate", "reactivate"):
        if target_dept_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{action_type} 액션은 target_dept_id가 필요합니다.")
        dept = session.get(OrgDepartment, target_dept_id)
        if dept is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="대상 부서를 찾을 수 없습니다.")
    if action_type == "move" and new_parent_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="move 액션은 new_parent_id가 필요합니다.")
    if action_type == "rename" and not new_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="rename 액션은 new_name이 필요합니다.")
    if action_type == "create" and not new_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="create 액션은 new_name이 필요합니다.")


# ---------------------------------------------------------------------------
# A안: 개편안 일괄 적용
# ---------------------------------------------------------------------------

def apply_restructure_plan(
    session: Session,
    plan_id: int,
    user_id: int,
) -> OrgRestructureApplyResponse:
    plan = _get_plan_or_404(session, plan_id)
    if plan.status == "applied":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 적용된 개편안입니다.")
    if plan.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="취소된 개편안은 적용할 수 없습니다.")

    items = session.exec(
        select(OrgRestructurePlanItem)
        .where(
            OrgRestructurePlanItem.plan_id == plan_id,
            OrgRestructurePlanItem.item_status == "pending",
        )
        .order_by(OrgRestructurePlanItem.sort_order, OrgRestructurePlanItem.id)
    ).all()

    applied = 0
    skipped = 0
    messages: list[str] = []
    now = _utc_now()

    for item in items:
        try:
            msg = _apply_single_item(session, item, user_id, now)
            item.item_status = "applied"
            item.applied_at = now
            session.add(item)
            applied += 1
            if msg:
                messages.append(msg)
        except HTTPException as exc:
            item.item_status = "skipped"
            session.add(item)
            skipped += 1
            messages.append(f"[SKIP] {item.action_type} id={item.id}: {exc.detail}")

    plan.status = "applied"
    plan.applied_at = now
    plan.applied_by = user_id
    plan.updated_at = now
    session.add(plan)
    session.commit()

    return OrgRestructureApplyResponse(
        plan_id=plan_id,
        applied_count=applied,
        skipped_count=skipped,
        messages=messages,
    )


def _apply_single_item(
    session: Session,
    item: OrgRestructurePlanItem,
    user_id: int,
    now: datetime,
) -> str | None:
    """단일 개편 항목 실행. 변경 이력 자동 기록."""
    action = item.action_type

    if action == "move":
        dept = _get_dept_or_raise(session, item.target_dept_id)
        new_parent = _get_dept_or_raise(session, item.new_parent_id)
        old_parent_id = dept.parent_id
        _ensure_no_cycle(session, dept.id or 0, new_parent.id or 0)
        record_dept_change(session, department_id=dept.id or 0, changed_by=user_id, field_name="parent_id", before_value=str(old_parent_id), after_value=str(new_parent.id), change_reason=f"조직개편 plan_id={item.plan_id}")
        dept.parent_id = new_parent.id
        dept.updated_at = now
        session.add(dept)
        return f"[MOVE] {dept.name} → 상위부서 변경"

    if action == "rename":
        dept = _get_dept_or_raise(session, item.target_dept_id)
        old_name = dept.name
        dept.name = (item.new_name or "").strip()
        if item.new_code:
            old_code = dept.code
            record_dept_change(session, department_id=dept.id or 0, changed_by=user_id, field_name="code", before_value=old_code, after_value=item.new_code, change_reason=f"조직개편 plan_id={item.plan_id}")
            dept.code = item.new_code.upper()
        record_dept_change(session, department_id=dept.id or 0, changed_by=user_id, field_name="name", before_value=old_name, after_value=dept.name, change_reason=f"조직개편 plan_id={item.plan_id}")
        dept.updated_at = now
        session.add(dept)
        return f"[RENAME] {old_name} → {dept.name}"

    if action == "create":
        code = (item.new_code or "").upper().strip()
        if not code:
            raise HTTPException(status_code=400, detail="create 액션에 new_code가 없습니다.")
        existing = session.exec(select(OrgDepartment).where(OrgDepartment.code == code)).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"코드 '{code}'가 이미 존재합니다.")
        new_dept = OrgDepartment(
            code=code,
            name=(item.new_name or code).strip(),
            parent_id=item.new_parent_id,
            organization_type=item.new_organization_type,
            cost_center_code=item.new_cost_center_code,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        session.add(new_dept)
        session.flush()
        record_dept_change(session, department_id=new_dept.id or 0, changed_by=user_id, field_name="created", before_value=None, after_value=code, change_reason=f"조직개편 plan_id={item.plan_id}")
        return f"[CREATE] {new_dept.name} ({code})"

    if action == "deactivate":
        dept = _get_dept_or_raise(session, item.target_dept_id)
        record_dept_change(session, department_id=dept.id or 0, changed_by=user_id, field_name="is_active", before_value="True", after_value="False", change_reason=f"조직개편 plan_id={item.plan_id}")
        dept.is_active = False
        dept.updated_at = now
        session.add(dept)
        return f"[DEACTIVATE] {dept.name}"

    if action == "reactivate":
        dept = _get_dept_or_raise(session, item.target_dept_id)
        record_dept_change(session, department_id=dept.id or 0, changed_by=user_id, field_name="is_active", before_value="False", after_value="True", change_reason=f"조직개편 plan_id={item.plan_id}")
        dept.is_active = True
        dept.updated_at = now
        session.add(dept)
        return f"[REACTIVATE] {dept.name}"

    return None


def _get_dept_or_raise(session: Session, dept_id: int | None) -> OrgDepartment:
    if dept_id is None:
        raise HTTPException(status_code=400, detail="부서 ID가 없습니다.")
    dept = session.get(OrgDepartment, dept_id)
    if dept is None:
        raise HTTPException(status_code=404, detail=f"부서 id={dept_id}를 찾을 수 없습니다.")
    return dept


def _ensure_no_cycle(session: Session, dept_id: int, new_parent_id: int) -> None:
    """새 부모가 자기 자신이거나 자신의 하위 부서이면 에러."""
    if dept_id == new_parent_id:
        raise HTTPException(status_code=400, detail="자기 자신을 상위 부서로 지정할 수 없습니다.")
    visited = {new_parent_id}
    current_id: int | None = new_parent_id
    while current_id is not None:
        parent = session.get(OrgDepartment, current_id)
        if parent is None or parent.parent_id is None:
            break
        if parent.parent_id == dept_id:
            raise HTTPException(status_code=400, detail="순환 부서 구조를 만들 수 없습니다.")
        if parent.parent_id in visited:
            break
        visited.add(parent.parent_id)
        current_id = parent.parent_id
