from fastapi import APIRouter, Depends, Query, Response, status
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.employee import (
    EmployeeBatchRequest,
    EmployeeBatchResponse,
    DepartmentListResponse,
    EmployeeCreateRequest,
    EmployeeDetailResponse,
    EmployeeListResponse,
    EmployeeUpdateRequest,
)
from app.services.employee_service import (
    batch_save_employees,
    create_employee,
    delete_employee,
    get_employee_by_user_id,
    list_departments,
    list_employees,
    update_employee,
)

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get(
    "",
    response_model=EmployeeListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def employee_list(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=1000),
    all: bool = Query(default=False),
    employee_no: str | None = Query(default=None),
    name: str | None = Query(default=None),
    department: str | None = Query(default=None),
    employment_status: str | None = Query(default=None),
    active: bool | None = Query(default=None),
    session: Session = Depends(get_session),
) -> EmployeeListResponse:
    if all:
        employees, total_count = list_employees(
            session,
            employee_no=employee_no,
            name=name,
            department=department,
            employment_status=employment_status,
            active=active,
        )
        return EmployeeListResponse(employees=employees, total_count=total_count)

    employees, total_count = list_employees(
        session,
        page=page,
        limit=limit,
        employee_no=employee_no,
        name=name,
        department=department,
        employment_status=employment_status,
        active=active,
    )
    return EmployeeListResponse(employees=employees, total_count=total_count, page=page, limit=limit)


@router.get(
    "/departments",
    response_model=DepartmentListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def employee_departments(session: Session = Depends(get_session)) -> DepartmentListResponse:
    return DepartmentListResponse(departments=list_departments(session))


@router.post(
    "",
    response_model=EmployeeDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def employee_create(
    payload: EmployeeCreateRequest,
    session: Session = Depends(get_session),
) -> EmployeeDetailResponse:
    employee = create_employee(session, payload)
    return EmployeeDetailResponse(employee=employee)


@router.post(
    "/batch",
    response_model=EmployeeBatchResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def employee_batch_save(
    payload: EmployeeBatchRequest,
    session: Session = Depends(get_session),
) -> EmployeeBatchResponse:
    return batch_save_employees(session, payload)


@router.get("/me", response_model=EmployeeDetailResponse)
def employee_me(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> EmployeeDetailResponse:
    employee = get_employee_by_user_id(session, current_user.id)
    return EmployeeDetailResponse(employee=employee)


@router.put(
    "/{employee_id}",
    response_model=EmployeeDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def employee_update(
    employee_id: int,
    payload: EmployeeUpdateRequest,
    session: Session = Depends(get_session),
) -> EmployeeDetailResponse:
    employee = update_employee(session, employee_id, payload)
    return EmployeeDetailResponse(employee=employee)


@router.delete(
    "/{employee_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def employee_delete(employee_id: int, session: Session = Depends(get_session)) -> Response:
    delete_employee(session, employee_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
