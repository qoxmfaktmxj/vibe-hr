"""MNG(관리) 모듈 Pydantic 스키마."""

from __future__ import annotations

from datetime import date, datetime
from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
#  고객사 (MngCompany)
# ──────────────────────────────────────────────

class MngCompanyItem(BaseModel):
    id: int
    company_code: str
    company_name: str
    company_group_code: str | None = None
    company_type: str | None = None
    management_type: str | None = None
    representative_company: str | None = None
    start_date: date | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class MngCompanyListResponse(BaseModel):
    companies: list[MngCompanyItem]
    total_count: int


class MngCompanyDetailResponse(BaseModel):
    company: MngCompanyItem


class MngCompanyCreateRequest(BaseModel):
    company_code: str = Field(min_length=1, max_length=20)
    company_name: str = Field(min_length=1, max_length=100)
    company_group_code: str | None = None
    company_type: str | None = None
    management_type: str | None = None
    representative_company: str | None = None
    start_date: date | None = None


class MngCompanyUpdateRequest(BaseModel):
    company_name: str | None = Field(default=None, min_length=1, max_length=100)
    company_group_code: str | None = None
    company_type: str | None = None
    management_type: str | None = None
    representative_company: str | None = None
    start_date: date | None = None
    is_active: bool | None = None


class MngCompanyDropdownItem(BaseModel):
    id: int
    company_name: str


class MngCompanyDropdownResponse(BaseModel):
    companies: list[MngCompanyDropdownItem]


class MngBulkDeleteRequest(BaseModel):
    ids: list[int] = Field(min_length=1)


class MngBulkDeleteResponse(BaseModel):
    deleted_count: int


# ──────────────────────────────────────────────
#  담당자-고객사 매핑 (MngManagerCompany)
# ──────────────────────────────────────────────

class MngManagerCompanyItem(BaseModel):
    id: int
    employee_id: int
    employee_name: str | None = None
    company_id: int
    company_name: str | None = None
    start_date: date
    end_date: date | None = None
    note: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class MngManagerCompanyListResponse(BaseModel):
    items: list[MngManagerCompanyItem]
    total_count: int


class MngManagerCompanyCreateRequest(BaseModel):
    employee_id: int
    company_id: int
    start_date: date
    end_date: date | None = None
    note: str | None = None


# ──────────────────────────────────────────────
#  추가개발 요청 (MngDevRequest)
# ──────────────────────────────────────────────

class MngDevRequestItem(BaseModel):
    id: int
    company_id: int
    company_name: str | None = None
    request_ym: date
    request_seq: int
    status_code: str | None = None
    status_name: str | None = None
    part_code: str | None = None
    part_name: str | None = None
    requester_name: str | None = None
    request_content: str | None = None
    manager_employee_id: int | None = None
    manager_name: str | None = None
    developer_employee_id: int | None = None
    developer_name: str | None = None
    is_paid: bool
    paid_content: str | None = None
    has_tax_bill: bool
    start_ym: date | None = None
    end_ym: date | None = None
    dev_start_date: date | None = None
    dev_end_date: date | None = None
    paid_man_months: float | None = None
    actual_man_months: float | None = None
    note: str | None = None
    created_at: datetime
    updated_at: datetime


class MngDevRequestListResponse(BaseModel):
    items: list[MngDevRequestItem]
    total_count: int


class MngDevRequestMonthlySummaryItem(BaseModel):
    request_ym: date
    total_count: int
    paid_count: int
    paid_man_months_total: float
    actual_man_months_total: float


class MngDevRequestMonthlySummaryResponse(BaseModel):
    items: list[MngDevRequestMonthlySummaryItem]
    total_count: int


class MngDevRequestDetailResponse(BaseModel):
    item: MngDevRequestItem


class MngDevRequestCreateRequest(BaseModel):
    company_id: int
    request_ym: date
    request_seq: int = 0
    status_code: str | None = None
    part_code: str | None = None
    requester_name: str | None = None
    request_content: str | None = None
    manager_employee_id: int | None = None
    developer_employee_id: int | None = None
    is_paid: bool = False
    paid_content: str | None = None
    has_tax_bill: bool = False
    start_ym: date | None = None
    end_ym: date | None = None
    dev_start_date: date | None = None
    dev_end_date: date | None = None
    paid_man_months: float | None = None
    actual_man_months: float | None = None
    note: str | None = None


