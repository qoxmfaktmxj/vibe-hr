"""MNG 개발관리 서비스 (추가개발요청, 프로젝트, 문의, 인력현황)."""

from __future__ import annotations

from datetime import date

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.core.time_utils import business_today, now_utc

from app.models import (
    AuthUser,
    HrEmployee,
    MngCompany,
    MngDevInquiry,
    MngDevProject,
    MngDevRequest,
)
from app.schemas.mng import (
    MngDevInquiryCreateRequest,
    MngDevInquiryItem,
    MngDevInquiryUpdateRequest,
    MngDevProjectCreateRequest,
    MngDevProjectItem,
    MngDevProjectUpdateRequest,
    MngDevRequestCreateRequest,
    MngDevRequestItem,
    MngDevRequestMonthlySummaryItem,
    MngDevRequestUpdateRequest,
    MngDevStaffProjectItem,
    MngDevStaffRevenueItem,
)


# ──────────────────────────────────────────────
#  일괄 이름 조회 헬퍼 (N+1 방지)
# ──────────────────────────────────────────────

def _load_company_name_map(session: Session, company_ids: list[int]) -> dict[int, str]:
    """company_id → company_name 매핑을 한 번의 쿼리로 로드한다."""
    if not company_ids:
        return {}
    rows = session.exec(
        select(MngCompany.id, MngCompany.company_name).where(MngCompany.id.in_(company_ids))
    ).all()
    return {row[0]: row[1] for row in rows}


def _load_employee_display_name_map(session: Session, employee_ids: list[int]) -> dict[int, str]:
    """employee_id → display_name 매핑을 한 번의 쿼리로 로드한다 (HrEmployee + AuthUser JOIN)."""
    if not employee_ids:
        return {}
    rows = session.exec(
        select(HrEmployee.id, AuthUser.display_name)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .where(HrEmployee.id.in_(employee_ids))
    ).all()
    return {row[0]: row[1] for row in rows}


# ──────────────────────────────────────────────
#  단건 조회 헬퍼 (get/create/update 용)
# ──────────────────────────────────────────────

def _resolve_employee_name(session: Session, employee_id: int | None) -> str | None:
    if employee_id is None:
        return None
    emp = session.get(HrEmployee, employee_id)
    if emp is None:
        return None
    user = session.get(AuthUser, emp.user_id)
    return user.display_name if user else None


def _resolve_company_name(session: Session, company_id: int) -> str | None:
    c = session.get(MngCompany, company_id)
    return c.company_name if c else None


# ──────────────────────────────────────────────
#  추가개발 요청
# ──────────────────────────────────────────────

