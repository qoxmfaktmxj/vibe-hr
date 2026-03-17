from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlmodel import Session, select

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser, HrEmployee
from app.schemas.payroll_phase2 import (
    PayEmployeeProfileBatchRequest,
    PayEmployeeProfileBatchResponse,
    PayEmployeeProfileListResponse,
    PayMyPayslipDetailResponse,
    PayMyPayslipListResponse,
    PayPayrollRunActionResponse,
    PayPayrollRunCreateRequest,
    PayPayrollRunEmployeeDetailResponse,
    PayPayrollRunEmployeeListResponse,
    PayPayrollRunListResponse,
    PayVariableInputBatchRequest,
    PayVariableInputBatchResponse,
    PayVariableInputListResponse,
)
from app.services.payroll_phase2_service import (
    batch_save_employee_profiles,
    batch_save_variable_inputs,
    calculate_payroll_run,
    close_payroll_run,
    create_payroll_run,
    get_my_payslip_detail,
    get_payroll_run_employee_detail,
    list_employee_profiles,
    list_my_payslips,
    list_payroll_run_employees,
    list_payroll_runs,
    list_variable_inputs,
    mark_payroll_run_paid,
)

router = APIRouter(prefix="/pay", tags=["payroll-phase2"])


@router.get(
    "/employee-profiles",
    response_model=PayEmployeeProfileListResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def get_employee_profiles(session: Session = Depends(get_session)) -> PayEmployeeProfileListResponse:
    items = list_employee_profiles(session)
    return PayEmployeeProfileListResponse(items=items, total_count=len(items))


@router.post(
    "/employee-profiles/batch",
    response_model=PayEmployeeProfileBatchResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def save_employee_profiles_batch(
    payload: PayEmployeeProfileBatchRequest,
    session: Session = Depends(get_session),
) -> PayEmployeeProfileBatchResponse:
    return batch_save_employee_profiles(session, payload)


@router.get(
    "/variable-inputs",
    response_model=PayVariableInputListResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def get_variable_inputs(
    year_month: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> PayVariableInputListResponse:
    items = list_variable_inputs(session, year_month=year_month)
    return PayVariableInputListResponse(items=items, total_count=len(items))


@router.post(
    "/variable-inputs/batch",
    response_model=PayVariableInputBatchResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def save_variable_inputs_batch(
    payload: PayVariableInputBatchRequest,
    session: Session = Depends(get_session),
) -> PayVariableInputBatchResponse:
    return batch_save_variable_inputs(session, payload)


@router.get(
    "/runs",
    response_model=PayPayrollRunListResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def get_payroll_runs(
    year_month: str | None = Query(default=None),
    status: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> PayPayrollRunListResponse:
    return list_payroll_runs(session, year_month=year_month, status_value=status)


@router.post(
    "/runs",
    response_model=PayPayrollRunActionResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def create_payroll_run_api(
    payload: PayPayrollRunCreateRequest,
    session: Session = Depends(get_session),
) -> PayPayrollRunActionResponse:
    return create_payroll_run(session, payload)


@router.post(
    "/runs/{run_id}/calculate",
    response_model=PayPayrollRunActionResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def calculate_payroll_run_api(
    run_id: int,
    session: Session = Depends(get_session),
) -> PayPayrollRunActionResponse:
    return calculate_payroll_run(session, run_id)


@router.post(
    "/runs/{run_id}/recalculate",
    response_model=PayPayrollRunActionResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def recalculate_payroll_run_api(
    run_id: int,
    session: Session = Depends(get_session),
) -> PayPayrollRunActionResponse:
    return calculate_payroll_run(session, run_id)


@router.post(
    "/runs/{run_id}/close",
    response_model=PayPayrollRunActionResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def close_payroll_run_api(
    run_id: int,
    session: Session = Depends(get_session),
) -> PayPayrollRunActionResponse:
    return close_payroll_run(session, run_id)


@router.post(
    "/runs/{run_id}/mark-paid",
    response_model=PayPayrollRunActionResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def mark_payroll_run_paid_api(
    run_id: int,
    session: Session = Depends(get_session),
) -> PayPayrollRunActionResponse:
    return mark_payroll_run_paid(session, run_id)


@router.get(
    "/runs/{run_id}/employees",
    response_model=PayPayrollRunEmployeeListResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def get_payroll_run_employees(
    run_id: int,
    session: Session = Depends(get_session),
) -> PayPayrollRunEmployeeListResponse:
    return list_payroll_run_employees(session, run_id)


@router.get(
    "/runs/{run_id}/employees/{run_employee_id}",
    response_model=PayPayrollRunEmployeeDetailResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def get_payroll_run_employee_detail_api(
    run_id: int,
    run_employee_id: int,
    session: Session = Depends(get_session),
) -> PayPayrollRunEmployeeDetailResponse:
    return get_payroll_run_employee_detail(session, run_id, run_employee_id)


# ── 셀프서비스: 본인 급여 조회 ──────────────────────────────────────────────────


def _resolve_my_employee_id(session: Session, user: AuthUser) -> int:
    emp = session.exec(select(HrEmployee).where(HrEmployee.user_id == user.id)).first()
    if emp is None:
        raise HTTPException(status_code=404, detail="직원 정보를 찾을 수 없습니다.")
    return emp.id


@router.get("/my/payslips", response_model=PayMyPayslipListResponse)
def get_my_payslips(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PayMyPayslipListResponse:
    employee_id = _resolve_my_employee_id(session, current_user)
    return list_my_payslips(session, employee_id)


@router.get("/my/payslips/{run_id}", response_model=PayMyPayslipDetailResponse)
def get_my_payslip_detail_api(
    run_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PayMyPayslipDetailResponse:
    employee_id = _resolve_my_employee_id(session, current_user)
    return get_my_payslip_detail(session, employee_id, run_id)


@router.get("/my/payslips/{run_id}/pdf")
def get_my_payslip_pdf(
    run_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> Response:
    from app.services.payslip_pdf_service import generate_payslip_pdf

    employee_id = _resolve_my_employee_id(session, current_user)
    pdf_bytes = generate_payslip_pdf(session, run_id, employee_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=payslip-{run_id}.pdf"},
    )


@router.get(
    "/runs/{run_id}/employees/{employee_id}/pdf",
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def get_admin_payslip_pdf(
    run_id: int,
    employee_id: int,
    session: Session = Depends(get_session),
) -> Response:
    from app.services.payslip_pdf_service import generate_payslip_pdf

    pdf_bytes = generate_payslip_pdf(session, run_id, employee_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=payslip-{run_id}-{employee_id}.pdf"},
    )
