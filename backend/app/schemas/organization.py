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
    page: int | None = None
    limit: int | None = None


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


class OrganizationCorporationItem(BaseModel):
    id: int
    enter_cd: str
    company_code: str
    corporation_name: str
    corporation_number: str | None = None
    business_number: str | None = None
    company_seal_url: str | None = None
    certificate_seal_url: str | None = None
    company_logo_url: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class OrganizationCorporationListResponse(BaseModel):
    corporations: list[OrganizationCorporationItem]
    total_count: int
    page: int | None = None
    limit: int | None = None


class OrganizationCorporationDetailResponse(BaseModel):
    corporation: OrganizationCorporationItem


class OrganizationCorporationCreateRequest(BaseModel):
    enter_cd: str = Field(min_length=1, max_length=20)
    company_code: str = Field(min_length=1, max_length=20)
    corporation_name: str = Field(min_length=1, max_length=120)
    corporation_number: str | None = Field(default=None, max_length=30)
    business_number: str | None = Field(default=None, max_length=30)
    company_seal_url: str | None = Field(default=None, max_length=500)
    certificate_seal_url: str | None = Field(default=None, max_length=500)
    company_logo_url: str | None = Field(default=None, max_length=500)
    is_active: bool = True


class OrganizationCorporationUpdateRequest(BaseModel):
    enter_cd: str | None = Field(default=None, min_length=1, max_length=20)
    company_code: str | None = Field(default=None, min_length=1, max_length=20)
    corporation_name: str | None = Field(default=None, min_length=1, max_length=120)
    corporation_number: str | None = Field(default=None, max_length=30)
    business_number: str | None = Field(default=None, max_length=30)
    company_seal_url: str | None = Field(default=None, max_length=500)
    certificate_seal_url: str | None = Field(default=None, max_length=500)
    company_logo_url: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None
