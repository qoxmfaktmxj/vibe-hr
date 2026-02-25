from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class HriRequestItem(BaseModel):
    id: int
    request_no: str
    form_type_id: int
    form_name: str | None = None
    requester_id: int
    title: str
    status_code: str
    current_step_order: int | None = None
    current_actor_name: str | None = None
    submitted_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    content_json: dict[str, Any]


class HriRequestListResponse(BaseModel):
    items: list[HriRequestItem]
    total_count: int


class HriTaskItem(BaseModel):
    request_id: int
    request_no: str
    title: str
    status_code: str
    step_order: int
    step_type: str
    requester_id: int
    requested_at: datetime
    form_name: str | None = None


class HriTaskListResponse(BaseModel):
    items: list[HriTaskItem]
    total_count: int


class HriRequestDraftUpsertRequest(BaseModel):
    request_id: int | None = None
    form_type_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=200)
    content_json: dict[str, Any] = Field(default_factory=dict)


class HriRequestDetailResponse(BaseModel):
    request: HriRequestItem


class HriRequestSubmitResponse(BaseModel):
    request_id: int
    status_code: str
    current_step_order: int | None = None


class HriRequestActionRequest(BaseModel):
    comment: str | None = Field(default=None, max_length=1000)


class HriRequestActionResponse(BaseModel):
    request_id: int
    status_code: str
