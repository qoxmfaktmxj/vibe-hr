from datetime import datetime, timezone

from sqlmodel import Session, select

from app.core.auth import build_access_token
from app.core.security import verify_password
from app.models import AuthRole, AuthUser, AuthUserRole
from app.schemas.auth import ImpersonationCandidate, LoginResponse, LoginUser


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


def list_impersonation_candidates(
    session: Session,
    *,
    current_user_id: int,
    query: str = "",
    limit: int = 20,
) -> list[ImpersonationCandidate]:
    normalized_query = query.strip().lower()
    max_limit = min(max(limit, 1), 100)

    users = session.exec(
        select(AuthUser)
        .where(AuthUser.is_active == True, AuthUser.id != current_user_id)  # noqa: E712
        .order_by(AuthUser.login_id)
    ).all()

    filtered = []
    for user in users:
        if normalized_query:
            haystack = f"{user.login_id} {user.display_name} {user.email}".lower()
            if normalized_query not in haystack:
                continue
        filtered.append(
            ImpersonationCandidate(
                id=user.id,
                login_id=user.login_id,
                display_name=user.display_name,
            )
        )
        if len(filtered) >= max_limit:
            break

    return filtered


def impersonate_user(session: Session, *, target_user_id: int) -> LoginResponse:
    target_user = session.exec(
        select(AuthUser).where(AuthUser.id == target_user_id, AuthUser.is_active == True)  # noqa: E712
    ).first()
    if target_user is None:
        raise ValueError("전환 대상 사용자를 찾을 수 없습니다.")
    return build_login_response(session, target_user)
