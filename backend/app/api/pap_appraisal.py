from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
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
from app.services.menu_service import get_allowed_menu_actions_for_user

router = APIRouter(prefix="/pap/appraisals", tags=["pap-appraisals"])


def _require_menu_action(
    session: Session,
    current_user: AuthUser,
    action_code: str,
) -> None:
    allowed = get_allowed_menu_actions_for_user(
        session,
        user_id=current_user.id,
        menu_code="pap.appraisals",
    )
    if not allowed.get(action_code, False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action not allowed.")


@router.get(
    "",
    response_model=PapAppraisalListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def pap_appraisal_list(
    code: str | None = Query(default=None),
    name: str | None = Query(default=None),
    appraisal_year: int | None = Query(default=None, ge=2000, le=2100),
    active_only: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    all: bool = Query(default=False),
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PapAppraisalListResponse:
    _require_menu_action(session, current_user, "query")
    items, total_count = list_appraisals(
        session,
        appraisal_year=appraisal_year,
        active_only=active_only,
        code=code,
        name=name,
        page=page,
        limit=limit,
        all_rows=all,
    )
    return PapAppraisalListResponse(
        items=items,
        total_count=total_count,
        page=page,
        limit=limit,
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
    current_user: AuthUser = Depends(get_current_user),
) -> PapAppraisalDetailResponse:
    _require_menu_action(session, current_user, "save")
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
    current_user: AuthUser = Depends(get_current_user),
) -> PapAppraisalDetailResponse:
    _require_menu_action(session, current_user, "save")
    return PapAppraisalDetailResponse(item=update_appraisal(session, appraisal_id, payload))


@router.delete(
    "/{appraisal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def pap_appraisal_delete(
    appraisal_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> Response:
    _require_menu_action(session, current_user, "save")
    delete_appraisal(session, appraisal_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
