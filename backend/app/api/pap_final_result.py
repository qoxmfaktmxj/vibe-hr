from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.pap_final_result import (
    PapFinalResultCreateRequest,
    PapFinalResultDetailResponse,
    PapFinalResultListResponse,
    PapFinalResultUpdateRequest,
)
from app.services.pap_final_result_service import (
    create_final_result,
    delete_final_result,
    list_final_results,
    update_final_result,
)
from app.services.menu_service import get_allowed_menu_actions_for_user

router = APIRouter(prefix="/pap/final-results", tags=["pap-final-results"])


def _require_menu_action(
    session: Session,
    current_user: AuthUser,
    action_code: str,
) -> None:
    allowed = get_allowed_menu_actions_for_user(
        session,
        user_id=current_user.id,
        menu_code="pap.final-results",
    )
    if not allowed.get(action_code, False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action not allowed.")


@router.get(
    "",
    response_model=PapFinalResultListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def pap_final_result_list(
    code: str | None = Query(default=None),
    name: str | None = Query(default=None),
    active_only: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    all: bool = Query(default=False),
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PapFinalResultListResponse:
    _require_menu_action(session, current_user, "query")
    items, total_count = list_final_results(
        session,
        code=code,
        name=name,
        active_only=active_only,
        page=page,
        limit=limit,
        all_rows=all,
    )
    return PapFinalResultListResponse(items=items, total_count=total_count, page=page, limit=limit)


@router.post(
    "",
    response_model=PapFinalResultDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def pap_final_result_create(
    payload: PapFinalResultCreateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PapFinalResultDetailResponse:
    _require_menu_action(session, current_user, "save")
    return PapFinalResultDetailResponse(item=create_final_result(session, payload))


@router.put(
    "/{result_id}",
    response_model=PapFinalResultDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def pap_final_result_update(
    result_id: int,
    payload: PapFinalResultUpdateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PapFinalResultDetailResponse:
    _require_menu_action(session, current_user, "save")
    return PapFinalResultDetailResponse(item=update_final_result(session, result_id, payload))


@router.delete(
    "/{result_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def pap_final_result_delete(
    result_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> Response:
    _require_menu_action(session, current_user, "save")
    delete_final_result(session, result_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
