from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from app.core.database import get_session
from app.models import AuthUser

TOKEN_PREFIX = "dev-token-"
bearer_scheme = HTTPBearer(auto_error=False)


def build_access_token(user_id: int) -> str:
    return f"{TOKEN_PREFIX}{user_id}"


def parse_access_token(token: str) -> int | None:
    if not token.startswith(TOKEN_PREFIX):
        return None

    user_id_str = token.removeprefix(TOKEN_PREFIX)
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
