from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import (
    PayAllowanceDeduction,
    PayItemGroup,
    PayItemGroupDetail,
    PayPayrollCode,
    PayTaxRate,
)
from app.schemas.pay_setup_schema import (
    PayAllowanceDeductionBatchItem,
    PayAllowanceDeductionBatchRequest,
    PayAllowanceDeductionBatchResponse,
    PayAllowanceDeductionItem,
    PayItemGroupBatchItem,
    PayItemGroupBatchRequest,
    PayItemGroupBatchResponse,
    PayItemGroupDetailItem,
    PayItemGroupWithDetailsItem,
    PayPayrollCodeBatchItem,
    PayPayrollCodeBatchRequest,
    PayPayrollCodeBatchResponse,
    PayPayrollCodeItem,
    PayTaxRateBatchItem,
    PayTaxRateBatchRequest,
    PayTaxRateBatchResponse,
    PayTaxRateItem,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


# -------------------------------------------------------------------------
# PayPayrollCode Logic
# -------------------------------------------------------------------------
def list_pay_payroll_codes(session: Session) -> list[PayPayrollCodeItem]:
    rows = session.exec(select(PayPayrollCode).order_by(PayPayrollCode.code)).all()
    return [
        PayPayrollCodeItem(
            id=row.id,
            code=row.code,
            name=row.name,
            pay_type=row.pay_type,
            payment_day=row.payment_day,
            tax_deductible=row.tax_deductible,
            social_ins_deductible=row.social_ins_deductible,
            is_active=row.is_active,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        for row in rows
    ]


def batch_save_pay_payroll_codes(
    session: Session, payload: PayPayrollCodeBatchRequest
) -> PayPayrollCodeBatchResponse:
    inserted = 0
    updated = 0
    deleted = 0

    for del_id in payload.delete_ids:
        row = session.get(PayPayrollCode, del_id)
        if row:
            session.delete(row)
            deleted += 1

    for item in payload.items:
        if item.id and item.id > 0:
            row = session.get(PayPayrollCode, item.id)
            if row:
                row.code = item.code.strip()
                row.name = item.name.strip()
                row.pay_type = item.pay_type
                row.payment_day = item.payment_day
                row.tax_deductible = item.tax_deductible
                row.social_ins_deductible = item.social_ins_deductible
                row.is_active = item.is_active
                row.updated_at = _utc_now()
                session.add(row)
                updated += 1
                continue

        dup = session.exec(select(PayPayrollCode).where(PayPayrollCode.code == item.code.strip())).first()
        if dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"급여코드 '{item.code}'가 이미 존재합니다.",
            )

        new_row = PayPayrollCode(
            code=item.code.strip(),
            name=item.name.strip(),
            pay_type=item.pay_type,
            payment_day=item.payment_day,
            tax_deductible=item.tax_deductible,
            social_ins_deductible=item.social_ins_deductible,
            is_active=item.is_active,
            created_at=_utc_now(),
        )
        session.add(new_row)
        inserted += 1

    session.commit()
    items = list_pay_payroll_codes(session)
    return PayPayrollCodeBatchResponse(
        items=items,
        total_count=len(items),
        inserted_count=inserted,
        updated_count=updated,
        deleted_count=deleted,
    )


# -------------------------------------------------------------------------
# PayTaxRate Logic
# -------------------------------------------------------------------------
def list_pay_tax_rates(session: Session) -> list[PayTaxRateItem]:
    rows = session.exec(select(PayTaxRate).order_by(PayTaxRate.year.desc(), PayTaxRate.id)).all()
    return [
        PayTaxRateItem(
            id=row.id,
            year=row.year,
            rate_type=row.rate_type,
            employee_rate=row.employee_rate,
            employer_rate=row.employer_rate,
            min_limit=row.min_limit,
            max_limit=row.max_limit,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        for row in rows
    ]


def batch_save_pay_tax_rates(
    session: Session, payload: PayTaxRateBatchRequest
) -> PayTaxRateBatchResponse:
    inserted = 0
    updated = 0
    deleted = 0

    for del_id in payload.delete_ids:
        row = session.get(PayTaxRate, del_id)
        if row:
            session.delete(row)
            deleted += 1

    for item in payload.items:
        if item.id and item.id > 0:
            row = session.get(PayTaxRate, item.id)
            if row:
                row.year = item.year
                row.rate_type = item.rate_type.strip()
                row.employee_rate = item.employee_rate
                row.employer_rate = item.employer_rate
                row.min_limit = item.min_limit
                row.max_limit = item.max_limit
                row.updated_at = _utc_now()
                session.add(row)
                updated += 1
                continue

        dup = session.exec(
            select(PayTaxRate).where(
                PayTaxRate.year == item.year, PayTaxRate.rate_type == item.rate_type.strip()
            )
        ).first()
        if dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"연도 '{item.year}'에 해당하는 세율 '{item.rate_type}'가 이미 존재합니다.",
            )

        new_row = PayTaxRate(
            year=item.year,
            rate_type=item.rate_type.strip(),
            employee_rate=item.employee_rate,
            employer_rate=item.employer_rate,
            min_limit=item.min_limit,
            max_limit=item.max_limit,
            created_at=_utc_now(),
        )
        session.add(new_row)
        inserted += 1

    session.commit()
    items = list_pay_tax_rates(session)
    return PayTaxRateBatchResponse(
        items=items,
        total_count=len(items),
        inserted_count=inserted,
        updated_count=updated,
        deleted_count=deleted,
    )


# -------------------------------------------------------------------------
# PayAllowanceDeduction Logic
# -------------------------------------------------------------------------
def list_pay_allowance_deductions(session: Session) -> list[PayAllowanceDeductionItem]:
    rows = session.exec(select(PayAllowanceDeduction).order_by(PayAllowanceDeduction.sort_order)).all()
    return [
        PayAllowanceDeductionItem(
            id=row.id,
            code=row.code,
            name=row.name,
            type=row.type,
            tax_type=row.tax_type,
            calculation_type=row.calculation_type,
            is_active=row.is_active,
            sort_order=row.sort_order,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        for row in rows
    ]


def batch_save_pay_allowance_deductions(
    session: Session, payload: PayAllowanceDeductionBatchRequest
) -> PayAllowanceDeductionBatchResponse:
    inserted = 0
    updated = 0
    deleted = 0

    for del_id in payload.delete_ids:
        row = session.get(PayAllowanceDeduction, del_id)
        if row:
            session.delete(row)
            deleted += 1

    for item in payload.items:
        if item.id and item.id > 0:
            row = session.get(PayAllowanceDeduction, item.id)
            if row:
                row.code = item.code.strip()
                row.name = item.name.strip()
                row.type = item.type
                row.tax_type = item.tax_type
                row.calculation_type = item.calculation_type
                row.is_active = item.is_active
                row.sort_order = item.sort_order
                row.updated_at = _utc_now()
                session.add(row)
                updated += 1
                continue

        dup = session.exec(select(PayAllowanceDeduction).where(PayAllowanceDeduction.code == item.code.strip())).first()
        if dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"수당/공제항목 '{item.code}'가 이미 존재합니다.",
            )

        new_row = PayAllowanceDeduction(
            code=item.code.strip(),
            name=item.name.strip(),
            type=item.type,
            tax_type=item.tax_type,
            calculation_type=item.calculation_type,
            is_active=item.is_active,
            sort_order=item.sort_order,
            created_at=_utc_now(),
        )
        session.add(new_row)
        inserted += 1

    session.commit()
    items = list_pay_allowance_deductions(session)
    return PayAllowanceDeductionBatchResponse(
        items=items,
        total_count=len(items),
        inserted_count=inserted,
        updated_count=updated,
        deleted_count=deleted,
    )


# -------------------------------------------------------------------------
# PayItemGroup Logic
# -------------------------------------------------------------------------
def list_pay_item_groups(session: Session) -> list[PayItemGroupWithDetailsItem]:
    groups = session.exec(select(PayItemGroup).order_by(PayItemGroup.code)).all()
    results = []
    
    # We fetch details for all groups for simplicity as dataset is expected to be small
    for group in groups:
        details = session.exec(select(PayItemGroupDetail).where(PayItemGroupDetail.group_id == group.id)).all()
        detail_items = [
            PayItemGroupDetailItem(
                id=d.id,
                group_id=d.group_id,
                item_id=d.item_id,
                type=d.type,
                created_at=d.created_at
            ) for d in details
        ]
        
        results.append(PayItemGroupWithDetailsItem(
            id=group.id,
            code=group.code,
            name=group.name,
            description=group.description,
            is_active=group.is_active,
            created_at=group.created_at,
            updated_at=group.updated_at,
            details=detail_items
        ))
    
    return results


def batch_save_pay_item_groups(
    session: Session, payload: PayItemGroupBatchRequest
) -> PayItemGroupBatchResponse:
    inserted = 0
    updated = 0
    deleted = 0

    for del_id in payload.delete_ids:
        group = session.get(PayItemGroup, del_id)
        if group:
            # Delete details first
            session.exec(select(PayItemGroupDetail).where(PayItemGroupDetail.group_id == del_id)).all() # load them
            details = session.exec(select(PayItemGroupDetail).where(PayItemGroupDetail.group_id == del_id)).all()
            for d in details:
                session.delete(d)
                
            session.delete(group)
            deleted += 1

    for item in payload.items:
        if item.id and item.id > 0:
            group = session.get(PayItemGroup, item.id)
            if group:
                group.code = item.code.strip()
                group.name = item.name.strip()
                group.description = item.description
                group.is_active = item.is_active
                group.updated_at = _utc_now()
                session.add(group)
                updated += 1
                
                # Replace details
                if item.details is not None:
                    old_details = session.exec(select(PayItemGroupDetail).where(PayItemGroupDetail.group_id == group.id)).all()
                    for od in old_details:
                        session.delete(od)
                        
                    for nd in item.details:
                        session.add(PayItemGroupDetail(
                            group_id=group.id,
                            item_id=nd.item_id,
                            type=nd.type,
                            created_at=_utc_now()
                        ))
                
                continue

        dup = session.exec(select(PayItemGroup).where(PayItemGroup.code == item.code.strip())).first()
        if dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"항목그룹 '{item.code}'가 이미 존재합니다.",
            )

        new_group = PayItemGroup(
            code=item.code.strip(),
            name=item.name.strip(),
            description=item.description,
            is_active=item.is_active,
            created_at=_utc_now(),
        )
        session.add(new_group)
        session.flush() # To get ID early
        
        if item.details is not None:
             for nd in item.details:
                 session.add(PayItemGroupDetail(
                     group_id=new_group.id,
                     item_id=nd.item_id,
                     type=nd.type,
                     created_at=_utc_now()
                 ))
        
        inserted += 1

    session.commit()
    items = list_pay_item_groups(session)
    return PayItemGroupBatchResponse(
        items=items,
        total_count=len(items),
        inserted_count=inserted,
        updated_count=updated,
        deleted_count=deleted,
    )
