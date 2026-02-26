from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import CheckConstraint, Index, UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AuthUser(SQLModel, table=True):
    __tablename__ = "auth_users"

    id: Optional[int] = Field(default=None, primary_key=True)
    login_id: str = Field(index=True, unique=True, max_length=50)
    email: str = Field(index=True, unique=True, max_length=320)
    password_hash: str
    display_name: str = Field(max_length=100)
    is_active: bool = Field(default=True)
    last_login_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class AuthRole(SQLModel, table=True):
    __tablename__ = "auth_roles"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True, max_length=40)
    name: str = Field(max_length=60)
    created_at: datetime = Field(default_factory=utc_now)


class AuthUserRole(SQLModel, table=True):
    __tablename__ = "auth_user_roles"

    user_id: int = Field(foreign_key="auth_users.id", primary_key=True)
    role_id: int = Field(foreign_key="auth_roles.id", primary_key=True)
    assigned_at: datetime = Field(default_factory=utc_now)


class OrgDepartment(SQLModel, table=True):
    __tablename__ = "org_departments"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True, max_length=30)
    name: str = Field(max_length=100)
    parent_id: Optional[int] = Field(default=None, foreign_key="org_departments.id")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class HrEmployee(SQLModel, table=True):
    __tablename__ = "hr_employees"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_hr_employees_user_id"),
        UniqueConstraint("employee_no", name="uq_hr_employees_employee_no"),
        CheckConstraint(
            "employment_status IN ('active', 'leave', 'resigned')",
            name="ck_hr_employees_employment_status",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="auth_users.id")
    employee_no: str = Field(index=True, max_length=30)
    department_id: int = Field(foreign_key="org_departments.id")
    position_title: str = Field(max_length=80)
    hire_date: date
    employment_status: str = Field(default="active", max_length=20)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class HrAttendanceDaily(SQLModel, table=True):
    __tablename__ = "tim_attendance_daily"
    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "work_date",
            name="uq_hr_attendance_daily_employee_work_date",
        ),
        CheckConstraint(
            "attendance_status IN ('present', 'late', 'absent', 'leave', 'remote')",
            name="ck_hr_attendance_daily_attendance_status",
        ),
        Index("ix_tim_attendance_daily_emp_date", "employee_id", "work_date"),
        Index("ix_tim_attendance_daily_date_status", "work_date", "attendance_status"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="hr_employees.id")
    work_date: date = Field(index=True)
    check_in_at: Optional[datetime] = None
    check_out_at: Optional[datetime] = None
    attendance_status: str = Field(max_length=20)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class AppMenu(SQLModel, table=True):
    """화면/메뉴 마스터 (계층형 트리)"""

    __tablename__ = "app_menus"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True, max_length=60)
    name: str = Field(max_length=100)
    parent_id: Optional[int] = Field(default=None, foreign_key="app_menus.id")
    path: Optional[str] = Field(default=None, max_length=200)
    icon: Optional[str] = Field(default=None, max_length=60)
    sort_order: int = Field(default=0)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class AppMenuRole(SQLModel, table=True):
    """메뉴-역할 매핑 (N:M)"""

    __tablename__ = "app_menu_roles"

    menu_id: int = Field(foreign_key="app_menus.id", primary_key=True)
    role_id: int = Field(foreign_key="auth_roles.id", primary_key=True)


