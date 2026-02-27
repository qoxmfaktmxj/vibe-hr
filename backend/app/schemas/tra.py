from __future__ import annotations

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
