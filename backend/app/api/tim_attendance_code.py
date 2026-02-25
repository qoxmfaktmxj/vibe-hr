from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.tim_attendance_code import (
    TimAttendanceCodeBatchRequest,
    TimAttendanceCodeBatchResponse,
    TimAttendanceCodeListResponse,
)
from app.services.tim_attendance_code_service import (
    batch_save_attendance_codes,
    list_attendance_codes,
)

router = APIRouter(prefix="/tim/attendance-codes", tags=["tim-attendance-codes"])


@router.get(
    "",
    response_model=TimAttendanceCodeListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def get_attendance_codes(
    session: Session = Depends(get_session),
) -> TimAttendanceCodeListResponse:
    items = list_attendance_codes(session)
    return TimAttendanceCodeListResponse(items=items, total_count=len(items))


@router.post(
    "/batch",
    response_model=TimAttendanceCodeBatchResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def save_attendance_codes_batch(
    payload: TimAttendanceCodeBatchRequest,
    session: Session = Depends(get_session),
) -> TimAttendanceCodeBatchResponse:
    return batch_save_attendance_codes(session, payload)
