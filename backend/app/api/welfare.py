from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.welfare import (
    WelBenefitRequestListResponse,
    WelBenefitTypeBatchRequest,
    WelBenefitTypeBatchResponse,
    WelBenefitTypeListResponse,
)
from app.services.welfare_service import (
    batch_save_wel_benefit_types,
    list_wel_benefit_requests,
    list_wel_benefit_types,
)

router = APIRouter(prefix="/wel", tags=["welfare"])


@router.get(
    "/benefit-types",
    response_model=WelBenefitTypeListResponse,
    dependencies=[Depends(require_roles("hr_manager", "payroll_mgr", "admin"))],
)
def get_wel_benefit_types(
    session: Session = Depends(get_session),
) -> WelBenefitTypeListResponse:
    items = list_wel_benefit_types(session)
    return WelBenefitTypeListResponse(items=items, total_count=len(items))


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
    session: Session = Depends(get_session),
) -> WelBenefitRequestListResponse:
    items = list_wel_benefit_requests(session)
    return WelBenefitRequestListResponse(items=items, total_count=len(items))
