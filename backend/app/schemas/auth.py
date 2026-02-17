from typing import List

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginUser(BaseModel):
    id: int
    email: EmailStr
    display_name: str
    roles: List[str]


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: LoginUser

