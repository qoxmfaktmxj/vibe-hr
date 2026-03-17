from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TraResourceListResponse(BaseModel):
    items: list[dict[str, Any]]
    total_count: int


class TraBatchRowInput(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: int | None = None
    _status: str = "clean"


class TraResourceBatchRequest(BaseModel):
    items: list[TraBatchRowInput]


class TraResourceBatchResponse(BaseModel):
    created: int
    updated: int
    deleted: int


class TraGenerateRequiredEventsRequest(BaseModel):
    year: int = Field(ge=2000, le=2100)


class TraGenerateRequiredTargetsRequest(BaseModel):
    year: int = Field(ge=2000, le=2100)
    rule_code: str | None = Field(default=None, max_length=30)


class TraGenerateElearningWindowsRequest(BaseModel):
    year: int = Field(ge=2000, le=2100)
    app_count: int = Field(default=2, ge=0, le=31)


class TraApplyCyberResultsRequest(BaseModel):
    upload_ym: str | None = Field(default=None, pattern=r"^\d{6}$")


class TraGenerationResponse(BaseModel):
    processed: int
    message: str


# ─── Write-flow schemas ───────────────────────────────────────────────────────


class TraApplicationItem(BaseModel):
    id: int
    application_no: str
    employee_id: int
    employee_no: str | None
    employee_name: str | None
    department_name: str | None
    course_id: int
    course_name: str | None
    event_id: int | None
    event_name: str | None
    in_out_type: str | None
    status: str
    year_plan_yn: bool
    survey_yn: bool
    edu_memo: str | None
    note: str | None
    created_at: datetime
    updated_at: datetime


class TraApplicationListResponse(BaseModel):
    items: list[TraApplicationItem]
    total_count: int


class TraApplicationCreateRequest(BaseModel):
    course_id: int
    event_id: int | None = None
    in_out_type: str | None = None
    year_plan_yn: bool = False
    edu_memo: str | None = Field(default=None, max_length=2000)
    note: str | None = Field(default=None, max_length=2000)


class TraApplicationRejectRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=2000)


class TraApplicationActionResponse(BaseModel):
    item: TraApplicationItem
