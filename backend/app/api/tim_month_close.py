from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.tim_month_close import (
    TimMonthCloseItem,
    TimMonthCloseListResponse,
    TimMonthCloseRequest,
    TimMonthReopenRequest,
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
def get_month_closes(
    year: int | None = Query(default=None),
    session: Session = Depends(get_session),
) -> TimMonthCloseListResponse:
    return list_month_closes(session, year=year)


@router.post(
    "",
    response_model=TimMonthCloseItem,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def do_close_month(
    payload: TimMonthCloseRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimMonthCloseItem:
    return close_month(session, payload, current_user.id)


@router.post(
    "/{year}/{month}/reopen",
    response_model=TimMonthCloseItem,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def do_reopen_month(
    year: int,
    month: int,
    payload: TimMonthReopenRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimMonthCloseItem:
    return reopen_month(session, year, month, current_user.id, payload.note)
