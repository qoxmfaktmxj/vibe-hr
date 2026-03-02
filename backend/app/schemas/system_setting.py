from pydantic import BaseModel, Field


class AuthSessionPolicy(BaseModel):
    access_ttl_min: int = Field(ge=5, le=1440)
    refresh_threshold_min: int = Field(ge=1, le=720)
    remember_enabled: bool = True
    remember_ttl_min: int = Field(ge=60, le=60 * 24 * 30)
    show_countdown: bool = True


class AuthSessionPolicyResponse(BaseModel):
    policy: AuthSessionPolicy


class AuthSessionPolicyUpdateRequest(BaseModel):
    access_ttl_min: int = Field(ge=5, le=1440)
    refresh_threshold_min: int = Field(ge=1, le=720)
    remember_enabled: bool = True
    remember_ttl_min: int = Field(ge=60, le=60 * 24 * 30)
    show_countdown: bool = True
    reason: str | None = Field(default=None, max_length=255)
