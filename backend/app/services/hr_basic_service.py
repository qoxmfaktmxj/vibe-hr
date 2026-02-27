from __future__ import annotations

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import (
    AuthUser,
    HrCareer,
    HrContactPoint,
    HrEmployee,
    HrEmployeeBasicProfile,
    HrEmployeeInfoRecord,
    HrLicense,
    HrMilitary,
    HrRewardPunish,
    OrgDepartment,
)
from app.schemas.hr_basic import (
    HrAdminRecordItem,
    HrAdminRecordListResponse,
    HrBasicDetailResponse,
    HrBasicProfile,
    HrBasicProfileUpdateRequest,
    HrBasicRecordCreateRequest,
    HrBasicRecordItem,
    HrBasicRecordUpdateRequest,
)

CATEGORY_ALIAS_MAP = {
    "appointment": "appointment",
    "reward_punish": "reward_punish",
    "reward_penalty": "reward_punish",
    "contact_points": "contact_points",
    "address": "contact_points",
    "contact": "contact_points",
    "education": "education",
    "careers": "careers",
    "career": "careers",
    "licenses": "licenses",
    "certificate": "licenses",
    "military": "military",
    "evaluation": "evaluation",
}

LEGACY_RECORD_CATEGORIES = {"appointment", "education", "evaluation"}
ALLOWED_CATEGORIES = set(CATEGORY_ALIAS_MAP.keys())


def normalize_category(category: str, *, strict: bool = True) -> str:
    normalized = CATEGORY_ALIAS_MAP.get(category.strip().lower())
    if normalized is not None:
        return normalized
    if strict:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category.")
    return category.strip().lower()


def normalize_reward_punish_type(raw: str | None) -> str:
    value = (raw or "REWARD").strip().upper()
    if value.startswith(("PUN", "DIS")) or "징계" in value or "벌" in value:
        return "PUNISH"
    return "REWARD"


def _get_employee_row(session: Session, employee_id: int):
    row = session.exec(
        select(HrEmployee, AuthUser, OrgDepartment)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrEmployee.id == employee_id)
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
    return row


def _to_record(item: HrEmployeeInfoRecord) -> HrBasicRecordItem:
    return HrBasicRecordItem(
        id=item.id,
        category=normalize_category(item.category, strict=False),
        record_date=item.record_date,
        title=item.title,
        type=item.type,
        organization=item.organization,
        value=item.value,
        note=item.note,
        created_at=item.created_at,
    )


def _to_contact_record(item: HrContactPoint) -> HrBasicRecordItem:
    return HrBasicRecordItem(
        id=item.id,
        category="contact_points",
        record_date=item.record_date or item.valid_from,
        title=item.contact_type,
        type=item.phone_mobile or item.phone_home or item.phone_work,
        organization=item.email,
        value=item.addr1,
        note=item.note,
        created_at=item.created_at,
    )


def _to_career_record(item: HrCareer) -> HrBasicRecordItem:
    return HrBasicRecordItem(
        id=item.id,
        category="careers",
        record_date=item.record_date or item.start_date,
        title=item.company_name,
        type=item.career_scope,
        organization=item.department_name,
        value=item.position_title or item.job_title,
        note=item.note,
        created_at=item.created_at,
    )


def _to_license_record(item: HrLicense) -> HrBasicRecordItem:
    return HrBasicRecordItem(
        id=item.id,
        category="licenses",
        record_date=item.record_date or item.issued_date,
        title=item.license_name,
        type=item.license_type,
        organization=item.issued_org,
        value=item.license_no,
        note=item.note,
        created_at=item.created_at,
    )


def _to_military_record(item: HrMilitary) -> HrBasicRecordItem:
    return HrBasicRecordItem(
        id=item.id,
        category="military",
        record_date=item.record_date or item.service_start_date,
        title=item.military_type,
        type=item.branch,
        organization=item.rank,
        value=item.discharge_type,
        note=item.note,
        created_at=item.created_at,
    )


