from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models import (
    AppCode,
    AppCodeGroup,
    AuthUser,
    HrEmployee,
    HrPersonnelHistory,
    OrgDepartment,
    OrgMappingAssignment,
    OrgMappingTypeItem,
)
from app.schemas.organization import (
    OrgMappingAssignmentCreateRequest,
    OrgMappingAssignmentItem,
    OrgMappingAssignmentUploadConfirmResponse,
    OrgMappingAssignmentUploadPreviewResponse,
    OrgMappingAssignmentUploadPreviewRow,
    OrgMappingAssignmentUploadRow,
    OrgMappingAssignmentUpdateRequest,
    OrgMappingPersonalStatusCell,
    OrgMappingPersonalStatusListResponse,
    OrgMappingPersonalStatusRow,
    OrgMappingPersonalStatusTypeColumn,
    OrgMappingTypeItemCreateRequest,
    OrgMappingTypeItemDetail,
    OrgMappingTypeItemUpdateRequest,
    OrganizationLookupItem,
)

MAPPING_TYPE_GROUP_CODE = "ORG_MAPPING_TYPE"
_OPEN_END_DATE = date.max
_PERSONAL_STATUS_CHUNK_SIZE = 200


@dataclass(slots=True)
class _PersonalStatusEmployeeSnapshot:
    employee_id: int
    employee_no: str
    display_name: str
    department_id: int
    position_title: str
    employment_status: str


@dataclass(slots=True)
class _PersonalStatusScanResult:
    employee_id: int
    employee_no: str
    department_id: int
    position_title: str
    employment_status: str


@dataclass(slots=True)
class _PreparedUploadRow:
    row_number: int
    department: OrgDepartment
    item: OrgMappingTypeItem
    type_code: str
    effective_from: date
    effective_to: date | None
    existing_assignment: OrgMappingAssignment | None


def _snapshot_employee_state_at_reference(
    employee: HrEmployee,
    histories: list[HrPersonnelHistory],
) -> _PersonalStatusScanResult:
    snapshot = _PersonalStatusScanResult(
        employee_id=int(employee.id),
        employee_no=employee.employee_no,
        department_id=int(employee.department_id),
        position_title=employee.position_title,
        employment_status=employee.employment_status,
    )
    for history in histories:
        if history.field_name == "department_id" and history.before_value not in (None, ""):
            snapshot.department_id = int(history.before_value)
        elif history.field_name == "employment_status" and history.before_value is not None:
            snapshot.employment_status = history.before_value
    return snapshot


def _lookup_item(code: str, name: str, id: int | None = None) -> OrganizationLookupItem:
    return OrganizationLookupItem(id=id, code=code, name=name)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_code(value: str) -> str:
    return value.strip().upper()


def _strip_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _build_mapping_item(row: OrgMappingTypeItem) -> OrgMappingTypeItemDetail:
    return OrgMappingTypeItemDetail(
        id=int(row.id),
        type_code=row.type_code,
        item_code=row.item_code,
        name=row.name,
        effective_from=row.effective_from,
        effective_to=row.effective_to,
        erp_employee_code=row.erp_employee_code,
        cost_center_type=row.cost_center_type,
        remark=row.remark,
        sort_order=row.sort_order,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _build_assignment_item(
    assignment: OrgMappingAssignment,
    department: OrgDepartment,
    item: OrgMappingTypeItem,
) -> OrgMappingAssignmentItem:
    return OrgMappingAssignmentItem(
        id=int(assignment.id),
        department_id=int(department.id),
        department_code=department.code,
        department_name=department.name,
        type_code=assignment.type_code,
        item_id=int(item.id),
        item_code=item.item_code,
        item_name=item.name,
        effective_from=assignment.effective_from,
        effective_to=assignment.effective_to,
        created_at=assignment.created_at,
        updated_at=assignment.updated_at,
    )


def _validate_closed_period(effective_from: date, effective_to: date | None) -> None:
    if effective_to is not None and effective_to < effective_from:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="effective_to must be on or after effective_from.",
        )


def _ensure_no_item_overlap(
    session: Session,
    *,
    type_code: str,
    item_code: str,
    effective_from: date,
    effective_to: date | None,
    exclude_id: int | None = None,
    ) -> None:
    candidate_end = effective_to or _OPEN_END_DATE
    statement = select(OrgMappingTypeItem.id).where(
        OrgMappingTypeItem.type_code == type_code,
        OrgMappingTypeItem.item_code == item_code,
        OrgMappingTypeItem.effective_from <= candidate_end,
        func.coalesce(OrgMappingTypeItem.effective_to, _OPEN_END_DATE) >= effective_from,
    )
    if exclude_id is not None:
        statement = statement.where(OrgMappingTypeItem.id != exclude_id)

    with session.no_autoflush:
        conflict = session.exec(statement).first()
    if conflict is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Mapping item period overlaps existing record.")


