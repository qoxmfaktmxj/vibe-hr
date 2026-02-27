from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import Session, SQLModel, select

from app.models import HrEmployee
from app.models.tra import (
    TraApplication,
    TraCourse,
    TraCyberUpload,
    TraElearningWindow,
    TraEvent,
    TraHistory,
    TraOrganization,
    TraRequiredRule,
    TraRequiredTarget,
)
from app.schemas.tra import TraResourceBatchRequest


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "t", "y", "yes"}
    return False


def _to_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


def _to_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def _to_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return None
        if len(normalized) == 8 and normalized.isdigit():
            return datetime.strptime(normalized, "%Y%m%d").date()
        return date.fromisoformat(normalized)
    raise ValueError(f"Unsupported date value: {value}")


def _sqlmodel_to_dict(row: SQLModel) -> dict[str, Any]:
    return row.model_dump()


def _name_map_by_id(
    session: Session,
    model: type[SQLModel],
    ids: set[int],
    value_field: str,
) -> dict[int, Any]:
    if not ids:
        return {}
    id_column = getattr(model, "id")
    value_column = getattr(model, value_field)
    rows = session.exec(select(id_column, value_column).where(id_column.in_(ids))).all()
    return {int(row[0]): row[1] for row in rows}


def _employee_no_map(session: Session, employee_ids: set[int]) -> dict[int, str]:
    if not employee_ids:
        return {}
    rows = session.exec(
        select(HrEmployee.id, HrEmployee.employee_no).where(HrEmployee.id.in_(employee_ids)),
    ).all()
    return {int(row[0]): row[1] for row in rows}


@dataclass(frozen=True)
class ResourceConfig:
    model: type[SQLModel]
    writable_fields: tuple[str, ...]
    int_fields: frozenset[str]
    float_fields: frozenset[str]
    bool_fields: frozenset[str]
    date_fields: frozenset[str]
    order_fields: tuple[str, ...]