class AppCodeGroup(SQLModel, table=True):
    __tablename__ = "app_code_groups"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True, max_length=30)
    name: str = Field(max_length=100)
    description: Optional[str] = None
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class AppCode(SQLModel, table=True):
    __tablename__ = "app_codes"
    __table_args__ = (UniqueConstraint("group_id", "code", name="uq_app_codes_group_code"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    group_id: int = Field(foreign_key="app_code_groups.id", index=True)
    code: str = Field(max_length=30)
    name: str = Field(max_length=100)
    description: Optional[str] = None
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)
    extra_value1: Optional[str] = Field(default=None, max_length=200)
    extra_value2: Optional[str] = Field(default=None, max_length=200)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class HrEmployeeBasicProfile(SQLModel, table=True):
    __tablename__ = "hr_employee_basic_profiles"
    __table_args__ = (UniqueConstraint("employee_id", name="uq_hr_employee_basic_profiles_employee_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="hr_employees.id", index=True)
    gender: Optional[str] = Field(default=None, max_length=20)
    resident_no_masked: Optional[str] = Field(default=None, max_length=30)
    birth_date: Optional[date] = None
    retire_date: Optional[date] = None
    blood_type: Optional[str] = Field(default=None, max_length=10)
    marital_status: Optional[str] = Field(default=None, max_length=20)
    mbti: Optional[str] = Field(default=None, max_length=10)
    probation_end_date: Optional[date] = None
    job_family: Optional[str] = Field(default=None, max_length=80)
    job_role: Optional[str] = Field(default=None, max_length=80)
    grade: Optional[str] = Field(default=None, max_length=40)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class HrEmployeeInfoRecord(SQLModel, table=True):
    __tablename__ = "hr_employee_info_records"

    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="hr_employees.id", index=True)
    category: str = Field(max_length=40, index=True)
    record_date: Optional[date] = None
    title: Optional[str] = Field(default=None, max_length=120)
    type: Optional[str] = Field(default=None, max_length=80)
    organization: Optional[str] = Field(default=None, max_length=120)
    value: Optional[str] = Field(default=None, max_length=200)
    note: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=utc_now)


class HrLeaveRequest(SQLModel, table=True):
    __tablename__ = "tim_leave_requests"
    __table_args__ = (
        CheckConstraint(
            "leave_type IN ('annual', 'sick', 'half_day', 'unpaid', 'other')",
            name="ck_hr_leave_requests_leave_type",
        ),
        CheckConstraint(
            "request_status IN ('pending', 'approved', 'rejected', 'cancelled')",
            name="ck_hr_leave_requests_request_status",
        ),
        CheckConstraint("start_date <= end_date", name="ck_hr_leave_requests_date_range"),
        Index("ix_tim_leave_requests_emp_status", "employee_id", "request_status"),
        Index("ix_tim_leave_requests_dates", "start_date", "end_date"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="hr_employees.id")
    leave_type: str = Field(max_length=20)
    start_date: date
    end_date: date
    reason: Optional[str] = None
    request_status: str = Field(default="pending", max_length=20)
    approver_employee_id: Optional[int] = Field(default=None, foreign_key="hr_employees.id")
    approved_at: Optional[datetime] = None
    decision_comment: Optional[str] = Field(default=None)  # 반려/취소 처리자 코멘트 (reason 필드와 분리)
    decided_by: Optional[int] = Field(default=None, foreign_key="hr_employees.id")  # 처리자 employee_id
    decided_at: Optional[datetime] = None  # 처리 시각
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class TimAttendanceCorrection(SQLModel, table=True):
    __tablename__ = "tim_attendance_corrections"
    __table_args__ = (
        Index("ix_tim_attendance_corrections_attendance", "attendance_id", "corrected_at"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    attendance_id: int = Field(foreign_key="tim_attendance_daily.id", index=True)
    corrected_by_employee_id: int = Field(foreign_key="hr_employees.id")
    old_status: str = Field(max_length=20)
    new_status: str = Field(max_length=20)
    old_check_in_at: Optional[datetime] = None
    new_check_in_at: Optional[datetime] = None
    old_check_out_at: Optional[datetime] = None
    new_check_out_at: Optional[datetime] = None
    reason: str = Field(max_length=500)
    corrected_at: datetime = Field(default_factory=utc_now)


class HrAnnualLeave(SQLModel, table=True):
    __tablename__ = "tim_annual_leaves"
    __table_args__ = (
        UniqueConstraint("employee_id", "year", name="uq_tim_annual_leaves_emp_year"),
        Index("ix_tim_annual_leaves_emp_year", "employee_id", "year"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="hr_employees.id", index=True)
    year: int = Field(index=True)
    granted_days: float = Field(default=15.0)
    used_days: float = Field(default=0.0)
    carried_over_days: float = Field(default=0.0)
    remaining_days: float = Field(default=15.0)
    grant_type: str = Field(default="auto", max_length=20)
    note: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class TimAttendanceCode(SQLModel, table=True):
    """근태코드 마스터 (연차, 반차, 병가, 출장, 재택 등)"""

    __tablename__ = "tim_attendance_codes"
    __table_args__ = (
        UniqueConstraint("code", name="uq_tim_attendance_codes_code"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(max_length=20, index=True)
    name: str = Field(max_length=100)
    category: str = Field(max_length=20)
    unit: str = Field(default="day", max_length=20)
    is_requestable: bool = Field(default=True)
    min_days: Optional[float] = None
    max_days: Optional[float] = None
    deduct_annual: bool = Field(default=False)
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)
    description: Optional[str] = Field(default=None, max_length=200)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class TimWorkScheduleCode(SQLModel, table=True):
    """근무코드 마스터 (주간, 야간, 교대, 유연근무 등)"""

    __tablename__ = "tim_work_schedule_codes"
    __table_args__ = (
        UniqueConstraint("code", name="uq_tim_work_schedule_codes_code"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(max_length=20, index=True)
    name: str = Field(max_length=100)
    work_start: str = Field(max_length=5)
    work_end: str = Field(max_length=5)
    break_minutes: int = Field(default=60)
    is_overnight: bool = Field(default=False)
    work_hours: float = Field(default=8.0)
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)
    description: Optional[str] = Field(default=None, max_length=200)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class TimHoliday(SQLModel, table=True):
    """공휴일 마스터 (법정공휴일, 회사지정휴일, 대체휴일)"""

    __tablename__ = "tim_holidays"
    __table_args__ = (
        UniqueConstraint("holiday_date", name="uq_tim_holidays_date"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    holiday_date: date = Field(index=True)
    name: str = Field(max_length=100)
    holiday_type: str = Field(default="legal", max_length=20)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class PayPayrollCode(SQLModel, table=True):
    """급여코드 마스터 (정규급여, 정기상여 등)"""

    __tablename__ = "pay_payroll_codes"
    __table_args__ = (
        UniqueConstraint("code", name="uq_pay_payroll_codes_code"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(max_length=20, index=True)
    name: str = Field(max_length=100)
    pay_type: str = Field(max_length=20)
    payment_day: str = Field(max_length=20)
    tax_deductible: bool = Field(default=True)
    social_ins_deductible: bool = Field(default=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class PayTaxRate(SQLModel, table=True):
    """세율 및 4대보험 마스터 (매년 갱신)"""

    __tablename__ = "pay_tax_rates"
    __table_args__ = (
        UniqueConstraint("year", "rate_type", name="uq_pay_tax_rates_year_type"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    year: int = Field(index=True)
    rate_type: str = Field(max_length=50)
    employee_rate: Optional[float] = None
    employer_rate: Optional[float] = None
    min_limit: Optional[int] = None
    max_limit: Optional[int] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class PayAllowanceDeduction(SQLModel, table=True):
    """수당/공제 항목 마스터"""

    __tablename__ = "pay_allowance_deductions"
    __table_args__ = (
        UniqueConstraint("code", name="uq_pay_allowance_deductions_code"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(max_length=20, index=True)
    name: str = Field(max_length=100)
    type: str = Field(max_length=20)
    tax_type: str = Field(max_length=20)
    calculation_type: str = Field(default="fixed", max_length=20)
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class PayItemGroup(SQLModel, table=True):
    """급여항목 그룹 관리 (직군별 등)"""

    __tablename__ = "pay_item_groups"
    __table_args__ = (
        UniqueConstraint("code", name="uq_pay_item_groups_code"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(max_length=20, index=True)
    name: str = Field(max_length=100)
    description: Optional[str] = Field(default=None, max_length=200)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class PayItemGroupDetail(SQLModel, table=True):
    """급여항목 그룹별 매핑"""

    __tablename__ = "pay_item_group_details"
    __table_args__ = (
        UniqueConstraint("group_id", "item_id", name="uq_pay_item_group_details_link"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    group_id: int = Field(foreign_key="pay_item_groups.id", index=True)
    item_id: int = Field(foreign_key="pay_allowance_deductions.id")
    type: str = Field(max_length=20)
    created_at: datetime = Field(default_factory=utc_now)


class HriFormType(SQLModel, table=True):
    """Common request form type master."""

    __tablename__ = "hri_form_types"
    __table_args__ = (
        UniqueConstraint("form_code", name="uq_hri_form_types_form_code"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    form_code: str = Field(max_length=30, index=True)
    form_name_ko: str = Field(max_length=100)
    form_name_en: Optional[str] = Field(default=None, max_length=100)
    module_code: str = Field(max_length=30, default="COMMON")
    is_active: bool = Field(default=True)
    allow_draft: bool = Field(default=True)
    allow_withdraw: bool = Field(default=True)
    requires_receive: bool = Field(default=False)
    default_priority: int = Field(default=50)
    created_by: Optional[int] = Field(default=None, foreign_key="auth_users.id")
    updated_by: Optional[int] = Field(default=None, foreign_key="auth_users.id")
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class HriFormTypePolicy(SQLModel, table=True):
    """Policy key/value by form type."""

    __tablename__ = "hri_form_type_policies"
    __table_args__ = (
        UniqueConstraint(
            "form_type_id",
            "policy_key",
            "effective_from",
            name="uq_hri_form_type_policies_key_period",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    form_type_id: int = Field(foreign_key="hri_form_types.id", index=True)
    policy_key: str = Field(max_length=50)
    policy_value: str = Field(max_length=500)
    effective_from: date = Field(default_factory=date.today)
    effective_to: Optional[date] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class HriApprovalLineTemplate(SQLModel, table=True):
    """Approval line template header."""

    __tablename__ = "hri_approval_line_templates"
    __table_args__ = (
        UniqueConstraint("template_code", name="uq_hri_approval_line_templates_code"),
        CheckConstraint(
            "scope_type IN ('GLOBAL', 'COMPANY', 'DEPT', 'TEAM', 'USER')",
            name="ck_hri_approval_line_templates_scope_type",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    template_code: str = Field(max_length=30, index=True)
    template_name: str = Field(max_length=100)
    scope_type: str = Field(max_length=20, default="GLOBAL")
    scope_id: Optional[str] = Field(default=None, max_length=40, index=True)
    is_default: bool = Field(default=False)
    is_active: bool = Field(default=True)
    priority: int = Field(default=100)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class HriApprovalLineStep(SQLModel, table=True):
    """Approval line template step definition."""

    __tablename__ = "hri_approval_line_steps"
    __table_args__ = (
        UniqueConstraint("template_id", "step_order", name="uq_hri_approval_line_steps_order"),
        CheckConstraint(
            "step_type IN ('APPROVAL', 'RECEIVE', 'REFERENCE')",
            name="ck_hri_approval_line_steps_step_type",
        ),
        CheckConstraint(
            "actor_resolve_type IN ('ROLE_BASED', 'USER_FIXED')",
            name="ck_hri_approval_line_steps_actor_resolve_type",
        ),
        CheckConstraint(
            "required_action IN ('APPROVE', 'RECEIVE')",
            name="ck_hri_approval_line_steps_required_action",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    template_id: int = Field(foreign_key="hri_approval_line_templates.id", index=True)
    step_order: int = Field(default=1)
    step_type: str = Field(max_length=20, default="APPROVAL")
    actor_resolve_type: str = Field(max_length=30, default="ROLE_BASED")
    actor_role_code: Optional[str] = Field(default=None, max_length=30)
    actor_user_id: Optional[int] = Field(default=None, foreign_key="auth_users.id")
    allow_delegate: bool = Field(default=True)
    required_action: str = Field(max_length=20, default="APPROVE")
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class HriFormTypeApprovalMap(SQLModel, table=True):
    """Map form type to approval template."""

    __tablename__ = "hri_form_type_approval_maps"
    __table_args__ = (
        UniqueConstraint(
            "form_type_id",
            "template_id",
            "effective_from",
            name="uq_hri_form_type_approval_maps_link",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    form_type_id: int = Field(foreign_key="hri_form_types.id", index=True)
    template_id: int = Field(foreign_key="hri_approval_line_templates.id", index=True)
    is_active: bool = Field(default=True)
    effective_from: date = Field(default_factory=date.today)
    effective_to: Optional[date] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class HriApprovalActorRule(SQLModel, table=True):
    """Role-based actor resolution rules."""

    __tablename__ = "hri_approval_actor_rules"
    __table_args__ = (
        UniqueConstraint("role_code", name="uq_hri_approval_actor_rules_role_code"),
        CheckConstraint(
            "resolve_method IN ('ORG_CHAIN', 'JOB_POSITION', 'FIXED_USER')",
            name="ck_hri_approval_actor_rules_resolve_method",
        ),
        CheckConstraint(
            "fallback_rule IN ('ESCALATE', 'SKIP', 'HR_ADMIN')",
            name="ck_hri_approval_actor_rules_fallback_rule",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    role_code: str = Field(max_length=30, index=True)
    resolve_method: str = Field(max_length=30, default="ORG_CHAIN")
    fallback_rule: str = Field(max_length=30, default="ESCALATE")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class HriRequestMaster(SQLModel, table=True):
    """Request header transaction."""

    __tablename__ = "hri_request_masters"
    __table_args__ = (
        UniqueConstraint("request_no", name="uq_hri_request_masters_request_no"),
        CheckConstraint(
            "status_code IN ("
            "'DRAFT',"
            "'APPROVAL_IN_PROGRESS',"
            "'APPROVAL_REJECTED',"
            "'RECEIVE_IN_PROGRESS',"
            "'RECEIVE_REJECTED',"
            "'COMPLETED',"
            "'WITHDRAWN'"
            ")",
            name="ck_hri_request_masters_status_code",
        ),
        Index("ix_hri_request_masters_requester_created_at", "requester_id", "created_at"),
        Index("ix_hri_request_masters_status_created_at", "status_code", "created_at"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    request_no: str = Field(max_length=40, index=True)
    form_type_id: int = Field(foreign_key="hri_form_types.id", index=True)
    requester_id: int = Field(foreign_key="auth_users.id", index=True)
    requester_org_id: Optional[int] = Field(default=None, foreign_key="org_departments.id")
    title: str = Field(max_length=200)
    content_json: str = Field(default="{}")
    status_code: str = Field(max_length=30, default="DRAFT")
    current_step_order: Optional[int] = None
    submitted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class HriRequestStepSnapshot(SQLModel, table=True):
    """Frozen approval/receive line per request."""

    __tablename__ = "hri_request_step_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "request_id",
            "step_order",
            name="uq_hri_request_step_snapshots_request_step",
        ),
        CheckConstraint(
            "step_type IN ('APPROVAL', 'RECEIVE', 'REFERENCE')",
            name="ck_hri_request_step_snapshots_step_type",
        ),
        CheckConstraint(
            "action_status IN ('WAITING', 'APPROVED', 'REJECTED', 'RECEIVED')",
            name="ck_hri_request_step_snapshots_action_status",
        ),
        Index(
            "ix_hri_request_step_snapshots_actor_status",
            "actor_user_id",
            "action_status",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    request_id: int = Field(foreign_key="hri_request_masters.id", index=True)
    step_order: int = Field(default=1)
    step_type: str = Field(max_length=20, default="APPROVAL")
    actor_user_id: int = Field(foreign_key="auth_users.id", index=True)
    actor_name: str = Field(max_length=100)
    actor_org_id: Optional[int] = Field(default=None, foreign_key="org_departments.id")
    actor_role_code: Optional[str] = Field(default=None, max_length=30)
    action_status: str = Field(max_length=20, default="WAITING")
    acted_at: Optional[datetime] = None
    comment: Optional[str] = Field(default=None, max_length=1000)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class HriRequestHistory(SQLModel, table=True):
    """Request lifecycle audit trail."""

    __tablename__ = "hri_request_histories"
    __table_args__ = (
        Index("ix_hri_request_histories_request_created_at", "request_id", "created_at"),
        Index("ix_hri_request_histories_actor_created_at", "actor_user_id", "created_at"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    request_id: int = Field(foreign_key="hri_request_masters.id", index=True)
    event_type: str = Field(max_length=30, index=True)
    from_status: Optional[str] = Field(default=None, max_length=30)
    to_status: Optional[str] = Field(default=None, max_length=30)
    actor_user_id: int = Field(foreign_key="auth_users.id")
    actor_ip: Optional[str] = Field(default=None, max_length=45)
    event_payload_json: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)


class HriRequestAttachment(SQLModel, table=True):
    """Request attachment metadata."""

    __tablename__ = "hri_request_attachments"
    __table_args__ = (
        Index("ix_hri_request_attachments_request_uploaded_at", "request_id", "uploaded_at"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    request_id: int = Field(foreign_key="hri_request_masters.id", index=True)
    file_key: str = Field(max_length=300)
    file_name: str = Field(max_length=255)
    file_size: int = Field(default=0)
    mime_type: Optional[str] = Field(default=None, max_length=120)
    uploaded_by: int = Field(foreign_key="auth_users.id")
    uploaded_at: datetime = Field(default_factory=utc_now)


class HriRequestCounter(SQLModel, table=True):
    """Monthly sequence allocator for request number."""

    __tablename__ = "hri_request_counters"

    counter_key: str = Field(primary_key=True, max_length=80)
    last_seq: int = Field(default=0)
    updated_at: datetime = Field(default_factory=utc_now)
class HriReqTimAttendance(SQLModel, table=True):
    """근태신청 상세 (마스터 1:1)."""

    __tablename__ = "hri_req_tim_attendance"
    __table_args__ = (
        UniqueConstraint("request_id", name="uq_hri_req_tim_attendance_request_id"),
        Index("ix_hri_req_tim_attendance_dates", "start_date", "end_date"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    request_id: int = Field(foreign_key="hri_request_masters.id", index=True)
    attendance_code: str = Field(max_length=30)
    start_date: date
    end_date: date
    start_time: Optional[str] = Field(default=None, max_length=5)
    end_time: Optional[str] = Field(default=None, max_length=5)
    applied_minutes: int = Field(default=0)
    reason: Optional[str] = Field(default=None, max_length=1000)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class TimSchedulePattern(SQLModel, table=True):
    __tablename__ = "tim_schedule_patterns"
    __table_args__ = (UniqueConstraint("code", name="uq_tim_schedule_patterns_code"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(max_length=40, index=True)
    name: str = Field(max_length=120)
    description: Optional[str] = Field(default=None, max_length=255)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
class TimSchedulePatternDay(SQLModel, table=True):
    __tablename__ = "tim_schedule_pattern_days"
    __table_args__ = (
        UniqueConstraint("pattern_id", "weekday", name="uq_tim_schedule_pattern_days_pattern_weekday"),
        CheckConstraint("weekday BETWEEN 0 AND 6", name="ck_tim_schedule_pattern_days_weekday"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    pattern_id: int = Field(foreign_key="tim_schedule_patterns.id", index=True)
    weekday: int = Field(default=0)
    is_workday: bool = Field(default=True)
    start_time: Optional[str] = Field(default=None, max_length=5)
    end_time: Optional[str] = Field(default=None, max_length=5)
    break_minutes: int = Field(default=60)
    expected_minutes: int = Field(default=480)
    is_overnight: bool = Field(default=False)


class TimDepartmentScheduleAssignment(SQLModel, table=True):
    __tablename__ = "tim_department_schedule_assignments"
    __table_args__ = (
        Index("ix_tim_department_schedule_assignments_dept_date", "department_id", "effective_from", "effective_to"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    department_id: int = Field(foreign_key="org_departments.id", index=True)
    pattern_id: int = Field(foreign_key="tim_schedule_patterns.id")
    effective_from: date = Field(index=True)
    effective_to: Optional[date] = Field(default=None, index=True)
    priority: int = Field(default=100)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class TimEmployeeScheduleException(SQLModel, table=True):
    __tablename__ = "tim_employee_schedule_exceptions"
    __table_args__ = (
        Index("ix_tim_employee_schedule_exceptions_emp_date", "employee_id", "effective_from", "effective_to"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="hr_employees.id", index=True)
    pattern_id: int = Field(foreign_key="tim_schedule_patterns.id")
    effective_from: date = Field(index=True)
    effective_to: Optional[date] = Field(default=None, index=True)
    reason: Optional[str] = Field(default=None, max_length=255)
    priority: int = Field(default=1000)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
class TimEmployeeDailySchedule(SQLModel, table=True):
    __tablename__ = "tim_employee_daily_schedules"
    __table_args__ = (
        UniqueConstraint("employee_id", "work_date", name="uq_tim_employee_daily_schedules_employee_work_date"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="hr_employees.id", index=True)
    work_date: date = Field(index=True)
    schedule_source: str = Field(max_length=30, default="department_default")
    pattern_id: Optional[int] = Field(default=None, foreign_key="tim_schedule_patterns.id")
    is_holiday: bool = Field(default=False)
    holiday_name: Optional[str] = Field(default=None, max_length=120)
    is_workday: bool = Field(default=True)
    planned_start_at: Optional[datetime] = None
    planned_end_at: Optional[datetime] = None
    break_minutes: int = Field(default=60)
    expected_minutes: int = Field(default=480)
    is_overnight: bool = Field(default=False)
    generated_at: datetime = Field(default_factory=utc_now)
    version_tag: Optional[str] = Field(default=None, max_length=50)


# ──────────────────────────────────────────────────────────────────────
# MNG (관리) 모듈 — SSMS-master 마이그레이션
# ──────────────────────────────────────────────────────────────────────


class MngCompany(SQLModel, table=True):
    """고객사 마스터"""

    __tablename__ = "mng_companies"
    __table_args__ = (
        UniqueConstraint("company_code", name="uq_mng_companies_code"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    company_code: str = Field(max_length=20, index=True)
    company_name: str = Field(max_length=100)
    company_group_code: Optional[str] = Field(default=None, max_length=20)
    company_type: Optional[str] = Field(default=None, max_length=40)
    management_type: Optional[str] = Field(default=None, max_length=40)
    representative_company: Optional[str] = Field(default=None, max_length=20)
    start_date: Optional[date] = None
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class MngManagerCompany(SQLModel, table=True):
    """담당자-고객사 매핑"""

    __tablename__ = "mng_manager_companies"
    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "company_id",
            "start_date",
            name="uq_mng_manager_companies_emp_comp_sdate",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="hr_employees.id", index=True)
    company_id: int = Field(foreign_key="mng_companies.id", index=True)
    start_date: date
    end_date: Optional[date] = None
    note: Optional[str] = Field(default=None, max_length=500)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class MngDevRequest(SQLModel, table=True):
    """추가개발 요청관리"""

    __tablename__ = "mng_dev_requests"
    __table_args__ = (
        Index("ix_mng_dev_requests_company_ym", "company_id", "request_ym"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: int = Field(foreign_key="mng_companies.id", index=True)
    request_ym: date
    request_seq: int
    status_code: Optional[str] = Field(default=None, max_length=20)
    part_code: Optional[str] = Field(default=None, max_length=20)
    requester_name: Optional[str] = Field(default=None, max_length=100)
    request_content: Optional[str] = None
    manager_employee_id: Optional[int] = Field(default=None, foreign_key="hr_employees.id")
    developer_employee_id: Optional[int] = Field(default=None, foreign_key="hr_employees.id")
    is_paid: bool = Field(default=False)
    paid_content: Optional[str] = Field(default=None, max_length=500)
    has_tax_bill: bool = Field(default=False)
    start_ym: Optional[date] = None
    end_ym: Optional[date] = None
    dev_start_date: Optional[date] = None
    dev_end_date: Optional[date] = None
    paid_man_months: Optional[float] = None
    actual_man_months: Optional[float] = None
    note: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class MngDevProject(SQLModel, table=True):
    """추가개발 프로젝트관리"""

    __tablename__ = "mng_dev_projects"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_name: str = Field(max_length=200)
    company_id: int = Field(foreign_key="mng_companies.id", index=True)
    part_code: Optional[str] = Field(default=None, max_length=20)
    assigned_staff: Optional[str] = Field(default=None, max_length=200)
    contract_start_date: Optional[date] = None
    contract_end_date: Optional[date] = None
    dev_start_date: Optional[date] = None
    dev_end_date: Optional[date] = None
    inspection_status: Optional[str] = Field(default=None, max_length=20)
    has_tax_bill: bool = Field(default=False)
    actual_man_months: Optional[float] = None
    contract_amount: Optional[int] = None
    note: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class MngDevInquiry(SQLModel, table=True):
    """추가개발 문의관리"""

    __tablename__ = "mng_dev_inquiries"

    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: int = Field(foreign_key="mng_companies.id", index=True)
    inquiry_content: Optional[str] = None
    hoped_start_date: Optional[date] = None
    estimated_man_months: Optional[float] = None
    sales_rep_name: Optional[str] = Field(default=None, max_length=100)
    client_contact_name: Optional[str] = Field(default=None, max_length=100)
    progress_code: Optional[str] = Field(default=None, max_length=20)
    is_confirmed: bool = Field(default=False)
    project_name: Optional[str] = Field(default=None, max_length=200)
    note: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class MngOutsourceContract(SQLModel, table=True):
    """외주인력 계약관리"""

    __tablename__ = "mng_outsource_contracts"
    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "start_date",
            name="uq_mng_outsource_contracts_emp_sdate",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="hr_employees.id", index=True)
    start_date: date
    end_date: date
    total_leave_count: float = Field(default=0)
    extra_leave_count: float = Field(default=0)
    note: Optional[str] = Field(default=None, max_length=500)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class MngOutsourceAttendance(SQLModel, table=True):
    """외주인력 근태관리"""

    __tablename__ = "mng_outsource_attendances"
    __table_args__ = (
        Index("ix_mng_outsource_attendances_contract", "contract_id"),
        Index("ix_mng_outsource_attendances_emp", "employee_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    contract_id: int = Field(foreign_key="mng_outsource_contracts.id", index=True)
    employee_id: int = Field(foreign_key="hr_employees.id", index=True)
    attendance_code: str = Field(max_length=20)
    apply_date: Optional[date] = None
    status_code: Optional[str] = Field(default=None, max_length=20)
    start_date: date
    end_date: date
    apply_count: Optional[float] = None
    note: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class MngInfraMaster(SQLModel, table=True):
    """인프라 구성 마스터"""

    __tablename__ = "mng_infra_masters"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "service_type",
            "env_type",
            name="uq_mng_infra_masters_comp_svc_env",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: int = Field(foreign_key="mng_companies.id", index=True)
    service_type: str = Field(max_length=40)
    env_type: str = Field(max_length=10)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class MngInfraConfig(SQLModel, table=True):
    """인프라 구성 상세 (키-값 방식)"""

    __tablename__ = "mng_infra_configs"
    __table_args__ = (
        UniqueConstraint(
            "master_id",
            "section",
            "config_key",
            name="uq_mng_infra_configs_master_section_key",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    master_id: int = Field(foreign_key="mng_infra_masters.id", index=True)
    section: str = Field(max_length=100)
    config_key: str = Field(max_length=100)
    config_value: Optional[str] = None
    sort_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
