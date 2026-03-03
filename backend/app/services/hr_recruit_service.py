from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import HrEmployee, HrRecruitFinalist
from app.schemas.hr_recruit import (
    HrRecruitFinalistCreateRequest,
    HrRecruitFinalistItem,
    HrRecruitFinalistUpdateRequest,
    HrRecruitIfInboundRow,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _strip_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _build_item(row: HrRecruitFinalist) -> HrRecruitFinalistItem:
    return HrRecruitFinalistItem(
        id=row.id,
        candidate_no=row.candidate_no,
        source_type=row.source_type,
        external_key=row.external_key,
        full_name=row.full_name,
        resident_no_masked=row.resident_no_masked,
        birth_date=row.birth_date,
        phone_mobile=row.phone_mobile,
        email=row.email,
        hire_type=row.hire_type,
        career_years=row.career_years,
        login_id=row.login_id,
        employee_no=row.employee_no,
        expected_join_date=row.expected_join_date,
        status_code=row.status_code,
        note=row.note,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _next_candidate_no(session: Session) -> str:
    prefix = datetime.now(timezone.utc).strftime("RC%Y%m%d")
    max_seq = 0
    rows = session.exec(
        select(HrRecruitFinalist.candidate_no).where(HrRecruitFinalist.candidate_no.like(f"{prefix}-%"))
    ).all()
    for value in rows:
        if not value:
            continue
        parts = value.split("-")
        if len(parts) != 2:
            continue
        try:
            max_seq = max(max_seq, int(parts[1]))
        except ValueError:
            continue
    return f"{prefix}-{max_seq + 1:04d}"


def _next_employee_no(session: Session) -> str:
    max_seq = 0
    employee_rows = session.exec(
        select(HrEmployee.employee_no).where(HrEmployee.employee_no.like("EMP-%"))
    ).all()
    finalist_rows = session.exec(
        select(HrRecruitFinalist.employee_no).where(HrRecruitFinalist.employee_no.like("EMP-%"))
    ).all()
    for value in [*employee_rows, *finalist_rows]:
        if not value:
            continue
        suffix = value.replace("EMP-", "", 1)
        try:
            max_seq = max(max_seq, int(suffix))
        except ValueError:
            continue
    return f"EMP-{max_seq + 1:06d}"


def list_finalists(session: Session, *, search: str | None = None) -> list[HrRecruitFinalistItem]:
    stmt = select(HrRecruitFinalist).order_by(HrRecruitFinalist.id.desc())
    if search:
        keyword = f"%{search.strip()}%"
        stmt = stmt.where(
            HrRecruitFinalist.full_name.ilike(keyword)
            | HrRecruitFinalist.candidate_no.ilike(keyword)
            | HrRecruitFinalist.employee_no.ilike(keyword)
            | HrRecruitFinalist.login_id.ilike(keyword)
        )
    rows = session.exec(stmt).all()
    return [_build_item(row) for row in rows]


def create_finalist(session: Session, payload: HrRecruitFinalistCreateRequest) -> HrRecruitFinalistItem:
    candidate_no = _next_candidate_no(session)
    item = HrRecruitFinalist(
        candidate_no=candidate_no,
        source_type=payload.source_type,
        external_key=_strip_or_none(payload.external_key),
        full_name=payload.full_name.strip(),
        resident_no_masked=_strip_or_none(payload.resident_no_masked),
        birth_date=payload.birth_date,
        phone_mobile=_strip_or_none(payload.phone_mobile),
        email=_strip_or_none(payload.email),
        hire_type=payload.hire_type,
        career_years=payload.career_years,
        login_id=_strip_or_none(payload.login_id),
        employee_no=_strip_or_none(payload.employee_no),
        expected_join_date=payload.expected_join_date,
        status_code=payload.status_code,
        note=_strip_or_none(payload.note),
        is_active=payload.is_active,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return _build_item(item)


def update_finalist(
    session: Session,
    finalist_id: int,
    payload: HrRecruitFinalistUpdateRequest,
) -> HrRecruitFinalistItem:
    item = session.get(HrRecruitFinalist, finalist_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="채용합격자 정보를 찾을 수 없습니다.")

    if payload.source_type is not None:
        item.source_type = payload.source_type
    if payload.external_key is not None:
        item.external_key = _strip_or_none(payload.external_key)
    if payload.full_name is not None:
        item.full_name = payload.full_name.strip()
    if payload.resident_no_masked is not None:
        item.resident_no_masked = _strip_or_none(payload.resident_no_masked)
    if payload.birth_date is not None:
        item.birth_date = payload.birth_date
    if payload.phone_mobile is not None:
        item.phone_mobile = _strip_or_none(payload.phone_mobile)
    if payload.email is not None:
        item.email = _strip_or_none(payload.email)
    if payload.hire_type is not None:
        item.hire_type = payload.hire_type
    if payload.career_years is not None:
        item.career_years = payload.career_years
    if payload.login_id is not None:
        item.login_id = _strip_or_none(payload.login_id)
    if payload.employee_no is not None:
        item.employee_no = _strip_or_none(payload.employee_no)
    if payload.expected_join_date is not None:
        item.expected_join_date = payload.expected_join_date
    if payload.status_code is not None:
        item.status_code = payload.status_code
    if payload.note is not None:
        item.note = _strip_or_none(payload.note)
    if payload.is_active is not None:
        item.is_active = payload.is_active

    item.updated_at = _utc_now()
    session.add(item)
    session.commit()
    session.refresh(item)
    return _build_item(item)


def delete_finalists(session: Session, ids: list[int]) -> int:
    rows = session.exec(select(HrRecruitFinalist).where(HrRecruitFinalist.id.in_(ids))).all()
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="삭제할 채용합격자 데이터가 없습니다.")

    for row in rows:
        session.delete(row)
    session.commit()
    return len(rows)


def sync_if_rows(session: Session, inbound_rows: list[HrRecruitIfInboundRow]) -> tuple[int, int]:
    if not inbound_rows:
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        inbound_rows = [
            HrRecruitIfInboundRow(external_key=f"IF-{today}-001", full_name="김채용", hire_type="new"),
            HrRecruitIfInboundRow(external_key=f"IF-{today}-002", full_name="이경력", hire_type="experienced"),
            HrRecruitIfInboundRow(external_key=f"IF-{today}-003", full_name="박지원", hire_type="new"),
        ]

    inserted_count = 0
    updated_count = 0

    for inbound in inbound_rows:
        existing = session.exec(
            select(HrRecruitFinalist).where(HrRecruitFinalist.external_key == inbound.external_key)
        ).first()
        if existing is None:
            row = HrRecruitFinalist(
                candidate_no=_next_candidate_no(session),
                source_type="if",
                external_key=inbound.external_key,
                full_name=inbound.full_name.strip(),
                phone_mobile=_strip_or_none(inbound.phone_mobile),
                email=_strip_or_none(inbound.email),
                hire_type=inbound.hire_type,
                expected_join_date=inbound.expected_join_date,
                note=_strip_or_none(inbound.note),
                status_code="draft",
                is_active=True,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
            session.add(row)
            inserted_count += 1
            continue

        existing.source_type = "if"
        existing.full_name = inbound.full_name.strip()
        existing.phone_mobile = _strip_or_none(inbound.phone_mobile)
        existing.email = _strip_or_none(inbound.email)
        existing.hire_type = inbound.hire_type
        existing.expected_join_date = inbound.expected_join_date
        existing.note = _strip_or_none(inbound.note)
        existing.updated_at = _utc_now()
        session.add(existing)
        updated_count += 1

    session.commit()
    return inserted_count, updated_count


def generate_employee_numbers(session: Session, ids: list[int]) -> tuple[int, int]:
    rows = session.exec(
        select(HrRecruitFinalist).where(HrRecruitFinalist.id.in_(ids)).order_by(HrRecruitFinalist.id)
    ).all()
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="대상 채용합격자 데이터가 없습니다.")

    updated_count = 0
    skipped_count = 0
    for row in rows:
        if row.employee_no:
            skipped_count += 1
            continue
        row.employee_no = _next_employee_no(session)
        if not row.login_id:
            row.login_id = row.employee_no.lower().replace("-", "")
        if row.status_code == "draft":
            row.status_code = "ready"
        row.updated_at = _utc_now()
        session.add(row)
        updated_count += 1

    session.commit()
    return updated_count, skipped_count

