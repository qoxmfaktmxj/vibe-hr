"""MNG 고객사 관리 API 라우터."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.core.pagination import paginate_items
from app.models import AuthUser
from app.services.menu_service import get_allowed_menu_actions_for_user
from app.schemas.mng import (
    MngBulkDeleteRequest,
    MngBulkDeleteResponse,
    MngCompanyCreateRequest,
    MngCompanyDetailResponse,
    MngCompanyDropdownResponse,
    MngCompanyListResponse,
    MngCompanyUpdateRequest,
    MngManagerCompanyCreateRequest,
    MngManagerCompanyListResponse,
)
from app.services.mng_company_service import (
    create_company,
    create_manager_company,
    delete_companies,
    delete_manager_companies,
    get_company,
    list_companies,
    list_company_dropdown,
    list_manager_companies,
    update_company,
)

router = APIRouter(prefix="/mng", tags=["mng-company"])


def _require_menu_action(
    session: Session,
    current_user: AuthUser,
    action_code: str,
) -> None:
    allowed = get_allowed_menu_actions_for_user(
        session,
        user_id=current_user.id,
        menu_code="mng.companies",
    )
    if not allowed.get(action_code, False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action not allowed.")


# ── 고객사 CRUD ──

@router.get(
    "/companies",
    response_model=MngCompanyListResponse,
    dependencies=[Depends(require_roles("admin", "hr_manager"))],
)
def mng_company_list(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> MngCompanyListResponse:
    _require_menu_action(session, current_user, "query")
    items = list_companies(session, search=search)
    paged_items, total_count = paginate_items(items, page, limit)
    return MngCompanyListResponse(companies=paged_items, total_count=total_count, page=page, limit=limit)


@router.get(
    "/companies/dropdown",
    response_model=MngCompanyDropdownResponse,
    dependencies=[Depends(require_roles("admin", "hr_manager"))],
)
def mng_company_dropdown(
    session: Session = Depends(get_session),
) -> MngCompanyDropdownResponse:
    items = list_company_dropdown(session)
    return MngCompanyDropdownResponse(companies=items)


@router.get(
    "/companies/{company_id}",
    response_model=MngCompanyDetailResponse,
    dependencies=[Depends(require_roles("admin", "hr_manager"))],
)
def mng_company_detail(
    company_id: int,
    session: Session = Depends(get_session),
) -> MngCompanyDetailResponse:
    item = get_company(session, company_id)
    return MngCompanyDetailResponse(company=item)


@router.post(
    "/companies",
    response_model=MngCompanyDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "hr_manager"))],
)
def mng_company_create(
    payload: MngCompanyCreateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> MngCompanyDetailResponse:
    _require_menu_action(session, current_user, "save")
    item = create_company(session, payload)
    return MngCompanyDetailResponse(company=item)


@router.put(
    "/companies/{company_id}",
    response_model=MngCompanyDetailResponse,
    dependencies=[Depends(require_roles("admin", "hr_manager"))],
)
def mng_company_update(
    company_id: int,
    payload: MngCompanyUpdateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> MngCompanyDetailResponse:
    _require_menu_action(session, current_user, "save")
    item = update_company(session, company_id, payload)
    return MngCompanyDetailResponse(company=item)


@router.delete(
    "/companies",
    response_model=MngBulkDeleteResponse,
    dependencies=[Depends(require_roles("admin", "hr_manager"))],
)
def mng_company_delete(
    payload: MngBulkDeleteRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> MngBulkDeleteResponse:
    _require_menu_action(session, current_user, "save")
    cnt = delete_companies(session, payload.ids)
    return MngBulkDeleteResponse(deleted_count=cnt)


# ── 담당자 현황 ──

@router.get(
    "/manager-status",
    response_model=MngManagerCompanyListResponse,
    dependencies=[Depends(require_roles("admin", "hr_manager"))],
)
def mng_manager_status_list(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_session),
) -> MngManagerCompanyListResponse:
    items = list_manager_companies(session)
    paged_items, total_count = paginate_items(items, page, limit)
    return MngManagerCompanyListResponse(items=paged_items, total_count=total_count, page=page, limit=limit)


@router.post(
    "/manager-status",
    response_model=MngManagerCompanyListResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "hr_manager"))],
)
def mng_manager_status_create(
    payload: MngManagerCompanyCreateRequest,
    session: Session = Depends(get_session),
) -> MngManagerCompanyListResponse:
    create_manager_company(session, payload)
    items = list_manager_companies(session)
    total_count = len(items)
    return MngManagerCompanyListResponse(items=items, total_count=total_count, page=1, limit=max(total_count, 1))


@router.delete(
    "/manager-status",
    response_model=MngBulkDeleteResponse,
    dependencies=[Depends(require_roles("admin", "hr_manager"))],
)
def mng_manager_status_delete(
    payload: MngBulkDeleteRequest,
    session: Session = Depends(get_session),
) -> MngBulkDeleteResponse:
    cnt = delete_manager_companies(session, payload.ids)
    return MngBulkDeleteResponse(deleted_count=cnt)