def _build_dev_request_item(r: MngDevRequest, session: Session) -> MngDevRequestItem:
    return MngDevRequestItem(
        id=r.id,
        company_id=r.company_id,
        company_name=_resolve_company_name(session, r.company_id),
        request_ym=r.request_ym,
        request_seq=r.request_seq,
        status_code=r.status_code,
        part_code=r.part_code,
        requester_name=r.requester_name,
        request_content=r.request_content,
        manager_employee_id=r.manager_employee_id,
        manager_name=_resolve_employee_name(session, r.manager_employee_id),
        developer_employee_id=r.developer_employee_id,
        developer_name=_resolve_employee_name(session, r.developer_employee_id),
        is_paid=r.is_paid,
        paid_content=r.paid_content,
        has_tax_bill=r.has_tax_bill,
        start_ym=r.start_ym,
        end_ym=r.end_ym,
        dev_start_date=r.dev_start_date,
        dev_end_date=r.dev_end_date,
        paid_man_months=r.paid_man_months,
        actual_man_months=r.actual_man_months,
        note=r.note,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


def _build_dev_request_item_from_maps(
    r: MngDevRequest,
    company_map: dict[int, str],
    employee_map: dict[int, str],
) -> MngDevRequestItem:
    return MngDevRequestItem(
        id=r.id,
        company_id=r.company_id,
        company_name=company_map.get(r.company_id),
        request_ym=r.request_ym,
        request_seq=r.request_seq,
        status_code=r.status_code,
        part_code=r.part_code,
        requester_name=r.requester_name,
        request_content=r.request_content,
        manager_employee_id=r.manager_employee_id,
        manager_name=employee_map.get(r.manager_employee_id) if r.manager_employee_id else None,
        developer_employee_id=r.developer_employee_id,
        developer_name=employee_map.get(r.developer_employee_id) if r.developer_employee_id else None,
        is_paid=r.is_paid,
        paid_content=r.paid_content,
        has_tax_bill=r.has_tax_bill,
        start_ym=r.start_ym,
        end_ym=r.end_ym,
        dev_start_date=r.dev_start_date,
        dev_end_date=r.dev_end_date,
        paid_man_months=r.paid_man_months,
        actual_man_months=r.actual_man_months,
        note=r.note,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


def list_dev_requests(
    session: Session,
    *,
    company_id: int | None = None,
    status_code: str | None = None,
) -> list[MngDevRequestItem]:
    stmt = select(MngDevRequest).order_by(MngDevRequest.id.desc())
    if company_id:
        stmt = stmt.where(MngDevRequest.company_id == company_id)
    if status_code:
        stmt = stmt.where(MngDevRequest.status_code == status_code)
    rows = session.exec(stmt).all()

    if not rows:
        return []

    # N+1 방지: 사용되는 ID를 미리 수집해 일괄 로드
    company_ids = list({r.company_id for r in rows if r.company_id is not None})
    employee_ids = list({
        eid
        for r in rows
        for eid in (r.manager_employee_id, r.developer_employee_id)
        if eid is not None
    })
    company_map = _load_company_name_map(session, company_ids)
    employee_map = _load_employee_display_name_map(session, employee_ids)

    return [_build_dev_request_item_from_maps(r, company_map, employee_map) for r in rows]


def get_dev_request(session: Session, request_id: int) -> MngDevRequestItem:
    r = session.get(MngDevRequest, request_id)
    if r is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="추가개발 요청을 찾을 수 없습니다.")
    return _build_dev_request_item(r, session)


def create_dev_request(session: Session, payload: MngDevRequestCreateRequest) -> MngDevRequestItem:
    # 자동 seq 부여
    seq = payload.request_seq
    if seq == 0:
        max_seq_row = session.exec(
            select(MngDevRequest.request_seq)
            .where(MngDevRequest.company_id == payload.company_id, MngDevRequest.request_ym == payload.request_ym)
            .order_by(MngDevRequest.request_seq.desc())
            .limit(1)
        ).first()
        seq = (max_seq_row or 0) + 1

    r = MngDevRequest(
        company_id=payload.company_id,
        request_ym=payload.request_ym,
        request_seq=seq,
        status_code=payload.status_code,
        part_code=payload.part_code,
        requester_name=payload.requester_name,
        request_content=payload.request_content,
        manager_employee_id=payload.manager_employee_id,
        developer_employee_id=payload.developer_employee_id,
        is_paid=payload.is_paid,
        paid_content=payload.paid_content,
        has_tax_bill=payload.has_tax_bill,
        start_ym=payload.start_ym,
        end_ym=payload.end_ym,
        dev_start_date=payload.dev_start_date,
        dev_end_date=payload.dev_end_date,
        paid_man_months=payload.paid_man_months,
        actual_man_months=payload.actual_man_months,
        note=payload.note,
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    session.add(r)
    session.commit()
    session.refresh(r)
    return _build_dev_request_item(r, session)


def update_dev_request(session: Session, request_id: int, payload: MngDevRequestUpdateRequest) -> MngDevRequestItem:
    r = session.get(MngDevRequest, request_id)
    if r is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="추가개발 요청을 찾을 수 없습니다.")

    for field_name in payload.model_fields_set:
        setattr(r, field_name, getattr(payload, field_name))

    r.updated_at = now_utc()
    session.add(r)
    session.commit()
    session.refresh(r)
    return _build_dev_request_item(r, session)


def delete_dev_requests(session: Session, ids: list[int]) -> int:
    rows = session.exec(select(MngDevRequest).where(MngDevRequest.id.in_(ids))).all()
    for row in rows:
        session.delete(row)
    session.commit()
    return len(rows)


def list_dev_request_monthly_summary(
    session: Session,
    *,
    company_id: int | None = None,
    status_code: str | None = None,
) -> list[MngDevRequestMonthlySummaryItem]:
    stmt = select(MngDevRequest).order_by(MngDevRequest.request_ym.desc())
    if company_id:
        stmt = stmt.where(MngDevRequest.company_id == company_id)
    if status_code:
        stmt = stmt.where(MngDevRequest.status_code == status_code)
    rows = session.exec(stmt).all()

    bucket: dict[date, MngDevRequestMonthlySummaryItem] = {}
    for row in rows:
        month = date(row.request_ym.year, row.request_ym.month, 1)
        if month not in bucket:
            bucket[month] = MngDevRequestMonthlySummaryItem(
                request_ym=month,
                total_count=0,
                paid_count=0,
                paid_man_months_total=0.0,
                actual_man_months_total=0.0,
            )
        summary = bucket[month]
        summary.total_count += 1
        if row.is_paid:
            summary.paid_count += 1
        summary.paid_man_months_total += float(row.paid_man_months or 0)
        summary.actual_man_months_total += float(row.actual_man_months or 0)

    return sorted(bucket.values(), key=lambda item: item.request_ym, reverse=True)


# ──────────────────────────────────────────────
#  추가개발 프로젝트
# ──────────────────────────────────────────────

def _build_dev_project_item(p: MngDevProject, session: Session) -> MngDevProjectItem:
    return MngDevProjectItem(
        id=p.id,
        project_name=p.project_name,
        company_id=p.company_id,
        company_name=_resolve_company_name(session, p.company_id),
        part_code=p.part_code,
        assigned_staff=p.assigned_staff,
        contract_start_date=p.contract_start_date,
        contract_end_date=p.contract_end_date,
        dev_start_date=p.dev_start_date,
        dev_end_date=p.dev_end_date,
        inspection_status=p.inspection_status,
        has_tax_bill=p.has_tax_bill,
        actual_man_months=p.actual_man_months,
        contract_amount=p.contract_amount,
        note=p.note,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


def _build_dev_project_item_from_map(p: MngDevProject, company_map: dict[int, str]) -> MngDevProjectItem:
    return MngDevProjectItem(
        id=p.id,
        project_name=p.project_name,
        company_id=p.company_id,
        company_name=company_map.get(p.company_id),
        part_code=p.part_code,
        assigned_staff=p.assigned_staff,
        contract_start_date=p.contract_start_date,
        contract_end_date=p.contract_end_date,
        dev_start_date=p.dev_start_date,
        dev_end_date=p.dev_end_date,
        inspection_status=p.inspection_status,
        has_tax_bill=p.has_tax_bill,
        actual_man_months=p.actual_man_months,
        contract_amount=p.contract_amount,
        note=p.note,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


def list_dev_projects(
    session: Session,
    *,
    company_id: int | None = None,
) -> list[MngDevProjectItem]:
    stmt = select(MngDevProject).order_by(MngDevProject.id.desc())
    if company_id:
        stmt = stmt.where(MngDevProject.company_id == company_id)
    rows = session.exec(stmt).all()

    if not rows:
        return []

    company_ids = list({p.company_id for p in rows if p.company_id is not None})
    company_map = _load_company_name_map(session, company_ids)

    return [_build_dev_project_item_from_map(p, company_map) for p in rows]


def get_dev_project(session: Session, project_id: int) -> MngDevProjectItem:
    p = session.get(MngDevProject, project_id)
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="프로젝트를 찾을 수 없습니다.")
    return _build_dev_project_item(p, session)


def create_dev_project(session: Session, payload: MngDevProjectCreateRequest) -> MngDevProjectItem:
    p = MngDevProject(
        project_name=payload.project_name.strip(),
        company_id=payload.company_id,
        part_code=payload.part_code,
        assigned_staff=payload.assigned_staff,
        contract_start_date=payload.contract_start_date,
        contract_end_date=payload.contract_end_date,
        dev_start_date=payload.dev_start_date,
        dev_end_date=payload.dev_end_date,
        inspection_status=payload.inspection_status,
        has_tax_bill=payload.has_tax_bill,
        actual_man_months=payload.actual_man_months,
        contract_amount=payload.contract_amount,
        note=payload.note,
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    return _build_dev_project_item(p, session)


def update_dev_project(session: Session, project_id: int, payload: MngDevProjectUpdateRequest) -> MngDevProjectItem:
    p = session.get(MngDevProject, project_id)
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="프로젝트를 찾을 수 없습니다.")

    for field_name in payload.model_fields_set:
        val = getattr(payload, field_name)
        if isinstance(val, str):
            val = val.strip()
        setattr(p, field_name, val)

    p.updated_at = now_utc()
    session.add(p)
    session.commit()
    session.refresh(p)
    return _build_dev_project_item(p, session)


def delete_dev_projects(session: Session, ids: list[int]) -> int:
    rows = session.exec(select(MngDevProject).where(MngDevProject.id.in_(ids))).all()
    for row in rows:
        session.delete(row)
    session.commit()
    return len(rows)


# ──────────────────────────────────────────────
#  추가개발 문의
# ──────────────────────────────────────────────

def _build_dev_inquiry_item(q: MngDevInquiry, session: Session) -> MngDevInquiryItem:
    return MngDevInquiryItem(
        id=q.id,
        company_id=q.company_id,
        company_name=_resolve_company_name(session, q.company_id),
        inquiry_content=q.inquiry_content,
        hoped_start_date=q.hoped_start_date,
        estimated_man_months=q.estimated_man_months,
        sales_rep_name=q.sales_rep_name,
        client_contact_name=q.client_contact_name,
        progress_code=q.progress_code,
        is_confirmed=q.is_confirmed,
        project_name=q.project_name,
        note=q.note,
        created_at=q.created_at,
        updated_at=q.updated_at,
    )


def _build_dev_inquiry_item_from_map(q: MngDevInquiry, company_map: dict[int, str]) -> MngDevInquiryItem:
    return MngDevInquiryItem(
        id=q.id,
        company_id=q.company_id,
        company_name=company_map.get(q.company_id),
        inquiry_content=q.inquiry_content,
        hoped_start_date=q.hoped_start_date,
        estimated_man_months=q.estimated_man_months,
        sales_rep_name=q.sales_rep_name,
        client_contact_name=q.client_contact_name,
        progress_code=q.progress_code,
        is_confirmed=q.is_confirmed,
        project_name=q.project_name,
        note=q.note,
        created_at=q.created_at,
        updated_at=q.updated_at,
    )


def list_dev_inquiries(
    session: Session,
    *,
    company_id: int | None = None,
    progress_code: str | None = None,
) -> list[MngDevInquiryItem]:
    stmt = select(MngDevInquiry).order_by(MngDevInquiry.id.desc())
    if company_id:
        stmt = stmt.where(MngDevInquiry.company_id == company_id)
    if progress_code:
        stmt = stmt.where(MngDevInquiry.progress_code == progress_code)
    rows = session.exec(stmt).all()

    if not rows:
        return []

    company_ids = list({q.company_id for q in rows if q.company_id is not None})
    company_map = _load_company_name_map(session, company_ids)

    return [_build_dev_inquiry_item_from_map(q, company_map) for q in rows]


def get_dev_inquiry(session: Session, inquiry_id: int) -> MngDevInquiryItem:
    q = session.get(MngDevInquiry, inquiry_id)
    if q is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="문의를 찾을 수 없습니다.")
    return _build_dev_inquiry_item(q, session)


def create_dev_inquiry(session: Session, payload: MngDevInquiryCreateRequest) -> MngDevInquiryItem:
    q = MngDevInquiry(
        company_id=payload.company_id,
        inquiry_content=payload.inquiry_content,
        hoped_start_date=payload.hoped_start_date,
        estimated_man_months=payload.estimated_man_months,
        sales_rep_name=payload.sales_rep_name,
        client_contact_name=payload.client_contact_name,
        progress_code=payload.progress_code,
        is_confirmed=payload.is_confirmed,
        project_name=payload.project_name,
        note=payload.note,
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    session.add(q)
    session.commit()
    session.refresh(q)
    return _build_dev_inquiry_item(q, session)


def update_dev_inquiry(session: Session, inquiry_id: int, payload: MngDevInquiryUpdateRequest) -> MngDevInquiryItem:
    q = session.get(MngDevInquiry, inquiry_id)
    if q is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="문의를 찾을 수 없습니다.")

    for field_name in payload.model_fields_set:
        setattr(q, field_name, getattr(payload, field_name))

    q.updated_at = now_utc()
    session.add(q)
    session.commit()
    session.refresh(q)
    return _build_dev_inquiry_item(q, session)


def delete_dev_inquiries(session: Session, ids: list[int]) -> int:
    rows = session.exec(select(MngDevInquiry).where(MngDevInquiry.id.in_(ids))).all()
    for row in rows:
        session.delete(row)
    session.commit()
    return len(rows)


# ──────────────────────────────────────────────
#  인력현황 (읽기 전용)
# ──────────────────────────────────────────────

def list_dev_staff_projects(
    session: Session,
    *,
    company_id: int | None = None,
) -> list[MngDevStaffProjectItem]:
    stmt = select(MngDevProject).order_by(MngDevProject.id.desc())
    if company_id:
        stmt = stmt.where(MngDevProject.company_id == company_id)
    rows = session.exec(stmt).all()

    if not rows:
        return []

    company_ids = list({row.company_id for row in rows if row.company_id is not None})
    company_map = _load_company_name_map(session, company_ids)

    return [
        MngDevStaffProjectItem(
            project_id=row.id,
            project_name=row.project_name,
            company_id=row.company_id,
            company_name=company_map.get(row.company_id),
            assigned_staff=row.assigned_staff,
            contract_start_date=row.contract_start_date,
            contract_end_date=row.contract_end_date,
            dev_start_date=row.dev_start_date,
            dev_end_date=row.dev_end_date,
            actual_man_months=row.actual_man_months,
            contract_amount=row.contract_amount,
        )
        for row in rows
    ]


def _to_month(value: date | None) -> date:
    if value is None:
        today = business_today()
        return date(today.year, today.month, 1)
    return date(value.year, value.month, 1)


def list_dev_staff_revenue_summary(
    session: Session,
    *,
    company_id: int | None = None,
) -> list[MngDevStaffRevenueItem]:
    stmt = select(MngDevProject).order_by(MngDevProject.id.desc())
    if company_id:
        stmt = stmt.where(MngDevProject.company_id == company_id)
    rows = session.exec(stmt).all()

    bucket: dict[date, MngDevStaffRevenueItem] = {}
    for row in rows:
        month_key = _to_month(row.contract_end_date or row.dev_end_date or row.contract_start_date or row.dev_start_date)
        if month_key not in bucket:
            bucket[month_key] = MngDevStaffRevenueItem(
                month=month_key,
                project_count=0,
                contract_amount_total=0,
                actual_man_months_total=0.0,
            )
        item = bucket[month_key]
        item.project_count += 1
        item.contract_amount_total += int(row.contract_amount or 0)
        item.actual_man_months_total += float(row.actual_man_months or 0)

    return sorted(bucket.values(), key=lambda item: item.month, reverse=True)
