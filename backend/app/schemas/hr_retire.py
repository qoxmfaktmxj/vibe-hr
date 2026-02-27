from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class HrRetireChecklistItemResponse(BaseModel):
    id: int
    code: str
    title: str
    description: str | None = None
    is_required: bool
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class HrRetireChecklistListResponse(BaseModel):
    items: list[HrRetireChecklistItemResponse]


class HrRetireChecklistCreateRequest(BaseModel):
    code: str
    title: str
    description: str | None = None
    is_required: bool = True
    is_active: bool = True
    sort_order: int = 0


class HrRetireChecklistUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    is_required: bool | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class HrRetireCaseListItem(BaseModel):
    id: int
    employee_id: int
    employee_no: str
    employee_name: str
    department_name: str
    position_title: str
    retire_date: date
    reason: str | None = None
    status: str
    created_at: datetime
    confirmed_at: datetime | None = None
    cancelled_at: datetime | None = None


class HrRetireCaseListResponse(BaseModel):
    items: list[HrRetireCaseListItem]


class HrRetireCaseCreateRequest(BaseModel):
    employee_id: int
    retire_date: date
    reason: str | None = None


class HrRetireCaseChecklistItemResponse(BaseModel):
    id: int
    checklist_item_id: int
    checklist_code: str
    checklist_title: str
    checklist_description: str | None = None
    is_required: bool
    is_checked: bool
    checked_by: int | None = None
    checked_at: datetime | None = None
    note: str | None = None


class HrRetireAuditLogItemResponse(BaseModel):
    id: int
    action_type: str
    actor_user_id: int | None = None
    detail: str | None = None
    created_at: datetime


class HrRetireCaseDetailResponse(BaseModel):
    id: int
    employee_id: int
    employee_no: str
    employee_name: str
    department_name: str
    position_title: str
    retire_date: date
    reason: str | None = None
    status: str
    previous_employment_status: str | None = None
    requested_by: int | None = None
    confirmed_by: int | None = None
    confirmed_at: datetime | None = None
    cancelled_by: int | None = None
    cancelled_at: datetime | None = None
    cancel_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    checklist_items: list[HrRetireCaseChecklistItemResponse]
    audit_logs: list[HrRetireAuditLogItemResponse]


class HrRetireCaseChecklistUpdateRequest(BaseModel):
    is_checked: bool
    note: str | None = None


class HrRetireCaseCancelRequest(BaseModel):
    cancel_reason: str | None = None

