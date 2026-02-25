"""MNG 개발관리 API 라우터 (추가개발요청, 프로젝트, 문의, 인력현황)."""

from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.mng import (
    MngBulkDeleteRequest,
    MngBulkDeleteResponse,
    MngDevInquiryCreateRequest,
    MngDevInquiryDetailResponse,
    MngDevInquiryListResponse,
    MngDevInquiryUpdateRequest,
    MngDevProjectCreateRequest,
    MngDevProjectDetailResponse,
    MngDevProjectListResponse,
    MngDevProjectUpdateRequest,
    MngDevRequestCreateRequest,
    MngDevRequestDetailResponse,
    MngDevRequestListResponse,
    MngDevRequestMonthlySummaryResponse,
    MngDevRequestUpdateRequest,
    MngDevStaffProjectListResponse,
    MngDevStaffRevenueSummaryResponse,
)
from app.services.mng_dev_service import (
    create_dev_inquiry,
    create_dev_project,
    create_dev_request,
    delete_dev_inquiries,
    delete_dev_projects,
    delete_dev_requests,
    get_dev_inquiry,
    get_dev_project,
    get_dev_request,
    list_dev_inquiries,
    list_dev_projects,
    list_dev_requests,
    list_dev_request_monthly_summary,
    list_dev_staff_projects,
    list_dev_staff_revenue_summary,
    update_dev_inquiry,
    update_dev_project,
    update_dev_request,
)

router = APIRouter(prefix="/mng", tags=["mng-dev"])

_ROLES = [Depends(require_roles("admin", "hr_manager"))]


# ── 추가개발 요청 ──

