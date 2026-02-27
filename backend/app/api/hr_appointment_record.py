from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.hr_appointment_record import (
    HrAppointmentOrderConfirmResponse,
    HrAppointmentRecordCreateRequest,
    HrAppointmentRecordDetailResponse,
    HrAppointmentRecordListResponse,
    HrAppointmentRecordUpdateRequest,
)
from app.services.hr_appointment_record_service import (
    confirm_appointment_order,
    create_appointment_record,
    delete_appointment_record,
    list_appointment_records,
    update_appointment_record,
)

router = APIRouter(prefix="/hr/appointments", tags=["hr-appointments"])


@router.get(
    "/records",
    response_model=HrAppointmentRecordListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def hr_appointment_record_list(
    employee_no: str | None = Query(default=None),
    name: str | None = Query(default=None),
    department: str | None = Query(default=None),
    order_status: str | None = Query(default=None),
    appointment_kind: str | None = Query(default=None),
    appointment_no: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> HrAppointmentRecordListResponse:
    items = list_appointment_records(
        session,
        employee_no=employee_no,
        name=name,
        department=department,
        order_status=order_status,
        appointment_kind=appointment_kind,
        appointment_no=appointment_no,
    )
    return HrAppointmentRecordListResponse(items=items)


@router.post(
    "/records",
    response_model=HrAppointmentRecordDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def hr_appointment_record_create(
    payload: HrAppointmentRecordCreateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HrAppointmentRecordDetailResponse:
    item = create_appointment_record(session, payload, current_user.id or 0)
    return HrAppointmentRecordDetailResponse(item=item)


@router.put(
    "/records/{item_id}",
    response_model=HrAppointmentRecordDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def hr_appointment_record_update(
    item_id: int,
    payload: HrAppointmentRecordUpdateRequest,
    session: Session = Depends(get_session),
) -> HrAppointmentRecordDetailResponse:
    item = update_appointment_record(session, item_id, payload)
    return HrAppointmentRecordDetailResponse(item=item)


@router.delete(
    "/records/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def hr_appointment_record_delete(item_id: int, session: Session = Depends(get_session)) -> Response:
    delete_appointment_record(session, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/orders/{order_id}/confirm",
    response_model=HrAppointmentOrderConfirmResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def hr_appointment_order_confirm(
    order_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HrAppointmentOrderConfirmResponse:
    return confirm_appointment_order(session, order_id, current_user.id or 0)
