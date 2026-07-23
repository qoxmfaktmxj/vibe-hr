from datetime import date, datetime, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, create_engine, select

from app.models import AuthUser, OrgDepartment, OrgMappingAssignment, OrgMappingTypeItem
from app.schemas.organization import OrgMappingAssignmentCreateRequest, OrgMappingAssignmentUpdateRequest
from app.services.organization_mapping_service import create_mapping_assignment, update_mapping_assignment


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _create_tables(engine) -> None:
    SQLModel.metadata.create_all(
        engine,
        tables=[AuthUser.__table__, OrgDepartment.__table__, OrgMappingTypeItem.__table__, OrgMappingAssignment.__table__],
    )


def _create_request(
    department_id: int,
    type_code: str,
    item_id: int,
    effective_from: date,
    effective_to: date | None,
) -> OrgMappingAssignmentCreateRequest:
    return OrgMappingAssignmentCreateRequest(
        department_id=department_id,
        type_code=type_code,
        item_id=item_id,
        effective_from=effective_from,
        effective_to=effective_to,
    )


def _patch_request(**kwargs) -> OrgMappingAssignmentUpdateRequest:
    return OrgMappingAssignmentUpdateRequest(**kwargs)


def _seed_department(session: Session, code: str = "HQ") -> OrgDepartment:
    department = OrgDepartment(code=code, name=code, is_active=True, created_at=_now(), updated_at=_now())
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


def test_assignment_closed_period_rules_and_item_containment() -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        department = _seed_department(session)
        cost_item = _seed_item(session, type_code="COST", item_code="CC-100", effective_from=date(2026, 1, 1), effective_to=date(2026, 1, 31))
        next_cost_item = _seed_item(session, type_code="COST", item_code="CC-200", effective_from=date(2026, 1, 1), effective_to=None, sort_order=2)
        limited_item = _seed_item(session, type_code="COST", item_code="CC-300", effective_from=date(2026, 1, 1), effective_to=date(2026, 1, 31), sort_order=3)
        inactive_item = _seed_item(session, type_code="COST", item_code="CC-400", effective_from=date(2026, 1, 1), effective_to=None, sort_order=4, is_active=False)
        region_item = _seed_item(session, type_code="REGION", item_code="RG-100", name="지역 A", effective_from=date(2026, 1, 1), effective_to=None, sort_order=5)

        created = create_mapping_assignment(session, _create_request(int(department.id), "COST", int(cost_item.id), date(2026, 1, 1), date(2026, 1, 31)))
        assert created.type_code == "COST"

        with pytest.raises(HTTPException, match="overlaps"):
            create_mapping_assignment(session, _create_request(int(department.id), "COST", int(next_cost_item.id), date(2026, 1, 31), date(2026, 2, 1)))

        next_assignment = create_mapping_assignment(session, _create_request(int(department.id), "COST", int(next_cost_item.id), date(2026, 2, 1), None))
        assert next_assignment.effective_to is None

        with pytest.raises(HTTPException, match="item period"):
            create_mapping_assignment(session, _create_request(int(department.id), "COST", int(limited_item.id), date(2025, 12, 31), date(2026, 1, 1)))

        with pytest.raises(HTTPException, match="inactive"):
            create_mapping_assignment(session, _create_request(int(department.id), "COST", int(inactive_item.id), date(2026, 1, 1), None))

        with pytest.raises(HTTPException, match="not found"):
            create_mapping_assignment(session, _create_request(int(department.id), "REGION", int(cost_item.id), date(2026, 1, 1), None))

        with pytest.raises(HTTPException, match="Department not found"):
            create_mapping_assignment(session, _create_request(999, "COST", int(cost_item.id), date(2026, 1, 1), None))

        region_assignment = create_mapping_assignment(session, _create_request(int(department.id), "REGION", int(region_item.id), date(2026, 1, 1), None))
        assert region_assignment.type_code == "REGION"


def test_assignment_update_excludes_self_and_rolls_back_on_integrity_error(monkeypatch) -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        department = _seed_department(session)
        cost_item = _seed_item(session, type_code="COST", item_code="CC-500", effective_from=date(2026, 1, 1), effective_to=None)
        region_item = _seed_item(session, type_code="REGION", item_code="RG-500", effective_from=date(2026, 1, 1), effective_to=None, sort_order=2)

        assignment = create_mapping_assignment(session, _create_request(int(department.id), "COST", int(cost_item.id), date(2026, 1, 1), None))

        assert update_mapping_assignment(session, int(assignment.id), _patch_request(effective_to=None)).id == assignment.id
        assert create_mapping_assignment(session, _create_request(int(department.id), "REGION", int(region_item.id), date(2026, 1, 1), None)).type_code == "REGION"

        called = {"rollback": False}

        def _flush() -> None:
            raise IntegrityError("stmt", "params", Exception("duplicate"))

        def _rollback() -> None:
            called["rollback"] = True
            Session.rollback(session)

        monkeypatch.setattr(session, "flush", _flush)
        monkeypatch.setattr(session, "rollback", _rollback)

        with pytest.raises(HTTPException, match="conflict"):
            update_mapping_assignment(session, int(assignment.id), _patch_request(name="원가센터 E2"))

        assert called["rollback"] is True
        with Session(engine) as fresh_session:
            assert fresh_session.exec(select(OrgMappingAssignment)).all() != []
