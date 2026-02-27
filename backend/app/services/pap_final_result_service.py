from __future__ import annotations

from sqlmodel import Session, select

from app.models import PapFinalResult
from app.schemas.pap_final_result import PapFinalResultItem


def list_final_results(session: Session, active_only: bool | None = None) -> list[PapFinalResultItem]:
    statement = select(PapFinalResult)
    if active_only is not None:
        statement = statement.where(PapFinalResult.is_active == active_only)
    rows = session.exec(statement.order_by(PapFinalResult.sort_order, PapFinalResult.id)).all()
    return [
        PapFinalResultItem(
            id=row.id or 0,
            result_code=row.result_code,
            result_name=row.result_name,
            score_grade=row.score_grade,
            is_active=row.is_active,
            sort_order=row.sort_order,
            description=row.description,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        for row in rows
    ]
