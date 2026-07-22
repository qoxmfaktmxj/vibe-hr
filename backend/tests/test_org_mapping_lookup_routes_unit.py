from datetime import date, datetime, timezone

import pytest
from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine, select

from app.api.organization import (
    department_options,
    mapping_item_options,
    mapping_type_options,
    mapping_types,
)
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
    OrgDepartment,
    OrgMappingTypeItem,
)
from app.services.menu_service import STANDARD_MENU_ACTION_CODES


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
        ],
    )


def _seed_permissions(
    session: Session,
    *,
    menu_code: str,
    path: str,
    allow_query: bool,
) -> AuthUser:
    user = AuthUser(
        login_id=f"{menu_code.replace('.', '_')}_user_{len(session.exec(select(AuthUser.id)).all())}",
        email=f"{menu_code.replace('.', '_')}_{len(session.exec(select(AuthUser.id)).all())}@example.com",
        password_hash="hashed",
        display_name=menu_code,
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )
    role = session.exec(select(AuthRole).where(AuthRole.code == "hr_manager")).first()
    if role is None:
        role = AuthRole(code="hr_manager", name="HR Manager", created_at=_now())
        session.add(role)
        session.commit()
        session.refresh(role)
    menu = session.exec(select(AppMenu).where(AppMenu.code == menu_code)).first()
    if menu is None:
        menu = AppMenu(
            code=menu_code,
            name=menu_code,
            path=path,
            is_active=True,
            created_at=_now(),
            updated_at=_now(),
        )
        session.add(menu)
        session.commit()
        session.refresh(menu)

    session.add(user)
    session.commit()
    session.refresh(user)
    existing_menu_role = session.exec(
        select(AppMenuRole).where(
            AppMenuRole.menu_id == int(menu.id),
            AppMenuRole.role_id == int(role.id),
        )
    ).first()
    if existing_menu_role is None:
        session.add(AppMenuRole(menu_id=int(menu.id), role_id=int(role.id)))
    session.add(AuthUserRole(user_id=int(user.id), role_id=int(role.id)))
    session.commit()

    for action_code in STANDARD_MENU_ACTION_CODES:
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
            continue
        existing_action.enabled_default = False
        existing_action.updated_at = _now()
        session.add(existing_action)

    session.commit()

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

        session.commit()
    return user


def _seed_lookup_data(session: Session) -> None:
    group = AppCodeGroup(
        code="ORG_MAPPING_TYPE",
        name="조직매핑유형",
        description="조직 매핑 유형",
        is_active=True,
        sort_order=7,
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
                code="LEVEL",
                name="직급",
                is_active=True,
                sort_order=2,
                created_at=_now(),
                updated_at=_now(),
            ),
        ]
    )
    session.add_all(
        [
            OrgDepartment(
                code="HQ",
                name="본사",
                is_active=True,
                created_at=_now(),
                updated_at=_now(),
            ),
            OrgDepartment(
                code="OPS",
                name="운영",
                is_active=True,
                created_at=_now(),
                updated_at=_now(),
            ),
            OrgDepartment(
                code="OLD",
                name="비활성",
                is_active=False,
                created_at=_now(),
                updated_at=_now(),
            ),
            OrgMappingTypeItem(
                type_code="COST",
                item_code="CC-100",
                name="원가센터 A",
                effective_from=date(2026, 1, 1),
                effective_to=None,
                is_active=True,
                sort_order=1,
                created_at=_now(),
                updated_at=_now(),
            ),
            OrgMappingTypeItem(
                type_code="COST",
                item_code="CC-200",
                name="원가센터 B",
                effective_from=date(2026, 1, 1),
                effective_to=None,
                is_active=False,
                sort_order=2,
                created_at=_now(),
                updated_at=_now(),
            ),
            OrgMappingTypeItem(
                type_code="LEVEL",
                item_code="LV-1",
                name="레벨 1",
                effective_from=date(2026, 1, 1),
                effective_to=None,
                is_active=True,
                sort_order=3,
                created_at=_now(),
                updated_at=_now(),
            ),
        ]
    )
    session.commit()


@pytest.mark.parametrize(
    "handler,kwargs",
    [
        (mapping_type_options, {}),
        (mapping_item_options, {"type_code": "COST"}),
        (department_options, {}),
    ],
)
def test_types_lookup_denies_without_types_query(handler, kwargs) -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        user = _seed_permissions(
            session,
            menu_code="org.types",
            path="/org/types",
            allow_query=False,
        )

        with pytest.raises(HTTPException, match="Action not allowed"):
            handler(session=session, current_user=user, **kwargs)


def test_mapping_types_requires_type_items_query_and_returns_seeded_items_when_allowed() -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        _seed_lookup_data(session)
        denied = _seed_permissions(
            session,
            menu_code="org.type-items",
            path="/org/type-items",
            allow_query=False,
        )
        with pytest.raises(HTTPException, match="Action not allowed"):
            mapping_types(session=session, current_user=denied)

        allowed = _seed_permissions(
            session,
            menu_code="org.type-items",
            path="/org/type-items",
            allow_query=True,
        )
        response = mapping_types(session=session, current_user=allowed)

        assert [item.code for item in response.items] == ["COST", "LEVEL"]
        assert [item.name for item in response.items] == ["원가센터", "직급"]


def test_mapping_type_item_department_options_return_seeded_items_when_allowed() -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        _seed_lookup_data(session)
        user = _seed_permissions(
            session,
            menu_code="org.types",
            path="/org/types",
            allow_query=True,
        )

        type_options = mapping_type_options(session=session, current_user=user)
        item_options = mapping_item_options(session=session, current_user=user, type_code="COST")
        department_options_response = department_options(session=session, current_user=user)

        assert [item.code for item in type_options.items] == ["COST", "LEVEL"]
        assert [item.code for item in item_options.items] == ["CC-100"]
        assert [item.code for item in department_options_response.items] == ["HQ", "OPS"]
