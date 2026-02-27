from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


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
