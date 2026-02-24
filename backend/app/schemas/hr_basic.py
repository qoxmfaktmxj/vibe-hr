from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class HrBasicProfile(BaseModel):
    employee_id: int
    employee_no: str | None = None
    full_name: str | None = None
    gender: str | None = None
    resident_no_masked: str | None = None
    birth_date: date | None = None
    hire_date: date | None = None
    retire_date: date | None = None
    blood_type: str | None = None
    marital_status: str | None = None
    mbti: str | None = None
    probation_end_date: date | None = None
    department_name: str | None = None
    position_title: str | None = None
    job_family: str | None = None
    job_role: str | None = None
    grade: str | None = None


class HrBasicProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    hire_date: date | None = None
    position_title: str | None = None
    gender: str | None = None
    resident_no_masked: str | None = None
    birth_date: date | None = None
    retire_date: date | None = None
    blood_type: str | None = None
    marital_status: str | None = None
    mbti: str | None = None
    probation_end_date: date | None = None
    job_family: str | None = None
    job_role: str | None = None
    grade: str | None = None


class HrBasicRecordItem(BaseModel):
    id: int
    category: str
    record_date: date | None = None
    title: str | None = None
    type: str | None = None
    organization: str | None = None
    value: str | None = None
    note: str | None = None
    created_at: datetime


class HrBasicRecordCreateRequest(BaseModel):
    category: str
    record_date: date | None = None
    title: str | None = None
    type: str | None = None
    organization: str | None = None
    value: str | None = None
    note: str | None = None


class HrBasicRecordUpdateRequest(BaseModel):
    record_date: date | None = None
    title: str | None = None
    type: str | None = None
    organization: str | None = None
    value: str | None = None
    note: str | None = None


class HrBasicDetailResponse(BaseModel):
    profile: HrBasicProfile
    appointments: list[HrBasicRecordItem]
    rewards_penalties: list[HrBasicRecordItem]
    contacts: list[HrBasicRecordItem]
    educations: list[HrBasicRecordItem]
    careers: list[HrBasicRecordItem]
    certificates: list[HrBasicRecordItem]
    military: list[HrBasicRecordItem]
    evaluations: list[HrBasicRecordItem]
