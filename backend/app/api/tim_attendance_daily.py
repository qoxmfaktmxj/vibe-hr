from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser, HrEmployee, TimEmployeeDailySchedule, TimHoliday, TimSchedulePattern, TimWorkScheduleCode
from app.schemas.tim_attendance_daily import (
    TimAttendanceCorrectionListResponse,
    TimAttendanceCorrectRequest,
    TimAttendanceDailyItem,
    TimAttendanceDailyListResponse,
    TimAttendanceTodayResponse,
    TimCheckInOutRequest,
    TimTodayScheduleItem,
    TimTodayScheduleResponse,
)
from app.services.tim_attendance_daily_service import (
    check_in,
    check_out,
    correct_attendance,
    get_today_attendance,
    get_attendance_by_id,
    list_attendance_daily,
    list_corrections,
    resolve_target_employee_id,
)

router = APIRouter(prefix="/tim/attendance-daily", tags=["tim-attendance-daily"])


@router.get(
    "",
    response_model=TimAttendanceDailyListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def attendance_daily_list(
    start_date: date,
    end_date: date,
    employee_id: int | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_session),
) -> TimAttendanceDailyListResponse:
    return list_attendance_daily(
        session,
        start_date=start_date,
        end_date=end_date,
        employee_id=employee_id,
        status_filter=status_filter,
        page=page,
        limit=limit,
    )


@router.get("/today", response_model=TimAttendanceTodayResponse)
def attendance_today(
    employee_id: int | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimAttendanceTodayResponse:
    target_employee_id = resolve_target_employee_id(session, current_user, employee_id)
    return TimAttendanceTodayResponse(item=get_today_attendance(session, target_employee_id))


@router.get("/today-schedule", response_model=TimTodayScheduleResponse)
def attendance_today_schedule(
    employee_id: int | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimTodayScheduleResponse:
    target_employee_id = resolve_target_employee_id(session, current_user, employee_id)
    today = date.today()

    holiday = session.exec(select(TimHoliday).where(TimHoliday.holiday_date == today)).first()
    daily = session.exec(
        select(TimEmployeeDailySchedule).where(
            TimEmployeeDailySchedule.employee_id == target_employee_id,
            TimEmployeeDailySchedule.work_date == today,
        )
    ).first()

    pattern = session.get(TimSchedulePattern, daily.pattern_id) if daily and daily.pattern_id else None

    default_schedule = session.exec(
        select(TimWorkScheduleCode)
        .where(TimWorkScheduleCode.is_active == True)
        .order_by(TimWorkScheduleCode.sort_order.asc(), TimWorkScheduleCode.id.asc())
    ).first()

    if default_schedule is None:
        default_schedule = TimWorkScheduleCode(
            id=0,
            code="WS00",
            name="기본근무",
            work_start="09:00",
            work_end="18:00",
            break_minutes=60,
            work_hours=8.0,
            is_active=True,
            sort_order=0,
        )

    is_weekend = today.weekday() >= 5
    day_type = "weekend" if is_weekend else "workday"
    if holiday is not None:
        day_type = "holiday"
    if daily is not None:
        day_type = "holiday" if daily.is_holiday else ("workday" if daily.is_workday else "weekend")

    attendance = get_today_attendance(session, target_employee_id)
    work_start = daily.planned_start_at.strftime("%H:%M") if daily and daily.planned_start_at else default_schedule.work_start
    work_end = daily.planned_end_at.strftime("%H:%M") if daily and daily.planned_end_at else default_schedule.work_end
    schedule = TimTodayScheduleItem(
        work_date=today,
        day_type=day_type,
        schedule_code=pattern.code if pattern else default_schedule.code,
        schedule_name=pattern.name if pattern else default_schedule.name,
        work_start=work_start,
        work_end=work_end,
        break_minutes=daily.break_minutes if daily else default_schedule.break_minutes,
        work_hours=((daily.expected_minutes if daily else int(default_schedule.work_hours * 60)) / 60),
        is_holiday=daily.is_holiday if daily is not None else holiday is not None,
        holiday_name=daily.holiday_name if daily is not None else (holiday.name if holiday is not None else None),
    )
    return TimTodayScheduleResponse(schedule=schedule, attendance=attendance)


@router.get("/detail/{attendance_id}", response_model=TimAttendanceDailyItem, dependencies=[Depends(require_roles("hr_manager", "admin"))])
def attendance_detail(attendance_id: int, session: Session = Depends(get_session)) -> TimAttendanceDailyItem:
    return get_attendance_by_id(session, attendance_id)


@router.post("/check-in", response_model=TimAttendanceDailyItem)
def attendance_check_in(
    payload: TimCheckInOutRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimAttendanceDailyItem:
    target_employee_id = resolve_target_employee_id(session, current_user, payload.employee_id)
    return check_in(session, target_employee_id)


@router.post("/check-out", response_model=TimAttendanceDailyItem)
def attendance_check_out(
    payload: TimCheckInOutRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimAttendanceDailyItem:
    target_employee_id = resolve_target_employee_id(session, current_user, payload.employee_id)
    return check_out(session, target_employee_id)


@router.post(
    "/{attendance_id}/correct",
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def attendance_correct(
    attendance_id: int,
    payload: TimAttendanceCorrectRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
):
    employee = session.exec(select(HrEmployee).where(HrEmployee.user_id == current_user.id)).first()
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="관리자 사원 프로필을 찾을 수 없습니다.")

    return correct_attendance(
        session,
        attendance_id=attendance_id,
        corrected_by_employee_id=employee.id,
        new_status=payload.new_status,
        reason=payload.reason,
        new_check_in_at=payload.new_check_in_at,
        new_check_out_at=payload.new_check_out_at,
    )


@router.get(
    "/{attendance_id}/corrections",
    response_model=TimAttendanceCorrectionListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def attendance_corrections(attendance_id: int, session: Session = Depends(get_session)) -> TimAttendanceCorrectionListResponse:
    items = list_corrections(session, attendance_id)
    return TimAttendanceCorrectionListResponse(corrections=items, total_count=len(items))
