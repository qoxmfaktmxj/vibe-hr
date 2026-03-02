from __future__ import annotations

from sqlmodel import Session, select

from app.models import AppSystemSetting, AppSystemSettingHistory
from app.schemas.system_setting import AuthSessionPolicy, AuthSessionPolicyUpdateRequest

AUTH_POLICY_REGISTRY: dict[str, tuple[str, str]] = {
    "auth.session.access_ttl_min": ("int", "120"),
    "auth.session.refresh_threshold_min": ("int", "60"),
    "auth.session.remember_enabled": ("bool", "true"),
    "auth.session.remember_ttl_min": ("int", str(60 * 24 * 30)),
    "auth.session.show_countdown": ("bool", "true"),
}


def _parse_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "y", "yes", "on"}


def _to_text(value_type: str, value: int | bool | str) -> str:
    if value_type == "bool":
        return "true" if bool(value) else "false"
    return str(value)


def _upsert_setting(
    session: Session,
    *,
    key: str,
    value_type: str,
    value_text: str,
    category: str,
    description: str,
    changed_by: int | None,
    reason: str | None,
) -> None:
    row = session.exec(select(AppSystemSetting).where(AppSystemSetting.key == key)).first()
    old = row.value_text if row is not None else None

    if row is None:
        row = AppSystemSetting(
            key=key,
            category=category,
            value_type=value_type,
            value_text=value_text,
            description=description,
            updated_by=changed_by,
        )
    else:
        row.value_type = value_type
        row.value_text = value_text
        row.category = category
        row.description = description
        row.updated_by = changed_by

    session.add(row)
    session.flush()

    session.add(
        AppSystemSettingHistory(
            setting_id=row.id,
            key=key,
            old_value_text=old,
            new_value_text=value_text,
            changed_by=changed_by,
            reason=reason,
        )
    )


def ensure_auth_policy_defaults(session: Session) -> None:
    descriptions = {
        "auth.session.access_ttl_min": "Access JWT 만료시간(분)",
        "auth.session.refresh_threshold_min": "갱신 임계치(분)",
        "auth.session.remember_enabled": "Remember me 허용 여부",
        "auth.session.remember_ttl_min": "Remember me 쿠키 만료(분)",
        "auth.session.show_countdown": "상단 세션 카운트다운 표시",
    }

    for key, (value_type, default_value) in AUTH_POLICY_REGISTRY.items():
        exists = session.exec(select(AppSystemSetting.id).where(AppSystemSetting.key == key)).first()
        if exists is not None:
            continue
        session.add(
            AppSystemSetting(
                key=key,
                category="auth",
                value_type=value_type,
                value_text=default_value,
                description=descriptions[key],
                is_active=True,
            )
        )


def get_auth_session_policy(session: Session) -> AuthSessionPolicy:
    rows = session.exec(
        select(AppSystemSetting).where(AppSystemSetting.key.in_(list(AUTH_POLICY_REGISTRY.keys())))
    ).all()

    values: dict[str, str] = {row.key: row.value_text for row in rows}
    access = int(values.get("auth.session.access_ttl_min", AUTH_POLICY_REGISTRY["auth.session.access_ttl_min"][1]))
    threshold = int(
        values.get("auth.session.refresh_threshold_min", AUTH_POLICY_REGISTRY["auth.session.refresh_threshold_min"][1])
    )
    remember_enabled = _parse_bool(
        values.get("auth.session.remember_enabled", AUTH_POLICY_REGISTRY["auth.session.remember_enabled"][1])
    )
    remember_ttl = int(values.get("auth.session.remember_ttl_min", AUTH_POLICY_REGISTRY["auth.session.remember_ttl_min"][1]))
    show_countdown = _parse_bool(
        values.get("auth.session.show_countdown", AUTH_POLICY_REGISTRY["auth.session.show_countdown"][1])
    )

    threshold = min(max(1, threshold), access)

    return AuthSessionPolicy(
        access_ttl_min=access,
        refresh_threshold_min=threshold,
        remember_enabled=remember_enabled,
        remember_ttl_min=remember_ttl,
        show_countdown=show_countdown,
    )


def update_auth_session_policy(
    session: Session,
    payload: AuthSessionPolicyUpdateRequest,
    *,
    changed_by: int | None,
) -> AuthSessionPolicy:
    if payload.refresh_threshold_min > payload.access_ttl_min:
        raise ValueError("refresh_threshold_min cannot be greater than access_ttl_min")

    with session.begin():
        _upsert_setting(
            session,
            key="auth.session.access_ttl_min",
            value_type="int",
            value_text=_to_text("int", payload.access_ttl_min),
            category="auth",
            description="Access JWT 만료시간(분)",
            changed_by=changed_by,
            reason=payload.reason,
        )
        _upsert_setting(
            session,
            key="auth.session.refresh_threshold_min",
            value_type="int",
            value_text=_to_text("int", payload.refresh_threshold_min),
            category="auth",
            description="갱신 임계치(분)",
            changed_by=changed_by,
            reason=payload.reason,
        )
        _upsert_setting(
            session,
            key="auth.session.remember_enabled",
            value_type="bool",
            value_text=_to_text("bool", payload.remember_enabled),
            category="auth",
            description="Remember me 허용 여부",
            changed_by=changed_by,
            reason=payload.reason,
        )
        _upsert_setting(
            session,
            key="auth.session.remember_ttl_min",
            value_type="int",
            value_text=_to_text("int", payload.remember_ttl_min),
            category="auth",
            description="Remember me 쿠키 만료(분)",
            changed_by=changed_by,
            reason=payload.reason,
        )
        _upsert_setting(
            session,
            key="auth.session.show_countdown",
            value_type="bool",
            value_text=_to_text("bool", payload.show_countdown),
            category="auth",
            description="상단 세션 카운트다운 표시",
            changed_by=changed_by,
            reason=payload.reason,
        )

    return get_auth_session_policy(session)
