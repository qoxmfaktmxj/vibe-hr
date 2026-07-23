from datetime import date, datetime, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.api.organization import (
    mapping_assignment_create,
    mapping_assignment_delete,
    mapping_assignment_update,
    mapping_assignments,
)
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
from app.schemas.organization import OrgMappingAssignmentCreateRequest, OrgMappingAssignmentUpdateRequest


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


def test_mapping_assignments_route_paginates_filters_and_requires_query_permission() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_tables(engine)

    with Session(engine) as session:
        denied_user = _seed_permission_context(session, allow_query=False, allow_save=False)
        with pytest.raises(HTTPException, match="Action not allowed."):
            mapping_assignments(session=session, current_user=denied_user)

    with Session(engine) as session:
        user = _seed_permission_context(session, allow_query=True, allow_save=False)
        hq = _seed_department(session, "HQ")
        branch = _seed_department(session, "BRANCH")
        cost_item_1_id = int(
            _seed_item(
                session,
                type_code="COST",
                item_code="CC-100",
                name="원가센터 A",
                effective_from=date(2026, 1, 1),
                effective_to=date(2026, 1, 31),
                sort_order=1,
            ).id
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
            department_id=int(hq.id),
            item=session.get(OrgMappingTypeItem, cost_item_1_id),
            effective_from=date(2026, 1, 1),
            effective_to=date(2026, 1, 31),
        )
        _seed_assignment(
            session,
            department_id=int(hq.id),
            item=cost_item_2,
            effective_from=date(2026, 2, 1),
            effective_to=None,
        )
        _seed_assignment(
            session,
            department_id=int(hq.id),
            item=region_item,
            effective_from=date(2026, 1, 1),
            effective_to=None,
        )
        _seed_assignment(
            session,
            department_id=int(branch.id),
            item=session.get(OrgMappingTypeItem, cost_item_1_id),
            effective_from=date(2026, 1, 1),
            effective_to=None,
        )

        first_page = mapping_assignments(
            page=1,
            limit=1,
            department_id=int(hq.id),
            type_code="COST",
            reference_date=date(2026, 1, 31),
            session=session,
            current_user=user,
        )
        second_page = mapping_assignments(
            page=2,
            limit=1,
            department_id=int(hq.id),
            type_code="COST",
            reference_date=None,
            session=session,
            current_user=user,
        )

    assert first_page.total_count == 1
    assert first_page.page == 1
    assert first_page.limit == 1
    assert [item.item_code for item in first_page.items] == ["CC-100"]
    assert first_page.items[0].department_code == "HQ"

    assert second_page.total_count == 2
    assert second_page.page == 2
    assert second_page.limit == 1
    assert [item.item_code for item in second_page.items] == ["CC-200"]


def test_mapping_assignment_routes_require_save_permission_and_support_crud() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_tables(engine)

    with Session(engine) as session:
        denied_user = _seed_permission_context(session, allow_query=True, allow_save=False)
        with pytest.raises(HTTPException, match="Action not allowed."):
            mapping_assignment_create(
                payload=OrgMappingAssignmentCreateRequest(
                    department_id=1,
                    type_code="COST",
                    item_id=1,
                    effective_from=date(2026, 7, 1),
                    effective_to=None,
                ),
                session=session,
                current_user=denied_user,
            )

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
        item_id = int(item.id)

        created = mapping_assignment_create(
            payload=OrgMappingAssignmentCreateRequest(
                department_id=int(department.id),
                type_code="COST",
                item_id=item_id,
                effective_from=date(2026, 7, 1),
                effective_to=None,
            ),
            session=session,
            current_user=user,
        )
        updated = mapping_assignment_update(
            assignment_id=created.item.id,
            payload=OrgMappingAssignmentUpdateRequest(effective_to=date(2026, 12, 31)),
            session=session,
            current_user=user,
        )
        deleted = mapping_assignment_delete(
            assignment_id=created.item.id,
            session=session,
            current_user=user,
        )

    assert created.item.item_id == item_id
    assert created.item.department_code == "HQ"
    assert updated.item.effective_to == date(2026, 12, 31)
    assert deleted.status_code == 204
