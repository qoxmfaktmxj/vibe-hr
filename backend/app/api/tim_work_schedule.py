from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.tim_work_schedule import (
    TimWorkScheduleCodeBatchRequest,
    TimWorkScheduleCodeBatchResponse,
    TimWorkScheduleCodeListResponse,
)
from app.services.tim_work_schedule_service import (
    batch_save_work_schedule_codes,
    list_work_schedule_codes,
)

router = APIRouter(prefix="/tim/work-schedules", tags=["tim-work-schedules"])


@router.get(
    "",
    response_model=TimWorkScheduleCodeListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def get_work_schedule_codes(
    session: Session = Depends(get_session),
) -> TimWorkScheduleCodeListResponse:
    items = list_work_schedule_codes(session)
    return TimWorkScheduleCodeListResponse(items=items, total_count=len(items))


@router.post(
    "/batch",
    response_model=TimWorkScheduleCodeBatchResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def save_work_schedule_codes_batch(
    payload: TimWorkScheduleCodeBatchRequest,
    session: Session = Depends(get_session),
) -> TimWorkScheduleCodeBatchResponse:
    return batch_save_work_schedule_codes(session, payload)