def _item_has_assignments(session: Session, item_id: int) -> bool:
    return session.exec(select(OrgMappingAssignment.id).where(OrgMappingAssignment.item_id == item_id)).first() is not None


def _item_period_contains_assignments(
    session: Session,
    *,
    item_id: int,
    effective_from: date,
    effective_to: date | None,
) -> bool:
    assignments = session.exec(
        select(OrgMappingAssignment).where(OrgMappingAssignment.item_id == item_id)
    ).all()
    if not assignments:
        return True

    for assignment in assignments:
        if assignment.effective_from < effective_from:
            return False
        if effective_to is not None and (
            assignment.effective_to is None or assignment.effective_to > effective_to
        ):
            return False
    return True


def _apply_integrity_guard(session: Session, exc: IntegrityError) -> None:
    session.rollback()
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Mapping item conflict.",
    ) from exc


def _apply_assignment_integrity_guard(session: Session, exc: IntegrityError) -> None:
    session.rollback()
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Mapping assignment conflict.",
    ) from exc


def _get_department(session: Session, department_id: int) -> OrgDepartment:
    department = session.get(OrgDepartment, department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found.")
    return department


def _get_assignment_item(session: Session, *, item_id: int, type_code: str) -> OrgMappingTypeItem:
    with session.no_autoflush:
        item = session.exec(
            select(OrgMappingTypeItem).where(
                OrgMappingTypeItem.id == item_id,
                OrgMappingTypeItem.type_code == type_code,
            )
        ).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mapping item not found.")
    if not item.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Mapping item is inactive.")
    return item


def _validate_assignment_period_within_item(
    *,
    item: OrgMappingTypeItem,
    effective_from: date,
    effective_to: date | None,
) -> None:
    if effective_from < item.effective_from:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Mapping assignment item period must contain the assignment period.",
        )
    if item.effective_to is None:
        return
    if effective_to is None or effective_to > item.effective_to:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Mapping assignment item period must contain the assignment period.",
        )


def _ensure_no_assignment_overlap(
    session: Session,
    *,
    department_id: int,
    type_code: str,
    effective_from: date,
    effective_to: date | None,
    exclude_id: int | None = None,
) -> None:
    candidate_end = effective_to or _OPEN_END_DATE
    statement = select(OrgMappingAssignment.id).where(
        OrgMappingAssignment.department_id == department_id,
        OrgMappingAssignment.type_code == type_code,
        OrgMappingAssignment.effective_from <= candidate_end,
        func.coalesce(OrgMappingAssignment.effective_to, _OPEN_END_DATE) >= effective_from,
    )
    if exclude_id is not None:
        statement = statement.where(OrgMappingAssignment.id != exclude_id)

    with session.no_autoflush:
        conflict = session.exec(statement).first()
    if conflict is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Mapping assignment period overlaps existing record.",
        )


def _periods_overlap(
    first_from: date,
    first_to: date | None,
    second_from: date,
    second_to: date | None,
) -> bool:
    return first_from <= (second_to or _OPEN_END_DATE) and second_from <= (first_to or _OPEN_END_DATE)


def _normalized_upload_row(row: OrgMappingAssignmentUploadRow) -> dict[str, str | date | None]:
    return {
        "department_code": _normalize_code(row.department_code),
        "type_code": _normalize_code(row.type_code),
        "item_code": _normalize_code(row.item_code),
        "effective_from": row.effective_from,
        "effective_to": row.effective_to,
    }


def _upload_preview_from_errors(
    rows: list[OrgMappingAssignmentUploadRow],
    errors_by_row: list[list[str]],
) -> OrgMappingAssignmentUploadPreviewResponse:
    preview_rows = [
        OrgMappingAssignmentUploadPreviewRow(
            row_number=index,
            valid=not errors,
            errors=errors,
            normalized=_normalized_upload_row(row),
        )
        for index, (row, errors) in enumerate(zip(rows, errors_by_row), start=1)
    ]
    invalid_count = sum(not row.valid for row in preview_rows)
    return OrgMappingAssignmentUploadPreviewResponse(
        rows=preview_rows,
        valid_count=len(preview_rows) - invalid_count,
        invalid_count=invalid_count,
    )


def _append_upload_error(errors: list[str], error: str) -> None:
    if error not in errors:
        errors.append(error)


