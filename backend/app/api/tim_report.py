from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.core.time_utils import business_today
from app.schemas.tim_report import TimReportSummaryResponse
from app.services.tim_report_service import get_tim_report_summary

router = APIRouter(prefix="/tim/reports", tags=["tim-reports"])


@router.get(
    "/summary",
    response_model=TimReportSummaryResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def tim_report_summary(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    session: Session = Depends(get_session),
) -> TimReportSummaryResponse:
    if end_date is None:
        end_date = business_today()
    if start_date is None:
        start_date = end_date - timedelta(days=30)
    return get_tim_report_summary(session, start_date, end_date)
