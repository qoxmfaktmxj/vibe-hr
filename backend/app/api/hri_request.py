from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.hri_request import (
    HriRequestActionRequest,
    HriRequestActionResponse,
    HriRequestDetailFullResponse,
    HriRequestDetailResponse,
    HriRequestDraftUpsertRequest,
    HriRequestListResponse,
    HriRequestSubmitResponse,
    HriTaskListResponse,
)
from app.services.hri_request_service import (
    approve_request,
    get_request_detail,
    list_my_approval_tasks,
    list_my_receive_tasks,
    list_my_requests,
    receive_complete_request,
    receive_reject_request,
    reject_request,
    submit_request,
    upsert_request_draft,
    withdraw_request,
)

router = APIRouter(prefix="/hri", tags=["hri-requests"])


@router.post(
    "/requests/draft",
    response_model=HriRequestDetailResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "admin"))],
)
def save_draft(
    payload: HriRequestDraftUpsertRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HriRequestDetailResponse:
    request = upsert_request_draft(session, current_user.id, payload)
    return HriRequestDetailResponse(request=request)


@router.post(
    "/requests/{request_id}/submit",
    response_model=HriRequestSubmitResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "admin"))],
)
def submit(
    request_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HriRequestSubmitResponse:
    return submit_request(session, current_user.id, request_id)


@router.post(
    "/requests/{request_id}/withdraw",
    response_model=HriRequestActionResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "admin"))],
)
def withdraw(
    request_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HriRequestActionResponse:
    return withdraw_request(session, current_user.id, request_id)


@router.post(
    "/requests/{request_id}/approve",
    response_model=HriRequestActionResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "admin"))],
)
def approve(
    request_id: int,
    payload: HriRequestActionRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HriRequestActionResponse:
    return approve_request(session, current_user.id, request_id, payload.comment)


@router.post(
    "/requests/{request_id}/reject",
    response_model=HriRequestActionResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "admin"))],
)
def reject(
    request_id: int,
    payload: HriRequestActionRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HriRequestActionResponse:
    return reject_request(session, current_user.id, request_id, payload.comment)


@router.post(
    "/requests/{request_id}/receive-complete",
    response_model=HriRequestActionResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "admin"))],
)
def receive_complete(
    request_id: int,
    payload: HriRequestActionRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HriRequestActionResponse:
    return receive_complete_request(session, current_user.id, request_id, payload.comment)


@router.post(
    "/requests/{request_id}/receive-reject",
    response_model=HriRequestActionResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "admin"))],
)
def receive_reject(
    request_id: int,
    payload: HriRequestActionRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HriRequestActionResponse:
    return receive_reject_request(session, current_user.id, request_id, payload.comment)


@router.get(
    "/requests/{request_id}",
    response_model=HriRequestDetailFullResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "admin"))],
)
def get_detail(
    request_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HriRequestDetailFullResponse:
    detail = get_request_detail(session, request_id, current_user.id)
    return HriRequestDetailFullResponse(request=detail)


@router.get(
    "/requests/my",
    response_model=HriRequestListResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "admin"))],
)
def my_requests(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HriRequestListResponse:
    items = list_my_requests(session, current_user.id)
    return HriRequestListResponse(items=items, total_count=len(items))


@router.get(
    "/tasks/my-approvals",
    response_model=HriTaskListResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "admin"))],
)
def my_approval_tasks(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HriTaskListResponse:
    items = list_my_approval_tasks(session, current_user.id)
    return HriTaskListResponse(items=items, total_count=len(items))


@router.get(
    "/tasks/my-receives",
    response_model=HriTaskListResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "admin"))],
)
def my_receive_tasks(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HriTaskListResponse:
    items = list_my_receive_tasks(session, current_user.id)
    return HriTaskListResponse(items=items, total_count=len(items))
