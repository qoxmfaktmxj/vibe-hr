from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.tim_work_schedule import (
    TimWorkScheduleCodeBatchRequest,
    TimWorkScheduleCodeBatchResponse,
    TimWorkScheduleCodeListResponse,
)
from app.services.menu_service import get_allowed_menu_actions_for_user
from app.services.tim_work_schedule_service import (
    batch_save_work_schedule_codes,
    list_work_schedule_codes,
)

router = APIRouter(prefix="/tim/work-schedules", tags=["tim-work-schedules"])


def _require_menu_action(
    session: Session,
    current_user: AuthUser,
    action_code: str,
) -> None:
    allowed = get_allowed_menu_actions_for_user(
        session,
        user_id=current_user.id,
        path="/tim/work-codes",
    )
    if not allowed.get(action_code, False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action not allowed.")


@router.get(
    "",
    response_model=TimWorkScheduleCodeListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def get_work_schedule_codes(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimWorkScheduleCodeListResponse:
    _require_menu_action(session, current_user, "query")
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
    current_user: AuthUser = Depends(get_current_user),
) -> TimWorkScheduleCodeBatchResponse:
    _require_menu_action(session, current_user, "save")
    return batch_save_work_schedule_codes(session, payload)