def _validate_upload_rows(
    session: Session,
    rows: list[OrgMappingAssignmentUploadRow],
) -> tuple[OrgMappingAssignmentUploadPreviewResponse, list[_PreparedUploadRow | None]]:
    errors_by_row: list[list[str]] = [[] for _ in rows]
    prepared_rows: list[_PreparedUploadRow | None] = [None for _ in rows]

    for index, row in enumerate(rows):
        normalized = _normalized_upload_row(row)
        department = session.exec(
            select(OrgDepartment).where(func.upper(OrgDepartment.code) == normalized["department_code"])
        ).first()
        if department is None:
            errors_by_row[index].append("Department code not found.")

        type_code = normalized["type_code"]
        item_code = normalized["item_code"]
        item_versions = session.exec(
            select(OrgMappingTypeItem).where(
                OrgMappingTypeItem.type_code == type_code,
                OrgMappingTypeItem.item_code == item_code,
            )
        ).all()
        item_candidates = [
            candidate
            for candidate in item_versions
            if candidate.is_active
            and candidate.effective_from <= row.effective_from
            and (
                candidate.effective_to is None
                if row.effective_to is None
                else candidate.effective_to is None or candidate.effective_to >= row.effective_to
            )
        ]
        item: OrgMappingTypeItem | None = None
        if not item_versions:
            errors_by_row[index].append("Mapping item code not found.")
        elif not any(version.is_active for version in item_versions):
            errors_by_row[index].append("Mapping item is inactive.")
        elif not item_candidates:
            errors_by_row[index].append("Mapping assignment item period must contain the assignment period.")
        elif len(item_candidates) > 1:
            errors_by_row[index].append("Mapping item period is ambiguous.")
        else:
            item = item_candidates[0]

        if row.effective_to is not None and row.effective_to < row.effective_from:
            errors_by_row[index].append("effective_to must be on or after effective_from.")

        if department is not None and item is not None and not errors_by_row[index]:
            prepared_rows[index] = _PreparedUploadRow(
                row_number=index + 1,
                department=department,
                item=item,
                type_code=type_code,
                effective_from=row.effective_from,
                effective_to=row.effective_to,
                existing_assignment=None,
            )

    prepared_by_group: dict[tuple[int, str], list[tuple[int, _PreparedUploadRow]]] = defaultdict(list)
    for index, prepared in enumerate(prepared_rows):
        if prepared is not None:
            prepared_by_group[(int(prepared.department.id), prepared.type_code)].append((index, prepared))

    for (department_id, type_code), group_rows in prepared_by_group.items():
        existing_rows = session.exec(
            select(OrgMappingAssignment).where(
                OrgMappingAssignment.department_id == department_id,
                OrgMappingAssignment.type_code == type_code,
            )
        ).all()
        existing_by_start: dict[date, list[OrgMappingAssignment]] = defaultdict(list)
        incoming_by_start: dict[date, list[tuple[int, _PreparedUploadRow]]] = defaultdict(list)
        for existing in existing_rows:
            existing_by_start[existing.effective_from].append(existing)
        for index, prepared in group_rows:
            incoming_by_start[prepared.effective_from].append((index, prepared))

        for effective_from, incoming_rows in incoming_by_start.items():
            if len(incoming_rows) > 1:
                for index, _ in incoming_rows:
                    _append_upload_error(errors_by_row[index], "Mapping assignment period overlaps another upload row.")
            matching_existing = existing_by_start.get(effective_from, [])
            if len(matching_existing) > 1:
                for index, _ in incoming_rows:
                    _append_upload_error(errors_by_row[index], "Mapping assignment period overlaps existing record.")
            elif len(matching_existing) == 1 and len(incoming_rows) == 1:
                incoming_rows[0][1].existing_assignment = matching_existing[0]

        final_periods: list[tuple[date, date | None, int | None]] = []
        for existing in existing_rows:
            incoming_rows = incoming_by_start.get(existing.effective_from, [])
            if len(incoming_rows) == 1 and len(existing_by_start[existing.effective_from]) == 1:
                index, prepared = incoming_rows[0]
                final_periods.append((prepared.effective_from, prepared.effective_to, index))
            else:
                final_periods.append((existing.effective_from, existing.effective_to, None))
        for index, prepared in group_rows:
            if not existing_by_start.get(prepared.effective_from):
                final_periods.append((prepared.effective_from, prepared.effective_to, index))

        for first_index, first in enumerate(final_periods):
            for second in final_periods[first_index + 1 :]:
                if not _periods_overlap(first[0], first[1], second[0], second[1]):
                    continue
                error = (
                    "Mapping assignment period overlaps another upload row."
                    if first[2] is not None and second[2] is not None
                    else "Mapping assignment period overlaps existing record."
                )
                if first[2] is not None:
                    _append_upload_error(errors_by_row[first[2]], error)
                if second[2] is not None:
                    _append_upload_error(errors_by_row[second[2]], error)

    preview = _upload_preview_from_errors(rows, errors_by_row)
    return preview, prepared_rows


