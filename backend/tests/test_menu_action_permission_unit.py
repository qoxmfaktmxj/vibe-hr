from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine

from app.api.common_code import code_group_create, code_groups
from app.api.employee import employee_batch_save, employee_list
from app.api.organization import organization_department_create, organization_departments
from app.models import AppMenu, AppMenuAction, AppMenuRole, AppRoleMenuAction, AuthRole, AuthUser, AuthUserRole
from app.schemas.common_code import CodeGroupCreateRequest
from app.schemas.employee import EmployeeBatchRequest
from app.schemas.organization import OrganizationDepartmentCreateRequest
from app.services.menu_service import STANDARD_MENU_ACTION_CODES, get_allowed_menu_actions_for_user


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
    allow_save: bool = False,
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

    for action_code in STANDARD_MENU_ACTION_CODES:
        session.add(
            AppMenuAction(
                menu_id=int(menu.id),
                action_code=action_code,
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

    if allow_save:
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

    session.commit()
    return user


def test_get_allowed_menu_actions_for_user_applies_role_overrides() -> None:
    engine = create_engine("sqlite://")
    _create_permission_tables(engine)

    with Session(engine) as session:
        user = _seed_permission_context(
            session,
            menu_code="hr.employee",
            path="/hr/employee",
            role_code="hr_manager",
            allow_query=True,
            allow_save=False,
        )

        allowed = get_allowed_menu_actions_for_user(
            session,
            user_id=int(user.id),
            path="/hr/employee",
        )

        assert allowed["query"] is True
        assert allowed["save"] is False
        assert allowed["download"] is False


def test_employee_list_denies_when_query_permission_is_missing() -> None:
    engine = create_engine("sqlite://")
    _create_permission_tables(engine)

    with Session(engine) as session:
        user = _seed_permission_context(
            session,
            menu_code="hr.employee",
            path="/hr/employee",
            role_code="hr_manager",
            allow_query=False,
        )

        with pytest.raises(HTTPException) as exc_info:
            employee_list(
                page=1,
                limit=100,
                all=False,
                employee_no=None,
                name=None,
                department=None,
                employment_status=None,
                active=None,
                session=session,
                current_user=user,
            )

        assert exc_info.value.status_code == 403
        assert exc_info.value.detail == "Action not allowed."


def test_employee_batch_save_denies_when_save_permission_is_missing() -> None:
    engine = create_engine("sqlite://")
    _create_permission_tables(engine)

    with Session(engine) as session:
        user = _seed_permission_context(
            session,
            menu_code="hr.employee",
            path="/hr/employee",
            role_code="hr_manager",
            allow_query=True,
            allow_save=False,
        )

        with pytest.raises(HTTPException) as exc_info:
            employee_batch_save(EmployeeBatchRequest(), session=session, current_user=user)

        assert exc_info.value.status_code == 403
        assert exc_info.value.detail == "Action not allowed."


def test_organization_departments_denies_when_query_permission_is_missing() -> None:
    engine = create_engine("sqlite://")
    _create_permission_tables(engine)

    with Session(engine) as session:
        user = _seed_permission_context(
            session,
            menu_code="org.departments",
            path="/org/departments",
            role_code="hr_manager",
            allow_query=False,
        )

        with pytest.raises(HTTPException) as exc_info:
            organization_departments(
                page=1,
                limit=100,
                all=False,
                code=None,
                name=None,
                organization_type=None,
                cost_center_code=None,
                reference_date=None,
                session=session,
                current_user=user,
            )

        assert exc_info.value.status_code == 403
        assert exc_info.value.detail == "Action not allowed."


def test_organization_department_create_denies_when_save_permission_is_missing() -> None:
    engine = create_engine("sqlite://")
    _create_permission_tables(engine)

    with Session(engine) as session:
        user = _seed_permission_context(
            session,
            menu_code="org.departments",
            path="/org/departments",
            role_code="hr_manager",
            allow_query=True,
            allow_save=False,
        )

        with pytest.raises(HTTPException) as exc_info:
            organization_department_create(
                OrganizationDepartmentCreateRequest(code="D001", name="조직1"),
                session=session,
                current_user=user,
            )

        assert exc_info.value.status_code == 403
        assert exc_info.value.detail == "Action not allowed."


def test_code_groups_denies_when_query_permission_is_missing() -> None:
    engine = create_engine("sqlite://")
    _create_permission_tables(engine)

    with Session(engine) as session:
        user = _seed_permission_context(
            session,
            menu_code="settings.common-codes",
            path="/settings/common-codes",
            role_code="admin",
            allow_query=False,
        )

        with pytest.raises(HTTPException) as exc_info:
            code_groups(
                page=1,
                limit=100,
                all=False,
                code=None,
                name=None,
                session=session,
                current_user=user,
            )

        assert exc_info.value.status_code == 403
        assert exc_info.value.detail == "Action not allowed."


def test_code_group_create_denies_when_save_permission_is_missing() -> None:
    engine = create_engine("sqlite://")
    _create_permission_tables(engine)

    with Session(engine) as session:
        user = _seed_permission_context(
            session,
            menu_code="settings.common-codes",
            path="/settings/common-codes",
            role_code="admin",
            allow_query=True,
            allow_save=False,
        )

        with pytest.raises(HTTPException) as exc_info:
            code_group_create(
                CodeGroupCreateRequest(code="TEST", name="테스트"),
                session=session,
                current_user=user,
            )

        assert exc_info.value.status_code == 403
        assert exc_info.value.detail == "Action not allowed."
