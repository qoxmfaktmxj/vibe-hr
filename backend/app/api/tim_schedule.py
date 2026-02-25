from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser, HrEmployee
from app.schemas.tim_schedule import (
    TimScheduleGenerateRequest,
    TimScheduleGenerateResponse,
    TimScheduleTodayResponse,
)
from app.services.tim_schedule_service import generate_employee_daily_schedules, get_my_today_schedule

router = APIRouter(prefix="/tim/schedules", tags=["tim-schedules"])


@router.post(
    "/generate",
    response_model=TimScheduleGenerateResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def schedule_generate(payload: TimScheduleGenerateRequest, session: Session = Depends(get_session)) -> TimScheduleGenerateResponse:
    return generate_employee_daily_schedules(session, payload)


@router.get("/me/today", response_model=TimScheduleTodayResponse)
def my_schedule_today(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimScheduleTodayResponse:
    employee = session.exec(select(HrEmployee).where(HrEmployee.user_id == current_user.id)).first()
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee profile not found.")
    return TimScheduleTodayResponse(item=get_my_today_schedule(session, employee.id))
