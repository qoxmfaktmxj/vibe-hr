from typing import List

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    login_id: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=4, max_length=128)


class LoginUser(BaseModel):
    id: int
    email: str
    display_name: str
    roles: List[str]


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: LoginUser


class ImpersonationCandidate(BaseModel):
    id: int
    login_id: str
    display_name: str


class ImpersonationCandidateListResponse(BaseModel):
    users: list[ImpersonationCandidate]


class ImpersonationLoginRequest(BaseModel):
    user_id: int = Field(gt=0)


class SocialExchangeRequest(BaseModel):
    provider: str = Field(min_length=2, max_length=20)
    provider_user_id: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=1, max_length=100)
