from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.hr_appointment_code import (
    HrAppointmentCodeCreateRequest,
    HrAppointmentCodeDetailResponse,
    HrAppointmentCodeListResponse,
    HrAppointmentCodeUpdateRequest,
)
from app.services.hr_appointment_code_service import (
    create_appointment_code,
    delete_appointment_code,
    list_appointment_codes,
    update_appointment_code,
)

router = APIRouter(prefix="/hr/appointment-codes", tags=["hr-appointment-codes"])


@router.get(
    "",
    response_model=HrAppointmentCodeListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def hr_appointment_code_list(session: Session = Depends(get_session)) -> HrAppointmentCodeListResponse:
    return HrAppointmentCodeListResponse(items=list_appointment_codes(session))


@router.post(
    "",
    response_model=HrAppointmentCodeDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def hr_appointment_code_create(
    payload: HrAppointmentCodeCreateRequest,
    session: Session = Depends(get_session),
) -> HrAppointmentCodeDetailResponse:
    return HrAppointmentCodeDetailResponse(item=create_appointment_code(session, payload))


@router.put(
    "/{code_id}",
    response_model=HrAppointmentCodeDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def hr_appointment_code_update(
    code_id: int,
    payload: HrAppointmentCodeUpdateRequest,
    session: Session = Depends(get_session),
) -> HrAppointmentCodeDetailResponse:
    return HrAppointmentCodeDetailResponse(item=update_appointment_code(session, code_id, payload))


@router.delete(
    "/{code_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def hr_appointment_code_delete(code_id: int, session: Session = Depends(get_session)) -> Response:
    delete_appointment_code(session, code_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