class MngDevRequestUpdateRequest(BaseModel):
    company_id: int | None = None
    request_ym: date | None = None
    status_code: str | None = None
    part_code: str | None = None
    requester_name: str | None = None
    request_content: str | None = None
    manager_employee_id: int | None = None
    developer_employee_id: int | None = None
    is_paid: bool | None = None
    paid_content: str | None = None
    has_tax_bill: bool | None = None
    start_ym: date | None = None
    end_ym: date | None = None
    dev_start_date: date | None = None
    dev_end_date: date | None = None
    paid_man_months: float | None = None
    actual_man_months: float | None = None
    note: str | None = None


# ──────────────────────────────────────────────
#  추가개발 프로젝트 (MngDevProject)
# ──────────────────────────────────────────────

class MngDevProjectItem(BaseModel):
    id: int
    project_name: str
    company_id: int
    company_name: str | None = None
    part_code: str | None = None
    part_name: str | None = None
    assigned_staff: str | None = None
    contract_start_date: date | None = None
    contract_end_date: date | None = None
    dev_start_date: date | None = None
    dev_end_date: date | None = None
    inspection_status: str | None = None
    inspection_name: str | None = None
    has_tax_bill: bool
    actual_man_months: float | None = None
    contract_amount: int | None = None
    note: str | None = None
    created_at: datetime
    updated_at: datetime


class MngDevProjectListResponse(BaseModel):
    items: list[MngDevProjectItem]
    total_count: int


class MngDevProjectDetailResponse(BaseModel):
    item: MngDevProjectItem


class MngDevProjectCreateRequest(BaseModel):
    project_name: str = Field(min_length=1, max_length=200)
    company_id: int
    part_code: str | None = None
    assigned_staff: str | None = None
    contract_start_date: date | None = None
    contract_end_date: date | None = None
    dev_start_date: date | None = None
    dev_end_date: date | None = None
    inspection_status: str | None = None
    has_tax_bill: bool = False
    actual_man_months: float | None = None
    contract_amount: int | None = None
    note: str | None = None


class MngDevProjectUpdateRequest(BaseModel):
    project_name: str | None = Field(default=None, min_length=1, max_length=200)
    company_id: int | None = None
    part_code: str | None = None
    assigned_staff: str | None = None
    contract_start_date: date | None = None
    contract_end_date: date | None = None
    dev_start_date: date | None = None
    dev_end_date: date | None = None
    inspection_status: str | None = None
    has_tax_bill: bool | None = None
    actual_man_months: float | None = None
    contract_amount: int | None = None
    note: str | None = None


# ──────────────────────────────────────────────
#  추가개발 문의 (MngDevInquiry)
# ──────────────────────────────────────────────

class MngDevInquiryItem(BaseModel):
    id: int
    company_id: int
    company_name: str | None = None
    inquiry_content: str | None = None
    hoped_start_date: date | None = None
    estimated_man_months: float | None = None
    sales_rep_name: str | None = None
    client_contact_name: str | None = None
    progress_code: str | None = None
    progress_name: str | None = None
    is_confirmed: bool
    project_name: str | None = None
    note: str | None = None
    created_at: datetime
    updated_at: datetime


class MngDevInquiryListResponse(BaseModel):
    items: list[MngDevInquiryItem]
    total_count: int


class MngDevInquiryDetailResponse(BaseModel):
    item: MngDevInquiryItem


class MngDevInquiryCreateRequest(BaseModel):
    company_id: int
    inquiry_content: str | None = None
    hoped_start_date: date | None = None
    estimated_man_months: float | None = None
    sales_rep_name: str | None = None
    client_contact_name: str | None = None
    progress_code: str | None = None
    is_confirmed: bool = False
    project_name: str | None = None
    note: str | None = None


class MngDevInquiryUpdateRequest(BaseModel):
    company_id: int | None = None
    inquiry_content: str | None = None
    hoped_start_date: date | None = None
    estimated_man_months: float | None = None
    sales_rep_name: str | None = None
    client_contact_name: str | None = None
    progress_code: str | None = None
    is_confirmed: bool | None = None
    project_name: str | None = None
    note: str | None = None


# ──────────────────────────────────────────────
#  개발 인력현황 (Dev Staff)
# ──────────────────────────────────────────────

class MngDevStaffProjectItem(BaseModel):
    project_id: int
    project_name: str
    company_id: int
    company_name: str | None = None
    assigned_staff: str | None = None
    contract_start_date: date | None = None
    contract_end_date: date | None = None
    dev_start_date: date | None = None
    dev_end_date: date | None = None
    actual_man_months: float | None = None
    contract_amount: int | None = None