def validate_upload_rows(
    session: Session,
    rows: list[OrgMappingAssignmentUploadRow],
) -> OrgMappingAssignmentUploadPreviewResponse:
    preview, _ = _validate_upload_rows(session, rows)
    return preview


def preview_mapping_assignment_upload(
    session: Session,
    rows: list[OrgMappingAssignmentUploadRow],
) -> OrgMappingAssignmentUploadPreviewResponse:
    with session.no_autoflush:
        return validate_upload_rows(session, rows)


def _upload_validation_exception(
    preview: OrgMappingAssignmentUploadPreviewResponse,
) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={"message": "upload validation failed", **preview.model_dump(mode="json")},
    )


def confirm_mapping_assignment_upload(
    session: Session,
    rows: list[OrgMappingAssignmentUploadRow],
    *,
    actor_id: int,
) -> OrgMappingAssignmentUploadConfirmResponse:
    try:
        with session.no_autoflush:
            preview, prepared_rows = _validate_upload_rows(session, rows)
    except HTTPException:
        session.rollback()
        raise
    except IntegrityError as exc:
        session.rollback()
        errors = [["Mapping assignment period overlaps existing record."] for _ in rows]
        raise _upload_validation_exception(_upload_preview_from_errors(rows, errors)) from exc
    except Exception as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Upload confirmation failed.",
        ) from exc
    if preview.invalid_count:
        session.rollback()
        raise _upload_validation_exception(preview)

    inserted_count = 0
    updated_count = 0
    try:
        for prepared in prepared_rows:
            assert prepared is not None
            if prepared.existing_assignment is None:
                session.add(
                    OrgMappingAssignment(
                        department_id=int(prepared.department.id),
                        type_code=prepared.type_code,
                        item_id=int(prepared.item.id),
                        effective_from=prepared.effective_from,
                        effective_to=prepared.effective_to,
                        created_by=actor_id,
                        updated_by=actor_id,
                        created_at=_utc_now(),
                        updated_at=_utc_now(),
                    )
                )
                inserted_count += 1
            else:
                prepared.existing_assignment.item_id = int(prepared.item.id)
                prepared.existing_assignment.effective_to = prepared.effective_to
                prepared.existing_assignment.updated_by = actor_id
                prepared.existing_assignment.updated_at = _utc_now()
                session.add(prepared.existing_assignment)
                updated_count += 1
        session.flush()
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        errors = [["Mapping assignment period overlaps existing record."] for _ in rows]
        raise _upload_validation_exception(_upload_preview_from_errors(rows, errors)) from exc
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Upload confirmation failed.",
        ) from exc

    return OrgMappingAssignmentUploadConfirmResponse(
        inserted_count=inserted_count,
        updated_count=updated_count,
    )


def _list_mapping_type_codes(session: Session) -> list[OrganizationLookupItem]:
    group = session.exec(
        select(AppCodeGroup).where(AppCodeGroup.code == MAPPING_TYPE_GROUP_CODE, AppCodeGroup.is_active == True)
    ).first()
    if group is None:
        return []

    rows = session.exec(
        select(AppCode)
        .where(AppCode.group_id == group.id, AppCode.is_active == True)
        .order_by(AppCode.sort_order, AppCode.id)
    ).all()
    return [_lookup_item(code=row.code, name=row.name) for row in rows]


def list_mapping_types(session: Session) -> list[OrganizationLookupItem]:
    return _list_mapping_type_codes(session)


def list_mapping_type_options(session: Session) -> list[OrganizationLookupItem]:
    return _list_mapping_type_codes(session)


def list_mapping_item_options(session: Session, *, type_code: str) -> list[OrganizationLookupItem]:
    rows = session.exec(
        select(OrgMappingTypeItem)
        .where(
            OrgMappingTypeItem.type_code == type_code.strip().upper(),
            OrgMappingTypeItem.is_active == True,
        )
        .order_by(OrgMappingTypeItem.sort_order, OrgMappingTypeItem.id)
    ).all()
    return [_lookup_item(code=row.item_code, name=row.name, id=int(row.id)) for row in rows]