RESOURCE_CONFIGS: dict[str, ResourceConfig] = {
    "organizations": ResourceConfig(
        model=TraOrganization,
        writable_fields=(
            "code",
            "name",
            "business_no",
            "contact_name",
            "contact_phone",
            "contact_email",
            "is_active",
        ),
        int_fields=frozenset(),
        float_fields=frozenset(),
        bool_fields=frozenset({"is_active"}),
        date_fields=frozenset(),
        order_fields=("code", "id"),
    ),
    "courses": ResourceConfig(
        model=TraCourse,
        writable_fields=(
            "course_code",
            "course_name",
            "in_out_type",
            "branch_code",
            "sub_branch_code",
            "method_code",
            "status_code",
            "organization_id",
            "mandatory_yn",
            "job_code",
            "edu_level",
            "memo",
            "note",
            "manager_employee_no",
            "manager_phone",
            "is_active",
        ),
        int_fields=frozenset({"organization_id"}),
        float_fields=frozenset(),
        bool_fields=frozenset({"mandatory_yn", "is_active"}),
        date_fields=frozenset(),
        order_fields=("course_code", "id"),
    ),
    "events": ResourceConfig(
        model=TraEvent,
        writable_fields=(
            "course_id",
            "event_code",
            "event_name",
            "status_code",
            "organization_id",
            "place",
            "start_date",
            "end_date",
            "start_time",
            "end_time",
            "edu_day",
            "edu_hour",
            "appl_start_date",
            "appl_end_date",
            "currency_code",
            "per_expense_amount",
            "real_expense_amount",
            "labor_apply_yn",
            "labor_amount",
            "labor_return_yn",
            "labor_return_date",
            "result_app_skip_yn",
            "max_person",
            "note",
            "manager_employee_no",
            "manager_phone",
            "is_active",
        ),
        int_fields=frozenset({"course_id", "organization_id", "edu_day", "max_person"}),
        float_fields=frozenset({"edu_hour", "per_expense_amount", "real_expense_amount", "labor_amount"}),
        bool_fields=frozenset({"labor_apply_yn", "labor_return_yn", "result_app_skip_yn", "is_active"}),
        date_fields=frozenset({"start_date", "end_date", "appl_start_date", "appl_end_date", "labor_return_date"}),
        order_fields=("start_date", "id"),
    ),
    "required-standards": ResourceConfig(
        model=TraRequiredRule,
        writable_fields=(
            "year",
            "rule_code",
            "order_seq",
            "job_grade_code",
            "job_grade_year",
            "job_code",
            "search_seq",
            "entry_month",
            "start_month",
            "end_month",
            "course_id",
            "edu_level",
            "note",
            "is_active",
        ),
        int_fields=frozenset(
            {"year", "order_seq", "job_grade_year", "search_seq", "entry_month", "start_month", "end_month", "course_id"},
        ),
        float_fields=frozenset(),
        bool_fields=frozenset({"is_active"}),
        date_fields=frozenset(),
        order_fields=("year", "rule_code", "order_seq", "id"),
    ),
    "required-targets": ResourceConfig(
        model=TraRequiredTarget,
        writable_fields=(
            "year",
            "employee_id",
            "rule_code",
            "course_id",
            "edu_month",
            "event_id",
            "application_id",
            "standard_rule_id",
            "edu_level",
            "completion_status",
            "completed_count",
            "note",
            "error_note",
        ),
        int_fields=frozenset({"year", "employee_id", "course_id", "event_id", "application_id", "standard_rule_id", "completed_count"}),
        float_fields=frozenset(),
        bool_fields=frozenset(),
        date_fields=frozenset(),
        order_fields=("year", "edu_month", "employee_id", "id"),
    ),
    "applications": ResourceConfig(
        model=TraApplication,
        writable_fields=(
            "application_no",
            "employee_id",
            "course_id",
            "event_id",
            "in_out_type",
            "job_code",
            "year_plan_yn",
            "edu_memo",
            "note",
            "survey_yn",
            "approval_request_id",
            "status",
        ),
        int_fields=frozenset({"employee_id", "course_id", "event_id", "approval_request_id"}),
        float_fields=frozenset(),
        bool_fields=frozenset({"year_plan_yn", "survey_yn"}),
        date_fields=frozenset(),
        order_fields=("id",),
    ),
    "elearning-windows": ResourceConfig(
        model=TraElearningWindow,
        writable_fields=("year_month", "start_date", "end_date", "app_count", "note"),
        int_fields=frozenset({"app_count"}),
        float_fields=frozenset(),
        bool_fields=frozenset(),
        date_fields=frozenset({"start_date", "end_date"}),
        order_fields=("year_month", "id"),
    ),
    "histories": ResourceConfig(
        model=TraHistory,
        writable_fields=(
            "employee_id",
            "course_id",
            "event_id",
            "application_id",
            "confirm_type",
            "unconfirm_reason",
            "app_point",
            "job_code",
            "note",
            "completed_at",
        ),
        int_fields=frozenset({"employee_id", "course_id", "event_id", "application_id"}),
        float_fields=frozenset({"app_point"}),
        bool_fields=frozenset(),
        date_fields=frozenset({"completed_at"}),
        order_fields=("completed_at", "id"),
    ),
    "cyber-uploads": ResourceConfig(
        model=TraCyberUpload,
        writable_fields=(
            "upload_ym",
            "employee_no",
            "employee_id",
            "course_name",
            "start_date",
            "end_date",
            "reward_hour",
            "edu_hour",
            "labor_apply_yn",
            "labor_amount",
            "per_expense_amount",
            "real_expense_amount",
            "confirm_type",
            "unconfirm_reason",
            "edu_branch_code",
            "edu_sub_branch_code",
            "in_out_type",
            "method_code",
            "organization_name",
            "business_no",
            "mandatory_yn",
            "job_code",
            "edu_level",
            "event_name",
            "place",
            "close_yn",
            "applied_course_id",
            "applied_event_id",
            "applied_history_id",
            "note",
        ),
        int_fields=frozenset({"employee_id", "applied_course_id", "applied_event_id", "applied_history_id"}),
        float_fields=frozenset({"reward_hour", "edu_hour", "labor_amount", "per_expense_amount", "real_expense_amount"}),
        bool_fields=frozenset({"labor_apply_yn", "mandatory_yn", "close_yn"}),
        date_fields=frozenset({"start_date", "end_date"}),
        order_fields=("upload_ym", "id"),
    ),
}


