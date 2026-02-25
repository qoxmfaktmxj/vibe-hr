"""MNG 인프라관리 API 라우터."""

from fastapi import APIRouter, Depends, Query, Response, status
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.mng import (
    MngBulkDeleteRequest,
    MngBulkDeleteResponse,
    MngInfraConfigListResponse,
    MngInfraConfigUpsertRequest,
    MngInfraMasterCreateRequest,
    MngInfraMasterListResponse,
)
from app.services.mng_infra_service import (
    create_infra_master,
    delete_infra_config,
    delete_infra_masters,
    list_infra_configs,
    list_infra_masters,
    upsert_infra_configs,
)

router = APIRouter(prefix="/mng", tags=["mng-infra"])

_ROLES = [Depends(require_roles("admin"))]


# ── 인프라 마스터 ──

@router.get("/infra-masters", response_model=MngInfraMasterListResponse, dependencies=_ROLES)
def mng_infra_master_list(
    company_id: int | None = Query(default=None),
    session: Session = Depends(get_session),
) -> MngInfraMasterListResponse:
    items = list_infra_masters(session, company_id=company_id)
    return MngInfraMasterListResponse(items=items, total_count=len(items))


@router.post("/infra-masters", response_model=MngInfraMasterListResponse, status_code=status.HTTP_201_CREATED, dependencies=_ROLES)
def mng_infra_master_create(payload: MngInfraMasterCreateRequest, session: Session = Depends(get_session)) -> MngInfraMasterListResponse:
    create_infra_master(session, payload)
    items = list_infra_masters(session)
    return MngInfraMasterListResponse(items=items, total_count=len(items))


@router.delete("/infra-masters", response_model=MngBulkDeleteResponse, dependencies=_ROLES)
def mng_infra_master_delete(payload: MngBulkDeleteRequest, session: Session = Depends(get_session)) -> MngBulkDeleteResponse:
    return MngBulkDeleteResponse(deleted_count=delete_infra_masters(session, payload.ids))


# ── 인프라 구성 상세 ──

@router.get("/infra-configs/{master_id}", response_model=MngInfraConfigListResponse, dependencies=_ROLES)
def mng_infra_config_list(master_id: int, session: Session = Depends(get_session)) -> MngInfraConfigListResponse:
    items = list_infra_configs(session, master_id)
    return MngInfraConfigListResponse(items=items, total_count=len(items))


@router.post("/infra-configs/{master_id}", response_model=MngInfraConfigListResponse, dependencies=_ROLES)
def mng_infra_config_upsert(master_id: int, payload: MngInfraConfigUpsertRequest, session: Session = Depends(get_session)) -> MngInfraConfigListResponse:
    items = upsert_infra_configs(session, master_id, payload)
    return MngInfraConfigListResponse(items=items, total_count=len(items))


@router.delete("/infra-configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_ROLES)
def mng_infra_config_delete(config_id: int, session: Session = Depends(get_session)) -> Response:
    delete_infra_config(session, config_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
