"""MNG 외주관리 API 라우터."""

from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.core.pagination import paginate_items
from app.schemas.mng import (
    MngBulkDeleteRequest,
    MngBulkDeleteResponse,
    MngOutsourceAttendanceCreateRequest,
    MngOutsourceAttendanceListResponse,
    MngOutsourceAttendanceSummaryResponse,
    MngOutsourceContractCreateRequest,
    MngOutsourceContractDetailResponse,
    MngOutsourceContractDuplicateResponse,
    MngOutsourceContractListResponse,
    MngOutsourceContractUpdateRequest,
)
from app.services.mng_outsource_service import (
    create_outsource_attendance,
    create_outsource_contract,
    delete_outsource_attendances,
    delete_outsource_contracts,
    get_outsource_contract,
    has_duplicate_outsource_contract,
    list_outsource_attendance_summary,
    list_outsource_attendances,
    list_outsource_contracts,
    update_outsource_contract,
)

router = APIRouter(prefix="/mng", tags=["mng-outsource"])

_ROLES = [Depends(require_roles("admin", "hr_manager"))]


# ── 외주 계약 ──

@router.get("/outsource-contracts", response_model=MngOutsourceContractListResponse, dependencies=_ROLES)
def mng_outsource_contract_list(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_session),
) -> MngOutsourceContractListResponse:
    items = list_outsource_contracts(session, search=search)
    paged_items, total_count = paginate_items(items, page, limit)
    return MngOutsourceContractListResponse(items=paged_items, total_count=total_count, page=page, limit=limit)


@router.get("/outsource-contracts/check-duplicate", response_model=MngOutsourceContractDuplicateResponse, dependencies=_ROLES)
def mng_outsource_contract_check_duplicate(
    employee_id: int = Query(...),
    start_date: date = Query(...),
    exclude_contract_id: int | None = Query(default=None),
    session: Session = Depends(get_session),
) -> MngOutsourceContractDuplicateResponse:
    return MngOutsourceContractDuplicateResponse(
        is_duplicate=has_duplicate_outsource_contract(
            session,
            employee_id=employee_id,
            start_date=start_date,
            exclude_contract_id=exclude_contract_id,
        )
    )


@router.get("/outsource-contracts/{contract_id}", response_model=MngOutsourceContractDetailResponse, dependencies=_ROLES)
def mng_outsource_contract_detail(contract_id: int, session: Session = Depends(get_session)) -> MngOutsourceContractDetailResponse:
    return MngOutsourceContractDetailResponse(item=get_outsource_contract(session, contract_id))


@router.post("/outsource-contracts", response_model=MngOutsourceContractDetailResponse, status_code=status.HTTP_201_CREATED, dependencies=_ROLES)
def mng_outsource_contract_create(payload: MngOutsourceContractCreateRequest, session: Session = Depends(get_session)) -> MngOutsourceContractDetailResponse:
    return MngOutsourceContractDetailResponse(item=create_outsource_contract(session, payload))


@router.put("/outsource-contracts/{contract_id}", response_model=MngOutsourceContractDetailResponse, dependencies=_ROLES)
def mng_outsource_contract_update(contract_id: int, payload: MngOutsourceContractUpdateRequest, session: Session = Depends(get_session)) -> MngOutsourceContractDetailResponse:
    return MngOutsourceContractDetailResponse(item=update_outsource_contract(session, contract_id, payload))


@router.delete("/outsource-contracts", response_model=MngBulkDeleteResponse, dependencies=_ROLES)
def mng_outsource_contract_delete(payload: MngBulkDeleteRequest, session: Session = Depends(get_session)) -> MngBulkDeleteResponse:
    return MngBulkDeleteResponse(deleted_count=delete_outsource_contracts(session, payload.ids))


# ── 외주 근태 ──

@router.get("/outsource-attendances/summary", response_model=MngOutsourceAttendanceSummaryResponse, dependencies=_ROLES)
def mng_outsource_attendance_summary(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_session),
) -> MngOutsourceAttendanceSummaryResponse:
    items = list_outsource_attendance_summary(session)
    paged_items, total_count = paginate_items(items, page, limit)
    return MngOutsourceAttendanceSummaryResponse(items=paged_items, total_count=total_count, page=page, limit=limit)


@router.get("/outsource-attendances/{contract_id}", response_model=MngOutsourceAttendanceListResponse, dependencies=_ROLES)
def mng_outsource_attendance_list(
    contract_id: int,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_session),
) -> MngOutsourceAttendanceListResponse:
    items = list_outsource_attendances(session, contract_id)
    paged_items, total_count = paginate_items(items, page, limit)
    return MngOutsourceAttendanceListResponse(items=paged_items, total_count=total_count, page=page, limit=limit)


@router.post("/outsource-attendances", response_model=MngOutsourceAttendanceListResponse, status_code=status.HTTP_201_CREATED, dependencies=_ROLES)
def mng_outsource_attendance_create(payload: MngOutsourceAttendanceCreateRequest, session: Session = Depends(get_session)) -> MngOutsourceAttendanceListResponse:
    create_outsource_attendance(session, payload)
    items = list_outsource_attendances(session, payload.contract_id)
    total_count = len(items)
    return MngOutsourceAttendanceListResponse(items=items, total_count=total_count, page=1, limit=max(total_count, 1))


@router.delete("/outsource-attendances", response_model=MngBulkDeleteResponse, dependencies=_ROLES)
def mng_outsource_attendance_delete(payload: MngBulkDeleteRequest, session: Session = Depends(get_session)) -> MngBulkDeleteResponse:
    return MngBulkDeleteResponse(deleted_count=delete_outsource_attendances(session, payload.ids))