def list_mapping_type_items(
    session: Session,
    *,
    page: int | None = None,
    limit: int | None = None,
    type_code: str | None = None,
    reference_date: date | None = None,
) -> tuple[list[OrgMappingTypeItemDetail], int]:
    statement = select(OrgMappingTypeItem).order_by(
        OrgMappingTypeItem.type_code,
        OrgMappingTypeItem.sort_order,
        OrgMappingTypeItem.item_code,
        OrgMappingTypeItem.effective_from,
        OrgMappingTypeItem.id,
    )
    if type_code:
        statement = statement.where(OrgMappingTypeItem.type_code == _normalize_code(type_code))
    if reference_date is not None:
        statement = statement.where(
            OrgMappingTypeItem.effective_from <= reference_date,
            func.coalesce(OrgMappingTypeItem.effective_to, _OPEN_END_DATE) >= reference_date,
        )

    rows = session.exec(statement).all()
    total_count = len(rows)
    if page is not None and limit is not None and limit > 0:
        offset = max(0, (page - 1) * limit)
        rows = rows[offset : offset + limit]

    return [_build_mapping_item(row) for row in rows], total_count


def list_mapping_assignments(
    session: Session,
    *,
    page: int | None = None,
    limit: int | None = None,
    department_id: int | None = None,
    type_code: str | None = None,
    reference_date: date | None = None,
) -> tuple[list[OrgMappingAssignmentItem], int]:
    statement = (
        select(OrgMappingAssignment, OrgDepartment, OrgMappingTypeItem)
        .join(OrgDepartment, OrgMappingAssignment.department_id == OrgDepartment.id)
        .join(
            OrgMappingTypeItem,
            and_(
                OrgMappingTypeItem.id == OrgMappingAssignment.item_id,
                OrgMappingTypeItem.type_code == OrgMappingAssignment.type_code,
            ),
        )
        .order_by(
            OrgDepartment.code,
            OrgMappingAssignment.type_code,
            OrgMappingAssignment.effective_from,
            OrgMappingAssignment.id,
        )
    )
    if department_id is not None:
        statement = statement.where(OrgMappingAssignment.department_id == department_id)
    if type_code:
        statement = statement.where(OrgMappingAssignment.type_code == _normalize_code(type_code))
    if reference_date is not None:
        statement = statement.where(
            OrgMappingAssignment.effective_from <= reference_date,
            func.coalesce(OrgMappingAssignment.effective_to, _OPEN_END_DATE) >= reference_date,
        )

    rows = session.exec(statement).all()
    total_count = len(rows)
    if page is not None and limit is not None and limit > 0:
        offset = max(0, (page - 1) * limit)
        rows = rows[offset : offset + limit]

    return [_build_assignment_item(assignment=row[0], department=row[1], item=row[2]) for row in rows], total_count


def _snapshot_employee_at_reference(
    employee: HrEmployee,
    histories: list[HrPersonnelHistory],
    display_name: str,
) -> _PersonalStatusEmployeeSnapshot:
    state = _snapshot_employee_state_at_reference(employee, histories)
    return _PersonalStatusEmployeeSnapshot(
        employee_id=state.employee_id,
        employee_no=state.employee_no,
        display_name=display_name,
        department_id=state.department_id,
        position_title=state.position_title,
        employment_status=state.employment_status,
    )


def _load_personal_status_candidate_chunk(
    session: Session,
    *,
    candidate_ids: list[int],
    reference_date: date,
) -> list[tuple[HrEmployee, AuthUser, list[HrPersonnelHistory]]]:
    if not candidate_ids:
        return []

    employee_rows = session.exec(
        select(HrEmployee, AuthUser)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .where(HrEmployee.id.in_(candidate_ids))
        .order_by(HrEmployee.employee_no, HrEmployee.id)
    ).all()
    history_rows = session.exec(
        select(HrPersonnelHistory)
        .where(
            HrPersonnelHistory.employee_id.in_(candidate_ids),
            HrPersonnelHistory.effective_date > reference_date,
            HrPersonnelHistory.field_name.in_(("department_id", "employment_status")),
        )
        .order_by(
            HrPersonnelHistory.employee_id,
            HrPersonnelHistory.effective_date.desc(),
            HrPersonnelHistory.id.desc(),
        )
    ).all()
    histories_by_employee: dict[int, list[HrPersonnelHistory]] = defaultdict(list)
    for history in history_rows:
        histories_by_employee[int(history.employee_id)].append(history)

    return [
        (employee, user, histories_by_employee.get(int(employee.id), []))
        for employee, user in employee_rows
    ]