@router.get("/dev-requests", response_model=MngDevRequestListResponse, dependencies=_ROLES)
def mng_dev_request_list(
    company_id: int | None = Query(default=None),
    status_code: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> MngDevRequestListResponse:
    items = list_dev_requests(session, company_id=company_id, status_code=status_code)
    return MngDevRequestListResponse(items=items, total_count=len(items))


@router.get("/dev-requests/monthly-summary", response_model=MngDevRequestMonthlySummaryResponse, dependencies=_ROLES)
def mng_dev_request_monthly_summary(
    company_id: int | None = Query(default=None),
    status_code: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> MngDevRequestMonthlySummaryResponse:
    items = list_dev_request_monthly_summary(session, company_id=company_id, status_code=status_code)
    return MngDevRequestMonthlySummaryResponse(items=items, total_count=len(items))


@router.get("/dev-requests/{request_id}", response_model=MngDevRequestDetailResponse, dependencies=_ROLES)
def mng_dev_request_detail(request_id: int, session: Session = Depends(get_session)) -> MngDevRequestDetailResponse:
    return MngDevRequestDetailResponse(item=get_dev_request(session, request_id))


@router.post("/dev-requests", response_model=MngDevRequestDetailResponse, status_code=status.HTTP_201_CREATED, dependencies=_ROLES)
def mng_dev_request_create(payload: MngDevRequestCreateRequest, session: Session = Depends(get_session)) -> MngDevRequestDetailResponse:
    return MngDevRequestDetailResponse(item=create_dev_request(session, payload))


@router.put("/dev-requests/{request_id}", response_model=MngDevRequestDetailResponse, dependencies=_ROLES)
def mng_dev_request_update(request_id: int, payload: MngDevRequestUpdateRequest, session: Session = Depends(get_session)) -> MngDevRequestDetailResponse:
    return MngDevRequestDetailResponse(item=update_dev_request(session, request_id, payload))


@router.delete("/dev-requests", response_model=MngBulkDeleteResponse, dependencies=_ROLES)
def mng_dev_request_delete(payload: MngBulkDeleteRequest, session: Session = Depends(get_session)) -> MngBulkDeleteResponse:
    return MngBulkDeleteResponse(deleted_count=delete_dev_requests(session, payload.ids))


# ── 추가개발 프로젝트 ──

@router.get("/dev-projects", response_model=MngDevProjectListResponse, dependencies=_ROLES)
def mng_dev_project_list(
    company_id: int | None = Query(default=None),
    session: Session = Depends(get_session),
) -> MngDevProjectListResponse:
    items = list_dev_projects(session, company_id=company_id)
    return MngDevProjectListResponse(items=items, total_count=len(items))


@router.get("/dev-projects/{project_id}", response_model=MngDevProjectDetailResponse, dependencies=_ROLES)
def mng_dev_project_detail(project_id: int, session: Session = Depends(get_session)) -> MngDevProjectDetailResponse:
    return MngDevProjectDetailResponse(item=get_dev_project(session, project_id))


@router.post("/dev-projects", response_model=MngDevProjectDetailResponse, status_code=status.HTTP_201_CREATED, dependencies=_ROLES)
def mng_dev_project_create(payload: MngDevProjectCreateRequest, session: Session = Depends(get_session)) -> MngDevProjectDetailResponse:
    return MngDevProjectDetailResponse(item=create_dev_project(session, payload))


@router.put("/dev-projects/{project_id}", response_model=MngDevProjectDetailResponse, dependencies=_ROLES)
def mng_dev_project_update(project_id: int, payload: MngDevProjectUpdateRequest, session: Session = Depends(get_session)) -> MngDevProjectDetailResponse:
    return MngDevProjectDetailResponse(item=update_dev_project(session, project_id, payload))


@router.delete("/dev-projects", response_model=MngBulkDeleteResponse, dependencies=_ROLES)
def mng_dev_project_delete(payload: MngBulkDeleteRequest, session: Session = Depends(get_session)) -> MngBulkDeleteResponse:
    return MngBulkDeleteResponse(deleted_count=delete_dev_projects(session, payload.ids))


# ── 추가개발 문의 ──

@router.get("/dev-inquiries", response_model=MngDevInquiryListResponse, dependencies=_ROLES)
def mng_dev_inquiry_list(
    company_id: int | None = Query(default=None),
    progress_code: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> MngDevInquiryListResponse:
    items = list_dev_inquiries(session, company_id=company_id, progress_code=progress_code)
    return MngDevInquiryListResponse(items=items, total_count=len(items))


@router.get("/dev-inquiries/{inquiry_id}", response_model=MngDevInquiryDetailResponse, dependencies=_ROLES)
def mng_dev_inquiry_detail(inquiry_id: int, session: Session = Depends(get_session)) -> MngDevInquiryDetailResponse:
    return MngDevInquiryDetailResponse(item=get_dev_inquiry(session, inquiry_id))


@router.post("/dev-inquiries", response_model=MngDevInquiryDetailResponse, status_code=status.HTTP_201_CREATED, dependencies=_ROLES)
def mng_dev_inquiry_create(payload: MngDevInquiryCreateRequest, session: Session = Depends(get_session)) -> MngDevInquiryDetailResponse:
    return MngDevInquiryDetailResponse(item=create_dev_inquiry(session, payload))


@router.put("/dev-inquiries/{inquiry_id}", response_model=MngDevInquiryDetailResponse, dependencies=_ROLES)
def mng_dev_inquiry_update(inquiry_id: int, payload: MngDevInquiryUpdateRequest, session: Session = Depends(get_session)) -> MngDevInquiryDetailResponse:
    return MngDevInquiryDetailResponse(item=update_dev_inquiry(session, inquiry_id, payload))


@router.delete("/dev-inquiries", response_model=MngBulkDeleteResponse, dependencies=_ROLES)
def mng_dev_inquiry_delete(payload: MngBulkDeleteRequest, session: Session = Depends(get_session)) -> MngBulkDeleteResponse:
    return MngBulkDeleteResponse(deleted_count=delete_dev_inquiries(session, payload.ids))


# ── 인력현황 (읽기 전용) ──

@router.get("/dev-staff/projects", response_model=MngDevStaffProjectListResponse, dependencies=_ROLES)
def mng_dev_staff_projects(
    company_id: int | None = Query(default=None),
    session: Session = Depends(get_session),
) -> MngDevStaffProjectListResponse:
    items = list_dev_staff_projects(session, company_id=company_id)
    return MngDevStaffProjectListResponse(items=items, total_count=len(items))


@router.get("/dev-staff/revenue-summary", response_model=MngDevStaffRevenueSummaryResponse, dependencies=_ROLES)
def mng_dev_staff_revenue_summary(
    company_id: int | None = Query(default=None),
    session: Session = Depends(get_session),
) -> MngDevStaffRevenueSummaryResponse:
    items = list_dev_staff_revenue_summary(session, company_id=company_id)
    return MngDevStaffRevenueSummaryResponse(items=items, total_count=len(items))
