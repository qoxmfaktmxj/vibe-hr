from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class HrRecruitFinalistItem(BaseModel):
    id: int
    candidate_no: str
    source_type: str
    external_key: str | None = None
    full_name: str
    resident_no_masked: str | None = None
    birth_date: date | None = None
    phone_mobile: str | None = None
    email: str | None = None
    hire_type: str
    career_years: int | None = None
    login_id: str | None = None
    employee_no: str | None = None
    expected_join_date: date | None = None
    status_code: str
    note: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class HrRecruitFinalistListResponse(BaseModel):
    items: list[HrRecruitFinalistItem]
    total_count: int


class HrRecruitFinalistDetailResponse(BaseModel):
    item: HrRecruitFinalistItem


class HrRecruitFinalistCreateRequest(BaseModel):
    source_type: str = Field(default="manual", pattern="^(if|manual)$")
    external_key: str | None = Field(default=None, max_length=100)
    full_name: str = Field(min_length=1, max_length=100)
    resident_no_masked: str | None = Field(default=None, max_length=30)
    birth_date: date | None = None
    phone_mobile: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=320)
    hire_type: str = Field(default="new", pattern="^(new|experienced)$")
    career_years: int | None = Field(default=None, ge=0, le=60)
    login_id: str | None = Field(default=None, max_length=50)
    employee_no: str | None = Field(default=None, max_length=30)
    expected_join_date: date | None = None
    status_code: str = Field(default="draft", pattern="^(draft|ready|appointed)$")
    note: str | None = Field(default=None, max_length=500)
    is_active: bool = True


class HrRecruitFinalistUpdateRequest(BaseModel):
    source_type: str | None = Field(default=None, pattern="^(if|manual)$")
    external_key: str | None = Field(default=None, max_length=100)
    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    resident_no_masked: str | None = Field(default=None, max_length=30)
    birth_date: date | None = None
    phone_mobile: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=320)
    hire_type: str | None = Field(default=None, pattern="^(new|experienced)$")
    career_years: int | None = Field(default=None, ge=0, le=60)
    login_id: str | None = Field(default=None, max_length=50)
    employee_no: str | None = Field(default=None, max_length=30)
    expected_join_date: date | None = None
    status_code: str | None = Field(default=None, pattern="^(draft|ready|appointed)$")
    note: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None


class HrRecruitBulkDeleteRequest(BaseModel):
    ids: list[int] = Field(min_length=1)


class HrRecruitBulkDeleteResponse(BaseModel):
    deleted_count: int


class HrRecruitIfInboundRow(BaseModel):
    external_key: str = Field(min_length=1, max_length=100)
    full_name: str = Field(min_length=1, max_length=100)
    hire_type: str = Field(default="new", pattern="^(new|experienced)$")
    phone_mobile: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=320)
    expected_join_date: date | None = None
    note: str | None = Field(default=None, max_length=500)


class HrRecruitIfSyncRequest(BaseModel):
    rows: list[HrRecruitIfInboundRow] = Field(default_factory=list)


class HrRecruitIfSyncResponse(BaseModel):
    inserted_count: int
    updated_count: int


class HrRecruitGenerateEmployeeNoRequest(BaseModel):
    ids: list[int] = Field(min_length=1)


class HrRecruitGenerateEmployeeNoResponse(BaseModel):
    updated_count: int
    skipped_count: int


class HrRecruitCreateEmployeesRequest(BaseModel):
    ids: list[int] = Field(min_length=1)


class HrRecruitCreateEmployeesResult(BaseModel):
    finalist_id: int
    candidate_no: str
    full_name: str
    outcome: str
    detail: str
    employee_id: int | None = None
    employee_no: str | None = None
    login_id: str | None = None


class HrRecruitCreateEmployeesResponse(BaseModel):
    created_count: int
    skipped_count: int
    error_count: int
    results: list[HrRecruitCreateEmployeesResult]
