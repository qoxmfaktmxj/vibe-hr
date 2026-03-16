from __future__ import annotations

import secrets
import string
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlmodel import Session, select

from app.models import AuthUser, HrEmployee, HrEmployeeBasicProfile, HrRecruitFinalist, OrgDepartment
from app.schemas.employee import EmployeeCreateRequest
from app.schemas.hr_recruit import (
    HrRecruitCreateEmployeesResponse,
    HrRecruitCreateEmployeesResult,
    HrRecruitFinalistCreateRequest,
    HrRecruitFinalistItem,
    HrRecruitFinalistUpdateRequest,
    HrRecruitIfInboundRow,
)
from app.services.employee_command_service import create_employee_no_commit

_EMAIL_ADAPTER = TypeAdapter(EmailStr)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _generate_temp_password(length: int = 12) -> str:
    """임시 비밀번호 생성: 영문 대소문자 + 숫자 + 특수문자 조합."""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    # 각 문자 종류 최소 1개씩 보장
    must_have = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%"),
    ]
    rest = [secrets.choice(alphabet) for _ in range(length - len(must_have))]
    combined = must_have + rest
    secrets.SystemRandom().shuffle(combined)
    return "".join(combined)


def _ensure_basic_profile_from_finalist(
    session: Session,
    employee_id: int,
    finalist: HrRecruitFinalist,
) -> None:
    """합격자 데이터를 기반으로 HrEmployeeBasicProfile이 없으면 자동 생성."""
    existing = session.exec(
        select(HrEmployeeBasicProfile).where(HrEmployeeBasicProfile.employee_id == employee_id)
    ).first()
    if existing is not None:
        return

    now = _utc_now()
    profile = HrEmployeeBasicProfile(
        employee_id=employee_id,
        birth_date=finalist.birth_date,
        resident_no_masked=finalist.resident_no_masked,
        created_at=now,
        updated_at=now,
    )
    session.add(profile)


def _strip_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _build_item(row: HrRecruitFinalist) -> HrRecruitFinalistItem:
    return HrRecruitFinalistItem(
        id=row.id,
        candidate_no=row.candidate_no,
        source_type=row.source_type,
        external_key=row.external_key,
        full_name=row.full_name,
        resident_no_masked=row.resident_no_masked,
        birth_date=row.birth_date,
        phone_mobile=row.phone_mobile,
        email=row.email,
        hire_type=row.hire_type,
        career_years=row.career_years,
        login_id=row.login_id,
        employee_no=row.employee_no,
        expected_join_date=row.expected_join_date,
        status_code=row.status_code,
        note=row.note,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _next_candidate_no(session: Session) -> str:
    prefix = datetime.now(timezone.utc).strftime("RC%Y%m%d")
    max_seq = 0
    rows = session.exec(
        select(HrRecruitFinalist.candidate_no).where(HrRecruitFinalist.candidate_no.like(f"{prefix}-%"))
    ).all()
    for value in rows:
        if not value:
            continue
        parts = value.split("-")
        if len(parts) != 2:
            continue
        try:
            max_seq = max(max_seq, int(parts[1]))
        except ValueError:
            continue
    return f"{prefix}-{max_seq + 1:04d}"


def _next_employee_no(session: Session) -> str:
    max_seq = 0
    employee_rows = session.exec(
        select(HrEmployee.employee_no).where(HrEmployee.employee_no.like("EMP-%"))
    ).all()
    finalist_rows = session.exec(
        select(HrRecruitFinalist.employee_no).where(HrRecruitFinalist.employee_no.like("EMP-%"))
    ).all()
    for value in [*employee_rows, *finalist_rows]:
        if not value:
            continue
        suffix = value.replace("EMP-", "", 1)
        try:
            max_seq = max(max_seq, int(suffix))
        except ValueError:
            continue
    return f"EMP-{max_seq + 1:06d}"


def _find_recruit_staging_department(session: Session) -> OrgDepartment:
    department = session.exec(
        select(OrgDepartment).where(OrgDepartment.code == "HQ-HR"),
    ).first()
    if department is None:
        department = session.exec(
            select(OrgDepartment)
            .where(OrgDepartment.is_active == True)  # noqa: E712
            .order_by(OrgDepartment.id),
        ).first()
    if department is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="사원 생성에 사용할 기본 부서를 찾을 수 없습니다.",
        )
    return department


