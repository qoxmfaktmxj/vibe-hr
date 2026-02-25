"""MNG 인프라관리 서비스."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import MngCompany, MngInfraConfig, MngInfraMaster
from app.schemas.mng import (
    MngInfraConfigItem,
    MngInfraConfigUpsertRequest,
    MngInfraMasterCreateRequest,
    MngInfraMasterItem,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _resolve_company_name(session: Session, company_id: int) -> str | None:
    c = session.get(MngCompany, company_id)
    return c.company_name if c else None


# ── 인프라 마스터 ──

def _build_master_item(m: MngInfraMaster, session: Session) -> MngInfraMasterItem:
    return MngInfraMasterItem(
        id=m.id,
        company_id=m.company_id,
        company_name=_resolve_company_name(session, m.company_id),
        service_type=m.service_type,
        env_type=m.env_type,
        is_active=m.is_active,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


def list_infra_masters(
    session: Session,
    *,
    company_id: int | None = None,
) -> list[MngInfraMasterItem]:
    stmt = select(MngInfraMaster).where(MngInfraMaster.is_active == True).order_by(MngInfraMaster.id.desc())
    if company_id:
        stmt = stmt.where(MngInfraMaster.company_id == company_id)
    rows = session.exec(stmt).all()
    return [_build_master_item(m, session) for m in rows]


def create_infra_master(session: Session, payload: MngInfraMasterCreateRequest) -> MngInfraMasterItem:
    dup = session.exec(
        select(MngInfraMaster.id).where(
            MngInfraMaster.company_id == payload.company_id,
            MngInfraMaster.service_type == payload.service_type,
            MngInfraMaster.env_type == payload.env_type,
        )
    ).first()
    if dup is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="동일한 인프라 구성이 이미 존재합니다.")

    m = MngInfraMaster(
        company_id=payload.company_id,
        service_type=payload.service_type.strip(),
        env_type=payload.env_type.strip(),
        is_active=True,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(m)
    session.commit()
    session.refresh(m)
    return _build_master_item(m, session)


def delete_infra_masters(session: Session, ids: list[int]) -> int:
    masters = session.exec(select(MngInfraMaster).where(MngInfraMaster.id.in_(ids))).all()
    for m in masters:
        configs = session.exec(select(MngInfraConfig).where(MngInfraConfig.master_id == m.id)).all()
        for c in configs:
            session.delete(c)
        session.delete(m)
    session.commit()
    return len(masters)


# ── 인프라 구성 상세 ──

def list_infra_configs(session: Session, master_id: int) -> list[MngInfraConfigItem]:
    rows = session.exec(
        select(MngInfraConfig)
        .where(MngInfraConfig.master_id == master_id)
        .order_by(MngInfraConfig.section, MngInfraConfig.sort_order)
    ).all()
    return [
        MngInfraConfigItem(
            id=c.id,
            master_id=c.master_id,
            section=c.section,
            config_key=c.config_key,
            config_value=c.config_value,
            sort_order=c.sort_order,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in rows
    ]


def upsert_infra_configs(session: Session, master_id: int, payload: MngInfraConfigUpsertRequest) -> list[MngInfraConfigItem]:
    master = session.get(MngInfraMaster, master_id)
    if master is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="인프라 마스터를 찾을 수 없습니다.")

    for row in payload.rows:
        existing = session.exec(
            select(MngInfraConfig).where(
                MngInfraConfig.master_id == master_id,
                MngInfraConfig.section == row.section,
                MngInfraConfig.config_key == row.config_key,
            )
        ).first()

        if existing:
            existing.config_value = row.config_value
            existing.sort_order = row.sort_order
            existing.updated_at = _utc_now()
            session.add(existing)
        else:
            session.add(MngInfraConfig(
                master_id=master_id,
                section=row.section.strip(),
                config_key=row.config_key.strip(),
                config_value=row.config_value,
                sort_order=row.sort_order,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            ))

    session.commit()
    return list_infra_configs(session, master_id)


def delete_infra_config(session: Session, config_id: int) -> None:
    c = session.get(MngInfraConfig, config_id)
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="인프라 구성을 찾을 수 없습니다.")
    session.delete(c)
    session.commit()
