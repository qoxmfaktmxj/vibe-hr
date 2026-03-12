from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.pay_setup_schema import (
    PayAllowanceDeductionBatchRequest,
    PayAllowanceDeductionBatchResponse,
    PayAllowanceDeductionListResponse,
    PayItemGroupBatchRequest,
    PayItemGroupBatchResponse,
    PayItemGroupListResponse,
    PayPayrollCodeBatchRequest,
    PayPayrollCodeBatchResponse,
    PayPayrollCodeListResponse,
    PayTaxRateBatchRequest,
    PayTaxRateBatchResponse,
    PayTaxRateListResponse,
)
from app.services.menu_service import get_allowed_menu_actions_for_user
from app.services.pay_setup_service import (
    batch_save_pay_allowance_deductions,
    batch_save_pay_item_groups,
    batch_save_pay_payroll_codes,
    batch_save_pay_tax_rates,
    list_pay_allowance_deductions,
    list_pay_item_groups,
    list_pay_payroll_codes,
    list_pay_tax_rates,
)

router = APIRouter(prefix="/pay/setup", tags=["pay-setup"])


def _require_menu_action(
    session: Session,
    current_user: AuthUser,
    menu_code: str,
    action_code: str,
) -> None:
    allowed = get_allowed_menu_actions_for_user(
        session,
        user_id=current_user.id,
        menu_code=menu_code,
    )
    if not allowed.get(action_code, False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )


# -------------------------------------------------------------------------
# PayPayrollCode Endpoints
# -------------------------------------------------------------------------
@router.get(
    "/codes",
    response_model=PayPayrollCodeListResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def get_payroll_codes(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PayPayrollCodeListResponse:
    _require_menu_action(session, current_user, "payroll.codes", "query")
    items = list_pay_payroll_codes(session)
    return PayPayrollCodeListResponse(items=items, total_count=len(items))


@router.post(
    "/codes/batch",
    response_model=PayPayrollCodeBatchResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def save_payroll_codes_batch(
    payload: PayPayrollCodeBatchRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PayPayrollCodeBatchResponse:
    _require_menu_action(session, current_user, "payroll.codes", "save")
    return batch_save_pay_payroll_codes(session, payload)


# -------------------------------------------------------------------------
# PayTaxRate Endpoints
# -------------------------------------------------------------------------
@router.get(
    "/tax-rates",
    response_model=PayTaxRateListResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def get_tax_rates(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PayTaxRateListResponse:
    _require_menu_action(session, current_user, "payroll.tax-rates", "query")
    items = list_pay_tax_rates(session)
    return PayTaxRateListResponse(items=items, total_count=len(items))


@router.post(
    "/tax-rates/batch",
    response_model=PayTaxRateBatchResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def save_tax_rates_batch(
    payload: PayTaxRateBatchRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PayTaxRateBatchResponse:
    _require_menu_action(session, current_user, "payroll.tax-rates", "save")
    return batch_save_pay_tax_rates(session, payload)


# -------------------------------------------------------------------------
# PayAllowanceDeduction Endpoints
# -------------------------------------------------------------------------
@router.get(
    "/allowance-deductions",
    response_model=PayAllowanceDeductionListResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def get_allowance_deductions(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PayAllowanceDeductionListResponse:
    _require_menu_action(session, current_user, "payroll.allowance-deduction-items", "query")
    items = list_pay_allowance_deductions(session)
    return PayAllowanceDeductionListResponse(items=items, total_count=len(items))


@router.post(
    "/allowance-deductions/batch",
    response_model=PayAllowanceDeductionBatchResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def save_allowance_deductions_batch(
    payload: PayAllowanceDeductionBatchRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PayAllowanceDeductionBatchResponse:
    _require_menu_action(session, current_user, "payroll.allowance-deduction-items", "save")
    return batch_save_pay_allowance_deductions(session, payload)


# -------------------------------------------------------------------------
# PayItemGroup Endpoints
# -------------------------------------------------------------------------
@router.get(
    "/item-groups",
    response_model=PayItemGroupListResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def get_item_groups(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PayItemGroupListResponse:
    _require_menu_action(session, current_user, "payroll.item-groups", "query")
    items = list_pay_item_groups(session)
    return PayItemGroupListResponse(items=items, total_count=len(items))


@router.post(
    "/item-groups/batch",
    response_model=PayItemGroupBatchResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def save_item_groups_batch(
    payload: PayItemGroupBatchRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PayItemGroupBatchResponse:
    _require_menu_action(session, current_user, "payroll.item-groups", "save")
    return batch_save_pay_item_groups(session, payload)
