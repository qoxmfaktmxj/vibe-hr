from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class OrganizationDepartmentItem(BaseModel):
    id: int
    code: str
    name: str
    parent_id: int | None
    parent_name: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class OrganizationDepartmentListResponse(BaseModel):
    departments: list[OrganizationDepartmentItem]
    total_count: int
    reference_date: date | None = None


class OrganizationDepartmentDetailResponse(BaseModel):
    department: OrganizationDepartmentItem


class OrganizationDepartmentCreateRequest(BaseModel):
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=100)
    parent_id: int | None = None
    is_active: bool = True


class OrganizationDepartmentUpdateRequest(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=30)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    parent_id: int | None = None
    is_active: bool | None = None
