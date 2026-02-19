from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class CodeGroupItem(BaseModel):
    id: int
    code: str
    name: str
    description: str | None
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class CodeItem(BaseModel):
    id: int
    group_id: int
    code: str
    name: str
    description: str | None
    is_active: bool
    sort_order: int
    extra_value1: str | None
    extra_value2: str | None
    created_at: datetime
    updated_at: datetime


class CodeGroupListResponse(BaseModel):
    groups: list[CodeGroupItem]


class CodeGroupDetailResponse(BaseModel):
    group: CodeGroupItem


class CodeListResponse(BaseModel):
    codes: list[CodeItem]


class CodeDetailResponse(BaseModel):
    code: CodeItem


class ActiveCodeOption(BaseModel):
    code: str
    name: str


class ActiveCodeListResponse(BaseModel):
    group_code: str
    options: list[ActiveCodeOption]


class CodeGroupCreateRequest(BaseModel):
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    is_active: bool = True
    sort_order: int = 0


class CodeGroupUpdateRequest(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=30)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class CodeCreateRequest(BaseModel):
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    is_active: bool = True
    sort_order: int = 0
    extra_value1: str | None = Field(default=None, max_length=200)
    extra_value2: str | None = Field(default=None, max_length=200)


class CodeUpdateRequest(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=30)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    extra_value1: str | None = Field(default=None, max_length=200)
    extra_value2: str | None = Field(default=None, max_length=200)
