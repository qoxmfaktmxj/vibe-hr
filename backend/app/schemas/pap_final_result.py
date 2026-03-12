from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class PapFinalResultItem(BaseModel):
    id: int
    result_code: str
    result_name: str
    score_grade: float | None = None
    is_active: bool
    sort_order: int
    description: str | None = None
    created_at: datetime
    updated_at: datetime


class PapFinalResultListResponse(BaseModel):
    items: list[PapFinalResultItem]
    total_count: int
    page: int
    limit: int


class PapFinalResultDetailResponse(BaseModel):
    item: PapFinalResultItem


class PapFinalResultCreateRequest(BaseModel):
    result_code: str = Field(min_length=1, max_length=30)
    result_name: str = Field(min_length=1, max_length=120)
    score_grade: float | None = None
    is_active: bool = True
    sort_order: int = 0
    description: str | None = Field(default=None, max_length=500)


class PapFinalResultUpdateRequest(BaseModel):
    result_code: str | None = Field(default=None, min_length=1, max_length=30)
    result_name: str | None = Field(default=None, min_length=1, max_length=120)
    score_grade: float | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    description: str | None = Field(default=None, max_length=500)
