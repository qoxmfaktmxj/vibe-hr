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
