from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
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

router = APIRouter(prefix="/codes", tags=["common-codes"])


@router.get(
    "/groups",
    response_model=CodeGroupListResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def code_groups(session: Session = Depends(get_session)) -> CodeGroupListResponse:
    return CodeGroupListResponse(groups=list_code_groups(session))


@router.post(
    "/groups",
    response_model=CodeGroupDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin"))],
)
def code_group_create(
    payload: CodeGroupCreateRequest,
    session: Session = Depends(get_session),
) -> CodeGroupDetailResponse:
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
) -> CodeGroupDetailResponse:
    return CodeGroupDetailResponse(group=update_code_group(session, group_id, payload))


@router.delete(
    "/groups/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin"))],
)
def code_group_delete(group_id: int, session: Session = Depends(get_session)) -> Response:
    delete_code_group(session, group_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/groups/{group_id}/items",
    response_model=CodeListResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def code_list(group_id: int, session: Session = Depends(get_session)) -> CodeListResponse:
    return CodeListResponse(codes=list_codes(session, group_id))


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
) -> CodeDetailResponse:
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
) -> CodeDetailResponse:
    return CodeDetailResponse(code=update_code(session, group_id, code_id, payload))


@router.delete(
    "/groups/{group_id}/items/{code_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin"))],
)
def code_delete(group_id: int, code_id: int, session: Session = Depends(get_session)) -> Response:
    delete_code(session, group_id, code_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/groups/by-code/{group_code}/active", response_model=ActiveCodeListResponse)
def active_codes(group_code: str, session: Session = Depends(get_session)) -> ActiveCodeListResponse:
    return ActiveCodeListResponse(group_code=group_code.upper(), options=list_active_codes(session, group_code))
