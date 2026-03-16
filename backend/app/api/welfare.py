from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.core.pagination import paginate_items
from app.models import AuthUser
from app.schemas.welfare import (
    WelBenefitRequestActionResponse,
    WelBenefitRequestApproveRequest,
    WelBenefitRequestCreateRequest,
    WelBenefitRequestListResponse,
    WelBenefitRequestRejectRequest,
    WelBenefitTypeBatchRequest,
    WelBenefitTypeBatchResponse,
    WelBenefitTypeListResponse,
)
from app.services.welfare_service import (
    approve_wel_request,
    batch_save_wel_benefit_types,
    create_wel_request,
    get_my_wel_requests,
    list_wel_benefit_requests,
    list_wel_benefit_types,
    reject_wel_request,
    withdraw_wel_request,
)

router = APIRouter(prefix="/wel", tags=["welfare"])


@router.get(
    "/benefit-types",
    response_model=WelBenefitTypeListResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "payroll_mgr", "admin"))],
)
def get_wel_benefit_types(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_session),
) -> WelBenefitTypeListResponse:
    items = list_wel_benefit_types(session)
    paged_items, total_count = paginate_items(items, page, limit)
    return WelBenefitTypeListResponse(items=paged_items, total_count=total_count, page=page, limit=limit)


@router.post(
    "/benefit-types/batch",
    response_model=WelBenefitTypeBatchResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def save_wel_benefit_types_batch(
    payload: WelBenefitTypeBatchRequest,
    session: Session = Depends(get_session),
) -> WelBenefitTypeBatchResponse:
    result = batch_save_wel_benefit_types(session, payload)
    return WelBenefitTypeBatchResponse(**result)


@router.get(
    "/requests",
    response_model=WelBenefitRequestListResponse,
    dependencies=[Depends(require_roles("hr_manager", "payroll_mgr", "admin"))],
)
def get_wel_benefit_requests(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_session),
) -> WelBenefitRequestListResponse:
    items = list_wel_benefit_requests(session)
    paged_items, total_count = paginate_items(items, page, limit)
    return WelBenefitRequestListResponse(items=paged_items, total_count=total_count, page=page, limit=limit)


@router.post(
    "/requests",
    response_model=WelBenefitRequestActionResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "payroll_mgr", "admin"))],
)
def create_wel_benefit_request(
    payload: WelBenefitRequestCreateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> WelBenefitRequestActionResponse:
    return create_wel_request(session, payload, current_user)


@router.get(
    "/my-requests",
    response_model=WelBenefitRequestListResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "payroll_mgr", "admin"))],
)
def get_my_wel_benefit_requests(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> WelBenefitRequestListResponse:
    items = get_my_wel_requests(session, current_user)
    return WelBenefitRequestListResponse(items=items, total_count=len(items), page=1, limit=len(items) or 1)


@router.post(
    "/requests/{req_id}/approve",
    response_model=WelBenefitRequestActionResponse,
    dependencies=[Depends(require_roles("hr_manager", "payroll_mgr", "admin"))],
)
def approve_wel_benefit_request(
    req_id: int,
    payload: WelBenefitRequestApproveRequest,
    session: Session = Depends(get_session),
) -> WelBenefitRequestActionResponse:
    return approve_wel_request(session, req_id, payload)


@router.post(
    "/requests/{req_id}/reject",
    response_model=WelBenefitRequestActionResponse,
    dependencies=[Depends(require_roles("hr_manager", "payroll_mgr", "admin"))],
)
def reject_wel_benefit_request(
    req_id: int,
    payload: WelBenefitRequestRejectRequest,
    session: Session = Depends(get_session),
) -> WelBenefitRequestActionResponse:
    return reject_wel_request(session, req_id, payload)


@router.put(
    "/requests/{req_id}/withdraw",
    response_model=WelBenefitRequestActionResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "payroll_mgr", "admin"))],
)
def withdraw_wel_benefit_request(
    req_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> WelBenefitRequestActionResponse:
    return withdraw_wel_request(session, req_id, current_user)
