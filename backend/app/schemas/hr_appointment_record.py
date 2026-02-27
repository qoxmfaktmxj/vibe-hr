from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class HrAppointmentRecordItem(BaseModel):
    id: int
    order_id: int
    appointment_no: str
    order_title: str
    order_description: str | None = None
    effective_date: date
    order_status: str
    confirmed_at: datetime | None = None
    confirmed_by: int | None = None
    employee_id: int
    employee_no: str
    display_name: str
    department_name: str
    employment_status: str
    appointment_code_id: int | None = None
    appointment_code_name: str | None = None
    appointment_kind: str
    action_type: str
    start_date: date
    end_date: date | None = None
    from_department_id: int | None = None
    to_department_id: int | None = None
    from_position_title: str | None = None
    to_position_title: str | None = None
    from_employment_status: str | None = None
    to_employment_status: str | None = None
    apply_status: str
    applied_at: datetime | None = None
    temporary_reason: str | None = None
    note: str | None = None
    created_at: datetime
    updated_at: datetime


class HrAppointmentRecordListResponse(BaseModel):
    items: list[HrAppointmentRecordItem]


class HrAppointmentRecordDetailResponse(BaseModel):
    item: HrAppointmentRecordItem


class HrAppointmentRecordCreateRequest(BaseModel):
    employee_id: int = Field(gt=0)
    appointment_no: str | None = Field(default=None, max_length=30)
    order_title: str = Field(min_length=1, max_length=120)
    order_description: str | None = Field(default=None, max_length=500)
    effective_date: date
    order_appointment_code_id: int | None = Field(default=None, gt=0)
    item_appointment_code_id: int | None = Field(default=None, gt=0)
    appointment_kind: str = Field(default="permanent", max_length=20)
    action_type: str = Field(min_length=1, max_length=30)
    start_date: date
    end_date: date | None = None
    to_department_id: int | None = Field(default=None, gt=0)
    to_position_title: str | None = Field(default=None, max_length=80)
    to_employment_status: str | None = Field(default=None, max_length=20)
    temporary_reason: str | None = Field(default=None, max_length=500)
    note: str | None = Field(default=None, max_length=500)


class HrAppointmentRecordUpdateRequest(BaseModel):
    employee_id: int | None = Field(default=None, gt=0)
    appointment_no: str | None = Field(default=None, max_length=30)
    order_title: str | None = Field(default=None, min_length=1, max_length=120)
    order_description: str | None = Field(default=None, max_length=500)
    effective_date: date | None = None
    order_appointment_code_id: int | None = Field(default=None, gt=0)
    item_appointment_code_id: int | None = Field(default=None, gt=0)
    appointment_kind: str | None = Field(default=None, max_length=20)
    action_type: str | None = Field(default=None, min_length=1, max_length=30)
    start_date: date | None = None
    end_date: date | None = None
    to_department_id: int | None = Field(default=None, gt=0)
    to_position_title: str | None = Field(default=None, max_length=80)
    to_employment_status: str | None = Field(default=None, max_length=20)
    temporary_reason: str | None = Field(default=None, max_length=500)
    note: str | None = Field(default=None, max_length=500)


class HrAppointmentOrderConfirmResponse(BaseModel):
    order_id: int
    status: str
    confirmed_at: datetime
    confirmed_by: int | None = None
    applied_count: int
