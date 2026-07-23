from __future__ import annotations

from datetime import date, datetime
from typing import Literal

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


class OrganizationChartResponse(BaseModel):
    departments: list[OrganizationDepartmentItem]
    total_count: int


class OrganizationDepartmentDetailResponse(BaseModel):
    department: OrganizationDepartmentItem


class OrganizationLookupItem(BaseModel):
    id: int | None = None
    code: str
    name: str


class OrganizationLookupItemsResponse(BaseModel):
    items: list[OrganizationLookupItem]


class OrgMappingTypeItemDetail(BaseModel):
    id: int
    type_code: str
    item_code: str
    name: str
    effective_from: date
    effective_to: date | None = None
    erp_employee_code: str | None = None
    cost_center_type: str | None = None
    remark: str | None = None
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class OrgMappingTypeItemListResponse(BaseModel):
    items: list[OrgMappingTypeItemDetail]
    total_count: int
    page: int
    limit: int


class OrgMappingTypeItemDetailResponse(BaseModel):
    item: OrgMappingTypeItemDetail


class OrgMappingTypeItemCreateRequest(BaseModel):
    type_code: str = Field(min_length=1, max_length=50)
    item_code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    effective_from: date
    effective_to: date | None = None
    erp_employee_code: str | None = Field(default=None, max_length=50)
    cost_center_type: str | None = Field(default=None, max_length=50)
    sort_order: int = 0
    remark: str | None = Field(default=None, max_length=500)
    is_active: bool = True


class OrgMappingTypeItemUpdateRequest(BaseModel):
    type_code: str | None = Field(default=None, min_length=1, max_length=50)
    item_code: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    effective_from: date | None = None
    effective_to: date | None = None
    erp_employee_code: str | None = Field(default=None, max_length=50)
    cost_center_type: str | None = Field(default=None, max_length=50)
    sort_order: int | None = None
    remark: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None


class OrgMappingAssignmentItem(BaseModel):
    id: int
    department_id: int
    department_code: str
    department_name: str
    type_code: str
    item_id: int
    item_code: str
    item_name: str
    effective_from: date
    effective_to: date | None = None
    created_at: datetime
    updated_at: datetime


class OrgMappingAssignmentListResponse(BaseModel):
    items: list[OrgMappingAssignmentItem]
    total_count: int
    page: int
    limit: int


class OrgMappingAssignmentDetailResponse(BaseModel):
    item: OrgMappingAssignmentItem


class OrgMappingPersonalStatusTypeColumn(BaseModel):
    type_code: str
    name: str


class OrgMappingPersonalStatusCell(BaseModel):
    item_code: str
    item_name: str


class OrgMappingPersonalStatusRow(BaseModel):
    employee_id: int
    employee_no: str
    display_name: str
    department_id: int
    department_code: str
    department_name: str
    position_title: str
    mappings: dict[str, OrgMappingPersonalStatusCell] = Field(default_factory=dict)


class OrgMappingPersonalStatusListResponse(BaseModel):
    items: list[OrgMappingPersonalStatusRow]
    type_columns: list[OrgMappingPersonalStatusTypeColumn]
    total_count: int
    page: int
    limit: int


class OrgMappingAssignmentCreateRequest(BaseModel):
    department_id: int
    type_code: str = Field(min_length=1, max_length=50)
    item_id: int
    effective_from: date
    effective_to: date | None = None


class OrgMappingAssignmentUpdateRequest(BaseModel):
    department_id: int | None = None
    type_code: str | None = Field(default=None, min_length=1, max_length=50)
    item_id: int | None = None
    effective_from: date | None = None
    effective_to: date | None = None


class OrgMappingAssignmentUploadRow(BaseModel):
    department_code: str = Field(min_length=1, max_length=30)
    type_code: str = Field(min_length=1, max_length=50)
    item_code: str = Field(min_length=1, max_length=50)
    effective_from: date
    effective_to: date | None = None


class OrgMappingAssignmentUploadRequest(BaseModel):
    mode: Literal["atomic"]
    rows: list[OrgMappingAssignmentUploadRow]


class OrgMappingAssignmentUploadPreviewRow(BaseModel):
    row_number: int
    valid: bool
    errors: list[str] = Field(default_factory=list)
    normalized: dict[str, str | date | None] | None = None


class OrgMappingAssignmentUploadPreviewResponse(BaseModel):
    rows: list[OrgMappingAssignmentUploadPreviewRow]
    valid_count: int
    invalid_count: int


class OrgMappingAssignmentUploadConfirmResponse(BaseModel):
    inserted_count: int
    updated_count: int


class OrgMappingAssignmentUploadTemplateResponse(BaseModel):
    headers: list[str]


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