def _next_login_id_from_employee_no(session: Session, employee_no: str) -> str:
    base = employee_no.lower().replace("-", "")
    candidate = base[:50]
    suffix = 1

    while session.exec(select(AuthUser.id).where(AuthUser.login_id == candidate)).first() is not None:
        suffix += 1
        suffix_text = str(suffix)
        candidate = f"{base[: max(1, 50 - len(suffix_text))]}{suffix_text}"

    return candidate


def _find_existing_employee_for_finalist(session: Session, finalist: HrRecruitFinalist) -> HrEmployee | None:
    if finalist.employee_no:
        employee = session.exec(
            select(HrEmployee).where(HrEmployee.employee_no == finalist.employee_no),
        ).first()
        if employee is not None:
            return employee

    if finalist.login_id:
        employee = session.exec(
            select(HrEmployee)
            .join(AuthUser, HrEmployee.user_id == AuthUser.id)
            .where(AuthUser.login_id == finalist.login_id),
        ).first()
        if employee is not None:
            return employee

    return None


def _sync_finalist_links_from_employee(
    session: Session,
    finalist: HrRecruitFinalist,
    employee: HrEmployee,
) -> tuple[str | None, bool]:
    user = session.get(AuthUser, employee.user_id)
    changed = False

    if finalist.employee_no != employee.employee_no:
        finalist.employee_no = employee.employee_no
        changed = True

    if user is not None and finalist.login_id != user.login_id:
        finalist.login_id = user.login_id
        changed = True

    if finalist.status_code == "draft":
        finalist.status_code = "ready"
        changed = True

    if changed:
        finalist.updated_at = _utc_now()
        session.add(finalist)

    return user.login_id if user is not None else None, changed


def _build_employee_email(finalist: HrRecruitFinalist) -> str | None:
    email = _strip_or_none(finalist.email)
    if email:
        try:
            return str(_EMAIL_ADAPTER.validate_python(email))
        except ValidationError:
            pass

    if finalist.login_id:
        return f"{finalist.login_id}@hr.minosek91.cloud"
    return None


def list_finalists(session: Session, *, search: str | None = None) -> list[HrRecruitFinalistItem]:
    stmt = select(HrRecruitFinalist).order_by(HrRecruitFinalist.id.desc())
    if search:
        keyword = f"%{search.strip()}%"
        stmt = stmt.where(
            HrRecruitFinalist.full_name.ilike(keyword)
            | HrRecruitFinalist.candidate_no.ilike(keyword)
            | HrRecruitFinalist.employee_no.ilike(keyword)
            | HrRecruitFinalist.login_id.ilike(keyword)
        )
    rows = session.exec(stmt).all()
    return [_build_item(row) for row in rows]


def create_finalist(session: Session, payload: HrRecruitFinalistCreateRequest) -> HrRecruitFinalistItem:
    candidate_no = _next_candidate_no(session)
    item = HrRecruitFinalist(
        candidate_no=candidate_no,
        source_type=payload.source_type,
        external_key=_strip_or_none(payload.external_key),
        full_name=payload.full_name.strip(),
        resident_no_masked=_strip_or_none(payload.resident_no_masked),
        birth_date=payload.birth_date,
        phone_mobile=_strip_or_none(payload.phone_mobile),
        email=_strip_or_none(payload.email),
        hire_type=payload.hire_type,
        career_years=payload.career_years,
        login_id=_strip_or_none(payload.login_id),
        employee_no=_strip_or_none(payload.employee_no),
        expected_join_date=payload.expected_join_date,
        status_code=payload.status_code,
        note=_strip_or_none(payload.note),
        is_active=payload.is_active,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return _build_item(item)


_STATUS_ORDER: dict[str, int] = {"draft": 0, "ready": 1, "appointed": 2}

_STATUS_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"draft", "ready"},
    "ready": {"ready", "appointed", "draft"},
    "appointed": {"appointed"},
}


