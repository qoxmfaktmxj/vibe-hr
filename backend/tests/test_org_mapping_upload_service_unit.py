from datetime import date, datetime, timezone

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, create_engine, select

from app.models import AuthUser, OrgDepartment, OrgMappingAssignment, OrgMappingTypeItem
from app.schemas.organization import OrgMappingAssignmentUploadRequest, OrgMappingAssignmentUploadRow
from app.services.organization_mapping_service import (
    confirm_mapping_assignment_upload,
    preview_mapping_assignment_upload,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _create_tables(engine) -> None:
    SQLModel.metadata.create_all(
        engine,
        tables=[AuthUser.__table__, OrgDepartment.__table__, OrgMappingTypeItem.__table__, OrgMappingAssignment.__table__],
    )


def _seed_department(session: Session, code: str = "HQ") -> OrgDepartment:
    row = OrgDepartment(code=code, name=code, is_active=True, created_at=_now(), updated_at=_now())
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def _seed_item(
    session: Session,
    item_code: str,
    *,
    type_code: str = "COST",
    effective_from: date = date(2026, 1, 1),
    effective_to: date | None = None,
    is_active: bool = True,
) -> OrgMappingTypeItem:
    row = OrgMappingTypeItem(
        type_code=type_code,
        item_code=item_code,
        name=item_code,
        effective_from=effective_from,
        effective_to=effective_to,
        erp_employee_code=None,
        cost_center_type=None,
        remark=None,
        sort_order=0,
        is_active=is_active,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def _row(
    *,
    department_code: str = "HQ",
    type_code: str = "COST",
    item_code: str = "CC-100",
    effective_from: date = date(2026, 7, 1),
    effective_to: date | None = None,
) -> OrgMappingAssignmentUploadRow:
    return OrgMappingAssignmentUploadRow(
        department_code=department_code,
        type_code=type_code,
        item_code=item_code,
        effective_from=effective_from,
        effective_to=effective_to,
    )


def _assignment_count(session: Session) -> int:
    return len(session.exec(select(OrgMappingAssignment)).all())


def test_preview_normalizes_rows_without_writing_and_reports_invalid_rows() -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        _seed_department(session)
        _seed_item(session, "CC-100")

        preview = preview_mapping_assignment_upload(
            session,
            [_row(department_code=" hq ", type_code=" cost ", item_code=" cc-100 "), _row(department_code="MISSING")],
        )

        assert preview.valid_count == 1
        assert preview.invalid_count == 1
        assert preview.rows[0].normalized == {
            "department_code": "HQ",
            "type_code": "COST",
            "item_code": "CC-100",
            "effective_from": date(2026, 7, 1),
            "effective_to": None,
        }
        assert preview.rows[1].errors == ["Department code not found."]
        assert _assignment_count(session) == 0


def test_invalid_or_conflicting_upload_rows_cause_zero_writes() -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        _seed_department(session)
        _seed_item(session, "CC-100")

        with pytest.raises(HTTPException, match="upload validation failed") as invalid_exc:
            confirm_mapping_assignment_upload(session, [_row(), _row(department_code="MISSING")], actor_id=7)
        assert invalid_exc.value.status_code == 422
        assert invalid_exc.value.detail["invalid_count"] == 1
        assert _assignment_count(session) == 0

        with pytest.raises(HTTPException, match="upload validation failed") as overlap_exc:
            confirm_mapping_assignment_upload(
                session,
                [_row(), _row(item_code="CC-100", effective_from=date(2026, 7, 1), effective_to=date(2026, 7, 31))],
                actor_id=7,
            )
        assert overlap_exc.value.status_code == 422
        assert overlap_exc.value.detail["invalid_count"] == 2
        assert _assignment_count(session) == 0


def test_upload_resolves_active_item_version_that_contains_the_full_assignment_period() -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        _seed_department(session)
        first_half = _seed_item(
            session,
            "CC-100",
            effective_to=date(2026, 6, 30),
        )
        second_half = _seed_item(
            session,
            "CC-100",
            effective_from=date(2026, 7, 1),
        )

        result = confirm_mapping_assignment_upload(
            session,
            [
                _row(effective_from=date(2026, 3, 1), effective_to=date(2026, 3, 31)),
                _row(effective_from=date(2026, 7, 1)),
            ],
            actor_id=7,
        )

        assert result.inserted_count == 2
        saved = session.exec(select(OrgMappingAssignment).order_by(OrgMappingAssignment.effective_from)).all()
        assert [row.item_id for row in saved] == [int(first_half.id), int(second_half.id)]

        preview = preview_mapping_assignment_upload(
            session,
            [_row(effective_from=date(2026, 6, 30), effective_to=date(2026, 7, 1))],
        )
        assert preview.rows[0].errors == ["Mapping assignment item period must contain the assignment period."]


def test_upload_rejects_ambiguous_active_item_versions() -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        _seed_department(session)
        _seed_item(session, "CC-100")
        _seed_item(session, "CC-100", effective_from=date(2026, 6, 1))

        preview = preview_mapping_assignment_upload(session, [_row(effective_from=date(2026, 7, 1))])

        assert preview.invalid_count == 1
        assert preview.rows[0].errors == ["Mapping item period is ambiguous."]


def test_upload_validates_overlap_against_the_final_batch_state() -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        department = _seed_department(session)
        old_item = _seed_item(session, "CC-100")
        _seed_item(session, "CC-200")
        session.add(
            OrgMappingAssignment(
                department_id=int(department.id),
                type_code="COST",
                item_id=int(old_item.id),
                effective_from=date(2026, 1, 1),
                effective_to=None,
                created_by=None,
                updated_by=None,
                created_at=_now(),
                updated_at=_now(),
            )
        )
        session.commit()

        result = confirm_mapping_assignment_upload(
            session,
            [
                _row(effective_from=date(2026, 1, 1), effective_to=date(2026, 6, 30)),
                _row(item_code="CC-200", effective_from=date(2026, 7, 1)),
            ],
            actor_id=7,
        )

        assert result.updated_count == 1
        assert result.inserted_count == 1
        saved = session.exec(select(OrgMappingAssignment).order_by(OrgMappingAssignment.effective_from)).all()
        assert [(row.effective_from, row.effective_to) for row in saved] == [
            (date(2026, 1, 1), date(2026, 6, 30)),
            (date(2026, 7, 1), None),
        ]


def test_upload_rejects_db_conflicts_with_incoming_rows_without_writes() -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        department = _seed_department(session)
        old_item = _seed_item(session, "CC-100")
        _seed_item(session, "CC-200")
        session.add(
            OrgMappingAssignment(
                department_id=int(department.id),
                type_code="COST",
                item_id=int(old_item.id),
                effective_from=date(2026, 1, 1),
                effective_to=None,
                created_by=None,
                updated_by=None,
                created_at=_now(),
                updated_at=_now(),
            )
        )
        session.commit()

        with pytest.raises(HTTPException, match="upload validation failed") as exc_info:
            confirm_mapping_assignment_upload(
                session,
                [_row(item_code="CC-200", effective_from=date(2026, 7, 1))],
                actor_id=7,
            )

        assert exc_info.value.status_code == 422
        assert exc_info.value.detail["rows"][0]["errors"] == ["Mapping assignment period overlaps existing record."]
        assert _assignment_count(session) == 1


def test_upload_request_limits_rows_to_one_through_one_thousand() -> None:
    with pytest.raises(ValidationError):
        OrgMappingAssignmentUploadRequest(mode="atomic", rows=[])
    with pytest.raises(ValidationError):
        OrgMappingAssignmentUploadRequest(mode="atomic", rows=[_row()] * 1001)


def test_confirm_updates_matching_start_date_and_commits_all_rows_once(monkeypatch) -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        department = _seed_department(session)
        old_item = _seed_item(session, "CC-100")
        new_item = _seed_item(session, "CC-200")
        _seed_item(session, "RG-100", type_code="REGION")
        existing = OrgMappingAssignment(
            department_id=int(department.id),
            type_code="COST",
            item_id=int(old_item.id),
            effective_from=date(2026, 7, 1),
            effective_to=None,
            created_by=None,
            updated_by=None,
            created_at=_now(),
            updated_at=_now(),
        )
        session.add(existing)
        session.commit()

        commits = {"count": 0}
        original_commit = session.commit

        def _commit() -> None:
            commits["count"] += 1
            original_commit()

        monkeypatch.setattr(session, "commit", _commit)
        result = confirm_mapping_assignment_upload(
            session,
            [_row(item_code="CC-200"), _row(type_code="REGION", item_code="RG-100")],
            actor_id=17,
        )

        assert result.inserted_count == 1
        assert result.updated_count == 1
        assert commits["count"] == 1
        saved = session.exec(select(OrgMappingAssignment).where(OrgMappingAssignment.type_code == "COST")).one()
        assert saved.item_id == new_item.id
        assert saved.updated_by == 17


def test_flush_integrity_error_rolls_back_all_staged_rows(monkeypatch) -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        _seed_department(session)
        _seed_item(session, "CC-100")
        _seed_item(session, "RG-100", type_code="REGION")

        original_flush = session.flush

        def _flush() -> None:
            original_flush()
            raise IntegrityError("stmt", "params", Exception("overlaps"))

        monkeypatch.setattr(session, "flush", _flush)
        with pytest.raises(HTTPException, match="overlaps") as exc_info:
            confirm_mapping_assignment_upload(
                session,
                [_row(), _row(type_code="REGION", item_code="RG-100")],
                actor_id=7,
            )

        assert exc_info.value.status_code == 422
        monkeypatch.setattr(session, "flush", original_flush)
        assert _assignment_count(session) == 0
