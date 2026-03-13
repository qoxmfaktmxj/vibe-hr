from __future__ import annotations

from datetime import datetime

from sqlmodel import Session, SQLModel, create_engine

from app.models import (
    AuthRole,
    AuthUser,
    AuthUserRole,
    HrEmployee,
    HriApprovalActorRule,
    OrgDepartment,
)
from app.services.hri_request_service import _resolve_admin_fallback_user_id, _resolve_role_actor_user_id


def _make_session() -> Session:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(
        engine,
        tables=[
            AuthUser.__table__,
            AuthRole.__table__,
            AuthUserRole.__table__,
            OrgDepartment.__table__,
            HrEmployee.__table__,
            HriApprovalActorRule.__table__,
        ],
    )
    return Session(engine)


def _seed_admin_role(session: Session, admin_user_id: int) -> None:
    if session.get(AuthRole, 1) is None:
        session.add(AuthRole(id=1, code="admin", name="Admin"))
    session.add(AuthUserRole(user_id=admin_user_id, role_id=1))


def test_resolve_role_actor_user_id_searches_department_chain() -> None:
    with _make_session() as session:
        session.add(AuthUser(id=1, login_id="req", email="req@example.com", password_hash="x", display_name="Requester"))
        session.add(AuthUser(id=2, login_id="lead", email="lead@example.com", password_hash="x", display_name="Lead"))
        session.add(AuthUser(id=3, login_id="admin", email="admin@example.com", password_hash="x", display_name="Admin"))
        _seed_admin_role(session, 3)

        session.add(OrgDepartment(id=10, code="HQ", name="HQ"))
        session.add(OrgDepartment(id=11, code="HQ-HR", name="HR", parent_id=10))

        session.add(
            HrEmployee(
                id=100,
                user_id=1,
                employee_no="HR-0001",
                department_id=11,
                position_title="Staff",
                hire_date=datetime(2024, 1, 1).date(),
                employment_status="active",
            )
        )
        session.add(
            HrEmployee(
                id=101,
                user_id=2,
                employee_no="HR-0002",
                department_id=10,
                position_title="Lead Manager",
                hire_date=datetime(2023, 1, 1).date(),
                employment_status="active",
            )
        )
        session.add(
            HriApprovalActorRule(
                role_code="TEAM_LEADER",
                resolve_method="ORG_CHAIN",
                fallback_rule="HR_ADMIN",
                position_keywords_json='["Lead"]',
                is_active=True,
            )
        )
        session.commit()

        actor_user_id = _resolve_role_actor_user_id(session, 1, "TEAM_LEADER")

        assert actor_user_id == 2


def test_resolve_admin_fallback_user_id_prefers_primary_admin_login() -> None:
    with _make_session() as session:
        session.add(
            AuthUser(id=1, login_id="admin-local", email="admin-local@example.com", password_hash="x", display_name="Admin Local")
        )
        session.add(
            AuthUser(id=2, login_id="admin", email="admin@example.com", password_hash="x", display_name="Admin")
        )
        _seed_admin_role(session, 1)
        _seed_admin_role(session, 2)
        session.commit()

        actor_user_id = _resolve_admin_fallback_user_id(session)

        assert actor_user_id == 2


def test_resolve_role_actor_user_id_falls_back_to_admin_when_chain_has_no_match() -> None:
    with _make_session() as session:
        session.add(AuthUser(id=1, login_id="req", email="req@example.com", password_hash="x", display_name="Requester"))
        session.add(AuthUser(id=3, login_id="admin", email="admin@example.com", password_hash="x", display_name="Admin"))
        _seed_admin_role(session, 3)

        session.add(OrgDepartment(id=11, code="HQ-HR", name="HR"))
        session.add(
            HrEmployee(
                id=100,
                user_id=1,
                employee_no="HR-0001",
                department_id=11,
                position_title="Staff",
                hire_date=datetime(2024, 1, 1).date(),
                employment_status="active",
            )
        )
        session.add(
            HriApprovalActorRule(
                role_code="TEAM_LEADER",
                resolve_method="ORG_CHAIN",
                fallback_rule="HR_ADMIN",
                position_keywords_json='["Lead"]',
                is_active=True,
            )
        )
        session.commit()

        actor_user_id = _resolve_role_actor_user_id(session, 1, "TEAM_LEADER")

        assert actor_user_id == 3
