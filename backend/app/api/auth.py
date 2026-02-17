from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.core.auth import get_current_user
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.auth import LoginRequest, LoginResponse, LoginUser
from app.services.auth_service import authenticate_user, build_login_response, build_login_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, session: Session = Depends(get_session)) -> LoginResponse:
    user = authenticate_user(session, payload.login_id, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다.",
        )
    return build_login_response(session, user)


@router.get("/me", response_model=LoginUser)
def me(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> LoginUser:
    return build_login_user(session, current_user)
