from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Query, Response
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.pay_voucher import (
    GlAccountBatchRequest,
    GlAccountBatchResponse,
    GlAccountListResponse,
    MappingGapsResponse,
    PayGlMappingBatchRequest,
    PayGlMappingBatchResponse,
    PayGlMappingListResponse,
    PayVoucherActionResponse,
    PayVoucherDetailResponse,
    PayVoucherGenerateDisbursementRequest,
    PayVoucherGenerateRequest,
    PayVoucherListResponse,
)
from app.services.pay_voucher_service import (
    batch_save_gl_accounts,
    batch_save_gl_mappings,
    build_voucher_export_csv,
    build_voucher_export_json,
    cancel_voucher,
    confirm_voucher,
    find_mapping_gaps,
    generate_disbursement_voucher,
    generate_voucher,
    get_voucher_detail,
    list_gl_accounts,
    list_gl_mappings,
    list_vouchers,
)

router = APIRouter(prefix="/pay", tags=["pay-voucher"])


@router.get(
    "/gl-accounts",
    response_model=GlAccountListResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def get_gl_accounts(session: Session = Depends(get_session)) -> GlAccountListResponse:
    return list_gl_accounts(session)


@router.post(
    "/gl-accounts/batch",
    response_model=GlAccountBatchResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def save_gl_accounts_batch(
    payload: GlAccountBatchRequest,
    session: Session = Depends(get_session),
) -> GlAccountBatchResponse:
    return batch_save_gl_accounts(session, payload)


@router.get(
    "/gl-mappings",
    response_model=PayGlMappingListResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def get_gl_mappings(session: Session = Depends(get_session)) -> PayGlMappingListResponse:
    return list_gl_mappings(session)


@router.post(
    "/gl-mappings/batch",
    response_model=PayGlMappingBatchResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def save_gl_mappings_batch(
    payload: PayGlMappingBatchRequest,
    session: Session = Depends(get_session),
) -> PayGlMappingBatchResponse:
    return batch_save_gl_mappings(session, payload)


@router.post(
    "/vouchers/generate",
    response_model=PayVoucherActionResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def generate_voucher_api(
    payload: PayVoucherGenerateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PayVoucherActionResponse:
    return generate_voucher(session, payload.run_id, created_by=current_user.id)


@router.post(
    "/vouchers/generate-disbursement",
    response_model=PayVoucherActionResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def generate_disbursement_voucher_api(
    payload: PayVoucherGenerateDisbursementRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PayVoucherActionResponse:
    return generate_disbursement_voucher(session, payload.run_id, created_by=current_user.id)


@router.get(
    "/vouchers",
    response_model=PayVoucherListResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def get_vouchers(
    year_month: str | None = Query(default=None),
    status: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> PayVoucherListResponse:
    return list_vouchers(session, year_month=year_month, status_value=status)


@router.get(
    "/vouchers/mapping-gaps",
    response_model=MappingGapsResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def get_mapping_gaps(
    run_id: int = Query(...),
    session: Session = Depends(get_session),
) -> MappingGapsResponse:
    return find_mapping_gaps(session, run_id)


@router.get(
    "/vouchers/{voucher_id}",
    response_model=PayVoucherDetailResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def get_voucher_detail_api(
    voucher_id: int,
    session: Session = Depends(get_session),
) -> PayVoucherDetailResponse:
    return get_voucher_detail(session, voucher_id)


@router.get(
    "/vouchers/{voucher_id}/export",
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def export_voucher_api(
    voucher_id: int,
    format: str = Query(default="csv", pattern="^(csv|json)$"),
    session: Session = Depends(get_session),
) -> Response:
    if format == "csv":
        filename, csv_bytes = build_voucher_export_csv(session, voucher_id)
        return Response(
            content=csv_bytes,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    filename, payload = build_voucher_export_json(session, voucher_id)
    return Response(
        content=json.dumps(payload, ensure_ascii=False),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/vouchers/{voucher_id}/confirm",
    response_model=PayVoucherActionResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def confirm_voucher_api(
    voucher_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> PayVoucherActionResponse:
    return confirm_voucher(session, voucher_id, confirmed_by=current_user.id)


@router.post(
    "/vouchers/{voucher_id}/cancel",
    response_model=PayVoucherActionResponse,
    dependencies=[Depends(require_roles("payroll_mgr", "admin"))],
)
def cancel_voucher_api(
    voucher_id: int,
    session: Session = Depends(get_session),
) -> PayVoucherActionResponse:
    return cancel_voucher(session, voucher_id)