def update_finalist(
    session: Session,
    finalist_id: int,
    payload: HrRecruitFinalistUpdateRequest,
) -> HrRecruitFinalistItem:
    item = session.get(HrRecruitFinalist, finalist_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="채용합격자 정보를 찾을 수 없습니다.")

    if payload.status_code is not None and payload.status_code != item.status_code:
        current = item.status_code or "draft"
        allowed = _STATUS_TRANSITIONS.get(current, set())
        if payload.status_code not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"상태 전이 불가: '{current}' → '{payload.status_code}'",
            )

    if payload.source_type is not None:
        item.source_type = payload.source_type
    if payload.external_key is not None:
        item.external_key = _strip_or_none(payload.external_key)
    if payload.full_name is not None:
        item.full_name = payload.full_name.strip()
    if payload.resident_no_masked is not None:
        item.resident_no_masked = _strip_or_none(payload.resident_no_masked)
    if payload.birth_date is not None:
        item.birth_date = payload.birth_date
    if payload.phone_mobile is not None:
        item.phone_mobile = _strip_or_none(payload.phone_mobile)
    if payload.email is not None:
        item.email = _strip_or_none(payload.email)
    if payload.hire_type is not None:
        item.hire_type = payload.hire_type
    if payload.career_years is not None:
        item.career_years = payload.career_years
    if payload.login_id is not None:
        item.login_id = _strip_or_none(payload.login_id)
    if payload.employee_no is not None:
        item.employee_no = _strip_or_none(payload.employee_no)
    if payload.expected_join_date is not None:
        item.expected_join_date = payload.expected_join_date
    if payload.status_code is not None:
        item.status_code = payload.status_code
    if payload.note is not None:
        item.note = _strip_or_none(payload.note)
    if payload.is_active is not None:
        item.is_active = payload.is_active

    item.updated_at = _utc_now()
    session.add(item)
    session.commit()
    session.refresh(item)
    return _build_item(item)


def delete_finalists(session: Session, ids: list[int]) -> int:
    rows = session.exec(select(HrRecruitFinalist).where(HrRecruitFinalist.id.in_(ids))).all()
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="삭제할 채용합격자 데이터가 없습니다.")

    for row in rows:
        session.delete(row)
    session.commit()
    return len(rows)


def sync_if_rows(session: Session, inbound_rows: list[HrRecruitIfInboundRow]) -> tuple[int, int]:
    if not inbound_rows:
        return 0, 0

    inserted_count = 0
    updated_count = 0

    for inbound in inbound_rows:
        existing = session.exec(
            select(HrRecruitFinalist).where(HrRecruitFinalist.external_key == inbound.external_key)
        ).first()
        if existing is None:
            row = HrRecruitFinalist(
                candidate_no=_next_candidate_no(session),
                source_type="if",
                external_key=inbound.external_key,
                full_name=inbound.full_name.strip(),
                phone_mobile=_strip_or_none(inbound.phone_mobile),
                email=_strip_or_none(inbound.email),
                hire_type=inbound.hire_type,
                expected_join_date=inbound.expected_join_date,
                note=_strip_or_none(inbound.note),
                status_code="draft",
                is_active=True,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
            session.add(row)
            inserted_count += 1
            continue

        existing.source_type = "if"
        existing.full_name = inbound.full_name.strip()
        existing.phone_mobile = _strip_or_none(inbound.phone_mobile)
        existing.email = _strip_or_none(inbound.email)
        existing.hire_type = inbound.hire_type
        existing.expected_join_date = inbound.expected_join_date
        existing.note = _strip_or_none(inbound.note)
        existing.updated_at = _utc_now()
        session.add(existing)
        updated_count += 1

    session.commit()
    return inserted_count, updated_count


def generate_employee_numbers(session: Session, ids: list[int]) -> tuple[int, int]:
    rows = session.exec(
        select(HrRecruitFinalist).where(HrRecruitFinalist.id.in_(ids)).order_by(HrRecruitFinalist.id)
    ).all()
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="대상 채용합격자 데이터가 없습니다.")

    # 번호가 필요한 행만 먼저 분리
    needs_no = [r for r in rows if not r.employee_no]
    skipped_count = len(rows) - len(needs_no)

    if needs_no:
        # 루프 전에 기준 시퀀스를 한 번만 계산 → 배치 내 중복 방지
        base_no = _next_employee_no(session)
        base_seq = int(base_no.replace("EMP-", ""))

        for offset, row in enumerate(needs_no):
            row.employee_no = f"EMP-{base_seq + offset:06d}"
            if not row.login_id:
                row.login_id = row.employee_no.lower().replace("-", "")
            if row.status_code == "draft":
                row.status_code = "ready"
            row.updated_at = _utc_now()
            session.add(row)

    session.commit()
    return len(needs_no), skipped_count


