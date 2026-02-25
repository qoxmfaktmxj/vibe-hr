from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class HriFormTypeItem(BaseModel):
    id: int
    form_code: str
    form_name_ko: str
    form_name_en: str | None = None
    module_code: str
    is_active: bool
    allow_draft: bool
    allow_withdraw: bool
    requires_receive: bool
    default_priority: int
    created_by: int | None = None
    updated_by: int | None = None
    created_at: datetime
    updated_at: datetime


class HriFormTypeListResponse(BaseModel):
    items: list[HriFormTypeItem]
    total_count: int


class HriFormTypeBatchItem(BaseModel):
    id: int | None = None
    form_code: str = Field(min_length=1, max_length=30)
    form_name_ko: str = Field(min_length=1, max_length=100)
    form_name_en: str | None = Field(default=None, max_length=100)
    module_code: str = Field(default="COMMON", min_length=1, max_length=30)
    is_active: bool = True
    allow_draft: bool = True
    allow_withdraw: bool = True
    requires_receive: bool = False
    default_priority: int = 50


class HriFormTypeBatchRequest(BaseModel):
    items: list[HriFormTypeBatchItem]
    delete_ids: list[int] = Field(default_factory=list)


class HriFormTypeBatchResponse(BaseModel):
    items: list[HriFormTypeItem]
    total_count: int
    inserted_count: int
    updated_count: int
    deleted_count: int
