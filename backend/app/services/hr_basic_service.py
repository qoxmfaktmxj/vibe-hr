from __future__ import annotations

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import AuthUser, HrEmployee, HrEmployeeBasicProfile, HrEmployeeInfoRecord, OrgDepartment
from app.schemas.hr_basic import HrBasicDetailResponse, HrBasicProfile, HrBasicRecordItem


def get_hr_basic_detail(session: Session, employee_id: int) -> HrBasicDetailResponse:
    row = session.exec(
        select(HrEmployee, AuthUser, OrgDepartment)
        .join(AuthUser, HrEmployee.user_id == AuthUser.id)
        .join(OrgDepartment, HrEmployee.department_id == OrgDepartment.id)
        .where(HrEmployee.id == employee_id)
    ).first()

    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")

    employee, user, department = row

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
        return [
            HrBasicRecordItem(
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
            for item in records
            if item.category == category
        ]

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
