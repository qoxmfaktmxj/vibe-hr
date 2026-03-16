from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class OrganizationDepartmentItem(BaseModel):
    id: int
    code: str
    name: str
    parent_id: int | None
    parent_name: str | None
    organization_type: str | None = None
    cost_center_code: str | None = None
    description: str | None = None
    employee_count: int = 0
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
    organization_type: str | None = Field(default=None, max_length=50)
    cost_center_code: str | None = Field(default=None, max_length=30)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool = True


class OrganizationDepartmentUpdateRequest(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=30)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    parent_id: int | None = None
    organization_type: str | None = Field(default=None, max_length=50)
    cost_center_code: str | None = Field(default=None, max_length=30)
    description: str | None = Field(default=None, max_length=500)
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


# ---------------------------------------------------------------------------
# OrgDeptChangeHistory Schemas
# ---------------------------------------------------------------------------
class OrgDeptChangeHistoryItem(BaseModel):
    id: int
    department_id: int
    department_name: str | None = None
    changed_by: int | None = None
    changed_by_name: str | None = None
    field_name: str
    before_value: str | None = None
    after_value: str | None = None
    change_reason: str | None = None
    changed_at: datetime


class OrgDeptChangeHistoryListResponse(BaseModel):
    items: list[OrgDeptChangeHistoryItem]
    total_count: int


# ---------------------------------------------------------------------------
# OrgRestructurePlan Schemas
# ---------------------------------------------------------------------------
class OrgRestructurePlanItem(BaseModel):
    id: int
    title: str
    description: str | None = None
    planned_date: date | None = None
    status: str
    applied_at: datetime | None = None
    applied_by: int | None = None
    created_by: int
    created_at: datetime
    updated_at: datetime
    item_count: int = 0


class OrgRestructurePlanListResponse(BaseModel):
    items: list[OrgRestructurePlanItem]
    total_count: int


class OrgRestructurePlanCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    planned_date: date | None = None


class OrgRestructurePlanUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    planned_date: date | None = None
    status: str | None = None   # draft → reviewing (manual), applied/cancelled via actions


# ---------------------------------------------------------------------------
# OrgRestructurePlanItem Schemas
# ---------------------------------------------------------------------------
class OrgRestructurePlanItemDetail(BaseModel):
    id: int
    plan_id: int
    action_type: str
    target_dept_id: int | None = None
    target_dept_name: str | None = None
    target_dept_code: str | None = None
    new_parent_id: int | None = None
    new_parent_name: str | None = None
    new_name: str | None = None
    new_code: str | None = None
    new_organization_type: str | None = None
    new_cost_center_code: str | None = None
    sort_order: int
    item_status: str
    memo: str | None = None
    applied_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class OrgRestructurePlanItemListResponse(BaseModel):
    items: list[OrgRestructurePlanItemDetail]
    total_count: int


class OrgRestructurePlanItemCreateRequest(BaseModel):
    action_type: str = Field(pattern="^(move|rename|create|deactivate|reactivate)$")
    target_dept_id: int | None = None
    new_parent_id: int | None = None
    new_name: str | None = Field(default=None, max_length=100)
    new_code: str | None = Field(default=None, max_length=30)
    new_organization_type: str | None = Field(default=None, max_length=50)
    new_cost_center_code: str | None = Field(default=None, max_length=30)
    sort_order: int = 0
    memo: str | None = Field(default=None, max_length=500)


class OrgRestructurePlanItemUpdateRequest(BaseModel):
    action_type: str | None = Field(default=None, pattern="^(move|rename|create|deactivate|reactivate)$")
    target_dept_id: int | None = None
    new_parent_id: int | None = None
    new_name: str | None = Field(default=None, max_length=100)
    new_code: str | None = Field(default=None, max_length=30)
    new_organization_type: str | None = Field(default=None, max_length=50)
    new_cost_center_code: str | None = Field(default=None, max_length=30)
    sort_order: int | None = None
    memo: str | None = Field(default=None, max_length=500)


class OrgRestructureApplyResponse(BaseModel):
    plan_id: int
    applied_count: int
    skipped_count: int
    messages: list[str] = []
