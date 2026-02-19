from __future__ import annotations

from datetime import date

from pydantic import BaseModel, EmailStr, Field


class DepartmentItem(BaseModel):
    id: int
    code: str
    name: str


class DepartmentListResponse(BaseModel):
    departments: list[DepartmentItem]


class EmployeeItem(BaseModel):
    id: int
    employee_no: str
    login_id: str
    display_name: str
    email: str
    department_id: int
    department_name: str
    position_title: str
    hire_date: date
    employment_status: str
    is_active: bool


class EmployeeListResponse(BaseModel):
    employees: list[EmployeeItem]
    total_count: int


class EmployeeDetailResponse(BaseModel):
    employee: EmployeeItem


class EmployeeCreateRequest(BaseModel):
    display_name: str = Field(min_length=2, max_length=100)
    department_id: int
    position_title: str = Field(min_length=1, max_length=80)
    hire_date: date | None = None
    employment_status: str = Field(default="active", pattern="^(active|leave|resigned)$")
    login_id: str | None = Field(default=None, min_length=4, max_length=50)
    email: EmailStr | None = None
    password: str = Field(default="admin", min_length=4, max_length=128)


class EmployeeUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=100)
    department_id: int | None = None
    position_title: str | None = Field(default=None, min_length=1, max_length=80)
    hire_date: date | None = None
    employment_status: str | None = Field(default=None, pattern="^(active|leave|resigned)$")
    email: EmailStr | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=4, max_length=128)