def _collect_personal_status_page_employee_ids(
    session: Session,
    *,
    reference_date: date,
    page: int,
    limit: int,
) -> tuple[list[int], int]:
    candidate_ids = session.exec(
        select(HrEmployee.id)
        .where(HrEmployee.hire_date <= reference_date)
        .order_by(HrEmployee.employee_no, HrEmployee.id)
    ).all()
    if not candidate_ids:
        return [], 0

    start = max(0, (page - 1) * limit)
    active_count = 0
    page_employee_ids: list[int] = []

    for offset in range(0, len(candidate_ids), _PERSONAL_STATUS_CHUNK_SIZE):
        chunk_ids = [int(candidate_id) for candidate_id in candidate_ids[offset : offset + _PERSONAL_STATUS_CHUNK_SIZE]]
        for employee, _user, histories in _load_personal_status_candidate_chunk(
            session,
            candidate_ids=chunk_ids,
            reference_date=reference_date,
        ):
            snapshot = _snapshot_employee_state_at_reference(employee, histories)
            if snapshot.employment_status != "active":
                continue
            if active_count >= start and len(page_employee_ids) < limit:
                page_employee_ids.append(int(employee.id))
            active_count += 1

    return page_employee_ids, active_count


def _load_personal_status_page_rows(
    session: Session,
    *,
    employee_ids: list[int],
    reference_date: date,
    type_columns: list[OrgMappingPersonalStatusTypeColumn],
) -> list[OrgMappingPersonalStatusRow]:
    if not employee_ids:
        return []

    employee_rows = session.exec(
        select(HrEmployee, AuthUser)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .where(HrEmployee.id.in_(employee_ids))
        .order_by(HrEmployee.employee_no, HrEmployee.id)
    ).all()
    employee_map = {
        int(employee.id): (employee, user)
        for employee, user in employee_rows
    }

    histories_by_employee: dict[int, list[HrPersonnelHistory]] = defaultdict(list)
    history_rows = session.exec(
        select(HrPersonnelHistory)
        .where(
            HrPersonnelHistory.employee_id.in_(employee_ids),
            HrPersonnelHistory.effective_date > reference_date,
            HrPersonnelHistory.field_name.in_(("department_id", "employment_status")),
        )
        .order_by(
            HrPersonnelHistory.employee_id,
            HrPersonnelHistory.effective_date.desc(),
            HrPersonnelHistory.id.desc(),
        )
    ).all()
    for history in history_rows:
        histories_by_employee[int(history.employee_id)].append(history)

    snapshots: list[_PersonalStatusEmployeeSnapshot] = []
    for employee_id in employee_ids:
        row = employee_map.get(employee_id)
        if row is None:
            continue
        employee, user = row
        snapshots.append(
            _snapshot_employee_at_reference(
                employee,
                histories_by_employee.get(employee_id, []),
                user.display_name,
            )
        )

    department_ids = {snapshot.department_id for snapshot in snapshots}
    department_map = {
        int(department.id): department
        for department in session.exec(
            select(OrgDepartment).where(OrgDepartment.id.in_(department_ids))
        ).all()
    } if department_ids else {}

    assignment_map: dict[tuple[int, str], OrgMappingPersonalStatusCell] = {}
    if department_ids:
        assignment_rows = session.exec(
            select(OrgMappingAssignment, OrgMappingTypeItem)
            .join(
                OrgMappingTypeItem,
                and_(
                    OrgMappingTypeItem.id == OrgMappingAssignment.item_id,
                    OrgMappingTypeItem.type_code == OrgMappingAssignment.type_code,
                ),
            )
            .where(
                OrgMappingAssignment.department_id.in_(department_ids),
                OrgMappingAssignment.effective_from <= reference_date,
                func.coalesce(OrgMappingAssignment.effective_to, _OPEN_END_DATE) >= reference_date,
            )
            .order_by(
                OrgMappingAssignment.department_id,
                OrgMappingAssignment.type_code,
                OrgMappingAssignment.effective_from.desc(),
                OrgMappingAssignment.id.desc(),
            )
        ).all()
        for assignment, item in assignment_rows:
            assignment_map[(int(assignment.department_id), assignment.type_code)] = OrgMappingPersonalStatusCell(
                item_code=item.item_code,
                item_name=item.name,
            )

    items: list[OrgMappingPersonalStatusRow] = []
    for snapshot in snapshots:
        department = department_map.get(snapshot.department_id)
        mappings = {
            column.type_code: OrgMappingPersonalStatusCell(item_code="", item_name="")
            for column in type_columns
        }
        for column in type_columns:
            cell = assignment_map.get((snapshot.department_id, column.type_code))
            if cell is not None:
                mappings[column.type_code] = cell
        items.append(
            OrgMappingPersonalStatusRow(
                employee_id=snapshot.employee_id,
                employee_no=snapshot.employee_no,
                display_name=snapshot.display_name,
                department_id=snapshot.department_id,
                department_code=department.code if department is not None else "",
                department_name=department.name if department is not None else "",
                position_title=snapshot.position_title,
                mappings=mappings,
            )
        )
    return items


