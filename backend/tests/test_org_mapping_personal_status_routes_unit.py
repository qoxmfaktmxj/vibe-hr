from datetime import date, datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.api.organization import router as organization_router
from app.core.auth import build_access_token
from app.core.database import get_session
from app.models import (
    AppCode,
    AppCodeGroup,
    AppMenu,
    AppMenuAction,
    AppMenuRole,
    AppRoleMenuAction,
    AuthRole,
    AuthUser,
    AuthUserRole,
    HrEmployee,
    HrPersonnelHistory,
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
            AppCodeGroup.__table__,
            AppCode.__table__,
            OrgDepartment.__table__,
            OrgMappingTypeItem.__table__,
            OrgMappingAssignment.__table__,
            HrEmployee.__table__,
            HrPersonnelHistory.__table__,
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


def _seed_permission_context(session: Session, *, allow_query: bool) -> AuthUser:
    role = session.exec(select(AuthRole).where(AuthRole.code == "hr_manager")).first()
    if role is None:
        role = AuthRole(code="hr_manager", name="HR Manager", created_at=_now())
        session.add(role)
        session.commit()
        session.refresh(role)

    menu = session.exec(select(AppMenu).where(AppMenu.code == "org.type-personal-status")).first()
    if menu is None:
        menu = AppMenu(
            code="org.type-personal-status",
            name="org.type-personal-status",
            path="/org/type-personal-status",
            is_active=True,
            created_at=_now(),
            updated_at=_now(),
        )
        session.add(menu)
        session.commit()
        session.refresh(menu)

    user = AuthUser(
        login_id=f"org_type_personal_status_{int(menu.id)}",
        email=f"org_type_personal_status_{int(menu.id)}@example.com",
        password_hash="hashed",
        display_name="org.type-personal-status",
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    if session.exec(
        select(AuthUserRole).where(
            AuthUserRole.user_id == int(user.id),
            AuthUserRole.role_id == int(role.id),
        )
    ).first() is None:
        session.add(AuthUserRole(user_id=int(user.id), role_id=int(role.id)))

    if session.exec(
        select(AppMenuRole).where(
            AppMenuRole.menu_id == int(menu.id),
            AppMenuRole.role_id == int(role.id),
        )
    ).first() is None:
        session.add(AppMenuRole(menu_id=int(menu.id), role_id=int(role.id)))

    for action_code in ("query", "save"):
        action = session.exec(
            select(AppMenuAction).where(
                AppMenuAction.menu_id == int(menu.id),
                AppMenuAction.action_code == action_code,
            )
        ).first()
        if action is None:
            session.add(
                AppMenuAction(
                    menu_id=int(menu.id),
                    action_code=action_code,
                    enabled_default=False,
                    created_at=_now(),
                    updated_at=_now(),
                )
            )

    override = session.exec(
        select(AppRoleMenuAction).where(
            AppRoleMenuAction.role_id == int(role.id),
            AppRoleMenuAction.menu_id == int(menu.id),
            AppRoleMenuAction.action_code == "query",
        )
    ).first()
    if allow_query:
        if override is None:
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
            override.allowed = True
            override.updated_at = _now()
            session.add(override)
    elif override is not None:
        override.allowed = False
        override.updated_at = _now()
        session.add(override)

    session.commit()
    return user


def _seed_department(session: Session, code: str, name: str | None = None) -> OrgDepartment:
    department = OrgDepartment(
        code=code,
        name=name or code,
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(department)
    session.commit()
    session.refresh(department)
    return department


def _seed_type_group(session: Session) -> None:
    group = AppCodeGroup(
        code="ORG_MAPPING_TYPE",
        name="Organization Mapping Type",
        is_active=True,
        sort_order=0,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(group)
    session.commit()
    session.refresh(group)
    session.add_all(
        [
            AppCode(
                group_id=int(group.id),
                code="COST",
                name="원가센터",
                is_active=True,
                sort_order=1,
                created_at=_now(),
                updated_at=_now(),
            ),
            AppCode(
                group_id=int(group.id),
                code="REGION",
                name="지역",
                is_active=True,
                sort_order=2,
                created_at=_now(),
                updated_at=_now(),
            ),
            AppCode(
                group_id=int(group.id),
                code="LEVEL",
                name="직급",
                is_active=True,
                sort_order=3,
                created_at=_now(),
                updated_at=_now(),
            ),
        ]
    )
    session.commit()


def _seed_employee(
    session: Session,
    *,
    employee_no: str,
    user_login_id: str,
    user_display_name: str,
    department_id: int,
    hire_date: date,
    employment_status: str,
    position_title: str,
) -> HrEmployee:
    user = AuthUser(
        login_id=user_login_id,
        email=f"{user_login_id}@example.com",
        password_hash="hashed",
        display_name=user_display_name,
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    employee = HrEmployee(
        user_id=int(user.id),
        employee_no=employee_no,
        department_id=department_id,
        position_title=position_title,
        hire_date=hire_date,
        employment_status=employment_status,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return employee


def _seed_history(
    session: Session,
    *,
    employee_id: int,
    effective_date: date,
    field_name: str,
    before_value: str | None,
    after_value: str | None,
) -> None:
    session.add(
        HrPersonnelHistory(
            employee_id=employee_id,
            history_type="update",
            source_table="hr_employees",
            source_id=employee_id,
            appointment_order_id=None,
            effective_date=effective_date,
            field_name=field_name,
            before_value=before_value,
            after_value=after_value,
            description=None,
            created_by=None,
            created_at=_now(),
        )
    )
    session.commit()


def _seed_mapping_item(
    session: Session,
    *,
    type_code: str,
    item_code: str,
    name: str,
    effective_from: date,
) -> OrgMappingTypeItem:
    item = OrgMappingTypeItem(
        type_code=type_code,
        item_code=item_code,
        name=name,
        effective_from=effective_from,
        effective_to=None,
        erp_employee_code=None,
        cost_center_type=None,
        remark=None,
        sort_order=1,
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def _seed_assignment(
    session: Session,
    *,
    department_id: int,
    item: OrgMappingTypeItem,
    effective_from: date,
) -> None:
    session.add(
        OrgMappingAssignment(
            department_id=department_id,
            type_code=item.type_code,
            item_id=int(item.id),
            effective_from=effective_from,
            effective_to=None,
            created_by=None,
            updated_by=None,
            created_at=_now(),
            updated_at=_now(),
        )
    )
    session.commit()


def test_personal_status_route_denies_query_when_permission_missing() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_tables(engine)

    with Session(engine) as session:
        denied_user = _seed_permission_context(session, allow_query=False)
        denied_token = build_access_token(int(denied_user.id))

    with _create_test_client(engine) as client:
        response = client.get(
            "/api/v1/org/mapping-personal-status?reference_date=2026-07-31&page=1&limit=1",
            headers={"Authorization": f"Bearer {denied_token}"},
        )

    assert response.status_code == 403
    assert response.json() == {"detail": "Action not allowed."}


def test_personal_status_route_returns_dynamic_columns_and_pivot_cells() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_tables(engine)

    with Session(engine) as session:
        _seed_type_group(session)
        department = _seed_department(session, "D-10", "부서10")
        department_id = int(department.id)
        employee = _seed_employee(
            session,
            employee_no="E-001",
            user_login_id="e001",
            user_display_name="홍길동",
            department_id=department_id,
            hire_date=date(2026, 1, 1),
            employment_status="leave",
            position_title="대리",
        )
        employee_id = int(employee.id)
        _seed_history(
            session,
            employee_id=employee_id,
            effective_date=date(2026, 8, 1),
            field_name="department_id",
            before_value=str(department_id),
            after_value=str(department_id),
        )
        _seed_history(
            session,
            employee_id=employee_id,
            effective_date=date(2026, 8, 1),
            field_name="employment_status",
            before_value="active",
            after_value="leave",
        )
        cost_item = _seed_mapping_item(
            session,
            type_code="COST",
            item_code="CC-100",
            name="원가센터 A",
            effective_from=date(2026, 1, 1),
        )
        region_item = _seed_mapping_item(
            session,
            type_code="REGION",
            item_code="RG-100",
            name="지역 A",
            effective_from=date(2026, 1, 1),
        )
        _seed_assignment(
            session,
            department_id=department_id,
            item=cost_item,
            effective_from=date(2026, 1, 1),
        )
        _seed_assignment(
            session,
            department_id=department_id,
            item=region_item,
            effective_from=date(2026, 1, 1),
        )

        user = _seed_permission_context(session, allow_query=True)
        token = build_access_token(int(user.id))

    with _create_test_client(engine) as client:
        response = client.get(
            "/api/v1/org/mapping-personal-status?reference_date=2026-07-31&page=1&limit=10",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_count"] == 1
    assert payload["page"] == 1
    assert payload["limit"] == 10
    assert [column["type_code"] for column in payload["type_columns"]] == ["COST", "REGION", "LEVEL"]
    assert payload["items"][0]["employee_no"] == "E-001"
    assert payload["items"][0]["department_id"] == department_id
    assert payload["items"][0]["mappings"]["COST"]["item_code"] == "CC-100"
    assert payload["items"][0]["mappings"]["REGION"]["item_code"] == "RG-100"
    assert payload["items"][0]["mappings"]["LEVEL"]["item_code"] == ""
