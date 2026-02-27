from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class PapAppraisalItem(BaseModel):
    id: int
    appraisal_code: str
    appraisal_name: str
    appraisal_year: int
    final_result_id: int | None = None
    final_result_code: str | None = None
    final_result_name: str | None = None
    appraisal_type: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool
    sort_order: int
    description: str | None = None
    created_at: datetime
    updated_at: datetime


class PapAppraisalListResponse(BaseModel):
    items: list[PapAppraisalItem]


class PapAppraisalDetailResponse(BaseModel):
    item: PapAppraisalItem


class PapAppraisalCreateRequest(BaseModel):
    appraisal_code: str = Field(min_length=1, max_length=30)
    appraisal_name: str = Field(min_length=1, max_length=120)
    appraisal_year: int = Field(ge=2000, le=2100)
    final_result_id: int | None = None
    appraisal_type: str | None = Field(default=None, max_length=40)
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool = True
    sort_order: int = 0
    description: str | None = Field(default=None, max_length=500)


class PapAppraisalUpdateRequest(BaseModel):
    appraisal_code: str | None = Field(default=None, min_length=1, max_length=30)
    appraisal_name: str | None = Field(default=None, min_length=1, max_length=120)
    appraisal_year: int | None = Field(default=None, ge=2000, le=2100)
    final_result_id: int | None = None
    appraisal_type: str | None = Field(default=None, max_length=40)
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    description: str | None = Field(default=None, max_length=500)