class MngDevStaffProjectListResponse(BaseModel):
    items: list[MngDevStaffProjectItem]
    total_count: int


class MngDevStaffRevenueItem(BaseModel):
    month: date
    project_count: int
    contract_amount_total: int
    actual_man_months_total: float


class MngDevStaffRevenueSummaryResponse(BaseModel):
    items: list[MngDevStaffRevenueItem]
    total_count: int


# ──────────────────────────────────────────────
#  외주인력 계약 (MngOutsourceContract)
# ──────────────────────────────────────────────

class MngOutsourceContractItem(BaseModel):
    id: int
    employee_id: int
    employee_name: str | None = None
    employee_no: str | None = None
    start_date: date
    end_date: date
    total_leave_count: float
    extra_leave_count: float
    note: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class MngOutsourceContractListResponse(BaseModel):
    items: list[MngOutsourceContractItem]
    total_count: int


class MngOutsourceContractDetailResponse(BaseModel):
    item: MngOutsourceContractItem


class MngOutsourceContractDuplicateResponse(BaseModel):
    is_duplicate: bool


class MngOutsourceContractCreateRequest(BaseModel):
    employee_id: int
    start_date: date
    end_date: date
    total_leave_count: float = 0
    extra_leave_count: float = 0
    note: str | None = None


class MngOutsourceContractUpdateRequest(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    total_leave_count: float | None = None
    extra_leave_count: float | None = None
    note: str | None = None
    is_active: bool | None = None


# ──────────────────────────────────────────────
#  외주인력 근태 (MngOutsourceAttendance)
# ──────────────────────────────────────────────

class MngOutsourceAttendanceSummaryItem(BaseModel):
    contract_id: int
    employee_id: int
    employee_name: str | None = None
    employee_no: str | None = None
    start_date: date
    end_date: date
    total_count: float
    used_count: float
    remain_count: float
    note: str | None = None


class MngOutsourceAttendanceSummaryResponse(BaseModel):
    items: list[MngOutsourceAttendanceSummaryItem]
    total_count: int


class MngOutsourceAttendanceItem(BaseModel):
    id: int
    contract_id: int
    employee_id: int
    attendance_code: str
    attendance_name: str | None = None
    apply_date: date | None = None
    status_code: str | None = None
    status_name: str | None = None
    start_date: date
    end_date: date
    apply_count: float | None = None
    note: str | None = None
    created_at: datetime
    updated_at: datetime


class MngOutsourceAttendanceListResponse(BaseModel):
    items: list[MngOutsourceAttendanceItem]
    total_count: int


class MngOutsourceAttendanceCreateRequest(BaseModel):
    contract_id: int
    employee_id: int
    attendance_code: str
    apply_date: date | None = None
    status_code: str | None = None
    start_date: date
    end_date: date
    apply_count: float | None = None
    note: str | None = None


# ──────────────────────────────────────────────
#  인프라 마스터 (MngInfraMaster)
# ──────────────────────────────────────────────

class MngInfraMasterItem(BaseModel):
    id: int
    company_id: int
    company_name: str | None = None
    service_type: str
    service_type_name: str | None = None
    env_type: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class MngInfraMasterListResponse(BaseModel):
    items: list[MngInfraMasterItem]
    total_count: int


class MngInfraMasterCreateRequest(BaseModel):
    company_id: int
    service_type: str = Field(min_length=1, max_length=40)
    env_type: str = Field(min_length=1, max_length=10)


# ──────────────────────────────────────────────
#  인프라 구성 상세 (MngInfraConfig)
# ──────────────────────────────────────────────

class MngInfraConfigItem(BaseModel):
    id: int
    master_id: int
    section: str
    config_key: str
    config_value: str | None = None
    sort_order: int
    created_at: datetime
    updated_at: datetime


class MngInfraConfigListResponse(BaseModel):
    items: list[MngInfraConfigItem]
    total_count: int


class MngInfraConfigUpsertRow(BaseModel):
    section: str = Field(min_length=1, max_length=100)
    config_key: str = Field(min_length=1, max_length=100)
    config_value: str | None = None
    sort_order: int = 0


class MngInfraConfigUpsertRequest(BaseModel):
    rows: list[MngInfraConfigUpsertRow]
