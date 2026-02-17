from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import CheckConstraint, UniqueConstraint
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
    __tablename__ = "hr_attendance_daily"
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


class HrLeaveRequest(SQLModel, table=True):
    __tablename__ = "hr_leave_requests"
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
