from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import PapFinalResult
from app.schemas.pap_final_result import (
    PapFinalResultCreateRequest,
    PapFinalResultItem,
    PapFinalResultUpdateRequest,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_item(row: PapFinalResult) -> PapFinalResultItem:
    return PapFinalResultItem(
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


def _get_or_404(session: Session, result_id: int) -> PapFinalResult:
    row = session.get(PapFinalResult, result_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Final result not found.")
    return row


def _check_duplicate(session: Session, result_code: str, exclude_id: int | None = None) -> None:
    statement = select(PapFinalResult.id).where(PapFinalResult.result_code == result_code)
    if exclude_id is not None:
        statement = statement.where(PapFinalResult.id != exclude_id)
    duplicate = session.exec(statement).first()
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Final result code already exists.")


def list_final_results(
    session: Session,
    *,
    code: str | None = None,
    name: str | None = None,
    active_only: bool | None = None,
    page: int = 1,
    limit: int = 100,
    all_rows: bool = False,
) -> tuple[list[PapFinalResultItem], int]:
    statement = select(PapFinalResult)
    if code:
      statement = statement.where(PapFinalResult.result_code.contains(code.strip().upper()))
    if name:
      statement = statement.where(PapFinalResult.result_name.contains(name.strip()))
    if active_only is not None:
        statement = statement.where(PapFinalResult.is_active == active_only)

    rows = session.exec(statement.order_by(PapFinalResult.sort_order, PapFinalResult.id)).all()
    total_count = len(rows)
    if not all_rows:
        start = max(page - 1, 0) * limit
        rows = rows[start:start + limit]

    return ([_to_item(row) for row in rows], total_count)


def create_final_result(session: Session, payload: PapFinalResultCreateRequest) -> PapFinalResultItem:
    result_code = payload.result_code.strip().upper()
    result_name = payload.result_name.strip()
    _check_duplicate(session, result_code)

    row = PapFinalResult(
        result_code=result_code,
        result_name=result_name,
        score_grade=payload.score_grade,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
        description=payload.description,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _to_item(row)


def update_final_result(
    session: Session,
    result_id: int,
    payload: PapFinalResultUpdateRequest,
) -> PapFinalResultItem:
    row = _get_or_404(session, result_id)
    changed_fields = payload.model_dump(exclude_unset=True)

    next_code = payload.result_code.strip().upper() if payload.result_code is not None else row.result_code
    _check_duplicate(session, next_code, exclude_id=result_id)
    row.result_code = next_code

    if payload.result_name is not None:
        row.result_name = payload.result_name.strip()
    if "score_grade" in changed_fields:
        row.score_grade = payload.score_grade
    if payload.is_active is not None:
        row.is_active = payload.is_active
    if payload.sort_order is not None:
        row.sort_order = payload.sort_order
    if "description" in changed_fields:
        row.description = payload.description
    row.updated_at = _utc_now()

    session.add(row)
    session.commit()
    session.refresh(row)
    return _to_item(row)


def delete_final_result(session: Session, result_id: int) -> None:
    row = _get_or_404(session, result_id)
    session.delete(row)
    session.commit()