def create_employees_from_finalists(
    session: Session,
    ids: list[int],
) -> HrRecruitCreateEmployeesResponse:
    finalists = session.exec(
        select(HrRecruitFinalist)
        .where(HrRecruitFinalist.id.in_(ids))
        .order_by(HrRecruitFinalist.id),
    ).all()
    if not finalists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="대상 채용합격자 데이터가 없습니다.")

    staging_department = _find_recruit_staging_department(session)
    results: list[HrRecruitCreateEmployeesResult] = []
    created_count = 0
    skipped_count = 0
    error_count = 0

    base_seq = int(_next_employee_no(session).replace("EMP-", ""))
    next_seq = base_seq

    for finalist in finalists:
        try:
            if not finalist.employee_no:
                finalist.employee_no = f"EMP-{next_seq:06d}"
                next_seq += 1

            if not finalist.login_id:
                finalist.login_id = _next_login_id_from_employee_no(session, finalist.employee_no)

            existing_employee = _find_existing_employee_for_finalist(session, finalist)
            if existing_employee is not None:
                login_id, changed = _sync_finalist_links_from_employee(session, finalist, existing_employee)
                if changed:
                    session.commit()
                    session.refresh(finalist)

                skipped_count += 1
                results.append(
                    HrRecruitCreateEmployeesResult(
                        finalist_id=finalist.id or 0,
                        candidate_no=finalist.candidate_no,
                        full_name=finalist.full_name,
                        outcome="skipped",
                        detail="이미 생성된 사원과 연결되어 있어 건너뛰었습니다.",
                        employee_id=existing_employee.id,
                        employee_no=existing_employee.employee_no,
                        login_id=login_id,
                    )
                )
                continue

            temp_password = _generate_temp_password()
            employee_item = create_employee_no_commit(
                session,
                EmployeeCreateRequest(
                    employee_no=finalist.employee_no,
                    display_name=finalist.full_name.strip(),
                    department_id=staging_department.id or 0,
                    position_title="채용대기",
                    hire_date=finalist.expected_join_date or date.today(),
                    employment_status="leave",
                    login_id=finalist.login_id,
                    email=_build_employee_email(finalist),
                    password=temp_password,
                ),
            )

            # 합격자 데이터로 인사기본 프로필 자동 생성 (birth_date, resident_no_masked)
            _ensure_basic_profile_from_finalist(session, employee_item.id or 0, finalist)

            if finalist.status_code == "draft":
                finalist.status_code = "ready"
            finalist.employee_no = employee_item.employee_no
            finalist.login_id = employee_item.login_id
            finalist.updated_at = _utc_now()
            session.add(finalist)
            session.commit()
            session.refresh(finalist)

            created_count += 1
            results.append(
                HrRecruitCreateEmployeesResult(
                    finalist_id=finalist.id or 0,
                    candidate_no=finalist.candidate_no,
                    full_name=finalist.full_name,
                    outcome="created",
                    detail="사원 생성이 완료되었습니다. 발령 전까지 채용대기 상태로 유지됩니다.",
                    employee_id=employee_item.id,
                    employee_no=employee_item.employee_no,
                    login_id=employee_item.login_id,
                )
            )
        except HTTPException as error:
            session.rollback()
            error_count += 1
            results.append(
                HrRecruitCreateEmployeesResult(
                    finalist_id=finalist.id or 0,
                    candidate_no=finalist.candidate_no,
                    full_name=finalist.full_name,
                    outcome="error",
                    detail=str(error.detail),
                    employee_no=finalist.employee_no,
                    login_id=finalist.login_id,
                )
            )

    return HrRecruitCreateEmployeesResponse(
        created_count=created_count,
        skipped_count=skipped_count,
        error_count=error_count,
        results=results,
    )
