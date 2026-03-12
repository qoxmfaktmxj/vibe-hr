from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.core.time_utils import business_today
from app.models import AuthUser
from app.schemas.tim_holiday import (
    TimHolidayBatchRequest,
    TimHolidayBatchResponse,
    TimHolidayCopyYearRequest,
    TimHolidayCopyYearResponse,
    TimHolidayListResponse,
)
from app.services.menu_service import get_allowed_menu_actions_for_user
from app.services.tim_holiday_service import (
    batch_save_holidays,
    copy_year_holidays,
    list_holidays,
)

router = APIRouter(prefix="/tim/holidays", tags=["tim-holidays"])


def _require_menu_action(
    session: Session,
    current_user: AuthUser,
    action_code: str,
) -> None:
    allowed = get_allowed_menu_actions_for_user(
        session,
        user_id=current_user.id,
        menu_code="tim.holidays",
    )
    if not allowed.get(action_code, False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action not allowed.")


@router.get(
    "",
    response_model=TimHolidayListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def get_holidays(
    year: int = Query(default=None, ge=2000, le=2100),
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimHolidayListResponse:
    _require_menu_action(session, current_user, "query")
    if year is None:
        year = business_today().year
    items = list_holidays(session, year)
    return TimHolidayListResponse(items=items, total_count=len(items), year=year)


@router.post(
    "/batch",
    response_model=TimHolidayBatchResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def save_holidays_batch(
    payload: TimHolidayBatchRequest,
    year: int = Query(default=None, ge=2000, le=2100),
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimHolidayBatchResponse:
    _require_menu_action(session, current_user, "save")
    if year is None:
        year = business_today().year
    return batch_save_holidays(session, payload, year)


@router.post(
    "/copy-year",
    response_model=TimHolidayCopyYearResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def copy_holidays_year(
    payload: TimHolidayCopyYearRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimHolidayCopyYearResponse:
    _require_menu_action(session, current_user, "save")
    return copy_year_holidays(session, payload)
