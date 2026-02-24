from __future__ import annotations

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import AuthUser, HrEmployee, HrEmployeeBasicProfile, HrEmployeeInfoRecord, OrgDepartment
from app.schemas.hr_basic import (
    HrBasicDetailResponse,
    HrBasicProfile,
    HrBasicProfileUpdateRequest,
    HrBasicRecordCreateRequest,
    HrBasicRecordItem,
    HrBasicRecordUpdateRequest,
)

ALLOWED_CATEGORIES = {
    "appointment",
    "reward_penalty",
    "contact",
    "education",
    "career",
    "certificate",
    "military",
    "evaluation",
}


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
        category=item.category,
        record_date=item.record_date,
        title=item.title,
        type=item.type,
        organization=item.organization,
        value=item.value,
        note=item.note,
        created_at=item.created_at,
    )


def get_hr_basic_detail(session: Session, employee_id: int) -> HrBasicDetailResponse:
    employee, user, department = _get_employee_row(session, employee_id)

    extra = session.exec(
        select(HrEmployeeBasicProfile).where(HrEmployeeBasicProfile.employee_id == employee.id)
    ).first()

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

    records = session.exec(
        select(HrEmployeeInfoRecord)
        .where(HrEmployeeInfoRecord.employee_id == employee.id)
        .order_by(HrEmployeeInfoRecord.record_date.desc(), HrEmployeeInfoRecord.id.desc())
    ).all()

    def map_items(category: str) -> list[HrBasicRecordItem]:
        return [_to_record(item) for item in records if item.category == category]

    return HrBasicDetailResponse(
        profile=profile,
        appointments=map_items("appointment"),
        rewards_penalties=map_items("reward_penalty"),
        contacts=map_items("contact"),
        educations=map_items("education"),
        careers=map_items("career"),
        certificates=map_items("certificate"),
        military=map_items("military"),
        evaluations=map_items("evaluation"),
    )


def update_hr_basic_profile(session: Session, employee_id: int, payload: HrBasicProfileUpdateRequest) -> HrBasicProfile:
    employee, user, department = _get_employee_row(session, employee_id)
    extra = session.exec(
        select(HrEmployeeBasicProfile).where(HrEmployeeBasicProfile.employee_id == employee.id)
    ).first()
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

    for field in [
        "gender",
        "resident_no_masked",
        "birth_date",
        "retire_date",
        "blood_type",
        "marital_status",
        "mbti",
        "probation_end_date",
        "job_family",
        "job_role",
        "grade",
    ]:
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


def create_hr_basic_record(session: Session, employee_id: int, payload: HrBasicRecordCreateRequest) -> HrBasicRecordItem:
    _get_employee_row(session, employee_id)
    if payload.category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category.")

    row = HrEmployeeInfoRecord(
        employee_id=employee_id,
        category=payload.category,
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


def update_hr_basic_record(
    session: Session, employee_id: int, record_id: int, payload: HrBasicRecordUpdateRequest
) -> HrBasicRecordItem:
    row = session.get(HrEmployeeInfoRecord, record_id)
    if row is None or row.employee_id != employee_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found.")

    for field in ["record_date", "title", "type", "organization", "value", "note"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(row, field, value)

    session.add(row)
    session.commit()
    session.refresh(row)
    return _to_record(row)


def delete_hr_basic_record(session: Session, employee_id: int, record_id: int) -> None:
    row = session.get(HrEmployeeInfoRecord, record_id)
    if row is None or row.employee_id != employee_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found.")
    session.delete(row)
    session.commit()