def _to_reward_record(item: HrRewardPunish) -> HrBasicRecordItem:
    return HrBasicRecordItem(
        id=item.id,
        category="reward_punish",
        record_date=item.action_date,
        title=item.title,
        type=item.reward_punish_type,
        organization=item.office_name,
        value=item.reason,
        note=item.note,
        created_at=item.created_at,
    )


def get_hr_basic_detail(session: Session, employee_id: int) -> HrBasicDetailResponse:
    employee, user, department = _get_employee_row(session, employee_id)
    extra = session.exec(select(HrEmployeeBasicProfile).where(HrEmployeeBasicProfile.employee_id == employee.id)).first()

    profile = HrBasicProfile(
        employee_id=employee.id,
        employee_no=employee.employee_no,
        full_name=user.display_name,
        gender=extra.gender if extra else None,
        resident_no_masked=extra.resident_no_masked if extra else None,
        birth_date=extra.birth_date if extra else None,
        hire_date=employee.hire_date,
        retire_date=extra.retire_date if extra else None,
        blood_type=extra.blood_type if extra else None,
        marital_status=extra.marital_status if extra else None,
        mbti=extra.mbti if extra else None,
        probation_end_date=extra.probation_end_date if extra else None,
        department_name=department.name,
        position_title=employee.position_title,
        job_family=extra.job_family if extra else None,
        job_role=extra.job_role if extra else employee.position_title,
        grade=extra.grade if extra else None,
    )

    legacy_records = session.exec(
        select(HrEmployeeInfoRecord)
        .where(HrEmployeeInfoRecord.employee_id == employee.id)
        .order_by(HrEmployeeInfoRecord.record_date.desc(), HrEmployeeInfoRecord.id.desc())
    ).all()

    contacts = session.exec(
        select(HrContactPoint)
        .where(HrContactPoint.employee_id == employee.id)
        .order_by(HrContactPoint.record_date.desc(), HrContactPoint.id.desc())
    ).all()
    careers = session.exec(
        select(HrCareer)
        .where(HrCareer.employee_id == employee.id)
        .order_by(HrCareer.record_date.desc(), HrCareer.id.desc())
    ).all()
    licenses = session.exec(
        select(HrLicense)
        .where(HrLicense.employee_id == employee.id)
        .order_by(HrLicense.record_date.desc(), HrLicense.id.desc())
    ).all()
    military = session.exec(
        select(HrMilitary)
        .where(HrMilitary.employee_id == employee.id)
        .order_by(HrMilitary.record_date.desc(), HrMilitary.id.desc())
    ).all()
    rewards = session.exec(
        select(HrRewardPunish)
        .where(HrRewardPunish.employee_id == employee.id)
        .order_by(HrRewardPunish.action_date.desc(), HrRewardPunish.id.desc())
    ).all()

    def map_legacy(category: str) -> list[HrBasicRecordItem]:
        return [
            _to_record(item)
            for item in legacy_records
            if normalize_category(item.category, strict=False) == category
        ]

    return HrBasicDetailResponse(
        profile=profile,
        appointments=map_legacy("appointment"),
        rewards_penalties=[_to_reward_record(item) for item in rewards],
        contacts=[_to_contact_record(item) for item in contacts],
        educations=map_legacy("education"),
        careers=[_to_career_record(item) for item in careers],
        certificates=[_to_license_record(item) for item in licenses],
        military=[_to_military_record(item) for item in military],
        evaluations=map_legacy("evaluation"),
    )


