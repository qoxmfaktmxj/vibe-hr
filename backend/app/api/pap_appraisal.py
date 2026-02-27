from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.pap_appraisal import (
    PapAppraisalCreateRequest,
    PapAppraisalDetailResponse,
    PapAppraisalListResponse,
    PapAppraisalUpdateRequest,
)
from app.services.pap_appraisal_service import (
    create_appraisal,
    delete_appraisal,
    list_appraisals,
    update_appraisal,
)

router = APIRouter(prefix="/pap/appraisals", tags=["pap-appraisals"])


@router.get(
    "",
    response_model=PapAppraisalListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def pap_appraisal_list(
    appraisal_year: int | None = Query(default=None, ge=2000, le=2100),
    active_only: bool | None = Query(default=None),
    session: Session = Depends(get_session),
) -> PapAppraisalListResponse:
    return PapAppraisalListResponse(
        items=list_appraisals(session, appraisal_year=appraisal_year, active_only=active_only),
    )


@router.post(
    "",
    response_model=PapAppraisalDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def pap_appraisal_create(
    payload: PapAppraisalCreateRequest,
    session: Session = Depends(get_session),
) -> PapAppraisalDetailResponse:
    return PapAppraisalDetailResponse(item=create_appraisal(session, payload))


@router.put(
    "/{appraisal_id}",
    response_model=PapAppraisalDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def pap_appraisal_update(
    appraisal_id: int,
    payload: PapAppraisalUpdateRequest,
    session: Session = Depends(get_session),
) -> PapAppraisalDetailResponse:
    return PapAppraisalDetailResponse(item=update_appraisal(session, appraisal_id, payload))


@router.delete(
    "/{appraisal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def pap_appraisal_delete(appraisal_id: int, session: Session = Depends(get_session)) -> Response:
    delete_appraisal(session, appraisal_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
