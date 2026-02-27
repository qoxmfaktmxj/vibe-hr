from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import PapAppraisalMaster, PapFinalResult
from app.schemas.pap_appraisal import (
    PapAppraisalCreateRequest,
    PapAppraisalItem,
    PapAppraisalUpdateRequest,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_item(row: PapAppraisalMaster, final_result: PapFinalResult | None = None) -> PapAppraisalItem:
    return PapAppraisalItem(
        id=row.id or 0,
        appraisal_code=row.appraisal_code,
        appraisal_name=row.appraisal_name,
        appraisal_year=row.appraisal_year,
        final_result_id=row.final_result_id,
        final_result_code=final_result.result_code if final_result is not None else None,
        final_result_name=final_result.result_name if final_result is not None else None,
        appraisal_type=row.appraisal_type,
        start_date=row.start_date,
        end_date=row.end_date,
        is_active=row.is_active,
        sort_order=row.sort_order,
        description=row.description,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _get_or_404(session: Session, appraisal_id: int) -> PapAppraisalMaster:
    row = session.get(PapAppraisalMaster, appraisal_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appraisal master not found.")
    return row


def _get_final_result_or_404(session: Session, final_result_id: int) -> PapFinalResult:
    row = session.get(PapFinalResult, final_result_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Final result not found.")
    return row


def _validate_date_range(start_date, end_date) -> None:
    if start_date is not None and end_date is not None and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be earlier than or equal to end_date.",
        )


def _check_duplicate(
    session: Session,
    appraisal_year: int,
    appraisal_code: str,
    exclude_id: int | None = None,
) -> None:
    statement = select(PapAppraisalMaster.id).where(
        PapAppraisalMaster.appraisal_year == appraisal_year,
        PapAppraisalMaster.appraisal_code == appraisal_code,
    )
    if exclude_id is not None:
        statement = statement.where(PapAppraisalMaster.id != exclude_id)
    duplicate = session.exec(statement).first()
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Appraisal code already exists in the same year.",
        )


def list_appraisals(
    session: Session,
    appraisal_year: int | None = None,
    active_only: bool | None = None,
) -> list[PapAppraisalItem]:
    statement = select(PapAppraisalMaster)
    if appraisal_year is not None:
        statement = statement.where(PapAppraisalMaster.appraisal_year == appraisal_year)
    if active_only is not None:
        statement = statement.where(PapAppraisalMaster.is_active == active_only)
    rows = session.exec(
        statement.order_by(
            PapAppraisalMaster.appraisal_year.desc(),
            PapAppraisalMaster.sort_order,
            PapAppraisalMaster.id,
        ),
    ).all()
    if not rows:
        return []

    final_result_ids = {row.final_result_id for row in rows if row.final_result_id is not None}
    final_results = {}
    if final_result_ids:
        final_results = {
            result.id: result
            for result in session.exec(select(PapFinalResult).where(PapFinalResult.id.in_(final_result_ids))).all()
            if result.id is not None
        }
    return [_to_item(row, final_results.get(row.final_result_id)) for row in rows]


def create_appraisal(session: Session, payload: PapAppraisalCreateRequest) -> PapAppraisalItem:
    appraisal_code = payload.appraisal_code.strip().upper()
    appraisal_name = payload.appraisal_name.strip()
    _validate_date_range(payload.start_date, payload.end_date)
    _check_duplicate(session, payload.appraisal_year, appraisal_code)

    if payload.final_result_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="final_result_id is required.")
    _get_final_result_or_404(session, payload.final_result_id)

    row = PapAppraisalMaster(
        appraisal_code=appraisal_code,
        appraisal_name=appraisal_name,
        appraisal_year=payload.appraisal_year,
        final_result_id=payload.final_result_id,
        appraisal_type=payload.appraisal_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
        description=payload.description,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    final_result = session.get(PapFinalResult, row.final_result_id) if row.final_result_id is not None else None
    return _to_item(row, final_result)


def update_appraisal(
    session: Session,
    appraisal_id: int,
    payload: PapAppraisalUpdateRequest,
) -> PapAppraisalItem:
    row = _get_or_404(session, appraisal_id)
    changed_fields = payload.model_dump(exclude_unset=True)

    next_year = payload.appraisal_year if payload.appraisal_year is not None else row.appraisal_year
    next_code = payload.appraisal_code.strip().upper() if payload.appraisal_code is not None else row.appraisal_code
    _check_duplicate(session, next_year, next_code, exclude_id=appraisal_id)

    next_start = payload.start_date if "start_date" in changed_fields else row.start_date
    next_end = payload.end_date if "end_date" in changed_fields else row.end_date
    _validate_date_range(next_start, next_end)

    row.appraisal_year = next_year
    row.appraisal_code = next_code
    if "final_result_id" in changed_fields:
        if payload.final_result_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="final_result_id is required.")
        _get_final_result_or_404(session, payload.final_result_id)
        row.final_result_id = payload.final_result_id
    if payload.appraisal_name is not None:
        row.appraisal_name = payload.appraisal_name.strip()
    if "appraisal_type" in changed_fields:
        row.appraisal_type = payload.appraisal_type
    if "start_date" in changed_fields:
        row.start_date = payload.start_date
    if "end_date" in changed_fields:
        row.end_date = payload.end_date
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
    final_result = session.get(PapFinalResult, row.final_result_id) if row.final_result_id is not None else None
    return _to_item(row, final_result)


def delete_appraisal(session: Session, appraisal_id: int) -> None:
    row = _get_or_404(session, appraisal_id)
    session.delete(row)
    session.commit()
