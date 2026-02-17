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
