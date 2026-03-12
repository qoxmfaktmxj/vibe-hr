from datetime import datetime, timezone

from sqlmodel import Session, SQLModel, create_engine

from app.models import AppCode, AppCodeGroup
from app.services.common_code_service import list_code_groups, list_codes


def _seed_code_data(session: Session) -> int:
    now = datetime.now(timezone.utc)
    groups = [
        AppCodeGroup(code="ALPHA", name="Alpha", sort_order=2, created_at=now, updated_at=now),
        AppCodeGroup(code="BETA", name="Beta", sort_order=1, created_at=now, updated_at=now),
        AppCodeGroup(code="GAMMA", name="Gamma", sort_order=3, created_at=now, updated_at=now),
    ]
    session.add_all(groups)
    session.commit()

    beta_id = next(group.id for group in groups if group.code == "BETA")
    codes = [
        AppCode(group_id=beta_id, code="B1", name="Beta One", sort_order=2, created_at=now, updated_at=now),
        AppCode(group_id=beta_id, code="B2", name="Beta Two", sort_order=1, created_at=now, updated_at=now),
        AppCode(group_id=beta_id, code="B3", name="Other", sort_order=3, created_at=now, updated_at=now),
    ]
    session.add_all(codes)
    session.commit()
    return beta_id


def test_list_code_groups_supports_filter_and_pagination() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        _seed_code_data(session)

        rows, total_count = list_code_groups(session, page=1, limit=2, name="a")

        assert total_count == 3
        assert [row.code for row in rows] == ["BETA", "ALPHA"]


def test_list_codes_supports_filter_and_pagination() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        beta_id = _seed_code_data(session)

        rows, total_count = list_codes(session, beta_id, page=1, limit=1, name="Beta")

        assert total_count == 2
        assert [row.code for row in rows] == ["B2"]
