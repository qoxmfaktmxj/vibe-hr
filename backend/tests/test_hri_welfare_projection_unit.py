from __future__ import annotations

from datetime import datetime

from sqlmodel import Session, SQLModel, create_engine, select

from app.models import (
    AuthUser,
    HrEmployee,
    HriFormType,
    HriRequestMaster,
    OrgDepartment,
    WelBenefitRequest,
    WelBenefitType,
)
from app.services.hri_request_service import _sync_domain_projection


def test_sync_domain_projection_upserts_welfare_request_status_transitions() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(
        engine,
        tables=[
            AuthUser.__table__,
            OrgDepartment.__table__,
            HrEmployee.__table__,
            HriFormType.__table__,
            HriRequestMaster.__table__,
            WelBenefitType.__table__,
            WelBenefitRequest.__table__,
        ],
    )

    with Session(engine) as session:
        session.add(
            AuthUser(
                id=1,
                login_id="admin",
                email="admin@example.com",
                password_hash="x",
                display_name="관리자",
            )
        )
        session.add(OrgDepartment(id=10, code="HR", name="인사팀"))
        session.add(
            HrEmployee(
                id=100,
                user_id=1,
                employee_no="HR-0001",
                department_id=10,
                position_title="Manager",
                hire_date=datetime(2024, 1, 1).date(),
                employment_status="active",
            )
        )
        session.add(
            HriFormType(
                id=5,
                form_code="WEL_BENEFIT_REQUEST",
                form_name_ko="Welfare benefit request",
                module_code="WEL",
                is_active=True,
                allow_draft=True,
                allow_withdraw=True,
                requires_receive=True,
                default_priority=35,
            )
        )
        session.add(
            WelBenefitType(
                id=7,
                code="SCHOLARSHIP",
                name="학자금",
                module_path="/wel/scholarship",
                is_deduction=False,
                pay_item_code="P100",
                is_active=True,
                sort_order=10,
            )
        )
        request = HriRequestMaster(
            id=50,
            request_no="HRI-TEST-0001",
            form_type_id=5,
            requester_id=1,
            requester_org_id=10,
            title="학자금 지원 신청",
            content_json='{"benefit_type_code":"SCHOLARSHIP","requested_amount":250000,"description":"1학기 등록금","reason":"자녀 학자금"}',
            status_code="DRAFT",
            created_at=datetime(2026, 3, 13, 9, 0),
            updated_at=datetime(2026, 3, 13, 9, 0),
        )
        session.add(request)
        session.commit()

        _sync_domain_projection(session, request)
        session.commit()

        row = session.exec(
            select(WelBenefitRequest).where(WelBenefitRequest.request_no == "HRI-TEST-0001")
        ).one()
        assert row.status_code == "draft"
        assert row.requested_amount == 250000
        assert row.approved_amount is None
        assert row.employee_no == "HR-0001"
        assert row.department_name == "인사팀"
        assert row.benefit_type_name == "학자금"

        request.status_code = "RECEIVE_IN_PROGRESS"
        request.submitted_at = datetime(2026, 3, 13, 9, 30)
        request.updated_at = datetime(2026, 3, 13, 9, 40)
        session.add(request)
        _sync_domain_projection(session, request)
        session.commit()

        row = session.exec(
            select(WelBenefitRequest).where(WelBenefitRequest.request_no == "HRI-TEST-0001")
        ).one()
        assert row.status_code == "approved"
        assert row.approved_amount == 250000
        assert row.payroll_run_label is None
        assert row.approved_at == datetime(2026, 3, 13, 9, 40)

        request.status_code = "COMPLETED"
        request.completed_at = datetime(2026, 3, 13, 10, 0)
        request.updated_at = datetime(2026, 3, 13, 10, 0)
        session.add(request)
        _sync_domain_projection(session, request)
        session.commit()

        row = session.exec(
            select(WelBenefitRequest).where(WelBenefitRequest.request_no == "HRI-TEST-0001")
        ).one()
        assert row.status_code == "payroll_reflected"
        assert row.approved_amount == 250000
        assert row.payroll_run_label == "2026-03 정기급여"
