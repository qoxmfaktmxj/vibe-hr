from datetime import date, datetime, timezone

from sqlmodel import Session, SQLModel, create_engine

from app.models import HrEmployee, OrgDepartment
from app.schemas.organization import (
    OrganizationDepartmentCreateRequest,
    OrganizationDepartmentUpdateRequest,
)
from app.services.organization_service import create_department, list_departments, update_department


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def test_list_departments_includes_metadata_and_employee_count() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        department = OrgDepartment(
            code="HQ-HR",
            name="인사본부",
            organization_type="HEADQUARTERS",
            cost_center_code="CC-HR-001",
            description="인사 운영",
            is_active=True,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(department)
        session.commit()
        session.refresh(department)

        session.add(
            HrEmployee(
                user_id=1,
                employee_no="HR-0001",
                department_id=int(department.id),
                position_title="사원",
                hire_date=date(2026, 3, 13),
                employment_status="active",
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
        session.add(
            HrEmployee(
                user_id=2,
                employee_no="HR-0002",
                department_id=int(department.id),
                position_title="대리",
                hire_date=date(2026, 3, 13),
                employment_status="active",
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
        session.commit()

        departments, total_count = list_departments(session, cost_center_code="CC-HR")

        assert total_count == 1
        assert len(departments) == 1
        assert departments[0].organization_type == "HEADQUARTERS"
        assert departments[0].cost_center_code == "CC-HR-001"
        assert departments[0].description == "인사 운영"
        assert departments[0].employee_count == 2


def test_update_department_can_trim_and_clear_metadata_fields() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        parent = create_department(
            session,
            OrganizationDepartmentCreateRequest(
                code="OPS-ROOT",
                name="운영본부",
                organization_type="HEADQUARTERS",
                cost_center_code="CC-OPS-ROOT",
                description="운영 루트",
                is_active=True,
            ),
        )
        created = create_department(
            session,
            OrganizationDepartmentCreateRequest(
                code="OPS-001",
                name="운영1팀",
                parent_id=parent.id,
                organization_type=" TEAM ",
                cost_center_code=" CC-OPS-001 ",
                description=" 운영 1팀 ",
                is_active=True,
            ),
        )

        assert created.organization_type == "TEAM"
        assert created.cost_center_code == "CC-OPS-001"
        assert created.description == "운영 1팀"

        updated = update_department(
            session,
            created.id,
            OrganizationDepartmentUpdateRequest(
                organization_type="   ",
                cost_center_code=" ",
                description="   ",
            ),
        )

        assert updated.organization_type is None
        assert updated.cost_center_code is None
        assert updated.description is None
        assert updated.parent_id == parent.id
