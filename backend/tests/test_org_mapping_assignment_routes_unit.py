from datetime import date, datetime, timezone

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
            AuthUser.__table__,
            AuthRole.__table__,
            AuthUserRole.__table__,
            AppMenu.__table__,
            AppMenuRole.__table__,
            AppMenuAction.__table__,
            AppRoleMenuAction.__table__,
            OrgDepartment.__table__,
            OrgMappingTypeItem.__table__,
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


def _seed_permission_context(
    session: Session,
    *,
    allow_query: bool,
    allow_save: bool,
) -> AuthUser:
    existing_user_count = len(session.exec(select(AuthUser.id)).all())
    role = session.exec(select(AuthRole).where(AuthRole.code == "hr_manager")).first()
    if role is None:
        role = AuthRole(code="hr_manager", name="HR Manager", created_at=_now())
        session.add(role)
        session.commit()
        session.refresh(role)

    menu = session.exec(select(AppMenu).where(AppMenu.code == "org.types")).first()
    if menu is None:
        menu = AppMenu(
            code="org.types",
            name="org.types",
            path="/org/types",
            is_active=True,
            created_at=_now(),
            updated_at=_now(),
        )
        session.add(menu)
        session.commit()
        session.refresh(menu)

    user = AuthUser(
        login_id=f"org_types_{existing_user_count}",
        email=f"org_types_{existing_user_count}@example.com",
        password_hash="hashed",
        display_name="org.types",
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    existing_user_role = session.exec(
        select(AuthUserRole).where(
            AuthUserRole.user_id == int(user.id),
            AuthUserRole.role_id == int(role.id),
        )
    ).first()
    if existing_user_role is None:
        session.add(AuthUserRole(user_id=int(user.id), role_id=int(role.id)))

    existing_menu_role = session.exec(
        select(AppMenuRole).where(
            AppMenuRole.menu_id == int(menu.id),
            AppMenuRole.role_id == int(role.id),
        )
    ).first()
    if existing_menu_role is None:
        session.add(AppMenuRole(menu_id=int(menu.id), role_id=int(role.id)))

    for action_code in ("query", "save"):
        existing_action = session.exec(
            select(AppMenuAction).where(
                AppMenuAction.menu_id == int(menu.id),
                AppMenuAction.action_code == action_code,
            )
        ).first()
        if existing_action is None:
            session.add(
                AppMenuAction(
                    menu_id=int(menu.id),
                    action_code=action_code,
                    enabled_default=False,
                    created_at=_now(),
                    updated_at=_now(),
                )
            )
        else:
            existing_action.enabled_default = False
            existing_action.updated_at = _now()
            session.add(existing_action)

    if allow_query:
        existing_override = session.exec(
            select(AppRoleMenuAction).where(
                AppRoleMenuAction.role_id == int(role.id),
                AppRoleMenuAction.menu_id == int(menu.id),
                AppRoleMenuAction.action_code == "query",
            )
        ).first()
        if existing_override is None:
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
        else:
            existing_override.allowed = True
            existing_override.updated_at = _now()
            session.add(existing_override)

    if allow_save:
        existing_override = session.exec(
            select(AppRoleMenuAction).where(
                AppRoleMenuAction.role_id == int(role.id),
                AppRoleMenuAction.menu_id == int(menu.id),
                AppRoleMenuAction.action_code == "save",
            )
        ).first()
        if existing_override is None:
            session.add(
                AppRoleMenuAction(
                    role_id=int(role.id),
                    menu_id=int(menu.id),
                    action_code="save",
                    allowed=True,
                    created_at=_now(),
                    updated_at=_now(),
                )
            )
        else:
            existing_override.allowed = True
            existing_override.updated_at = _now()
            session.add(existing_override)

    session.commit()
    return user


def _seed_department(session: Session, code: str = "HQ") -> OrgDepartment:
    department = OrgDepartment(code=code, name=code, is_active=True, created_at=_now(), updated_at=_now())
    session.add(department)
    session.commit()
    session.refresh(department)
    return department


def _seed_item(
    session: Session,
    *,
    type_code: str,
    item_code: str,
    name: str,
    effective_from: date,
    effective_to: date | None,
    sort_order: int,
    is_active: bool = True,
) -> OrgMappingTypeItem:
    row = OrgMappingTypeItem(
        type_code=type_code,
        item_code=item_code,
        name=name,
        effective_from=effective_from,
        effective_to=effective_to,
        erp_employee_code=None,
        cost_center_type=None,
        remark=None,
        sort_order=sort_order,
        is_active=is_active,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def _seed_assignment(
    session: Session,
    *,
    department_id: int,
    item: OrgMappingTypeItem,
    effective_from: date,
    effective_to: date | None,
) -> OrgMappingAssignment:
    assignment = OrgMappingAssignment(
        department_id=department_id,
        type_code=item.type_code,
        item_id=int(item.id),
        effective_from=effective_from,
        effective_to=effective_to,
        created_by=None,
        updated_by=None,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(assignment)
    session.commit()
    session.refresh(assignment)
    return assignment


def test_mapping_assignments_route_paginates_and_denies_query_when_permission_missing() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_tables(engine)

    with Session(engine) as session:
        denied_user = _seed_permission_context(session, allow_query=False, allow_save=False)
        denied_token = build_access_token(int(denied_user.id))

    with _create_test_client(engine) as client:
        denied_response = client.get(
            "/api/v1/org/mapping-assignments?page=1&limit=1",
            headers={"Authorization": f"Bearer {denied_token}"},
        )

    assert denied_response.status_code == 403
    assert denied_response.json() == {"detail": "Action not allowed."}

    with Session(engine) as session:
        user = _seed_permission_context(session, allow_query=True, allow_save=False)
        hq = _seed_department(session, "HQ")
        branch = _seed_department(session, "BRANCH")
        hq_id = int(hq.id)
        branch_id = int(branch.id)
        cost_item_1 = _seed_item(
            session,
            type_code="COST",
            item_code="CC-100",
            name="원가센터 A",
            effective_from=date(2026, 1, 1),
            effective_to=date(2026, 1, 31),
            sort_order=1,
        )
        cost_item_2 = _seed_item(
            session,
            type_code="COST",
            item_code="CC-200",
            name="원가센터 B",
            effective_from=date(2026, 2, 1),
            effective_to=None,
            sort_order=2,
        )
        region_item = _seed_item(
            session,
            type_code="REGION",
            item_code="RG-100",
            name="지역 A",
            effective_from=date(2026, 1, 1),
            effective_to=None,
            sort_order=3,
        )
        _seed_assignment(
            session,
            department_id=hq_id,
            item=cost_item_1,
            effective_from=date(2026, 1, 1),
            effective_to=date(2026, 1, 31),
        )
        _seed_assignment(
            session,
            department_id=hq_id,
            item=cost_item_2,
            effective_from=date(2026, 2, 1),
            effective_to=None,
        )
        _seed_assignment(
            session,
            department_id=hq_id,
            item=region_item,
            effective_from=date(2026, 1, 1),
            effective_to=None,
        )
        _seed_assignment(
            session,
            department_id=branch_id,
            item=cost_item_1,
            effective_from=date(2026, 1, 1),
            effective_to=None,
        )
        token = build_access_token(int(user.id))

    with _create_test_client(engine) as client:
        first_page = client.get(
            f"/api/v1/org/mapping-assignments?page=1&limit=1&department_id={hq_id}&type_code=COST&reference_date=2026-01-31",
            headers={"Authorization": f"Bearer {token}"},
        )
        second_page = client.get(
            f"/api/v1/org/mapping-assignments?page=2&limit=1&department_id={hq_id}&type_code=COST",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert first_page.status_code == 200
    assert first_page.json()["total_count"] == 1
    assert first_page.json()["page"] == 1
    assert first_page.json()["limit"] == 1
    assert [item["item_code"] for item in first_page.json()["items"]] == ["CC-100"]
    assert first_page.json()["items"][0]["department_code"] == "HQ"

    assert second_page.status_code == 200
    assert second_page.json()["total_count"] == 2
    assert second_page.json()["page"] == 2
    assert second_page.json()["limit"] == 1
    assert [item["item_code"] for item in second_page.json()["items"]] == ["CC-200"]


def test_mapping_assignment_routes_require_save_permission_and_support_crud() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_tables(engine)

    with Session(engine) as session:
        denied_user = _seed_permission_context(session, allow_query=True, allow_save=False)
        denied_token = build_access_token(int(denied_user.id))

    denied_payload = {
        "department_id": 1,
        "type_code": "COST",
        "item_id": 1,
        "effective_from": "2026-07-01",
        "effective_to": None,
    }

    with _create_test_client(engine) as client:
        denied_create = client.post(
            "/api/v1/org/mapping-assignments",
            json=denied_payload,
            headers={"Authorization": f"Bearer {denied_token}"},
        )

    assert denied_create.status_code == 403
    assert denied_create.json() == {"detail": "Action not allowed."}

    with Session(engine) as session:
        department = _seed_department(session)
        user = _seed_permission_context(session, allow_query=True, allow_save=True)
        item = _seed_item(
            session,
            type_code="COST",
            item_code="CC-300",
            name="원가센터 C",
            effective_from=date(2026, 1, 1),
            effective_to=None,
            sort_order=1,
        )
        department_id = int(department.id)
        item_id = int(item.id)
        token = build_access_token(int(user.id))

    create_payload = {
        "department_id": department_id,
        "type_code": "COST",
        "item_id": item_id,
        "effective_from": "2026-07-01",
        "effective_to": None,
    }

    with _create_test_client(engine) as client:
        created = client.post(
            "/api/v1/org/mapping-assignments",
            json=create_payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        created_assignment_id = created.json()["item"]["id"]

        updated = client.put(
            f"/api/v1/org/mapping-assignments/{created_assignment_id}",
            json={"effective_to": "2026-12-31"},
            headers={"Authorization": f"Bearer {token}"},
        )

        deleted = client.delete(
            f"/api/v1/org/mapping-assignments/{created_assignment_id}",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert created.status_code == 201
    assert created.json()["item"]["item_id"] == item_id
    assert created.json()["item"]["department_code"] == "HQ"
    assert updated.status_code == 200
    assert updated.json()["item"]["effective_to"] == "2026-12-31"
    assert deleted.status_code == 204
