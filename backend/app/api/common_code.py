from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.common_code import (
    ActiveCodeListResponse,
    CodeCreateRequest,
    CodeDetailResponse,
    CodeGroupCreateRequest,
    CodeGroupDetailResponse,
    CodeGroupListResponse,
    CodeGroupUpdateRequest,
    CodeListResponse,
    CodeUpdateRequest,
)
from app.services.common_code_service import (
    create_code,
    create_code_group,
    delete_code,
    delete_code_group,
    list_active_codes,
    list_code_groups,
    list_codes,
    update_code,
    update_code_group,
)
from app.services.menu_service import require_menu_action_for_user

router = APIRouter(prefix="/codes", tags=["common-codes"])


@router.get(
    "/groups",
    response_model=CodeGroupListResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def code_groups(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=1000),
    all: bool = Query(default=False),
    code: str | None = Query(default=None),
    name: str | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> CodeGroupListResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/settings/common-codes", action_code="query")
    groups, total_count = list_code_groups(
        session,
        page=None if all else page,
        limit=None if all else limit,
        code=code,
        name=name,
    )
    return CodeGroupListResponse(
        groups=groups,
        total_count=total_count,
        page=None if all else page,
        limit=None if all else limit,
    )


@router.post(
    "/groups",
    response_model=CodeGroupDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin"))],
)
def code_group_create(
    payload: CodeGroupCreateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> CodeGroupDetailResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/settings/common-codes", action_code="save")
    return CodeGroupDetailResponse(group=create_code_group(session, payload))


@router.put(
    "/groups/{group_id}",
    response_model=CodeGroupDetailResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def code_group_update(
    group_id: int,
    payload: CodeGroupUpdateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> CodeGroupDetailResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/settings/common-codes", action_code="save")
    return CodeGroupDetailResponse(group=update_code_group(session, group_id, payload))


@router.delete(
    "/groups/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin"))],
)
def code_group_delete(
    group_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> Response:
    require_menu_action_for_user(session, user_id=current_user.id, path="/settings/common-codes", action_code="save")
    delete_code_group(session, group_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/groups/{group_id}/items",
    response_model=CodeListResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def code_list(
    group_id: int,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=1000),
    all: bool = Query(default=False),
    code: str | None = Query(default=None),
    name: str | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> CodeListResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/settings/common-codes", action_code="query")
    codes, total_count = list_codes(
        session,
        group_id,
        page=None if all else page,
        limit=None if all else limit,
        code=code,
        name=name,
    )
    return CodeListResponse(
        codes=codes,
        total_count=total_count,
        page=None if all else page,
        limit=None if all else limit,
    )


@router.post(
    "/groups/{group_id}/items",
    response_model=CodeDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin"))],
)
def code_create(
    group_id: int,
    payload: CodeCreateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> CodeDetailResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/settings/common-codes", action_code="save")
    return CodeDetailResponse(code=create_code(session, group_id, payload))


@router.put(
    "/groups/{group_id}/items/{code_id}",
    response_model=CodeDetailResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def code_update(
    group_id: int,
    code_id: int,
    payload: CodeUpdateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> CodeDetailResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/settings/common-codes", action_code="save")
    return CodeDetailResponse(code=update_code(session, group_id, code_id, payload))


@router.delete(
    "/groups/{group_id}/items/{code_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin"))],
)
def code_delete(
    group_id: int,
    code_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> Response:
    require_menu_action_for_user(session, user_id=current_user.id, path="/settings/common-codes", action_code="save")
    delete_code(session, group_id, code_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/groups/by-code/{group_code}/active", response_model=ActiveCodeListResponse)
def active_codes(group_code: str, session: Session = Depends(get_session)) -> ActiveCodeListResponse:
    return ActiveCodeListResponse(group_code=group_code.upper(), options=list_active_codes(session, group_code))
