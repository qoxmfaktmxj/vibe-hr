from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.core.time_utils import business_today
from app.schemas.tim_holiday import (
    TimHolidayBatchRequest,
    TimHolidayBatchResponse,
    TimHolidayCopyYearRequest,
    TimHolidayCopyYearResponse,
    TimHolidayListResponse,
)
from app.services.tim_holiday_service import (
    batch_save_holidays,
    copy_year_holidays,
    list_holidays,
)

router = APIRouter(prefix="/tim/holidays", tags=["tim-holidays"])


@router.get(
    "",
    response_model=TimHolidayListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def get_holidays(
    year: int = Query(default=None, ge=2000, le=2100),
    session: Session = Depends(get_session),
) -> TimHolidayListResponse:
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
) -> TimHolidayBatchResponse:
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
) -> TimHolidayCopyYearResponse:
    return copy_year_holidays(session, payload)
