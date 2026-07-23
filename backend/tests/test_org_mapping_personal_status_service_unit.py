from datetime import date, datetime, timezone

import pytest
from sqlmodel import Session, SQLModel, create_engine

import app.services.organization_mapping_service as organization_mapping_service
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
from app.services.organization_mapping_service import list_mapping_personal_status


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _create_tables(engine) -> None:
    SQLModel.metadata.create_all(
        engine,
        tables=[
            AppCodeGroup.__table__,
            AppCode.__table__,
            AuthUser.__table__,
            OrgDepartment.__table__,
            OrgMappingTypeItem.__table__,
            OrgMappingAssignment.__table__,
            HrEmployee.__table__,
            HrPersonnelHistory.__table__,
        ],
    )


def _seed_department(session: Session, code: str, name: str | None = None) -> OrgDepartment:
    department = OrgDepartment(
        code=code,
        name=name or code,
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(department)
    session.commit()
    session.refresh(department)
    return department


def _seed_type_group(session: Session) -> None:
    group = AppCodeGroup(
        code="ORG_MAPPING_TYPE",
        name="Organization Mapping Type",
        is_active=True,
        sort_order=0,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(group)
    session.commit()
    session.refresh(group)

    for sort_order, (code, name, is_active) in enumerate(
        (
            ("COST", "원가센터", True),
            ("REGION", "지역", True),
            ("LEVEL", "직급", True),
            ("IGNORED", "무시", False),
        ),
        start=1,
    ):
        session.add(
            AppCode(
                group_id=int(group.id),
                code=code,
                name=name,
                is_active=is_active,
                sort_order=sort_order,
                created_at=_now(),
                updated_at=_now(),
            )
        )
    session.commit()


def _seed_employee(
    session: Session,
    *,
    employee_no: str,
    user_login_id: str,
    user_display_name: str,
    department_id: int,
    hire_date: date,
    employment_status: str,
    position_title: str = "사원",
) -> HrEmployee:
    user = AuthUser(
        login_id=user_login_id,
        email=f"{user_login_id}@example.com",
        password_hash="hashed",
        display_name=user_display_name,
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    employee = HrEmployee(
        user_id=int(user.id),
        employee_no=employee_no,
        department_id=department_id,
        position_title=position_title,
        hire_date=hire_date,
        employment_status=employment_status,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return employee


def _seed_history(
    session: Session,
    *,
    employee_id: int,
    effective_date: date,
    field_name: str,
    before_value: str | None,
    after_value: str | None,
) -> None:
    session.add(
        HrPersonnelHistory(
            employee_id=employee_id,
            history_type="update",
            source_table="hr_employees",
            source_id=employee_id,
            appointment_order_id=None,
            effective_date=effective_date,
            field_name=field_name,
            before_value=before_value,
            after_value=after_value,
            description=None,
            created_by=None,
            created_at=_now(),
        )
    )
    session.commit()


def _seed_mapping_item(
    session: Session,
    *,
    type_code: str,
    item_code: str,
    name: str,
    effective_from: date,
) -> OrgMappingTypeItem:
    item = OrgMappingTypeItem(
        type_code=type_code,
        item_code=item_code,
        name=name,
        effective_from=effective_from,
        effective_to=None,
        erp_employee_code=None,
        cost_center_type=None,
        remark=None,
        sort_order=1,
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def _seed_assignment(
    session: Session,
    *,
    department_id: int,
    item: OrgMappingTypeItem,
    effective_from: date,
) -> None:
    session.add(
        OrgMappingAssignment(
            department_id=department_id,
            type_code=item.type_code,
            item_id=int(item.id),
            effective_from=effective_from,
            effective_to=None,
            created_by=None,
            updated_by=None,
            created_at=_now(),
            updated_at=_now(),
        )
    )
    session.commit()


def test_status_rewinds_future_personnel_history_and_filters_active_snapshot() -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        _seed_type_group(session)
        dept_before = _seed_department(session, "D-10", "부서10")
        dept_after = _seed_department(session, "D-20", "부서20")
        dept_before_id = int(dept_before.id)
        dept_after_id = int(dept_after.id)
        employee = _seed_employee(
            session,
            employee_no="E-001",
            user_login_id="e001",
            user_display_name="홍길동",
            department_id=dept_after_id,
            hire_date=date(2026, 1, 1),
            employment_status="leave",
            position_title="대리",
        )
        excluded_employee_no = "E-002"
        excluded = _seed_employee(
            session,
            employee_no="E-002",
            user_login_id="e002",
            user_display_name="김철수",
            department_id=dept_before_id,
            hire_date=date(2026, 8, 1),
            employment_status="active",
            position_title="사원",
        )
        employee_id = int(employee.id)
        _seed_history(
            session,
            employee_id=employee_id,
            effective_date=date(2026, 8, 1),
            field_name="department_id",
            before_value=str(dept_before_id),
            after_value=str(dept_after_id),
        )
        _seed_history(
            session,
            employee_id=employee_id,
            effective_date=date(2026, 8, 1),
            field_name="employment_status",
            before_value="active",
            after_value="leave",
        )

        cost_item = _seed_mapping_item(
            session,
            type_code="COST",
            item_code="CC-100",
            name="원가센터 A",
            effective_from=date(2026, 1, 1),
        )
        region_item = _seed_mapping_item(
            session,
            type_code="REGION",
            item_code="RG-100",
            name="서울",
            effective_from=date(2026, 1, 1),
        )
        _seed_assignment(
            session,
            department_id=dept_before_id,
            item=cost_item,
            effective_from=date(2026, 1, 1),
        )
        _seed_assignment(
            session,
            department_id=dept_before_id,
            item=region_item,
            effective_from=date(2026, 1, 1),
        )

        response = list_mapping_personal_status(
            session,
            reference_date=date(2026, 7, 31),
            page=1,
            limit=100,
        )

    assert response.total_count == 1
    assert response.page == 1
    assert response.limit == 100
    assert [column.type_code for column in response.type_columns] == ["COST", "REGION", "LEVEL"]
    assert response.items[0].employee_no == "E-001"
    assert response.items[0].department_id == dept_before_id
    assert response.items[0].department_code == "D-10"
    assert response.items[0].mappings["COST"].item_code == "CC-100"
    assert response.items[0].mappings["REGION"].item_code == "RG-100"
    assert response.items[0].mappings["LEVEL"].item_code == ""
    assert excluded_employee_no == "E-002"


def test_status_excludes_hired_after_reference_and_pages_distinct_employee_ids() -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        _seed_type_group(session)
        dept_one = _seed_department(session, "D-10", "부서10")
        dept_two = _seed_department(session, "D-20", "부서20")
        dept_one_id = int(dept_one.id)
        dept_two_id = int(dept_two.id)
        employee_one = _seed_employee(
            session,
            employee_no="E-001",
            user_login_id="e001",
            user_display_name="홍길동",
            department_id=dept_one_id,
            hire_date=date(2026, 1, 1),
            employment_status="active",
            position_title="대리",
        )
        employee_two = _seed_employee(
            session,
            employee_no="E-002",
            user_login_id="e002",
            user_display_name="김철수",
            department_id=dept_two_id,
            hire_date=date(2026, 2, 1),
            employment_status="active",
            position_title="과장",
        )
        employee_three_no = "E-003"
        employee_three = _seed_employee(
            session,
            employee_no="E-003",
            user_login_id="e003",
            user_display_name="이영희",
            department_id=dept_one_id,
            hire_date=date(2026, 8, 1),
            employment_status="active",
            position_title="사원",
        )
        employee_one_id = int(employee_one.id)
        employee_two_id = int(employee_two.id)
        cost_item = _seed_mapping_item(
            session,
            type_code="COST",
            item_code="CC-200",
            name="원가센터 B",
            effective_from=date(2026, 1, 1),
        )
        _seed_assignment(
            session,
            department_id=dept_one_id,
            item=cost_item,
            effective_from=date(2026, 1, 1),
        )

        response = list_mapping_personal_status(
            session,
            reference_date=date(2026, 7, 31),
            page=1,
            limit=1,
        )

    assert response.total_count == 2
    assert len(response.items) == 1
    assert len({row.employee_id for row in response.items}) == 1
    assert response.items[0].employee_id in {employee_one_id, employee_two_id}
    assert employee_three_no == "E-003"


def test_status_scans_chunks_before_loading_only_requested_page_ids(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite://")
    _create_tables(engine)

    with Session(engine) as session:
        _seed_type_group(session)
        department = _seed_department(session, "D-10", "부서10")
        department_id = int(department.id)
        cost_item = _seed_mapping_item(
            session,
            type_code="COST",
            item_code="CC-300",
            name="원가센터 C",
            effective_from=date(2026, 1, 1),
        )
        _seed_assignment(
            session,
            department_id=department_id,
            item=cost_item,
            effective_from=date(2026, 1, 1),
        )

        active_ids: list[int] = []
        for index in range(5):
            employee = _seed_employee(
                session,
                employee_no=f"E-10{index}",
                user_login_id=f"e10{index}",
                user_display_name=f"직원{index}",
                department_id=department_id,
                hire_date=date(2026, 1, 1),
                employment_status="leave" if index < 2 else "active",
                position_title="사원",
            )
            employee_id = int(employee.id)
            if index < 2:
                _seed_history(
                    session,
                    employee_id=employee_id,
                    effective_date=date(2026, 8, 1),
                    field_name="employment_status",
                    before_value="active",
                    after_value="leave",
                )
                active_ids.append(employee_id)
            elif index == 2:
                active_ids.append(employee_id)
            else:
                _seed_history(
                    session,
                    employee_id=employee_id,
                    effective_date=date(2026, 8, 1),
                    field_name="employment_status",
                    before_value="leave",
                    after_value="active",
                )

        monkeypatch.setattr(organization_mapping_service, "_PERSONAL_STATUS_CHUNK_SIZE", 2)

        captured_page_ids: list[list[int]] = []
        original_loader = organization_mapping_service._load_personal_status_page_rows

        def _capture_page_rows(*args, **kwargs):
            captured_page_ids.append(list(kwargs["employee_ids"]))
            return original_loader(*args, **kwargs)

        monkeypatch.setattr(
            organization_mapping_service,
            "_load_personal_status_page_rows",
            _capture_page_rows,
        )

        response = organization_mapping_service.list_mapping_personal_status(
            session,
            reference_date=date(2026, 7, 31),
            page=1,
            limit=2,
        )

    assert response.total_count == 3
    assert [row.employee_id for row in response.items] == active_ids[:2]
    assert captured_page_ids == [active_ids[:2]]
