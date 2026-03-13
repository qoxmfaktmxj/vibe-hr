from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser, HrEmployee
from app.schemas.tim_schedule import (
    TimDepartmentScheduleAssignmentBatchRequest,
    TimDepartmentScheduleAssignmentBatchResponse,
    TimDepartmentScheduleAssignmentListResponse,
    TimEmployeeScheduleExceptionBatchRequest,
    TimEmployeeScheduleExceptionBatchResponse,
    TimEmployeeScheduleExceptionListResponse,
    TimScheduleGenerateRequest,
    TimScheduleGenerateResponse,
    TimSchedulePatternListResponse,
    TimScheduleTodayResponse,
)
from app.services.tim_schedule_service import (
    batch_save_department_schedule_assignments,
    batch_save_employee_schedule_exceptions,
    generate_employee_daily_schedules,
    get_my_today_schedule,
    list_department_schedule_assignments,
    list_employee_schedule_exceptions,
    list_schedule_patterns,
)
from app.services.menu_service import get_allowed_menu_actions_for_user

router = APIRouter(prefix="/tim/schedules", tags=["tim-schedules"])


def _require_menu_action(
    session: Session,
    current_user: AuthUser,
    path: str,
    action_code: str,
) -> None:
    allowed = get_allowed_menu_actions_for_user(
        session,
        user_id=current_user.id,
        path=path,
    )
    if not allowed.get(action_code, False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )


@router.get(
    "/patterns",
    response_model=TimSchedulePatternListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def schedule_patterns(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimSchedulePatternListResponse:
    _require_menu_action(session, current_user, "/tim/work-codes", "query")
    items = list_schedule_patterns(session)
    return TimSchedulePatternListResponse(items=items, total_count=len(items))


@router.get(
    "/departments",
    response_model=TimDepartmentScheduleAssignmentListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def department_assignments(
    department_id: int | None = None,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimDepartmentScheduleAssignmentListResponse:
    _require_menu_action(session, current_user, "/tim/work-codes", "query")
    items = list_department_schedule_assignments(session, department_id=department_id)
    return TimDepartmentScheduleAssignmentListResponse(items=items, total_count=len(items))


@router.post(
    "/departments/batch",
    response_model=TimDepartmentScheduleAssignmentBatchResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def department_assignments_batch(
    payload: TimDepartmentScheduleAssignmentBatchRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimDepartmentScheduleAssignmentBatchResponse:
    _require_menu_action(session, current_user, "/tim/work-codes", "save")
    return batch_save_department_schedule_assignments(session, payload)


@router.get(
    "/exceptions/employees",
    response_model=TimEmployeeScheduleExceptionListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def employee_exceptions(
    employee_id: int | None = None,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimEmployeeScheduleExceptionListResponse:
    _require_menu_action(session, current_user, "/tim/work-codes", "query")
    items = list_employee_schedule_exceptions(session, employee_id=employee_id)
    return TimEmployeeScheduleExceptionListResponse(items=items, total_count=len(items))


@router.post(
    "/exceptions/employees/batch",
    response_model=TimEmployeeScheduleExceptionBatchResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def employee_exceptions_batch(
    payload: TimEmployeeScheduleExceptionBatchRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimEmployeeScheduleExceptionBatchResponse:
    _require_menu_action(session, current_user, "/tim/work-codes", "save")
    return batch_save_employee_schedule_exceptions(session, payload)


@router.post(
    "/generate",
    response_model=TimScheduleGenerateResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def schedule_generate(
    payload: TimScheduleGenerateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TimScheduleGenerateResponse:
    _require_menu_action(session, current_user, "/tim/work-codes", "save")
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
