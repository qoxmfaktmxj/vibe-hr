from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.hr_recruit import (
    HrRecruitBulkDeleteRequest,
    HrRecruitBulkDeleteResponse,
    HrRecruitCreateEmployeesRequest,
    HrRecruitCreateEmployeesResponse,
    HrRecruitFinalistCreateRequest,
    HrRecruitFinalistDetailResponse,
    HrRecruitFinalistListResponse,
    HrRecruitFinalistUpdateRequest,
    HrRecruitGenerateEmployeeNoRequest,
    HrRecruitGenerateEmployeeNoResponse,
    HrRecruitIfSyncRequest,
    HrRecruitIfSyncResponse,
)
from app.services.hr_recruit_service import (
    create_employees_from_finalists,
    create_finalist,
    delete_finalists,
    generate_employee_numbers,
    list_finalists,
    sync_if_rows,
    update_finalist,
)

router = APIRouter(prefix="/hr/recruit", tags=["hr-recruit"])


@router.get(
    "/finalists",
    response_model=HrRecruitFinalistListResponse,
    dependencies=[Depends(require_roles("admin", "hr_manager"))],
)
def hr_recruit_finalist_list(
    search: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> HrRecruitFinalistListResponse:
    items = list_finalists(session, search=search)
    return HrRecruitFinalistListResponse(items=items, total_count=len(items))


@router.post(
    "/finalists",
    response_model=HrRecruitFinalistDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "hr_manager"))],
)
def hr_recruit_finalist_create(
    payload: HrRecruitFinalistCreateRequest,
    session: Session = Depends(get_session),
) -> HrRecruitFinalistDetailResponse:
    item = create_finalist(session, payload)
    return HrRecruitFinalistDetailResponse(item=item)


@router.put(
    "/finalists/{finalist_id}",
    response_model=HrRecruitFinalistDetailResponse,
    dependencies=[Depends(require_roles("admin", "hr_manager"))],
)
def hr_recruit_finalist_update(
    finalist_id: int,
    payload: HrRecruitFinalistUpdateRequest,
    session: Session = Depends(get_session),
) -> HrRecruitFinalistDetailResponse:
    item = update_finalist(session, finalist_id, payload)
    return HrRecruitFinalistDetailResponse(item=item)


@router.delete(
    "/finalists",
    response_model=HrRecruitBulkDeleteResponse,
    dependencies=[Depends(require_roles("admin", "hr_manager"))],
)
def hr_recruit_finalist_delete(
    payload: HrRecruitBulkDeleteRequest,
    session: Session = Depends(get_session),
) -> HrRecruitBulkDeleteResponse:
    deleted_count = delete_finalists(session, payload.ids)
    return HrRecruitBulkDeleteResponse(deleted_count=deleted_count)


@router.post(
    "/finalists/if-sync",
    response_model=HrRecruitIfSyncResponse,
    dependencies=[Depends(require_roles("admin", "hr_manager"))],
)
def hr_recruit_finalist_if_sync(
    payload: HrRecruitIfSyncRequest,
    session: Session = Depends(get_session),
) -> HrRecruitIfSyncResponse:
    inserted_count, updated_count = sync_if_rows(session, payload.rows)
    return HrRecruitIfSyncResponse(inserted_count=inserted_count, updated_count=updated_count)


@router.post(
    "/finalists/generate-employee-no",
    response_model=HrRecruitGenerateEmployeeNoResponse,
    dependencies=[Depends(require_roles("admin", "hr_manager"))],
)
def hr_recruit_finalist_generate_employee_no(
    payload: HrRecruitGenerateEmployeeNoRequest,
    session: Session = Depends(get_session),
) -> HrRecruitGenerateEmployeeNoResponse:
    updated_count, skipped_count = generate_employee_numbers(session, payload.ids)
    return HrRecruitGenerateEmployeeNoResponse(updated_count=updated_count, skipped_count=skipped_count)


@router.post(
    "/finalists/create-employees",
    response_model=HrRecruitCreateEmployeesResponse,
    dependencies=[Depends(require_roles("admin", "hr_manager"))],
)
def hr_recruit_finalist_create_employees(
    payload: HrRecruitCreateEmployeesRequest,
    session: Session = Depends(get_session),
) -> HrRecruitCreateEmployeesResponse:
    return create_employees_from_finalists(session, payload.ids)
