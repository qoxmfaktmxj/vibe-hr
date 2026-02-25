from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class HriApprovalTemplateStepItem(BaseModel):
    id: int
    step_order: int
    step_type: str
    actor_resolve_type: str
    actor_role_code: str | None = None
    actor_user_id: int | None = None
    allow_delegate: bool
    required_action: str
    created_at: datetime
    updated_at: datetime


class HriApprovalTemplateItem(BaseModel):
    id: int
    template_code: str
    template_name: str
    scope_type: str
    scope_id: str | None = None
    is_default: bool
    is_active: bool
    priority: int
    created_at: datetime
    updated_at: datetime
    steps: list[HriApprovalTemplateStepItem]


class HriApprovalTemplateListResponse(BaseModel):
    items: list[HriApprovalTemplateItem]
    total_count: int


class HriApprovalTemplateStepBatchItem(BaseModel):
    id: int | None = None
    step_order: int = Field(ge=1, le=99)
    step_type: str = Field(pattern="^(APPROVAL|RECEIVE|REFERENCE)$")
    actor_resolve_type: str = Field(pattern="^(ROLE_BASED|USER_FIXED)$")
    actor_role_code: str | None = Field(default=None, max_length=30)
    actor_user_id: int | None = None
    allow_delegate: bool = True
    required_action: str = Field(pattern="^(APPROVE|RECEIVE)$")


class HriApprovalTemplateBatchItem(BaseModel):
    id: int | None = None
    template_code: str = Field(min_length=1, max_length=30)
    template_name: str = Field(min_length=1, max_length=100)
    scope_type: str = Field(default="GLOBAL", pattern="^(GLOBAL|COMPANY|DEPT|TEAM|USER)$")
    scope_id: str | None = Field(default=None, max_length=40)
    is_default: bool = False
    is_active: bool = True
    priority: int = 100
    steps: list[HriApprovalTemplateStepBatchItem] = Field(default_factory=list)


class HriApprovalTemplateBatchRequest(BaseModel):
    items: list[HriApprovalTemplateBatchItem]
    delete_ids: list[int] = Field(default_factory=list)


class HriApprovalTemplateBatchResponse(BaseModel):
    items: list[HriApprovalTemplateItem]
    total_count: int
    inserted_count: int
    updated_count: int
    deleted_count: int
