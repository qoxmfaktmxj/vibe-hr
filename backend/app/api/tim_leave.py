from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.core.time_utils import business_today
from app.models import AuthUser, HrEmployee
from app.schemas.tim_leave import (
    TimAnnualLeaveAdjustRequest,
    TimAnnualLeaveListResponse,
    TimAnnualLeaveResponse,
    TimLeaveDecisionRequest,
    TimLeaveRequestCreateRequest,
    TimLeaveRequestListResponse,
)
from app.services.tim_leave_service import (
    adjust_annual_leave,
    cancel_leave_request,
    create_leave_request,
    decide_leave_request,
    get_or_create_annual_leave,
    list_annual_leaves,
    list_leave_requests,
)

router = APIRouter(prefix="/tim", tags=["tim-leave"])


def _current_employee(session: Session, current_user: AuthUser) -> HrEmployee:
    employee = session.exec(select(HrEmployee).where(HrEmployee.user_id == current_user.id)).first()
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee profile not found.")
    return employee


@router.get("/annual-leave/employee/{employee_id}", response_model=TimAnnualLeaveResponse, dependencies=[Depends(require_roles("hr_manager", "admin"))])
def annual_leave_by_employee(employee_id: int, year: int = Query(default_factory=lambda: business_today().year), session: Session = Depends(get_session)) -> TimAnnualLeaveResponse:
    return TimAnnualLeaveResponse(item=get_or_create_annual_leave(session, employee_id, year))


@router.get("/annual-leave/my", response_model=TimAnnualLeaveResponse)
def annual_leave_my(year: int = Query(default_factory=lambda: business_today().year), session: Session = Depends(get_session), current_user: AuthUser = Depends(get_current_user)) -> TimAnnualLeaveResponse:
    employee = _current_employee(session, current_user)
    return TimAnnualLeaveResponse(item=get_or_create_annual_leave(session, employee.id, year))


@router.post("/annual-leave/adjust", response_model=TimAnnualLeaveResponse, dependencies=[Depends(require_roles("hr_manager", "admin"))])
def annual_leave_adjust(payload: TimAnnualLeaveAdjustRequest, session: Session = Depends(get_session)) -> TimAnnualLeaveResponse:
    item = adjust_annual_leave(
        session,
        employee_id=payload.employee_id,
        year=payload.year,
        adjustment_days=payload.adjustment_days,
        reason=payload.reason,
    )
    return TimAnnualLeaveResponse(item=item)


@router.get("/annual-leave/list", response_model=TimAnnualLeaveListResponse, dependencies=[Depends(require_roles("hr_manager", "admin"))])
def annual_leave_list(
    year: int = Query(default_factory=lambda: business_today().year),
    department_id: int | None = Query(default=None),
    keyword: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> TimAnnualLeaveListResponse:
    items = list_annual_leaves(session, year=year, department_id=department_id, keyword=keyword)
    return TimAnnualLeaveListResponse(items=items, total_count=len(items))


@router.get("/leave-requests", response_model=TimLeaveRequestListResponse, dependencies=[Depends(require_roles("hr_manager", "admin"))])
def leave_requests_list(status_filter: str | None = Query(default=None, alias="status"), pending_only: bool = Query(default=False), session: Session = Depends(get_session)) -> TimLeaveRequestListResponse:
    items = list_leave_requests(session, status_filter=status_filter, pending_only=pending_only)
    return TimLeaveRequestListResponse(items=items, total_count=len(items))


@router.get("/leave-requests/my", response_model=TimLeaveRequestListResponse)
def leave_requests_my(status_filter: str | None = Query(default=None, alias="status"), session: Session = Depends(get_session), current_user: AuthUser = Depends(get_current_user)) -> TimLeaveRequestListResponse:
    employee = _current_employee(session, current_user)
    items = list_leave_requests(session, employee_id=employee.id, status_filter=status_filter)
    return TimLeaveRequestListResponse(items=items, total_count=len(items))


@router.post("/leave-requests")
def leave_request_create(payload: TimLeaveRequestCreateRequest, session: Session = Depends(get_session), current_user: AuthUser = Depends(get_current_user)):
    employee = _current_employee(session, current_user)
    return create_leave_request(
        session,
        employee_id=employee.id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason,
    )


@router.post("/leave-requests/{request_id}/approve", dependencies=[Depends(require_roles("hr_manager", "admin"))])
def leave_request_approve(request_id: int, payload: TimLeaveDecisionRequest, session: Session = Depends(get_session), current_user: AuthUser = Depends(get_current_user)):
    employee = _current_employee(session, current_user)
    return decide_leave_request(session, request_id=request_id, approver_employee_id=employee.id, decision="approve", reason=payload.reason)


@router.post("/leave-requests/{request_id}/reject", dependencies=[Depends(require_roles("hr_manager", "admin"))])
def leave_request_reject(request_id: int, payload: TimLeaveDecisionRequest, session: Session = Depends(get_session), current_user: AuthUser = Depends(get_current_user)):
    employee = _current_employee(session, current_user)
    return decide_leave_request(session, request_id=request_id, approver_employee_id=employee.id, decision="reject", reason=payload.reason)


@router.post("/leave-requests/{request_id}/cancel")
def leave_request_cancel(request_id: int, payload: TimLeaveDecisionRequest, session: Session = Depends(get_session), current_user: AuthUser = Depends(get_current_user)):
    employee = _current_employee(session, current_user)
    return cancel_leave_request(session, request_id=request_id, actor_employee_id=employee.id, reason=payload.reason)
