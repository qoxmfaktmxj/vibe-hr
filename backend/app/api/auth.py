from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.core.rate_limit import check_login_rate_limit
from app.models import AuthUser
from app.schemas.auth import (
    ImpersonationCandidateListResponse,
    ImpersonationLoginRequest,
    LoginRequest,
    LoginResponse,
    LoginUser,
)
from app.services.auth_service import (
    authenticate_user,
    build_login_response,
    build_login_user,
    impersonate_user,
    list_impersonation_candidates,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    request: Request,
    session: Session = Depends(get_session),
) -> LoginResponse:
    check_login_rate_limit(request)
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


@router.get(
    "/impersonation/users",
    response_model=ImpersonationCandidateListResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def get_impersonation_users(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
    query: str = Query(default="", max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
) -> ImpersonationCandidateListResponse:
    users = list_impersonation_candidates(
        session,
        current_user_id=current_user.id,
        query=query,
        limit=limit,
    )
    return ImpersonationCandidateListResponse(users=users)


@router.post(
    "/impersonation/login",
    response_model=LoginResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def impersonation_login(
    payload: ImpersonationLoginRequest,
    session: Session = Depends(get_session),
) -> LoginResponse:
    try:
        return impersonate_user(session, target_user_id=payload.user_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
