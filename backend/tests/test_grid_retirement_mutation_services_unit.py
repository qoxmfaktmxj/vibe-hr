from __future__ import annotations

from datetime import date

from sqlmodel import SQLModel, Session, create_engine, select

from app.models import (
    AuthUser,
    HrAnnualLeave,
    HrEmployee,
    HrEmployeeBasicProfile,
    HrRetireChecklistItem,
    MngCompany,
    MngDevInquiry,
    MngDevProject,
    MngDevRequest,
    MngInfraConfig,
    MngInfraMaster,
    MngManagerCompany,
    MngOutsourceAttendance,
    MngOutsourceContract,
    OrgDepartment,
)
from app.schemas.hr_retire import (
    HrRetireCaseCancelRequest,
    HrRetireCaseChecklistUpdateRequest,
    HrRetireCaseCreateRequest,
    HrRetireChecklistCreateRequest,
)
from app.schemas.mng import (
    MngDevInquiryCreateRequest,
    MngDevInquiryUpdateRequest,
    MngDevProjectCreateRequest,
    MngDevProjectUpdateRequest,
    MngDevRequestCreateRequest,
    MngDevRequestUpdateRequest,
    MngInfraConfigUpsertRequest,
    MngInfraConfigUpsertRow,
    MngInfraMasterCreateRequest,
    MngManagerCompanyCreateRequest,
    MngOutsourceAttendanceCreateRequest,
    MngOutsourceContractCreateRequest,
    MngOutsourceContractUpdateRequest,
)
from app.services.hr_retire_service import (
    cancel_retire_case,
    confirm_retire_case,
    create_retire_case,
    create_retire_checklist_item,
    update_retire_case_check_item,
)
from app.services.mng_company_service import create_manager_company, delete_manager_companies
from app.services.mng_dev_service import (
    create_dev_inquiry,
    create_dev_project,
    create_dev_request,
    delete_dev_inquiries,
    delete_dev_projects,
    delete_dev_requests,
    update_dev_inquiry,
    update_dev_project,
    update_dev_request,
)
from app.services.mng_infra_service import (
    create_infra_master,
    delete_infra_config,
    delete_infra_masters,
    upsert_infra_configs,
)
from app.services.mng_outsource_service import (
    create_outsource_attendance,
    create_outsource_contract,
    delete_outsource_attendances,
    delete_outsource_contracts,
    update_outsource_contract,
)
from app.services.tim_leave_service import adjust_annual_leave, get_or_create_annual_leave


def _make_engine():
    return create_engine("sqlite://", connect_args={"check_same_thread": False})


def _seed_company(session: Session, *, suffix: str) -> MngCompany:
    company = MngCompany(company_code=f"GRID-{suffix}", company_name=f"Grid {suffix} 고객사")
    session.add(company)
    session.commit()
    session.refresh(company)
    return company


