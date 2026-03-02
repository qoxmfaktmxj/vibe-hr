from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.system_setting import (
    AuthSessionPolicyResponse,
    AuthSessionPolicyUpdateRequest,
)
from app.services.system_setting_service import get_auth_session_policy, update_auth_session_policy

router = APIRouter(prefix="/system-settings", tags=["system-settings"])


@router.get(
    "/auth-session",
    response_model=AuthSessionPolicyResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def auth_session_policy_get(session: Session = Depends(get_session)) -> AuthSessionPolicyResponse:
    return AuthSessionPolicyResponse(policy=get_auth_session_policy(session))


@router.put(
    "/auth-session",
    response_model=AuthSessionPolicyResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def auth_session_policy_update(
    payload: AuthSessionPolicyUpdateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> AuthSessionPolicyResponse:
    try:
        policy = update_auth_session_policy(session, payload, changed_by=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AuthSessionPolicyResponse(policy=policy)
