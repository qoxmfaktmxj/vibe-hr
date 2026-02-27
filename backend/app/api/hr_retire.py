from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.hr_retire import (
    HrRetireCaseCancelRequest,
    HrRetireCaseChecklistUpdateRequest,
    HrRetireCaseCreateRequest,
    HrRetireCaseDetailResponse,
    HrRetireCaseListResponse,
    HrRetireChecklistCreateRequest,
    HrRetireChecklistItemResponse,
    HrRetireChecklistListResponse,
    HrRetireChecklistUpdateRequest,
)
from app.services.hr_retire_service import (
    cancel_retire_case,
    confirm_retire_case,
    create_retire_case,
    create_retire_checklist_item,
    get_retire_case_detail,
    list_retire_cases,
    list_retire_checklist_items,
    update_retire_case_check_item,
    update_retire_checklist_item,
)

router = APIRouter(prefix="/hr/retire", tags=["hr-retire"])


@router.get(
    "/checklist",
    response_model=HrRetireChecklistListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def retire_checklist_list(
    include_inactive: bool = Query(default=False),
    session: Session = Depends(get_session),
) -> HrRetireChecklistListResponse:
    return HrRetireChecklistListResponse(
        items=list_retire_checklist_items(session, include_inactive=include_inactive)
    )


@router.post(
    "/checklist",
    response_model=HrRetireChecklistItemResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def retire_checklist_create(
    payload: HrRetireChecklistCreateRequest,
    session: Session = Depends(get_session),
) -> HrRetireChecklistItemResponse:
    return create_retire_checklist_item(session, payload)


@router.put(
    "/checklist/{checklist_item_id}",
    response_model=HrRetireChecklistItemResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def retire_checklist_update(
    checklist_item_id: int,
    payload: HrRetireChecklistUpdateRequest,
    session: Session = Depends(get_session),
) -> HrRetireChecklistItemResponse:
    return update_retire_checklist_item(session, checklist_item_id, payload)


@router.get(
    "/cases",
    response_model=HrRetireCaseListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def retire_case_list(
    status: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> HrRetireCaseListResponse:
    return list_retire_cases(session, status_filter=status)


@router.post(
    "/cases",
    response_model=HrRetireCaseDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def retire_case_create(
    payload: HrRetireCaseCreateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HrRetireCaseDetailResponse:
    return create_retire_case(session, payload, actor_user_id=current_user.id)


@router.get(
    "/cases/{case_id}",
    response_model=HrRetireCaseDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def retire_case_detail(case_id: int, session: Session = Depends(get_session)) -> HrRetireCaseDetailResponse:
    return get_retire_case_detail(session, case_id)


@router.put(
    "/cases/{case_id}/items/{case_item_id}",
    response_model=HrRetireCaseDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def retire_case_item_update(
    case_id: int,
    case_item_id: int,
    payload: HrRetireCaseChecklistUpdateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HrRetireCaseDetailResponse:
    return update_retire_case_check_item(
        session,
        case_id=case_id,
        case_item_id=case_item_id,
        payload=payload,
        actor_user_id=current_user.id,
    )


@router.post(
    "/cases/{case_id}/confirm",
    response_model=HrRetireCaseDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def retire_case_confirm(
    case_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HrRetireCaseDetailResponse:
    return confirm_retire_case(session, case_id=case_id, actor_user_id=current_user.id)


@router.post(
    "/cases/{case_id}/cancel",
    response_model=HrRetireCaseDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def retire_case_cancel(
    case_id: int,
    payload: HrRetireCaseCancelRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HrRetireCaseDetailResponse:
    return cancel_retire_case(session, case_id=case_id, payload=payload, actor_user_id=current_user.id)