def _seed_employee(session: Session, *, suffix: str) -> HrEmployee:
    department = OrgDepartment(code=f"GRID-{suffix}", name=f"Grid {suffix} 부서", is_active=True)
    session.add(department)
    session.commit()
    session.refresh(department)

    user = AuthUser(
        login_id=f"grid-{suffix.lower()}",
        email=f"grid-{suffix.lower()}@vibe-hr.local",
        password_hash="hash",
        display_name=f"Grid {suffix} 사원",
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    employee = HrEmployee(
        user_id=int(user.id),
        employee_no=f"GRID-{suffix}",
        department_id=int(department.id),
        position_title="사원",
        hire_date=date(2020, 1, 1),
        employment_status="active",
    )
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return employee


def test_dev_inquiry_crud_persists_mutations() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        company = _seed_company(session, suffix="INQ")

        created = create_dev_inquiry(
            session,
            MngDevInquiryCreateRequest(company_id=int(company.id), progress_code="received", project_name="초기 문의"),
        )
        assert created.id > 0
        session.expire_all()
        assert session.get(MngDevInquiry, created.id) is not None

        updated = update_dev_inquiry(
            session,
            created.id,
            MngDevInquiryUpdateRequest(progress_code="reviewing", project_name="수정 문의"),
        )
        assert updated.progress_code == "reviewing"
        assert updated.project_name == "수정 문의"
        session.expire_all()
        persisted = session.get(MngDevInquiry, created.id)
        assert persisted is not None and persisted.progress_code == "reviewing" and persisted.project_name == "수정 문의"

        assert delete_dev_inquiries(session, [created.id]) == 1
        session.expire_all()
        assert session.get(MngDevInquiry, created.id) is None


def test_dev_project_crud_persists_mutations() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        company = _seed_company(session, suffix="PRJ")

        created = create_dev_project(
            session,
            MngDevProjectCreateRequest(project_name="초기 프로젝트", company_id=int(company.id), contract_amount=1_000),
        )
        assert created.id > 0
        session.expire_all()
        assert session.get(MngDevProject, created.id) is not None

        updated = update_dev_project(
            session,
            created.id,
            MngDevProjectUpdateRequest(contract_amount=2_000, inspection_status="completed"),
        )
        assert updated.contract_amount == 2_000
        assert updated.inspection_status == "completed"
        session.expire_all()
        persisted = session.get(MngDevProject, created.id)
        assert persisted is not None and persisted.contract_amount == 2_000 and persisted.inspection_status == "completed"

        assert delete_dev_projects(session, [created.id]) == 1
        session.expire_all()
        assert session.get(MngDevProject, created.id) is None


def test_dev_request_crud_persists_mutations() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        company = _seed_company(session, suffix="REQ")

        created = create_dev_request(
            session,
            MngDevRequestCreateRequest(
                company_id=int(company.id),
                request_ym=date(2026, 7, 1),
                status_code="received",
                actual_man_months=0.5,
            ),
        )
        assert created.id > 0
        session.expire_all()
        assert session.get(MngDevRequest, created.id) is not None

        updated = update_dev_request(
            session,
            created.id,
            MngDevRequestUpdateRequest(status_code="completed", actual_man_months=1.5),
        )
        assert updated.status_code == "completed"
        assert updated.actual_man_months == 1.5
        session.expire_all()
        persisted = session.get(MngDevRequest, created.id)
        assert persisted is not None and persisted.status_code == "completed" and persisted.actual_man_months == 1.5

        assert delete_dev_requests(session, [created.id]) == 1
        session.expire_all()
        assert session.get(MngDevRequest, created.id) is None


def test_infra_master_config_upsert_and_cleanup_persist() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        company = _seed_company(session, suffix="INFRA")

        master = create_infra_master(
            session,
            MngInfraMasterCreateRequest(company_id=int(company.id), service_type="app", env_type="test"),
        )
        assert master.id > 0
        configs = upsert_infra_configs(
            session,
            master.id,
            MngInfraConfigUpsertRequest(
                rows=[
                    MngInfraConfigUpsertRow(
                        section="test",
                        config_key="retirement_marker",
                        config_value="grid-retirement-e2e",
                        sort_order=1,
                    ),
                ],
            ),
        )
        assert len(configs) == 1
        config_id = configs[0].id
        session.expire_all()
        persisted = session.get(MngInfraConfig, config_id)
        assert persisted is not None and persisted.config_value == "grid-retirement-e2e"

        delete_infra_config(session, config_id)
        session.expire_all()
        assert session.get(MngInfraConfig, config_id) is None
        assert delete_infra_masters(session, [master.id]) == 1
        session.expire_all()
        assert session.get(MngInfraMaster, master.id) is None


def test_manager_company_mapping_create_and_delete_persist() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        employee = _seed_employee(session, suffix="MGR")
        company = _seed_company(session, suffix="MGR")

        created = create_manager_company(
            session,
            MngManagerCompanyCreateRequest(
                employee_id=int(employee.id),
                company_id=int(company.id),
                start_date=date(2026, 7, 1),
            ),
        )
        assert created.id > 0
        session.expire_all()
        assert session.get(MngManagerCompany, created.id) is not None

        assert delete_manager_companies(session, [created.id]) == 1
        session.expire_all()
        assert session.get(MngManagerCompany, created.id) is None


def test_outsource_contract_and_attendance_mutations_persist() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        employee = _seed_employee(session, suffix="OUT")

        contract = create_outsource_contract(
            session,
            MngOutsourceContractCreateRequest(
                employee_id=int(employee.id),
                start_date=date(2026, 1, 1),
                end_date=date(2026, 12, 31),
                total_leave_count=10,
            ),
        )
        assert contract.id > 0
        updated = update_outsource_contract(
            session,
            contract.id,
            MngOutsourceContractUpdateRequest(total_leave_count=12.5),
        )
        assert updated.total_leave_count == 12.5
        session.expire_all()
        persisted_contract = session.get(MngOutsourceContract, contract.id)
        assert persisted_contract is not None and persisted_contract.total_leave_count == 12.5

        attendance = create_outsource_attendance(
            session,
            MngOutsourceAttendanceCreateRequest(
                contract_id=contract.id,
                employee_id=int(employee.id),
                attendance_code="ANNUAL",
                start_date=date(2026, 7, 1),
                end_date=date(2026, 7, 1),
                apply_count=1,
            ),
        )
        assert attendance.id > 0
        session.expire_all()
        assert session.get(MngOutsourceAttendance, attendance.id) is not None

        assert delete_outsource_attendances(session, [attendance.id]) == 1
        session.expire_all()
        assert session.get(MngOutsourceAttendance, attendance.id) is None
        assert delete_outsource_contracts(session, [contract.id]) == 1
        session.expire_all()
        assert session.get(MngOutsourceContract, contract.id) is None


def test_retire_checklist_create_persists_active_code_title_and_order() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        created = create_retire_checklist_item(
            session,
            HrRetireChecklistCreateRequest(
                code="GRID-RETIRE-CHECK",
                title="Grid 퇴직 체크",
                is_active=True,
                sort_order=7,
            ),
        )
        assert created.id > 0
        assert created.code == "grid-retire-check"
        session.expire_all()
        persisted = session.get(HrRetireChecklistItem, created.id)
        assert persisted is not None
        assert (persisted.code, persisted.title, persisted.is_active, persisted.sort_order) == (
            "grid-retire-check",
            "Grid 퇴직 체크",
            True,
            7,
        )


def test_retire_case_cancellation_restores_employee_status_and_retire_date() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        employee = _seed_employee(session, suffix="RETIRE")
        checklist = create_retire_checklist_item(
            session,
            HrRetireChecklistCreateRequest(code="grid-retire-cancel", title="퇴직 취소 확인", sort_order=1),
        )
        created = create_retire_case(
            session,
            HrRetireCaseCreateRequest(employee_id=int(employee.id), retire_date=date(2026, 7, 31), reason="격리 테스트"),
            actor_user_id=int(employee.user_id),
        )
        checked = update_retire_case_check_item(
            session,
            case_id=created.id,
            case_item_id=created.checklist_items[0].id,
            payload=HrRetireCaseChecklistUpdateRequest(is_checked=True),
            actor_user_id=int(employee.user_id),
        )
        assert checked.checklist_items[0].checklist_item_id == checklist.id
        confirmed = confirm_retire_case(session, case_id=created.id, actor_user_id=int(employee.user_id))
        assert confirmed.status == "confirmed"

        cancelled = cancel_retire_case(
            session,
            case_id=created.id,
            payload=HrRetireCaseCancelRequest(cancel_reason="격리 테스트 취소"),
            actor_user_id=int(employee.user_id),
        )
        assert cancelled.status == "cancelled"
        session.expire_all()
        persisted_employee = session.get(HrEmployee, employee.id)
        profile = session.exec(
            select(HrEmployeeBasicProfile).where(HrEmployeeBasicProfile.employee_id == employee.id),
        ).first()
        assert persisted_employee is not None and persisted_employee.employment_status == "active"
        assert profile is not None and profile.retire_date is None


def test_annual_leave_adjustment_persists_once() -> None:
    engine = _make_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        employee = _seed_employee(session, suffix="LEAVE")
        original = get_or_create_annual_leave(session, int(employee.id), 2026)

        adjusted = adjust_annual_leave(
            session,
            employee_id=int(employee.id),
            year=2026,
            adjustment_days=0.5,
            reason="Grid retirement mutation test",
        )
        assert adjusted.granted_days == original.granted_days + 0.5
        assert adjusted.remaining_days == original.remaining_days + 0.5
        session.expire_all()
        persisted = session.get(HrAnnualLeave, adjusted.id)
        assert persisted is not None
        assert persisted.granted_days == original.granted_days + 0.5
        assert persisted.remaining_days == original.remaining_days + 0.5
