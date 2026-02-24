from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.hr_basic import (
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
    update_hr_basic_profile,
    update_hr_basic_record,
)

router = APIRouter(prefix="/hr/basic", tags=["hr-basic"])


@router.get(
    "/{employee_id}",
    response_model=HrBasicDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def hr_basic_detail(employee_id: int, session: Session = Depends(get_session)) -> HrBasicDetailResponse:
    return get_hr_basic_detail(session, employee_id)


@router.put(
    "/{employee_id}/profile",
    response_model=HrBasicProfile,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def hr_basic_profile_update(
    employee_id: int,
    payload: HrBasicProfileUpdateRequest,
    session: Session = Depends(get_session),
) -> HrBasicProfile:
    return update_hr_basic_profile(session, employee_id, payload)


@router.post(
    "/{employee_id}/records",
    response_model=HrBasicRecordItem,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def hr_basic_record_create(
    employee_id: int,
    payload: HrBasicRecordCreateRequest,
    session: Session = Depends(get_session),
) -> HrBasicRecordItem:
    return create_hr_basic_record(session, employee_id, payload)


@router.put(
    "/{employee_id}/records/{record_id}",
    response_model=HrBasicRecordItem,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def hr_basic_record_update(
    employee_id: int,
    record_id: int,
    payload: HrBasicRecordUpdateRequest,
    session: Session = Depends(get_session),
) -> HrBasicRecordItem:
    return update_hr_basic_record(session, employee_id, record_id, payload)


@router.delete(
    "/{employee_id}/records/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def hr_basic_record_delete(
    employee_id: int,
    record_id: int,
    session: Session = Depends(get_session),
) -> Response:
    delete_hr_basic_record(session, employee_id, record_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
