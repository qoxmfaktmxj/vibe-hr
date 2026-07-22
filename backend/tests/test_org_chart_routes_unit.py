from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.api.organization import router as organization_router
from app.core.auth import build_access_token
from app.core.database import get_session
from app.models import AppMenu, AppMenuAction, AppMenuRole, AppRoleMenuAction, AuthRole, AuthUser, AuthUserRole, HrEmployee, OrgDepartment


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _create_permission_tables(engine) -> None:
    SQLModel.metadata.create_all(
        engine,
        tables=[
            AuthUser.__table__,
            AuthRole.__table__,
            AuthUserRole.__table__,
            AppMenu.__table__,
            AppMenuRole.__table__,
            AppMenuAction.__table__,
            AppRoleMenuAction.__table__,
        ],
    )


def _seed_permission_context(
    session: Session,
    *,
    menu_code: str,
    path: str,
    role_code: str,
    allow_query: bool = False,
) -> AuthUser:
    user = AuthUser(
        login_id=f"{menu_code.replace('.', '_')}_{role_code}",
        email=f"{menu_code.replace('.', '_')}_{role_code}@example.com",
        password_hash="hashed",
        display_name=f"{menu_code} user",
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )
    role = AuthRole(code=role_code, name=role_code, created_at=_now())
    menu = AppMenu(
        code=menu_code,
        name=menu_code,
        path=path,
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(user)
    session.add(role)
    session.add(menu)
    session.commit()
    session.refresh(user)
    session.refresh(role)
    session.refresh(menu)

    session.add(AuthUserRole(user_id=int(user.id), role_id=int(role.id)))
    session.add(AppMenuRole(menu_id=int(menu.id), role_id=int(role.id)))
    session.add(
        AppMenuAction(
            menu_id=int(menu.id),
            action_code="query",
            enabled_default=False,
            created_at=_now(),
            updated_at=_now(),
        )
    )
    if allow_query:
        session.add(
            AppRoleMenuAction(
                role_id=int(role.id),
                menu_id=int(menu.id),
                action_code="query",
                allowed=True,
                created_at=_now(),
                updated_at=_now(),
            )
        )

    session.commit()
    return user


def _create_test_client(engine) -> TestClient:
    app = FastAPI()
    app.include_router(organization_router, prefix="/api/v1")

    def _override_get_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = _override_get_session
    return TestClient(app)


def test_chart_http_route_returns_200_when_query_permission_exists_without_hr_role_gate() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_permission_tables(engine)
    SQLModel.metadata.create_all(engine, tables=[OrgDepartment.__table__, HrEmployee.__table__])

    with Session(engine) as session:
        user = _seed_permission_context(
            session,
            menu_code="org.chart",
            path="/org/chart",
            role_code="org_viewer",
            allow_query=True,
        )
        session.add(
            OrgDepartment(
                code="D001",
                name="인사",
                is_active=True,
                created_at=_now(),
                updated_at=_now(),
            )
        )
        session.add(
            OrgDepartment(
                code="D002",
                name="총무",
                is_active=True,
                created_at=_now(),
                updated_at=_now(),
            )
        )
        session.commit()
        token = build_access_token(int(user.id))

    with _create_test_client(engine) as client:
        response = client.get(
            "/api/v1/org/chart",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_count"] == 2
    assert [department["code"] for department in payload["departments"]] == ["D001", "D002"]


def test_chart_http_route_denies_when_query_permission_is_missing() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_permission_tables(engine)
    SQLModel.metadata.create_all(engine, tables=[OrgDepartment.__table__, HrEmployee.__table__])

    with Session(engine) as session:
        user = _seed_permission_context(
            session,
            menu_code="org.chart",
            path="/org/chart",
            role_code="org_viewer",
            allow_query=False,
        )
        session.add(
            OrgDepartment(
                code="D001",
                name="인사",
                is_active=True,
                created_at=_now(),
                updated_at=_now(),
            )
        )
        session.commit()
        token = build_access_token(int(user.id))

    with _create_test_client(engine) as client:
        response = client.get(
            "/api/v1/org/chart",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 403
    assert response.json() == {"detail": "Action not allowed."}
