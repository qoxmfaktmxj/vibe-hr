from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.api.organization import router as organization_router
from app.core.auth import build_access_token
from app.core.database import get_session
from app.models import (
    AppMenu,
    AppMenuAction,
    AppMenuRole,
    AppRoleMenuAction,
    AuthRole,
    AuthUser,
    AuthUserRole,
    OrgDepartment,
    OrgMappingAssignment,
    OrgMappingTypeItem,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _create_tables(engine) -> None:
    SQLModel.metadata.create_all(
        engine,
        tables=[
            AuthUser.__table__, AuthRole.__table__, AuthUserRole.__table__, AppMenu.__table__, AppMenuRole.__table__,
            AppMenuAction.__table__, AppRoleMenuAction.__table__, OrgDepartment.__table__, OrgMappingTypeItem.__table__,
            OrgMappingAssignment.__table__,
        ],
    )


def _create_test_client(engine) -> TestClient:
    app = FastAPI()
    app.include_router(organization_router, prefix="/api/v1")

    def _override_get_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = _override_get_session
    return TestClient(app)


def _seed_permissions(session: Session, *, allow_template: bool, allow_upload: bool) -> AuthUser:
    role = session.exec(select(AuthRole).where(AuthRole.code == "hr_manager")).first()
    if role is None:
        role = AuthRole(code="hr_manager", name="HR Manager", created_at=_now())
        session.add(role)
    menu = session.exec(select(AppMenu).where(AppMenu.code == "org.type-upload")).first()
    if menu is None:
        menu = AppMenu(code="org.type-upload", name="org.type-upload", path="/org/type-upload", is_active=True, created_at=_now(), updated_at=_now())
        session.add(menu)
    count = len(session.exec(select(AuthUser.id)).all())
    user = AuthUser(login_id=f"upload_user_{count}", email=f"upload_{count}@example.com", password_hash="hashed", display_name="Upload", is_active=True, created_at=_now(), updated_at=_now())
    session.add(user)
    session.commit()
    session.refresh(role)
    session.refresh(menu)
    session.refresh(user)
    session.add(AuthUserRole(user_id=int(user.id), role_id=int(role.id)))
    menu_role = session.exec(select(AppMenuRole).where(AppMenuRole.menu_id == int(menu.id), AppMenuRole.role_id == int(role.id))).first()
    if menu_role is None:
        session.add(AppMenuRole(menu_id=int(menu.id), role_id=int(role.id)))
    session.commit()
    for action_code, allowed in (("template_download", allow_template), ("upload", allow_upload)):
        action = session.exec(select(AppMenuAction).where(AppMenuAction.menu_id == int(menu.id), AppMenuAction.action_code == action_code)).first()
        if action is None:
            session.add(AppMenuAction(menu_id=int(menu.id), action_code=action_code, enabled_default=False, created_at=_now(), updated_at=_now()))
        if allowed:
            session.add(AppRoleMenuAction(role_id=int(role.id), menu_id=int(menu.id), action_code=action_code, allowed=True, created_at=_now(), updated_at=_now()))
    session.commit()
    return user


def _seed_mapping_data(session: Session) -> None:
    session.add(OrgDepartment(code="HQ", name="HQ", is_active=True, created_at=_now(), updated_at=_now()))
    session.add(OrgMappingTypeItem(type_code="COST", item_code="CC-100", name="원가센터", effective_from=datetime(2026, 1, 1).date(), effective_to=None, erp_employee_code=None, cost_center_type=None, remark=None, sort_order=0, is_active=True, created_at=_now(), updated_at=_now()))
    session.commit()


def _payload(*, department_code: str = "HQ") -> dict[str, object]:
    return {
        "mode": "atomic",
        "rows": [{"department_code": department_code, "type_code": "COST", "item_code": "CC-100", "effective_from": "2026-07-01", "effective_to": None}],
    }


def test_upload_template_and_preview_enforce_distinct_permissions_without_writes() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    _create_tables(engine)
    with Session(engine) as session:
        denied = _seed_permissions(session, allow_template=False, allow_upload=False)
        denied_token = build_access_token(int(denied.id))

    with _create_test_client(engine) as client:
        assert client.get("/api/v1/org/mapping-assignments/upload-template", headers={"Authorization": f"Bearer {denied_token}"}).status_code == 403
        assert client.post("/api/v1/org/mapping-assignments/upload-preview", json=_payload(), headers={"Authorization": f"Bearer {denied_token}"}).status_code == 403

    with Session(engine) as session:
        allowed = _seed_permissions(session, allow_template=True, allow_upload=True)
        _seed_mapping_data(session)
        token = build_access_token(int(allowed.id))

    with _create_test_client(engine) as client:
        template = client.get("/api/v1/org/mapping-assignments/upload-template", headers={"Authorization": f"Bearer {token}"})
        preview = client.post("/api/v1/org/mapping-assignments/upload-preview", json=_payload(), headers={"Authorization": f"Bearer {token}"})

    assert template.status_code == 200
    assert template.json() == {"headers": ["조직코드", "유형코드", "항목코드", "시작일", "종료일"]}
    assert preview.status_code == 200
    assert preview.json()["valid_count"] == 1
    with Session(engine) as session:
        assert session.exec(select(OrgMappingAssignment)).all() == []


def test_upload_confirm_returns_preview_detail_on_validation_failure_and_counts_success() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    _create_tables(engine)
    with Session(engine) as session:
        user = _seed_permissions(session, allow_template=True, allow_upload=True)
        _seed_mapping_data(session)
        token = build_access_token(int(user.id))

    with _create_test_client(engine) as client:
        invalid = client.post("/api/v1/org/mapping-assignments/upload-confirm", json=_payload(department_code="MISSING"), headers={"Authorization": f"Bearer {token}"})
        confirmed = client.post("/api/v1/org/mapping-assignments/upload-confirm", json=_payload(), headers={"Authorization": f"Bearer {token}"})

    assert invalid.status_code == 422
    assert invalid.json()["detail"]["invalid_count"] == 1
    assert invalid.json()["detail"]["rows"][0]["valid"] is False
    assert confirmed.status_code == 200
    assert confirmed.json() == {"inserted_count": 1, "updated_count": 0}
