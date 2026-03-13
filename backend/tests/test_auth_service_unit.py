from __future__ import annotations

from sqlmodel import Session, SQLModel, create_engine

from app.models import OrgCorporation
from app.services.auth_service import list_login_corporations


def test_list_login_corporations_returns_active_corporations_sorted() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine, tables=[OrgCorporation.__table__])

    with Session(engine) as session:
        session.add(
            OrgCorporation(
                enter_cd="BETA",
                company_code="BETA",
                corporation_name="Beta HR",
                is_active=True,
            )
        )
        session.add(
            OrgCorporation(
                enter_cd="ALPHA",
                company_code="ALPHA",
                corporation_name="Alpha HR",
                is_active=True,
            )
        )
        session.add(
            OrgCorporation(
                enter_cd="OLD",
                company_code="OLD",
                corporation_name="Old HR",
                is_active=False,
            )
        )
        session.commit()

        corporations = list_login_corporations(session)

        assert [corporation.enter_cd for corporation in corporations] == ["ALPHA", "BETA"]
        assert [corporation.company_code for corporation in corporations] == ["ALPHA", "BETA"]
