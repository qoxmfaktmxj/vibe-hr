from datetime import datetime, timezone

from sqlmodel import Session, SQLModel, create_engine

from app.api.organization import organization_chart
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


def test_chart_returns_all_departments_without_department_menu_fallback() -> None:
    engine = create_engine("sqlite://")
    _create_permission_tables(engine)
    SQLModel.metadata.create_all(engine, tables=[OrgDepartment.__table__, HrEmployee.__table__])

    with Session(engine) as session:
        user = _seed_permission_context(
            session,
            menu_code="org.chart",
            path="/org/chart",
            role_code="hr_manager",
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

        result = organization_chart(session=session, current_user=user)

        assert result.total_count == 2
        assert [department.code for department in result.departments] == ["D001", "D002"]
