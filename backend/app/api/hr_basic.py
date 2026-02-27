from fastapi import APIRouter, Depends, Query, Response, status
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.hr_basic import (
    HrAdminRecordListResponse,
    HrBasicDetailResponse,
    HrBasicProfile,
    HrBasicProfileUpdateRequest,
    HrBasicRecordCreateRequest,
    HrBasicRecordItem,
    HrBasicRecordUpdateRequest,
)
from app.services.hr_basic_service import (
    create_hr_basic_record,
    delete_hr_basic_record,
    get_hr_basic_detail,
    list_hr_admin_records,
    update_hr_basic_profile,
    update_hr_basic_record,
)

router = APIRouter(prefix="/hr/basic", tags=["hr-basic"])


@router.get("/admin-records", response_model=HrAdminRecordListResponse, dependencies=[Depends(require_roles("hr_manager", "admin"))])
def hr_admin_records(
    category: str = Query(...),
    employee_no: str | None = Query(default=None),
    name: str | None = Query(default=None),
    department: str | None = Query(default=None),
    employment_status: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> HrAdminRecordListResponse:
    return list_hr_admin_records(
        session,
        category=category,
        employee_no=employee_no,
        name=name,
        department=department,
        employment_status=employment_status,
    )


@router.get("/{employee_id}", response_model=HrBasicDetailResponse, dependencies=[Depends(require_roles("hr_manager", "admin"))])
def hr_basic_detail(employee_id: int, session: Session = Depends(get_session)) -> HrBasicDetailResponse:
    return get_hr_basic_detail(session, employee_id)


@router.put("/{employee_id}/profile", response_model=HrBasicProfile, dependencies=[Depends(require_roles("hr_manager", "admin"))])
def hr_basic_profile_update(employee_id: int, payload: HrBasicProfileUpdateRequest, session: Session = Depends(get_session)) -> HrBasicProfile:
    return update_hr_basic_profile(session, employee_id, payload)


@router.post("/{employee_id}/records", response_model=HrBasicRecordItem, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles("hr_manager", "admin"))])
def hr_basic_record_create(employee_id: int, payload: HrBasicRecordCreateRequest, session: Session = Depends(get_session)) -> HrBasicRecordItem:
    return create_hr_basic_record(session, employee_id, payload)


@router.put("/{employee_id}/records/{record_id}", response_model=HrBasicRecordItem, dependencies=[Depends(require_roles("hr_manager", "admin"))])
def hr_basic_record_update(
    employee_id: int,
    record_id: int,
    payload: HrBasicRecordUpdateRequest,
    category: str = Query(...),
    session: Session = Depends(get_session),
) -> HrBasicRecordItem:
    return update_hr_basic_record(session, employee_id, record_id, payload, category=category)


@router.delete("/{employee_id}/records/{record_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_roles("hr_manager", "admin"))])
def hr_basic_record_delete(
    employee_id: int,
    record_id: int,
    category: str = Query(...),
    session: Session = Depends(get_session),
) -> Response:
    delete_hr_basic_record(session, employee_id, record_id, category=category)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
