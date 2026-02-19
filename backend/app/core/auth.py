from collections.abc import Callable
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlmodel import Session, select

from app.core.config import settings
from app.core.database import get_session
from app.models import AuthRole, AuthUser, AuthUserRole

bearer_scheme = HTTPBearer(auto_error=False)


def build_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.auth_token_expires_min)).timestamp()),
        "iss": settings.auth_token_issuer,
    }
    return jwt.encode(
        payload,
        settings.auth_token_secret,
        algorithm=settings.auth_token_algorithm,
    )


def parse_access_token(token: str) -> int | None:
    try:
        payload = jwt.decode(
            token,
            settings.auth_token_secret,
            algorithms=[settings.auth_token_algorithm],
            issuer=settings.auth_token_issuer,
            options={"require": ["sub", "iat", "exp", "iss"]},
        )
    except InvalidTokenError:
        return None

    user_id_str = payload.get("sub")
    if not isinstance(user_id_str, str):
        return None

    if not user_id_str.isdigit():
        return None

    return int(user_id_str)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> AuthUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )

    user_id = parse_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token.",
        )

    user = session.exec(select(AuthUser).where(AuthUser.id == user_id)).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token.",
        )

    return user


def _get_user_role_codes(session: Session, user_id: int) -> set[str]:
    """사용자의 역할 코드 목록을 반환한다."""
    role_codes = session.exec(
        select(AuthRole.code)
        .join(AuthUserRole, AuthRole.id == AuthUserRole.role_id)
        .where(AuthUserRole.user_id == user_id)
    ).all()
    return set(role_codes)


def require_roles(*allowed_roles: str) -> Callable:
    """특정 역할이 필요한 API 엔드포인트에 사용하는 의존성 팩토리.

    사용 예:
        @router.get("/admin-only", dependencies=[Depends(require_roles("admin"))])
        def admin_endpoint(): ...

        @router.get("/hr", dependencies=[Depends(require_roles("hr_manager", "admin"))])
        def hr_endpoint(): ...
    """

    def _guard(
        current_user: AuthUser = Depends(get_current_user),
        session: Session = Depends(get_session),
    ) -> AuthUser:
        user_roles = _get_user_role_codes(session, current_user.id)
        if not user_roles.intersection(allowed_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="접근 권한이 없습니다.",
            )
        return current_user

    return _guard
