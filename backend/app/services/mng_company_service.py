"""MNG 고객사 관리 서비스."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import (
    AuthUser,
    HrEmployee,
    MngCompany,
    MngManagerCompany,
)
from app.schemas.mng import (
    MngCompanyCreateRequest,
    MngCompanyDropdownItem,
    MngCompanyItem,
    MngCompanyUpdateRequest,
    MngManagerCompanyCreateRequest,
    MngManagerCompanyItem,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ── Company helpers ──

def _build_company_item(c: MngCompany) -> MngCompanyItem:
    return MngCompanyItem(
        id=c.id,
        company_code=c.company_code,
        company_name=c.company_name,
        company_group_code=c.company_group_code,
        company_type=c.company_type,
        management_type=c.management_type,
        representative_company=c.representative_company,
        start_date=c.start_date,
        is_active=c.is_active,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


def list_companies(
    session: Session,
    *,
    search: str | None = None,
) -> list[MngCompanyItem]:
    stmt = select(MngCompany).where(MngCompany.is_active == True).order_by(MngCompany.company_code)
    if search:
        keyword = f"%{search.strip()}%"
        stmt = stmt.where(
            MngCompany.company_name.ilike(keyword) | MngCompany.company_code.ilike(keyword)
        )
    rows = session.exec(stmt).all()
    return [_build_company_item(r) for r in rows]


def get_company(session: Session, company_id: int) -> MngCompanyItem:
    company = session.get(MngCompany, company_id)
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="고객사를 찾을 수 없습니다.")
    return _build_company_item(company)


def create_company(session: Session, payload: MngCompanyCreateRequest) -> MngCompanyItem:
    code = payload.company_code.strip()
    dup = session.exec(select(MngCompany.id).where(MngCompany.company_code == code)).first()
    if dup is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 존재하는 회사코드입니다.")

    company = MngCompany(
        company_code=code,
        company_name=payload.company_name.strip(),
        company_group_code=payload.company_group_code,
        company_type=payload.company_type,
        management_type=payload.management_type,
        representative_company=payload.representative_company,
        start_date=payload.start_date,
        is_active=True,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(company)
    session.commit()
    session.refresh(company)
    return _build_company_item(company)


def update_company(session: Session, company_id: int, payload: MngCompanyUpdateRequest) -> MngCompanyItem:
    company = session.get(MngCompany, company_id)
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="고객사를 찾을 수 없습니다.")

    if payload.company_name is not None:
        company.company_name = payload.company_name.strip()
    if payload.company_group_code is not None:
        company.company_group_code = payload.company_group_code
    if payload.company_type is not None:
        company.company_type = payload.company_type
    if payload.management_type is not None:
        company.management_type = payload.management_type
    if payload.representative_company is not None:
        company.representative_company = payload.representative_company
    if payload.start_date is not None:
        company.start_date = payload.start_date
    if payload.is_active is not None:
        company.is_active = payload.is_active

    company.updated_at = _utc_now()
    session.add(company)
    session.commit()
    session.refresh(company)
    return _build_company_item(company)


def delete_companies(session: Session, ids: list[int]) -> int:
    companies = session.exec(select(MngCompany).where(MngCompany.id.in_(ids))).all()
    if not companies:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="삭제할 고객사가 없습니다.")

    for company in companies:
        session.delete(company)

    session.commit()
    return len(companies)


def list_company_dropdown(session: Session) -> list[MngCompanyDropdownItem]:
    rows = session.exec(
        select(MngCompany.id, MngCompany.company_name)
        .where(MngCompany.is_active == True)
        .order_by(MngCompany.company_name)
    ).all()
    return [MngCompanyDropdownItem(id=r[0], company_name=r[1]) for r in rows]


# ── Manager-Company mapping ──

def _build_manager_item(mc: MngManagerCompany, emp_name: str | None, comp_name: str | None) -> MngManagerCompanyItem:
    return MngManagerCompanyItem(
        id=mc.id,
        employee_id=mc.employee_id,
        employee_name=emp_name,
        company_id=mc.company_id,
        company_name=comp_name,
        start_date=mc.start_date,
        end_date=mc.end_date,
        note=mc.note,
        is_active=mc.is_active,
        created_at=mc.created_at,
        updated_at=mc.updated_at,
    )


def list_manager_companies(session: Session) -> list[MngManagerCompanyItem]:
    stmt = (
        select(MngManagerCompany, AuthUser.display_name, MngCompany.company_name)
        .join(HrEmployee, MngManagerCompany.employee_id == HrEmployee.id)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(MngCompany, MngManagerCompany.company_id == MngCompany.id)
        .where(MngManagerCompany.is_active == True)
        .order_by(AuthUser.display_name)
    )
    rows = session.exec(stmt).all()
    return [_build_manager_item(mc, emp_name, comp_name) for mc, emp_name, comp_name in rows]


def create_manager_company(session: Session, payload: MngManagerCompanyCreateRequest) -> MngManagerCompanyItem:
    emp = session.get(HrEmployee, payload.employee_id)
    if emp is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="사원을 찾을 수 없습니다.")
    comp = session.get(MngCompany, payload.company_id)
    if comp is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="고객사를 찾을 수 없습니다.")

    mc = MngManagerCompany(
        employee_id=payload.employee_id,
        company_id=payload.company_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        note=payload.note,
        is_active=True,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(mc)
    session.commit()
    session.refresh(mc)

    user = session.get(AuthUser, emp.user_id)
    return _build_manager_item(mc, user.display_name if user else None, comp.company_name)


def delete_manager_companies(session: Session, ids: list[int]) -> int:
    rows = session.exec(select(MngManagerCompany).where(MngManagerCompany.id.in_(ids))).all()
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="삭제할 매핑이 없습니다.")
    for row in rows:
        session.delete(row)
    session.commit()
    return len(rows)