def update_hr_basic_profile(session: Session, employee_id: int, payload: HrBasicProfileUpdateRequest) -> HrBasicProfile:
    employee, user, department = _get_employee_row(session, employee_id)
    extra = session.exec(select(HrEmployeeBasicProfile).where(HrEmployeeBasicProfile.employee_id == employee.id)).first()
    if extra is None:
        extra = HrEmployeeBasicProfile(employee_id=employee.id)
        session.add(extra)
        session.flush()

    if payload.full_name is not None:
        user.display_name = payload.full_name
    if payload.hire_date is not None:
        employee.hire_date = payload.hire_date
    if payload.position_title is not None:
        employee.position_title = payload.position_title

    for field in ["gender", "resident_no_masked", "birth_date", "retire_date", "blood_type", "marital_status", "mbti", "probation_end_date", "job_family", "job_role", "grade"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(extra, field, value)

    session.add(user)
    session.add(employee)
    session.add(extra)
    session.commit()

    return HrBasicProfile(
        employee_id=employee.id,
        employee_no=employee.employee_no,
        full_name=user.display_name,
        gender=extra.gender,
        resident_no_masked=extra.resident_no_masked,
        birth_date=extra.birth_date,
        hire_date=employee.hire_date,
        retire_date=extra.retire_date,
        blood_type=extra.blood_type,
        marital_status=extra.marital_status,
        mbti=extra.mbti,
        probation_end_date=extra.probation_end_date,
        department_name=department.name,
        position_title=employee.position_title,
        job_family=extra.job_family,
        job_role=extra.job_role,
        grade=extra.grade,
    )


def _create_legacy_record(session: Session, employee_id: int, payload: HrBasicRecordCreateRequest, category: str) -> HrBasicRecordItem:
    row = HrEmployeeInfoRecord(
        employee_id=employee_id,
        category=category,
        record_date=payload.record_date,
        title=payload.title,
        type=payload.type,
        organization=payload.organization,
        value=payload.value,
        note=payload.note,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _to_record(row)


def create_hr_basic_record(session: Session, employee_id: int, payload: HrBasicRecordCreateRequest) -> HrBasicRecordItem:
    _get_employee_row(session, employee_id)
    category = normalize_category(payload.category)

    if category in LEGACY_RECORD_CATEGORIES:
        return _create_legacy_record(session, employee_id, payload, category)

    if category == "contact_points":
        row = HrContactPoint(
            employee_id=employee_id,
            contact_type=payload.title,
            phone_mobile=payload.type,
            email=payload.organization,
            addr1=payload.value,
            note=payload.note,
            record_date=payload.record_date,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_contact_record(row)

    if category == "careers":
        scope = (payload.type or "EXTERNAL").upper()
        row = HrCareer(
            employee_id=employee_id,
            career_scope="INTERNAL" if scope.startswith("IN") or "사내" in scope else "EXTERNAL",
            company_name=payload.title,
            department_name=payload.organization,
            position_title=payload.value,
            note=payload.note,
            record_date=payload.record_date,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_career_record(row)

    if category == "licenses":
        row = HrLicense(
            employee_id=employee_id,
            license_name=payload.title,
            license_type=payload.type,
            issued_org=payload.organization,
            license_no=payload.value,
            note=payload.note,
            record_date=payload.record_date,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_license_record(row)

    if category == "military":
        row = HrMilitary(
            employee_id=employee_id,
            military_type=payload.title,
            branch=payload.type,
            rank=payload.organization,
            discharge_type=payload.value,
            note=payload.note,
            record_date=payload.record_date,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_military_record(row)

    if category == "reward_punish":
        row = HrRewardPunish(
            employee_id=employee_id,
            reward_punish_type=normalize_reward_punish_type(payload.type),
            title=payload.title,
            office_name=payload.organization,
            reason=payload.value,
            note=payload.note,
            action_date=payload.record_date,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_reward_record(row)

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category.")


def update_hr_basic_record(
    session: Session,
    employee_id: int,
    record_id: int,
    payload: HrBasicRecordUpdateRequest,
    *,
    category: str,
) -> HrBasicRecordItem:
    normalized = normalize_category(category)

    if normalized in LEGACY_RECORD_CATEGORIES:
        row = session.get(HrEmployeeInfoRecord, record_id)
        if row is None or row.employee_id != employee_id or normalize_category(row.category, strict=False) != normalized:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found.")
        for field in ["record_date", "title", "type", "organization", "value", "note"]:
            value = getattr(payload, field)
            if value is not None:
                setattr(row, field, value)
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_record(row)

    if normalized == "contact_points":
        row = session.get(HrContactPoint, record_id)
        if row is None or row.employee_id != employee_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found.")
        if payload.record_date is not None:
            row.record_date = payload.record_date
        if payload.title is not None:
            row.contact_type = payload.title
        if payload.type is not None:
            row.phone_mobile = payload.type
        if payload.organization is not None:
            row.email = payload.organization
        if payload.value is not None:
            row.addr1 = payload.value
        if payload.note is not None:
            row.note = payload.note
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_contact_record(row)

    if normalized == "careers":
        row = session.get(HrCareer, record_id)
        if row is None or row.employee_id != employee_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found.")
        if payload.record_date is not None:
            row.record_date = payload.record_date
        if payload.title is not None:
            row.company_name = payload.title
        if payload.type is not None:
            scope = payload.type.upper()
            row.career_scope = "INTERNAL" if scope.startswith("IN") or "사내" in scope else "EXTERNAL"
        if payload.organization is not None:
            row.department_name = payload.organization
        if payload.value is not None:
            row.position_title = payload.value
        if payload.note is not None:
            row.note = payload.note
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_career_record(row)

    if normalized == "licenses":
        row = session.get(HrLicense, record_id)
        if row is None or row.employee_id != employee_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found.")
        if payload.record_date is not None:
            row.record_date = payload.record_date
        if payload.title is not None:
            row.license_name = payload.title
        if payload.type is not None:
            row.license_type = payload.type
        if payload.organization is not None:
            row.issued_org = payload.organization
        if payload.value is not None:
            row.license_no = payload.value
        if payload.note is not None:
            row.note = payload.note
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_license_record(row)

    if normalized == "military":
        row = session.get(HrMilitary, record_id)
        if row is None or row.employee_id != employee_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found.")
        if payload.record_date is not None:
            row.record_date = payload.record_date
        if payload.title is not None:
            row.military_type = payload.title
        if payload.type is not None:
            row.branch = payload.type
        if payload.organization is not None:
            row.rank = payload.organization
        if payload.value is not None:
            row.discharge_type = payload.value
        if payload.note is not None:
            row.note = payload.note
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_military_record(row)

    if normalized == "reward_punish":
        row = session.get(HrRewardPunish, record_id)
        if row is None or row.employee_id != employee_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found.")
        if payload.record_date is not None:
            row.action_date = payload.record_date
        if payload.title is not None:
            row.title = payload.title
        if payload.type is not None:
            row.reward_punish_type = normalize_reward_punish_type(payload.type)
        if payload.organization is not None:
            row.office_name = payload.organization
        if payload.value is not None:
            row.reason = payload.value
        if payload.note is not None:
            row.note = payload.note
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_reward_record(row)

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category.")


def delete_hr_basic_record(session: Session, employee_id: int, record_id: int, *, category: str) -> None:
    normalized = normalize_category(category)

    if normalized in LEGACY_RECORD_CATEGORIES:
        row = session.get(HrEmployeeInfoRecord, record_id)
        if row is None or row.employee_id != employee_id or normalize_category(row.category, strict=False) != normalized:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found.")
        session.delete(row)
        session.commit()
        return

    model_map = {
        "contact_points": HrContactPoint,
        "careers": HrCareer,
        "licenses": HrLicense,
        "military": HrMilitary,
        "reward_punish": HrRewardPunish,
    }
    model = model_map.get(normalized)
    if model is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category.")

    row = session.get(model, record_id)
    if row is None or row.employee_id != employee_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found.")
    session.delete(row)
    session.commit()


def list_hr_admin_records(
    session: Session,
    *,
    category: str,
    employee_no: str | None = None,
    name: str | None = None,
    department: str | None = None,
    employment_status: str | None = None,
) -> HrAdminRecordListResponse:
    normalized = normalize_category(category)

    if normalized in LEGACY_RECORD_CATEGORIES:
        stmt = (
            select(HrEmployeeInfoRecord, HrEmployee, AuthUser, OrgDepartment)
            .join(HrEmployee, HrEmployeeInfoRecord.employee_id == HrEmployee.id)
            .join(AuthUser, HrEmployee.user_id == AuthUser.id)
            .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
            .where(HrEmployeeInfoRecord.category == normalized)
        )

        if employee_no:
            stmt = stmt.where(HrEmployee.employee_no.ilike(f"%{employee_no.strip()}%"))
        if name:
            stmt = stmt.where(AuthUser.display_name.ilike(f"%{name.strip()}%"))
        if department:
            stmt = stmt.where(OrgDepartment.name.ilike(f"%{department.strip()}%"))
        if employment_status:
            stmt = stmt.where(HrEmployee.employment_status == employment_status)

        rows = session.exec(
            stmt.order_by(HrEmployee.employee_no.asc(), HrEmployeeInfoRecord.record_date.desc(), HrEmployeeInfoRecord.id.desc())
        ).all()

        items = [
            HrAdminRecordItem(
                id=record.id,
                category=normalize_category(record.category, strict=False),
                record_date=record.record_date,
                title=record.title,
                type=record.type,
                organization=record.organization,
                value=record.value,
                note=record.note,
                created_at=record.created_at,
                employee_id=employee.id,
                employee_no=employee.employee_no,
                display_name=user.display_name,
                department_name=department_row.name,
                employment_status=employee.employment_status,
            )
            for record, employee, user, department_row in rows
        ]
        return HrAdminRecordListResponse(items=items)

    if normalized == "contact_points":
        stmt = (
            select(HrContactPoint, HrEmployee, AuthUser, OrgDepartment)
            .join(HrEmployee, HrContactPoint.employee_id == HrEmployee.id)
            .join(AuthUser, HrEmployee.user_id == AuthUser.id)
            .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        )
    elif normalized == "careers":
        stmt = (
            select(HrCareer, HrEmployee, AuthUser, OrgDepartment)
            .join(HrEmployee, HrCareer.employee_id == HrEmployee.id)
            .join(AuthUser, HrEmployee.user_id == AuthUser.id)
            .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        )
    elif normalized == "licenses":
        stmt = (
            select(HrLicense, HrEmployee, AuthUser, OrgDepartment)
            .join(HrEmployee, HrLicense.employee_id == HrEmployee.id)
            .join(AuthUser, HrEmployee.user_id == AuthUser.id)
            .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        )
    elif normalized == "military":
        stmt = (
            select(HrMilitary, HrEmployee, AuthUser, OrgDepartment)
            .join(HrEmployee, HrMilitary.employee_id == HrEmployee.id)
            .join(AuthUser, HrEmployee.user_id == AuthUser.id)
            .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        )
    elif normalized == "reward_punish":
        stmt = (
            select(HrRewardPunish, HrEmployee, AuthUser, OrgDepartment)
            .join(HrEmployee, HrRewardPunish.employee_id == HrEmployee.id)
            .join(AuthUser, HrEmployee.user_id == AuthUser.id)
            .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        )
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category.")

    if employee_no:
        stmt = stmt.where(HrEmployee.employee_no.ilike(f"%{employee_no.strip()}%"))
    if name:
        stmt = stmt.where(AuthUser.display_name.ilike(f"%{name.strip()}%"))
    if department:
        stmt = stmt.where(OrgDepartment.name.ilike(f"%{department.strip()}%"))
    if employment_status:
        stmt = stmt.where(HrEmployee.employment_status == employment_status)

    rows = session.exec(stmt.order_by(HrEmployee.employee_no.asc())).all()

    items: list[HrAdminRecordItem] = []
    for record, employee, user, department_row in rows:
        if normalized == "contact_points":
            mapped = _to_contact_record(record)
        elif normalized == "careers":
            mapped = _to_career_record(record)
        elif normalized == "licenses":
            mapped = _to_license_record(record)
        elif normalized == "military":
            mapped = _to_military_record(record)
        else:
            mapped = _to_reward_record(record)

        items.append(
            HrAdminRecordItem(
                id=mapped.id,
                category=mapped.category,
                record_date=mapped.record_date,
                title=mapped.title,
                type=mapped.type,
                organization=mapped.organization,
                value=mapped.value,
                note=mapped.note,
                created_at=mapped.created_at,
                employee_id=employee.id,
                employee_no=employee.employee_no,
                display_name=user.display_name,
                department_name=department_row.name,
                employment_status=employee.employment_status,
            )
        )

    return HrAdminRecordListResponse(items=items)
