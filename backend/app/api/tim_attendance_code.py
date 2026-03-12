from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.tim_attendance_code import (
    TimAttendanceCodeBatchRequest,
    TimAttendanceCodeBatchResponse,
    TimAttendanceCodeListResponse,
)
from app.services.menu_service import get_allowed_menu_actions_for_user
from app.services.tim_attendance_code_service import (
    batch_save_attendance_codes,
    list_attendance_codes,
)

router = APIRouter(prefix="/tim/attendance-codes", tags=["tim-attendance-codes"])


def _require_menu_action(
    session: Session,
    current_user: AuthUser,
    action_code: str,
) -> None:
    allowed = get_allowed_menu_actions_for_user(
        session,
        user_id=current_user.id,
        path="/tim/codes",
    )
    if not allowed.get(action_code, False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action not allowed.")


@router.get(
    "",
    response_model=TimAttendanceCodeListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def get_attendance_codes(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimAttendanceCodeListResponse:
    _require_menu_action(session, current_user, "query")
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
    current_user: AuthUser = Depends(get_current_user),
) -> TimAttendanceCodeBatchResponse:
    _require_menu_action(session, current_user, "save")
    return batch_save_attendance_codes(session, payload)
