from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.hr_severance import (
    HrSeveranceAdjustmentUpdateRequest,
    HrSeveranceCalcDetailResponse,
    HrSeveranceCalcListResponse,
    PaySeveranceItemRuleBatchRequest,
    PaySeveranceItemRuleBatchResponse,
    PaySeveranceItemRuleListResponse,
)
from app.services.hr_severance_service import (
    batch_save_severance_item_rules,
    confirm_severance_calc,
    get_severance_calc_detail,
    list_severance_calcs,
    list_severance_item_rules,
    recalculate_severance_calc,
    update_severance_adjustment,
)

router = APIRouter(tags=["hr-severance"])

SEVERANCE_ROLES = ("hr_manager", "payroll_mgr", "admin")


@router.get(
    "/hr/severance/calcs",
    response_model=HrSeveranceCalcListResponse,
    dependencies=[Depends(require_roles(*SEVERANCE_ROLES))],
)
def severance_calc_list(
    status: str | None = Query(default=None),
    year: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_session),
) -> HrSeveranceCalcListResponse:
    return list_severance_calcs(session, status_filter=status, year_filter=year, page=page, limit=limit)


@router.get(
    "/hr/severance/calcs/{calc_id}",
    response_model=HrSeveranceCalcDetailResponse,
    dependencies=[Depends(require_roles(*SEVERANCE_ROLES))],
)
def severance_calc_detail(calc_id: int, session: Session = Depends(get_session)) -> HrSeveranceCalcDetailResponse:
    return get_severance_calc_detail(session, calc_id)


@router.post(
    "/hr/severance/calcs/{calc_id}/recalculate",
    response_model=HrSeveranceCalcDetailResponse,
    dependencies=[Depends(require_roles(*SEVERANCE_ROLES))],
)
def severance_calc_recalculate(calc_id: int, session: Session = Depends(get_session)) -> HrSeveranceCalcDetailResponse:
    return recalculate_severance_calc(session, calc_id)


@router.put(
    "/hr/severance/calcs/{calc_id}",
    response_model=HrSeveranceCalcDetailResponse,
    dependencies=[Depends(require_roles(*SEVERANCE_ROLES))],
)
def severance_calc_update_adjustment(
    calc_id: int,
    payload: HrSeveranceAdjustmentUpdateRequest,
    session: Session = Depends(get_session),
) -> HrSeveranceCalcDetailResponse:
    return update_severance_adjustment(session, calc_id, payload)


@router.post(
    "/hr/severance/calcs/{calc_id}/confirm",
    response_model=HrSeveranceCalcDetailResponse,
    dependencies=[Depends(require_roles(*SEVERANCE_ROLES))],
)
def severance_calc_confirm(
    calc_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HrSeveranceCalcDetailResponse:
    return confirm_severance_calc(session, calc_id, confirmed_by=current_user.id)


@router.get(
    "/pay/severance-item-rules",
    response_model=PaySeveranceItemRuleListResponse,
    dependencies=[Depends(require_roles(*SEVERANCE_ROLES))],
)
def severance_item_rule_list(session: Session = Depends(get_session)) -> PaySeveranceItemRuleListResponse:
    return list_severance_item_rules(session)


@router.post(
    "/pay/severance-item-rules/batch",
    response_model=PaySeveranceItemRuleBatchResponse,
    dependencies=[Depends(require_roles(*SEVERANCE_ROLES))],
)
def severance_item_rule_batch_save(
    payload: PaySeveranceItemRuleBatchRequest,
    session: Session = Depends(get_session),
) -> PaySeveranceItemRuleBatchResponse:
    return batch_save_severance_item_rules(session, payload)
