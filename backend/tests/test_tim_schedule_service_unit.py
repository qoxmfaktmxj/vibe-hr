from datetime import date, datetime, timezone

from sqlmodel import Session, SQLModel, create_engine

from app.models import HrEmployee, OrgDepartment, TimDepartmentScheduleAssignment, TimSchedulePattern
from app.schemas.tim_schedule import TimDepartmentScheduleAssignmentBatchRequest, TimDepartmentScheduleAssignmentUpsertRequest
from app.services.tim_schedule_service import (
    batch_save_department_schedule_assignments,
    list_department_schedule_assignments,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def test_list_department_schedule_assignments_includes_department_metadata() -> None:
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
        pattern = TimSchedulePattern(code="PTN_STD", name="기본 주간", is_active=True)
        session.add(department)
        session.add(pattern)
        session.commit()
        session.refresh(department)
        session.refresh(pattern)

        session.add(
            TimDepartmentScheduleAssignment(
                department_id=int(department.id),
                pattern_id=int(pattern.id),
                effective_from=date(2026, 1, 1),
                effective_to=None,
                priority=100,
                is_active=True,
                created_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
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
        session.commit()

        items = list_department_schedule_assignments(session)

        assert len(items) == 1
        assert items[0].department_code == "HQ-HR"
        assert items[0].cost_center_code == "CC-HR-001"
        assert items[0].organization_type == "HEADQUARTERS"
        assert items[0].employee_count == 1
        assert items[0].pattern_name == "기본 주간"


def test_batch_save_department_schedule_assignments_supports_insert_and_delete() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        department = OrgDepartment(
            code="HQ-OPS",
            name="운영본부",
            organization_type="HEADQUARTERS",
            cost_center_code="CC-OPS-001",
            description="운영",
            is_active=True,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        pattern = TimSchedulePattern(code="PTN_STD", name="기본 주간", is_active=True)
        session.add(department)
        session.add(pattern)
        session.commit()
        session.refresh(department)
        session.refresh(pattern)

        inserted = batch_save_department_schedule_assignments(
            session,
            TimDepartmentScheduleAssignmentBatchRequest(
                items=[
                    TimDepartmentScheduleAssignmentUpsertRequest(
                        department_id=int(department.id),
                        pattern_id=int(pattern.id),
                        effective_from=date(2026, 1, 1),
                        effective_to=None,
                        priority=200,
                        is_active=True,
                    )
                ],
                delete_ids=[],
            ),
        )

        assert inserted.inserted_count == 1
        assert inserted.total_count == 1

        deleted = batch_save_department_schedule_assignments(
            session,
            TimDepartmentScheduleAssignmentBatchRequest(items=[], delete_ids=[inserted.items[0].id]),
        )

        assert deleted.deleted_count == 1
        assert deleted.total_count == 0
