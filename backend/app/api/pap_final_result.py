from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.pap_final_result import PapFinalResultListResponse
from app.services.pap_final_result_service import list_final_results

router = APIRouter(prefix="/pap/final-results", tags=["pap-final-results"])


@router.get(
    "",
    response_model=PapFinalResultListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def pap_final_result_list(
    active_only: bool | None = Query(default=None),
    session: Session = Depends(get_session),
) -> PapFinalResultListResponse:
    return PapFinalResultListResponse(items=list_final_results(session, active_only=active_only))
