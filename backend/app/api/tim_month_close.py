from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.core.time_utils import business_today
from app.models import AuthUser
from app.schemas.tim_month_close import (
    TimMonthCloseActionResponse,
    TimMonthCloseListResponse,
    TimMonthCloseRequest,
)
from app.services.tim_month_close_service import (
    close_month,
    list_month_closes,
    reopen_month,
)

router = APIRouter(prefix="/tim/month-close", tags=["tim-month-close"])


@router.get(
    "",
    response_model=TimMonthCloseListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def list_month_closes_api(
    year: int | None = Query(default=None),
    session: Session = Depends(get_session),
) -> TimMonthCloseListResponse:
    if year is None:
        year = business_today().year
    return list_month_closes(session, year)


@router.post(
    "",
    response_model=TimMonthCloseActionResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def close_month_api(
    payload: TimMonthCloseRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimMonthCloseActionResponse:
    return close_month(session, payload.year, payload.month, current_user.id, payload.note)


@router.post(
    "/{year}/{month}/reopen",
    response_model=TimMonthCloseActionResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def reopen_month_api(
    year: int,
    month: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimMonthCloseActionResponse:
    return reopen_month(session, year, month, current_user.id)
