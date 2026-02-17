from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.database import get_session
from app.schemas.dashboard import DashboardSummaryResponse
from app.services.dashboard_service import load_dashboard_summary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def summary(session: Session = Depends(get_session)) -> DashboardSummaryResponse:
    return load_dashboard_summary(session)

