from datetime import date, datetime, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, create_engine, select

from app.models import (
    AuthUser,
    OrgDepartment,
    OrgMappingAssignment,
    OrgMappingTypeItem,
)
from app.schemas.organization import OrgMappingTypeItemCreateRequest, OrgMappingTypeItemUpdateRequest
from app.services.organization_mapping_service import (
    create_mapping_type_item,
    delete_mapping_type_item,
    list_mapping_type_items,
    update_mapping_type_item,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _create_tables(engine) -> None:
    SQLModel.metadata.create_all(
        engine,
        tables=[
            AuthUser.__table__,
            OrgDepartment.__table__,
            OrgMappingTypeItem.__table__,
            OrgMappingAssignment.__table__,
        ],
    )


def _create_item(
    *,
    type_code: str,
    item_code: str,
    name: str,
    effective_from: date,
    effective_to: date | None,
    sort_order: int = 0,
    is_active: bool = True,
) -> OrgMappingTypeItemCreateRequest:
    return OrgMappingTypeItemCreateRequest(
        type_code=type_code,
        item_code=item_code,
        name=name,
        effective_from=effective_from,
        effective_to=effective_to,
        erp_employee_code=None,
        cost_center_type=None,
        sort_order=sort_order,
        remark=None,
        is_active=is_active,
    )


def _patch_item(**kwargs) -> OrgMappingTypeItemUpdateRequest:
    return OrgMappingTypeItemUpdateRequest(**kwargs)


def _seed_department(session: Session, code: str = "HQ") -> OrgDepartment:
    department = OrgDepartment(
        code=code,
        name=code,
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(department)
    session.commit()
    session.refresh(department)
    return department


def _seed_item(
    session: Session,
    *,
    type_code: str = "COST",
    item_code: str = "CC-100",
    name: str = "원가센터 A",
    effective_from: date = date(2026, 1, 1),
    effective_to: date | None = date(2026, 1, 31),
    sort_order: int = 1,
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


def test_item_period_closed_interval_boundaries_and_update_self_exclusion() -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        first = create_mapping_type_item(
            session,
            _create_item(
                type_code="COST",
                item_code="CC-100",
                name="원가센터 A",
                effective_from=date(2026, 1, 1),
                effective_to=date(2026, 1, 31),
            ),
        )

        with pytest.raises(HTTPException, match="overlaps"):
            create_mapping_type_item(
                session,
                _create_item(
                    type_code="COST",
                    item_code="CC-100",
                    name="원가센터 A-dup",
                    effective_from=date(2026, 1, 31),
                    effective_to=date(2026, 2, 1),
                ),
            )

        create_mapping_type_item(
            session,
            _create_item(
                type_code="COST",
                item_code="CC-100",
                name="원가센터 A-next",
                effective_from=date(2026, 2, 1),
                effective_to=None,
            ),
        )

        updated = update_mapping_type_item(
            session,
            first.id,
            _patch_item(name="원가센터 A2"),
        )

        assert updated.name == "원가센터 A2"


def test_referenced_item_cannot_change_code_type_shrink_period_or_deactivate() -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        department = _seed_department(session)
        referenced = _seed_item(
            session,
            type_code="COST",
            item_code="CC-200",
            name="원가센터 B",
            effective_from=date(2026, 1, 1),
            effective_to=date(2026, 6, 30),
            sort_order=2,
        )
        _seed_assignment(
            session,
            department_id=int(department.id),
            item=referenced,
            effective_from=date(2026, 3, 1),
            effective_to=date(2026, 5, 31),
        )

        for request in [
            _patch_item(item_code="CC-201"),
            _patch_item(type_code="REGION"),
            _patch_item(effective_to=date(2026, 5, 30)),
            _patch_item(is_active=False),
        ]:
            with pytest.raises(HTTPException, match="Referenced"):
                update_mapping_type_item(session, referenced.id, request)

        extended = update_mapping_type_item(
            session,
            referenced.id,
            _patch_item(name="원가센터 B2", effective_to=date(2026, 12, 31)),
        )
        assert extended.name == "원가센터 B2"
        assert extended.effective_to == date(2026, 12, 31)

        with pytest.raises(HTTPException, match="Referenced"):
            delete_mapping_type_item(session, referenced.id)


def test_create_mapping_type_item_rolls_back_on_integrity_error(monkeypatch) -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        called = {"rollback": False}

        def _flush() -> None:
            raise IntegrityError("stmt", "params", Exception("duplicate"))

        def _rollback() -> None:
            called["rollback"] = True
            Session.rollback(session)

        monkeypatch.setattr(session, "flush", _flush)
        monkeypatch.setattr(session, "rollback", _rollback)

        with pytest.raises(HTTPException, match="conflict"):
            create_mapping_type_item(
                session,
                _create_item(
                    type_code="COST",
                    item_code="CC-300",
                    name="원가센터 C",
                    effective_from=date(2026, 7, 1),
                    effective_to=None,
                ),
            )

        assert called["rollback"] is True
        with Session(engine) as fresh_session:
            assert fresh_session.exec(select(OrgMappingTypeItem)).all() == []


def test_list_mapping_type_items_supports_reference_date_and_pagination() -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        _seed_item(
            session,
            type_code="COST",
            item_code="CC-100",
            name="원가센터 A",
            effective_from=date(2026, 1, 1),
            effective_to=None,
            sort_order=1,
        )
        _seed_item(
            session,
            type_code="COST",
            item_code="CC-200",
            name="원가센터 B",
            effective_from=date(2026, 1, 15),
            effective_to=None,
            sort_order=2,
        )
        _seed_item(
            session,
            type_code="LEVEL",
            item_code="LV-1",
            name="레벨 1",
            effective_from=date(2026, 1, 1),
            effective_to=None,
            sort_order=3,
        )

        items, total_count = list_mapping_type_items(
            session,
            page=1,
            limit=1,
            type_code="COST",
            reference_date=date(2026, 1, 31),
        )

        assert total_count == 2
        assert len(items) == 1
        assert items[0].item_code == "CC-100"

        next_page_items, _ = list_mapping_type_items(
            session,
            page=2,
            limit=1,
            type_code="COST",
            reference_date=date(2026, 1, 31),
        )

        assert [row.item_code for row in next_page_items] == ["CC-200"]
