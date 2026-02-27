from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.welfare import (
    WelBenefitTypeBatchRequest,
    WelBenefitTypeBatchResponse,
    WelBenefitTypeListResponse,
)
from app.services.welfare_service import (
    batch_save_wel_benefit_types,
    list_wel_benefit_types,
)

router = APIRouter(prefix="/wel/benefit-types", tags=["welfare"])


@router.get(
    "",
    response_model=WelBenefitTypeListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def get_wel_benefit_types(
    session: Session = Depends(get_session),
) -> WelBenefitTypeListResponse:
    items = list_wel_benefit_types(session)
    return WelBenefitTypeListResponse(items=items, total_count=len(items))


@router.post(
    "/batch",
    response_model=WelBenefitTypeBatchResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def save_wel_benefit_types_batch(
    payload: WelBenefitTypeBatchRequest,
    session: Session = Depends(get_session),
) -> WelBenefitTypeBatchResponse:
    result = batch_save_wel_benefit_types(session, payload)
    return WelBenefitTypeBatchResponse(**result)
