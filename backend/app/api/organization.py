from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.organization import (
    OrganizationCorporationCreateRequest,
    OrganizationCorporationDetailResponse,
    OrganizationCorporationListResponse,
    OrganizationCorporationUpdateRequest,
    OrganizationDepartmentCreateRequest,
    OrganizationDepartmentDetailResponse,
    OrganizationDepartmentListResponse,
    OrganizationDepartmentUpdateRequest,
)
from app.services.organization_service import (
    create_corporation,
    create_department,
    delete_corporation,
    delete_department,
    list_corporations,
    list_departments,
    update_corporation,
    update_department,
)

router = APIRouter(prefix="/org", tags=["organization"])


@router.get(
    "/corporations",
    response_model=OrganizationCorporationListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_corporations(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=1000),
    all: bool = Query(default=False),
    enter_cd: str | None = Query(default=None),
    company_code: str | None = Query(default=None),
    corporation_name: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> OrganizationCorporationListResponse:
    if all:
        corporations, total_count = list_corporations(
            session,
            enter_cd=enter_cd,
            company_code=company_code,
            corporation_name=corporation_name,
        )
        return OrganizationCorporationListResponse(
            corporations=corporations,
            total_count=total_count,
        )

    corporations, total_count = list_corporations(
        session,
        page=page,
        limit=limit,
        enter_cd=enter_cd,
        company_code=company_code,
        corporation_name=corporation_name,
    )
    return OrganizationCorporationListResponse(
        corporations=corporations,
        total_count=total_count,
        page=page,
        limit=limit,
    )


@router.post(
    "/corporations",
    response_model=OrganizationCorporationDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_corporation_create(
    payload: OrganizationCorporationCreateRequest,
    session: Session = Depends(get_session),
) -> OrganizationCorporationDetailResponse:
    corporation = create_corporation(session, payload)
    return OrganizationCorporationDetailResponse(corporation=corporation)


@router.put(
    "/corporations/{corporation_id}",
    response_model=OrganizationCorporationDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_corporation_update(
    corporation_id: int,
    payload: OrganizationCorporationUpdateRequest,
    session: Session = Depends(get_session),
) -> OrganizationCorporationDetailResponse:
    corporation = update_corporation(session, corporation_id, payload)
    return OrganizationCorporationDetailResponse(corporation=corporation)


@router.delete(
    "/corporations/{corporation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_corporation_delete(
    corporation_id: int,
    session: Session = Depends(get_session),
) -> Response:
    delete_corporation(session, corporation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/departments",
    response_model=OrganizationDepartmentListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_departments(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=1000),
    all: bool = Query(default=False),
    code: str | None = Query(default=None),
    name: str | None = Query(default=None),
    organization_type: str | None = Query(default=None),
    cost_center_code: str | None = Query(default=None),
    reference_date: date | None = Query(default=None),
    session: Session = Depends(get_session),
) -> OrganizationDepartmentListResponse:
    if all:
        departments, total_count = list_departments(
            session,
            code=code,
            name=name,
            organization_type=organization_type,
            cost_center_code=cost_center_code,
        )
        return OrganizationDepartmentListResponse(
            departments=departments,
            total_count=total_count,
            reference_date=reference_date,
        )

    departments, total_count = list_departments(
        session,
        page=page,
        limit=limit,
        code=code,
        name=name,
        organization_type=organization_type,
        cost_center_code=cost_center_code,
    )
    return OrganizationDepartmentListResponse(
        departments=departments,
        total_count=total_count,
        reference_date=reference_date,
        page=page,
        limit=limit,
    )


@router.post(
    "/departments",
    response_model=OrganizationDepartmentDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_department_create(
    payload: OrganizationDepartmentCreateRequest,
    session: Session = Depends(get_session),
) -> OrganizationDepartmentDetailResponse:
    department = create_department(session, payload)
    return OrganizationDepartmentDetailResponse(department=department)


@router.put(
    "/departments/{department_id}",
    response_model=OrganizationDepartmentDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_department_update(
    department_id: int,
    payload: OrganizationDepartmentUpdateRequest,
    session: Session = Depends(get_session),
) -> OrganizationDepartmentDetailResponse:
    department = update_department(session, department_id, payload)
    return OrganizationDepartmentDetailResponse(department=department)


@router.delete(
    "/departments/{department_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_department_delete(
    department_id: int,
    session: Session = Depends(get_session),
) -> Response:
    delete_department(session, department_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