def list_mapping_personal_status(
    session: Session,
    *,
    reference_date: date,
    page: int,
    limit: int,
) -> OrgMappingPersonalStatusListResponse:
    type_columns = [
        OrgMappingPersonalStatusTypeColumn(type_code=item.code, name=item.name)
        for item in list_mapping_types(session)
    ]
    page_employee_ids, total_count = _collect_personal_status_page_employee_ids(
        session,
        reference_date=reference_date,
        page=page,
        limit=limit,
    )
    page_items = _load_personal_status_page_rows(
        session,
        employee_ids=page_employee_ids,
        reference_date=reference_date,
        type_columns=type_columns,
    )
    return OrgMappingPersonalStatusListResponse(
        items=page_items,
        type_columns=type_columns,
        total_count=total_count,
        page=page,
        limit=limit,
    )


def create_mapping_assignment(
    session: Session,
    payload: OrgMappingAssignmentCreateRequest,
) -> OrgMappingAssignmentItem:
    type_code = _normalize_code(payload.type_code)
    department = _get_department(session, payload.department_id)
    item = _get_assignment_item(session, item_id=payload.item_id, type_code=type_code)
    _validate_closed_period(payload.effective_from, payload.effective_to)
    _validate_assignment_period_within_item(
        item=item,
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
    )
    _ensure_no_assignment_overlap(
        session,
        department_id=department.id,
        type_code=type_code,
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
    )

    row = OrgMappingAssignment(
        department_id=int(department.id),
        type_code=type_code,
        item_id=int(item.id),
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
        created_by=None,
        updated_by=None,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(row)
    try:
        session.flush()
        session.commit()
    except IntegrityError as exc:
        _apply_assignment_integrity_guard(session, exc)
    session.refresh(row)
    return _build_assignment_item(row, department, item)


def update_mapping_assignment(
    session: Session,
    assignment_id: int,
    payload: OrgMappingAssignmentUpdateRequest,
) -> OrgMappingAssignmentItem:
    with session.no_autoflush:
        row = session.get(OrgMappingAssignment, assignment_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mapping assignment not found.")

    next_department_id = row.department_id
    next_type_code = row.type_code
    next_item_id = row.item_id
    next_effective_from = row.effective_from
    next_effective_to = row.effective_to

    if payload.department_id is not None:
        next_department_id = payload.department_id
    if payload.type_code is not None:
        next_type_code = _normalize_code(payload.type_code)
    if payload.item_id is not None:
        next_item_id = payload.item_id
    if payload.effective_from is not None:
        next_effective_from = payload.effective_from
    if payload.effective_to is not None or "effective_to" in payload.model_fields_set:
        next_effective_to = payload.effective_to

    department = _get_department(session, next_department_id)
    item = _get_assignment_item(session, item_id=next_item_id, type_code=next_type_code)
    _validate_closed_period(next_effective_from, next_effective_to)
    _validate_assignment_period_within_item(
        item=item,
        effective_from=next_effective_from,
        effective_to=next_effective_to,
    )
    _ensure_no_assignment_overlap(
        session,
        department_id=int(department.id),
        type_code=next_type_code,
        effective_from=next_effective_from,
        effective_to=next_effective_to,
        exclude_id=row.id,
    )

    row.department_id = int(department.id)
    row.type_code = next_type_code
    row.item_id = int(item.id)
    row.effective_from = next_effective_from
    row.effective_to = next_effective_to
    row.updated_at = _utc_now()
    session.add(row)
    try:
        session.flush()
        session.commit()
    except IntegrityError as exc:
        _apply_assignment_integrity_guard(session, exc)
    session.refresh(row)
    return _build_assignment_item(row, department, item)


def delete_mapping_assignment(session: Session, assignment_id: int) -> None:
    with session.no_autoflush:
        row = session.get(OrgMappingAssignment, assignment_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mapping assignment not found.")

    session.delete(row)
    try:
        session.flush()
        session.commit()
    except IntegrityError as exc:
        _apply_assignment_integrity_guard(session, exc)


def create_mapping_type_item(
    session: Session,
    payload: OrgMappingTypeItemCreateRequest,
) -> OrgMappingTypeItemDetail:
    type_code = _normalize_code(payload.type_code)
    item_code = _normalize_code(payload.item_code)
    name = payload.name.strip()
    effective_from = payload.effective_from
    effective_to = payload.effective_to
    _validate_closed_period(effective_from, effective_to)
    _ensure_no_item_overlap(
        session,
        type_code=type_code,
        item_code=item_code,
        effective_from=effective_from,
        effective_to=effective_to,
    )

    row = OrgMappingTypeItem(
        type_code=type_code,
        item_code=item_code,
        name=name,
        effective_from=effective_from,
        effective_to=effective_to,
        erp_employee_code=_strip_or_none(payload.erp_employee_code),
        cost_center_type=_strip_or_none(payload.cost_center_type),
        remark=_strip_or_none(payload.remark),
        sort_order=payload.sort_order,
        is_active=payload.is_active,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(row)
    try:
        session.flush()
        session.commit()
    except IntegrityError as exc:
        _apply_integrity_guard(session, exc)
    session.refresh(row)
    return _build_mapping_item(row)


def update_mapping_type_item(
    session: Session,
    item_id: int,
    type_code_or_payload: OrgMappingTypeItemUpdateRequest | str,
    payload: OrgMappingTypeItemUpdateRequest | None = None,
) -> OrgMappingTypeItemDetail:
    if payload is None:
        payload = type_code_or_payload  # type: ignore[assignment]

    row = session.get(OrgMappingTypeItem, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mapping item not found.")

    next_type_code = row.type_code
    next_item_code = row.item_code
    next_effective_from = row.effective_from
    next_effective_to = row.effective_to

    if payload.type_code is not None:
        next_type_code = _normalize_code(payload.type_code)
    if payload.item_code is not None:
        next_item_code = _normalize_code(payload.item_code)
    if payload.effective_from is not None:
        next_effective_from = payload.effective_from
    if payload.effective_to is not None or "effective_to" in payload.model_fields_set:
        next_effective_to = payload.effective_to

    _validate_closed_period(next_effective_from, next_effective_to)

    has_assignments = _item_has_assignments(session, item_id)
    if has_assignments:
        if next_type_code != row.type_code or next_item_code != row.item_code:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Referenced mapping item type_code/item_code cannot be changed.",
            )
        if not _item_period_contains_assignments(
            session,
            item_id=item_id,
            effective_from=next_effective_from,
            effective_to=next_effective_to,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Referenced mapping item period must contain existing assignments.",
            )
        if payload.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Referenced mapping item cannot be deactivated.",
            )

    if payload.type_code is not None:
        row.type_code = next_type_code
    if payload.item_code is not None:
        row.item_code = next_item_code
    if payload.name is not None:
        row.name = payload.name.strip()
    if payload.effective_from is not None:
        row.effective_from = next_effective_from
    if "effective_to" in payload.model_fields_set:
        row.effective_to = next_effective_to
    if "erp_employee_code" in payload.model_fields_set:
        row.erp_employee_code = _strip_or_none(payload.erp_employee_code)
    if "cost_center_type" in payload.model_fields_set:
        row.cost_center_type = _strip_or_none(payload.cost_center_type)
    if payload.sort_order is not None:
        row.sort_order = payload.sort_order
    if "remark" in payload.model_fields_set:
        row.remark = _strip_or_none(payload.remark)
    if payload.is_active is not None:
        row.is_active = payload.is_active

    row.updated_at = _utc_now()
    session.add(row)
    _ensure_no_item_overlap(
        session,
        type_code=row.type_code,
        item_code=row.item_code,
        effective_from=row.effective_from,
        effective_to=row.effective_to,
        exclude_id=row.id,
    )
    try:
        session.flush()
        session.commit()
    except IntegrityError as exc:
        _apply_integrity_guard(session, exc)
    session.refresh(row)
    return _build_mapping_item(row)


def delete_mapping_type_item(session: Session, item_id: int) -> None:
    row = session.get(OrgMappingTypeItem, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mapping item not found.")

    if _item_has_assignments(session, item_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Referenced mapping item cannot be deleted.",
        )

    session.delete(row)
    try:
        session.flush()
        session.commit()
    except IntegrityError as exc:
        _apply_integrity_guard(session, exc)


def list_department_options(session: Session) -> list[OrganizationLookupItem]:
    rows = session.exec(
        select(OrgDepartment)
        .where(OrgDepartment.is_active == True)
        .order_by(OrgDepartment.code, OrgDepartment.id)
    ).all()
    return [_lookup_item(code=row.code, name=row.name, id=int(row.id)) for row in rows]
