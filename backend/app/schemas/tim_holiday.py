from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class TimHolidayItem(BaseModel):
    id: int
    holiday_date: date
    name: str
    holiday_type: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TimHolidayListResponse(BaseModel):
    items: list[TimHolidayItem]
    total_count: int
    year: int


class TimHolidayBatchItem(BaseModel):
    id: int | None = None
    holiday_date: date
    name: str = Field(min_length=1, max_length=100)
    holiday_type: str = Field(default="legal", pattern="^(legal|company|substitute)$")
    is_active: bool = True


class TimHolidayBatchRequest(BaseModel):
    items: list[TimHolidayBatchItem]
    delete_ids: list[int] = []


class TimHolidayBatchResponse(BaseModel):
    items: list[TimHolidayItem]
    total_count: int
    year: int
    inserted_count: int
    updated_count: int
    deleted_count: int


class TimHolidayCopyYearRequest(BaseModel):
    year_from: int = Field(ge=2000, le=2100)
    year_to: int = Field(ge=2000, le=2100)


class TimHolidayCopyYearResponse(BaseModel):
    copied_count: int
    year_to: int
