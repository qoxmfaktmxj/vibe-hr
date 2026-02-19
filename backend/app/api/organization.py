from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.organization import (
    OrganizationDepartmentCreateRequest,
    OrganizationDepartmentDetailResponse,
    OrganizationDepartmentListResponse,
    OrganizationDepartmentUpdateRequest,
)
from app.services.organization_service import (
    create_department,
    delete_department,
    list_departments,
    update_department,
)

router = APIRouter(prefix="/org", tags=["organization"])


@router.get(
    "/departments",
    response_model=OrganizationDepartmentListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_departments(
    code: str | None = Query(default=None),
    name: str | None = Query(default=None),
    reference_date: date | None = Query(default=None),
    session: Session = Depends(get_session),
) -> OrganizationDepartmentListResponse:
    departments = list_departments(session, code=code, name=name)
    return OrganizationDepartmentListResponse(
        departments=departments,
        total_count=len(departments),
        reference_date=reference_date,
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
