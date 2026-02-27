from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Session, select

from app.models import WelBenefitType
from app.schemas.welfare import WelBenefitTypeBatchRequest, WelBenefitTypeItem


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def list_wel_benefit_types(session: Session) -> list[WelBenefitTypeItem]:
    rows = session.exec(
        select(WelBenefitType).order_by(WelBenefitType.sort_order, WelBenefitType.id)
    ).all()
    return [WelBenefitTypeItem.model_validate(row, from_attributes=True) for row in rows]


def batch_save_wel_benefit_types(session: Session, payload: WelBenefitTypeBatchRequest) -> dict[str, int]:
    created = updated = deleted = 0

    for item in payload.items:
        status = item._status or "clean"

        if status == "added":
            row = WelBenefitType(
                code=item.code,
                name=item.name,
                module_path=item.module_path,
                is_deduction=item.is_deduction,
                pay_item_code=item.pay_item_code,
                is_active=item.is_active,
                sort_order=item.sort_order,
            )
            session.add(row)
            created += 1
            continue

        if item.id is None:
            continue

        existing = session.get(WelBenefitType, item.id)
        if existing is None:
            continue

        if status == "deleted":
            session.delete(existing)
            deleted += 1
            continue

        if status == "updated":
            existing.code = item.code
            existing.name = item.name
            existing.module_path = item.module_path
            existing.is_deduction = item.is_deduction
            existing.pay_item_code = item.pay_item_code
            existing.is_active = item.is_active
            existing.sort_order = item.sort_order
            existing.updated_at = _utc_now()
            session.add(existing)
            updated += 1

    session.commit()
    return {"created": created, "updated": updated, "deleted": deleted}