def _resource_config_or_404(resource: str) -> ResourceConfig:
    config = RESOURCE_CONFIGS.get(resource)
    if config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown TRA resource: {resource}")
    return config


def _normalize_payload(config: ResourceConfig, raw: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in raw.items():
        if key not in config.writable_fields:
            continue
        if value == "":
            value = None
        if key in config.bool_fields:
            normalized[key] = _to_bool(value)
            continue
        if key in config.int_fields:
            normalized[key] = _to_int(value)
            continue
        if key in config.float_fields:
            normalized[key] = _to_float(value)
            continue
        if key in config.date_fields:
            normalized[key] = _to_date(value)
            continue
        normalized[key] = value
    return normalized


def _serialize_rows(session: Session, resource: str, rows: list[SQLModel]) -> list[dict[str, Any]]:
    if not rows:
        return []

    if resource == "courses":
        org_ids = {row.organization_id for row in rows if isinstance(row, TraCourse) and row.organization_id is not None}
        org_map = _name_map_by_id(session, TraOrganization, {int(item) for item in org_ids}, "name")
        items: list[dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, TraCourse):
                continue
            data = _sqlmodel_to_dict(row)
            data["organization_name"] = org_map.get(row.organization_id or 0)
            items.append(data)
        return items

    if resource == "events":
        course_ids = {row.course_id for row in rows if isinstance(row, TraEvent)}
        org_ids = {row.organization_id for row in rows if isinstance(row, TraEvent) and row.organization_id is not None}
        course_map = _name_map_by_id(session, TraCourse, {int(item) for item in course_ids}, "course_name")
        org_map = _name_map_by_id(session, TraOrganization, {int(item) for item in org_ids}, "name")
        items = []
        for row in rows:
            if not isinstance(row, TraEvent):
                continue
            data = _sqlmodel_to_dict(row)
            data["course_name"] = course_map.get(row.course_id)
            data["organization_name"] = org_map.get(row.organization_id or 0)
            items.append(data)
        return items

    if resource == "required-standards":
        course_ids = {row.course_id for row in rows if isinstance(row, TraRequiredRule)}
        course_map = _name_map_by_id(session, TraCourse, {int(item) for item in course_ids}, "course_name")
        items = []
        for row in rows:
            if not isinstance(row, TraRequiredRule):
                continue
            data = _sqlmodel_to_dict(row)
            data["course_name"] = course_map.get(row.course_id)
            items.append(data)
        return items

    if resource == "required-targets":
        course_ids = {row.course_id for row in rows if isinstance(row, TraRequiredTarget)}
        event_ids = {row.event_id for row in rows if isinstance(row, TraRequiredTarget) and row.event_id is not None}
        employee_ids = {row.employee_id for row in rows if isinstance(row, TraRequiredTarget)}
        course_map = _name_map_by_id(session, TraCourse, {int(item) for item in course_ids}, "course_name")
        event_map = _name_map_by_id(session, TraEvent, {int(item) for item in event_ids}, "event_name")
        employee_map = _employee_no_map(session, {int(item) for item in employee_ids})
        items = []
        for row in rows:
            if not isinstance(row, TraRequiredTarget):
                continue
            data = _sqlmodel_to_dict(row)
            data["course_name"] = course_map.get(row.course_id)
            data["event_name"] = event_map.get((row.event_id or 0))
            data["employee_no"] = employee_map.get(row.employee_id)
            items.append(data)
        return items

    if resource == "applications":
        course_ids = {row.course_id for row in rows if isinstance(row, TraApplication)}
        event_ids = {row.event_id for row in rows if isinstance(row, TraApplication) and row.event_id is not None}
        employee_ids = {row.employee_id for row in rows if isinstance(row, TraApplication)}
        course_map = _name_map_by_id(session, TraCourse, {int(item) for item in course_ids}, "course_name")
        event_map = _name_map_by_id(session, TraEvent, {int(item) for item in event_ids}, "event_name")
        employee_map = _employee_no_map(session, {int(item) for item in employee_ids})
        items = []
        for row in rows:
            if not isinstance(row, TraApplication):
                continue
            data = _sqlmodel_to_dict(row)
            data["course_name"] = course_map.get(row.course_id)
            data["event_name"] = event_map.get((row.event_id or 0))
            data["employee_no"] = employee_map.get(row.employee_id)
            items.append(data)
        return items

    if resource == "histories":
        course_ids = {row.course_id for row in rows if isinstance(row, TraHistory)}
        event_ids = {row.event_id for row in rows if isinstance(row, TraHistory) and row.event_id is not None}
        employee_ids = {row.employee_id for row in rows if isinstance(row, TraHistory)}
        course_map = _name_map_by_id(session, TraCourse, {int(item) for item in course_ids}, "course_name")
        event_map = _name_map_by_id(session, TraEvent, {int(item) for item in event_ids}, "event_name")
        employee_map = _employee_no_map(session, {int(item) for item in employee_ids})
        items = []
        for row in rows:
            if not isinstance(row, TraHistory):
                continue
            data = _sqlmodel_to_dict(row)
            data["course_name"] = course_map.get(row.course_id)
            data["event_name"] = event_map.get((row.event_id or 0))
            data["employee_no"] = employee_map.get(row.employee_id)
            items.append(data)
        return items

    return [_sqlmodel_to_dict(row) for row in rows]


def list_tra_resource(
    session: Session,
    resource: str,
    *,
    year: int | None = None,
) -> list[dict[str, Any]]:
    config = _resource_config_or_404(resource)
    model = config.model
    statement = select(model)

    if year is not None and hasattr(model, "year"):
        statement = statement.where(getattr(model, "year") == year)

    order_columns = [getattr(model, field) for field in config.order_fields if hasattr(model, field)]
    if order_columns:
        statement = statement.order_by(*order_columns)

    rows = session.exec(statement).all()
    return _serialize_rows(session, resource, rows)


def _next_application_no(session: Session) -> str:
    max_id = session.exec(select(func.max(TraApplication.id))).one() or 0
    return f"TRA-{date.today().year}-{int(max_id) + 1:06d}"


def _next_org_code(session: Session) -> str:
    max_id = session.exec(select(func.max(TraOrganization.id))).one() or 0
    return f"TRORG{int(max_id) + 1:05d}"


def _next_course_code(session: Session) -> str:
    max_id = session.exec(select(func.max(TraCourse.id))).one() or 0
    return f"TRAC{int(max_id) + 1:05d}"


def batch_save_tra_resource(
    session: Session,
    resource: str,
    payload: TraResourceBatchRequest,
) -> dict[str, int]:
    config = _resource_config_or_404(resource)
    model = config.model
    created = updated = deleted = 0

    for item in payload.items:
        raw = item.model_dump()
        status_text = str(raw.pop("_status", "clean")).lower()
        row_id = raw.pop("id", None)
        normalized = _normalize_payload(config, raw)

        if status_text == "clean":
            continue

        if status_text == "added":
            if model is TraApplication and not normalized.get("application_no"):
                normalized["application_no"] = _next_application_no(session)
            if model is TraOrganization and not normalized.get("code"):
                normalized["code"] = _next_org_code(session)
            if model is TraCourse and not normalized.get("course_code"):
                normalized["course_code"] = _next_course_code(session)
            row = model(**normalized)  # type: ignore[call-arg]
            if hasattr(row, "created_at"):
                setattr(row, "created_at", _utc_now())
            if hasattr(row, "updated_at"):
                setattr(row, "updated_at", _utc_now())
            session.add(row)
            created += 1
            continue

        parsed_row_id = _to_int(row_id)
        if parsed_row_id is None:
            continue
        existing = session.get(model, parsed_row_id)
        if existing is None:
            continue

        if status_text == "deleted":
            session.delete(existing)
            deleted += 1
            continue

        if status_text == "updated":
            for field, value in normalized.items():
                setattr(existing, field, value)
            if hasattr(existing, "updated_at"):
                setattr(existing, "updated_at", _utc_now())
            session.add(existing)
            updated += 1

    session.commit()
    return {"created": created, "updated": updated, "deleted": deleted}


def generate_required_events(session: Session, year: int) -> int:
    rules = session.exec(
        select(TraRequiredRule).where(TraRequiredRule.year == year, TraRequiredRule.is_active.is_(True)),
    ).all()
    if not rules:
        return 0

    course_ids = {rule.course_id for rule in rules}
    course_name_map = _name_map_by_id(session, TraCourse, {int(item) for item in course_ids}, "course_name")
    created = 0

    for rule in rules:
        start_month = min(max(rule.start_month or 1, 1), 12)
        end_month = min(max(rule.end_month or start_month, start_month), 12)
        for month in range(start_month, end_month + 1):
            event_code = f"{year}{month:02d}"
            exists = session.exec(
                select(TraEvent.id).where(TraEvent.course_id == rule.course_id, TraEvent.event_code == event_code),
            ).first()
            if exists is not None:
                continue

            month_start = date(year, month, 1)
            if month == 12:
                month_end = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                month_end = date(year, month + 1, 1) - timedelta(days=1)

            course_name = course_name_map.get(rule.course_id) or f"Course-{rule.course_id}"
            row = TraEvent(
                course_id=rule.course_id,
                event_code=event_code,
                event_name=f"{course_name}({year}-{month:02d})",
                status_code="open",
                start_date=month_start,
                end_date=month_end,
                appl_start_date=date(year, 1, 1),
                appl_end_date=month_start - timedelta(days=1),
                result_app_skip_yn=True,
                max_person=999,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
            session.add(row)
            created += 1

    session.commit()
    return created


def generate_required_targets(session: Session, year: int, rule_code: str | None = None) -> int:
    statement = select(TraRequiredRule).where(TraRequiredRule.year == year, TraRequiredRule.is_active.is_(True))
    if rule_code:
        statement = statement.where(TraRequiredRule.rule_code == rule_code)
    rules = session.exec(statement).all()
    if not rules:
        return 0

    employees = session.exec(
        select(HrEmployee).where(HrEmployee.employment_status.in_(["active", "leave"])),
    ).all()
    if not employees:
        return 0

    existing_keys = {
        (
            row.employee_id,
            row.rule_code,
            row.course_id,
            row.edu_month,
        )
        for row in session.exec(select(TraRequiredTarget).where(TraRequiredTarget.year == year)).all()
    }

    created = 0
    for rule in rules:
        month = rule.entry_month or rule.start_month or 1
        month = min(max(month, 1), 12)
        edu_month = f"{year}{month:02d}"
        for employee in employees:
            if employee.id is None:
                continue
            key = (employee.id, rule.rule_code, rule.course_id, edu_month)
            if key in existing_keys:
                continue
            session.add(
                TraRequiredTarget(
                    year=year,
                    employee_id=employee.id,
                    rule_code=rule.rule_code,
                    course_id=rule.course_id,
                    edu_month=edu_month,
                    standard_rule_id=rule.id,
                    edu_level=rule.edu_level,
                    completion_status="pending",
                    created_at=_utc_now(),
                    updated_at=_utc_now(),
                ),
            )
            existing_keys.add(key)
            created += 1

    session.commit()
    return created


def generate_elearning_windows(session: Session, year: int, app_count: int = 2) -> int:
    existing_map = {
        row.year_month: row
        for row in session.exec(
            select(TraElearningWindow).where(TraElearningWindow.year_month.startswith(str(year))),
        ).all()
    }

    processed = 0
    for month in range(1, 13):
        year_month = f"{year}{month:02d}"
        first_day = date(year, month, 1)
        start_date = first_day
        while start_date.weekday() != 0:  # Monday
            start_date += timedelta(days=1)
        end_date = start_date + timedelta(days=4)

        row = existing_map.get(year_month)
        if row is None:
            session.add(
                TraElearningWindow(
                    year_month=year_month,
                    start_date=start_date,
                    end_date=end_date,
                    app_count=app_count,
                    created_at=_utc_now(),
                    updated_at=_utc_now(),
                ),
            )
        else:
            row.start_date = start_date
            row.end_date = end_date
            row.app_count = app_count
            row.updated_at = _utc_now()
            session.add(row)
        processed += 1

    session.commit()
    return processed


def apply_cyber_results(session: Session, upload_ym: str | None = None) -> int:
    statement = select(TraCyberUpload).where(TraCyberUpload.close_yn.is_(False))
    if upload_ym:
        statement = statement.where(TraCyberUpload.upload_ym == upload_ym)
    uploads = session.exec(statement.order_by(TraCyberUpload.id)).all()
    if not uploads:
        return 0

    employee_nos = {row.employee_no for row in uploads if row.employee_no}
    employee_map: dict[str, HrEmployee] = {}
    if employee_nos:
        employees = session.exec(select(HrEmployee).where(HrEmployee.employee_no.in_(employee_nos))).all()
        employee_map = {emp.employee_no: emp for emp in employees}

    processed = 0
    for upload in uploads:
        organization_id: int | None = None
        if upload.organization_name:
            org = session.exec(
                select(TraOrganization).where(TraOrganization.name == upload.organization_name),
            ).first()
            if org is None:
                org = TraOrganization(
                    code=_next_org_code(session),
                    name=upload.organization_name,
                    business_no=upload.business_no,
                    is_active=True,
                    created_at=_utc_now(),
                    updated_at=_utc_now(),
                )
                session.add(org)
                session.flush()
            organization_id = org.id

        course = session.exec(select(TraCourse).where(TraCourse.course_name == upload.course_name)).first()
        if course is None:
            course = TraCourse(
                course_code=_next_course_code(session),
                course_name=upload.course_name,
                in_out_type=upload.in_out_type or "EXTERNAL",
                branch_code=upload.edu_branch_code,
                sub_branch_code=upload.edu_sub_branch_code,
                method_code=upload.method_code,
                status_code="open",
                organization_id=organization_id,
                mandatory_yn=upload.mandatory_yn,
                job_code=upload.job_code,
                edu_level=upload.edu_level,
                is_active=True,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
            session.add(course)
            session.flush()

        event_code = (
            upload.start_date.strftime("%Y%m%d")
            if upload.start_date is not None
            else f"{upload.upload_ym}01"
        )
        event = session.exec(
            select(TraEvent).where(TraEvent.course_id == course.id, TraEvent.event_code == event_code),
        ).first()
        if event is None:
            event = TraEvent(
                course_id=course.id or 0,
                event_code=event_code,
                event_name=upload.event_name or f"{course.course_name}({event_code})",
                status_code="closed" if upload.close_yn else "open",
                organization_id=organization_id,
                place=upload.place,
                start_date=upload.start_date,
                end_date=upload.end_date,
                edu_hour=upload.edu_hour,
                per_expense_amount=upload.per_expense_amount,
                real_expense_amount=upload.real_expense_amount,
                labor_apply_yn=upload.labor_apply_yn,
                labor_amount=upload.labor_amount,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
            session.add(event)
            session.flush()

        employee = employee_map.get(upload.employee_no or "")
        history_id: int | None = None
        if employee is not None and employee.id is not None and course.id is not None and event.id is not None:
            history = session.exec(
                select(TraHistory).where(
                    TraHistory.employee_id == employee.id,
                    TraHistory.course_id == course.id,
                    TraHistory.event_id == event.id,
                ),
            ).first()
            if history is None:
                history = TraHistory(
                    employee_id=employee.id,
                    course_id=course.id,
                    event_id=event.id,
                    confirm_type=upload.confirm_type,
                    unconfirm_reason=upload.unconfirm_reason,
                    app_point=upload.reward_hour,
                    job_code=upload.job_code,
                    note=upload.note,
                    completed_at=upload.end_date,
                    created_at=_utc_now(),
                    updated_at=_utc_now(),
                )
            else:
                history.confirm_type = upload.confirm_type
                history.unconfirm_reason = upload.unconfirm_reason
                history.app_point = upload.reward_hour
                history.job_code = upload.job_code
                history.note = upload.note
                history.completed_at = upload.end_date
                history.updated_at = _utc_now()
            session.add(history)
            session.flush()
            history_id = history.id
            upload.employee_id = employee.id

        upload.close_yn = True
        upload.applied_course_id = course.id
        upload.applied_event_id = event.id
        upload.applied_history_id = history_id
        upload.updated_at = _utc_now()
        session.add(upload)
        processed += 1

    session.commit()
    return processed
