from datetime import datetime, timezone

from sqlmodel import Session, select

from app.core.auth import build_access_token
from app.core.security import verify_password
from app.models import AuthRole, AuthUser, AuthUserRole
from app.schemas.auth import LoginResponse, LoginUser


def authenticate_user(session: Session, login_id: str, password: str) -> AuthUser | None:
    user = session.exec(select(AuthUser).where(AuthUser.login_id == login_id)).first()
    if user is None:
        return None
    if not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def build_login_user(session: Session, user: AuthUser) -> LoginUser:
    roles = session.exec(
        select(AuthRole.code)
        .join(AuthUserRole, AuthRole.id == AuthUserRole.role_id)
        .where(AuthUserRole.user_id == user.id)
    ).all()

    return LoginUser(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        roles=list(roles),
    )


def build_login_response(session: Session, user: AuthUser) -> LoginResponse:
    user.last_login_at = datetime.now(timezone.utc)
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()

    return LoginResponse(
        access_token=build_access_token(user.id),
        user=build_login_user(session, user),
    )
