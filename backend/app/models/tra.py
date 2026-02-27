from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import CheckConstraint, Index, UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TraOrganization(SQLModel, table=True):
    __tablename__ = "tra_organizations"
    __table_args__ = (UniqueConstraint("code", name="uq_tra_organizations_code"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, max_length=30)
    name: str = Field(max_length=200)
    business_no: Optional[str] = Field(default=None, max_length=40)
    contact_name: Optional[str] = Field(default=None, max_length=100)
    contact_phone: Optional[str] = Field(default=None, max_length=40)
    contact_email: Optional[str] = Field(default=None, max_length=320)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class TraCourse(SQLModel, table=True):
    __tablename__ = "tra_courses"
    __table_args__ = (
        UniqueConstraint("course_code", name="uq_tra_courses_code"),
        CheckConstraint(
            "in_out_type IN ('INTERNAL', 'EXTERNAL', 'MIXED')",
            name="ck_tra_courses_in_out_type",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    course_code: str = Field(index=True, max_length=40)
    course_name: str = Field(max_length=200)
    in_out_type: str = Field(default="INTERNAL", max_length=20)
    branch_code: Optional[str] = Field(default=None, max_length=30)
    sub_branch_code: Optional[str] = Field(default=None, max_length=30)
    method_code: Optional[str] = Field(default=None, max_length=30)
    status_code: str = Field(default="open", max_length=30)
    organization_id: Optional[int] = Field(default=None, foreign_key="tra_organizations.id")
    mandatory_yn: bool = Field(default=False)
    job_code: Optional[str] = Field(default=None, max_length=30)
    edu_level: Optional[str] = Field(default=None, max_length=30)
    memo: Optional[str] = Field(default=None, max_length=2000)
    note: Optional[str] = Field(default=None, max_length=2000)
    manager_employee_no: Optional[str] = Field(default=None, max_length=40)
    manager_phone: Optional[str] = Field(default=None, max_length=40)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class TraEvent(SQLModel, table=True):
    __tablename__ = "tra_events"
    __table_args__ = (UniqueConstraint("course_id", "event_code", name="uq_tra_events_course_event_code"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: int = Field(foreign_key="tra_courses.id", index=True)
    event_code: str = Field(max_length=40)
    event_name: str = Field(max_length=200)
    status_code: str = Field(default="open", max_length=30)
    organization_id: Optional[int] = Field(default=None, foreign_key="tra_organizations.id")
    place: Optional[str] = Field(default=None, max_length=200)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    start_time: Optional[str] = Field(default=None, max_length=10)
    end_time: Optional[str] = Field(default=None, max_length=10)
    edu_day: int = Field(default=0)
    edu_hour: float = Field(default=0)
    appl_start_date: Optional[date] = None
    appl_end_date: Optional[date] = None
    currency_code: str = Field(default="KRW", max_length=20)
    per_expense_amount: float = Field(default=0)
    real_expense_amount: float = Field(default=0)
    labor_apply_yn: bool = Field(default=False)
    labor_amount: float = Field(default=0)
    labor_return_yn: bool = Field(default=False)
    labor_return_date: Optional[date] = None
    result_app_skip_yn: bool = Field(default=False)
    max_person: int = Field(default=0)
    note: Optional[str] = Field(default=None, max_length=2000)
    manager_employee_no: Optional[str] = Field(default=None, max_length=40)
    manager_phone: Optional[str] = Field(default=None, max_length=40)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class TraRequiredRule(SQLModel, table=True):
    __tablename__ = "tra_required_rules"
    __table_args__ = (
        UniqueConstraint("year", "rule_code", "order_seq", "course_id", name="uq_tra_required_rules_year_rule"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    year: int = Field(index=True)
    rule_code: str = Field(max_length=30)
    order_seq: int = Field(default=1)
    job_grade_code: Optional[str] = Field(default=None, max_length=30)
    job_grade_year: Optional[int] = None
    job_code: Optional[str] = Field(default=None, max_length=30)
    search_seq: Optional[int] = None
    entry_month: Optional[int] = None
    start_month: int = Field(default=1)
    end_month: int = Field(default=12)
    course_id: int = Field(foreign_key="tra_courses.id", index=True)
    edu_level: Optional[str] = Field(default=None, max_length=30)
    note: Optional[str] = Field(default=None, max_length=2000)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class TraApplication(SQLModel, table=True):
    __tablename__ = "tra_applications"
    __table_args__ = (
        UniqueConstraint("application_no", name="uq_tra_applications_application_no"),
        CheckConstraint(
            "status IN ('draft', 'submitted', 'approved', 'rejected', 'canceled')",
            name="ck_tra_applications_status",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    application_no: str = Field(index=True, max_length=40)
    employee_id: int = Field(foreign_key="hr_employees.id", index=True)
    course_id: int = Field(foreign_key="tra_courses.id", index=True)
    event_id: Optional[int] = Field(default=None, foreign_key="tra_events.id", index=True)
    in_out_type: Optional[str] = Field(default=None, max_length=20)
    job_code: Optional[str] = Field(default=None, max_length=30)
    year_plan_yn: bool = Field(default=False)
    edu_memo: Optional[str] = Field(default=None, max_length=2000)
    note: Optional[str] = Field(default=None, max_length=2000)
    survey_yn: bool = Field(default=False)
    approval_request_id: Optional[int] = Field(default=None, foreign_key="hri_request_masters.id")
    status: str = Field(default="draft", max_length=20)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class TraRequiredTarget(SQLModel, table=True):
    __tablename__ = "tra_required_targets"
    __table_args__ = (
        UniqueConstraint(
            "year",
            "employee_id",
            "rule_code",
            "course_id",
            "edu_month",
            name="uq_tra_required_targets_year_employee_rule",
        ),
        CheckConstraint(
            "completion_status IN ('pending', 'completed', 'exempt')",
            name="ck_tra_required_targets_completion_status",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    year: int = Field(index=True)
    employee_id: int = Field(foreign_key="hr_employees.id", index=True)
    rule_code: str = Field(max_length=30)
    course_id: int = Field(foreign_key="tra_courses.id", index=True)
    edu_month: str = Field(max_length=6)
    event_id: Optional[int] = Field(default=None, foreign_key="tra_events.id")
    application_id: Optional[int] = Field(default=None, foreign_key="tra_applications.id")
    standard_rule_id: Optional[int] = Field(default=None, foreign_key="tra_required_rules.id")
    edu_level: Optional[str] = Field(default=None, max_length=30)
    completion_status: str = Field(default="pending", max_length=20)
    completed_count: int = Field(default=0)
    note: Optional[str] = Field(default=None, max_length=1000)
    error_note: Optional[str] = Field(default=None, max_length=1000)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class TraHistory(SQLModel, table=True):
    __tablename__ = "tra_histories"
    __table_args__ = (
        Index("ix_tra_histories_employee_completed_at", "employee_id", "completed_at"),
        CheckConstraint("confirm_type IN ('0', '1')", name="ck_tra_histories_confirm_type"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="hr_employees.id", index=True)
    course_id: int = Field(foreign_key="tra_courses.id", index=True)
    event_id: Optional[int] = Field(default=None, foreign_key="tra_events.id")
    application_id: Optional[int] = Field(default=None, foreign_key="tra_applications.id")
    confirm_type: str = Field(default="0", max_length=1)
    unconfirm_reason: Optional[str] = Field(default=None, max_length=1000)
    app_point: Optional[float] = None
    job_code: Optional[str] = Field(default=None, max_length=30)
    note: Optional[str] = Field(default=None, max_length=2000)
    completed_at: Optional[date] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class TraElearningWindow(SQLModel, table=True):
    __tablename__ = "tra_elearning_windows"
    __table_args__ = (UniqueConstraint("year_month", name="uq_tra_elearning_windows_year_month"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    year_month: str = Field(index=True, max_length=6)
    start_date: date
    end_date: date
    app_count: int = Field(default=2)
    note: Optional[str] = Field(default=None, max_length=1000)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class TraCyberUpload(SQLModel, table=True):
    __tablename__ = "tra_cyber_uploads"
    __table_args__ = (
        Index("ix_tra_cyber_uploads_upload_ym_close_yn", "upload_ym", "close_yn"),
        CheckConstraint("confirm_type IN ('0', '1')", name="ck_tra_cyber_uploads_confirm_type"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    upload_ym: str = Field(index=True, max_length=6)
    employee_no: Optional[str] = Field(default=None, max_length=40)
    employee_id: Optional[int] = Field(default=None, foreign_key="hr_employees.id", index=True)
    course_name: str = Field(max_length=200)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    reward_hour: float = Field(default=0)
    edu_hour: float = Field(default=0)
    labor_apply_yn: bool = Field(default=False)
    labor_amount: float = Field(default=0)
    per_expense_amount: float = Field(default=0)
    real_expense_amount: float = Field(default=0)
    confirm_type: str = Field(default="0", max_length=1)
    unconfirm_reason: Optional[str] = Field(default=None, max_length=1000)
    edu_branch_code: Optional[str] = Field(default=None, max_length=30)
    edu_sub_branch_code: Optional[str] = Field(default=None, max_length=30)
    in_out_type: Optional[str] = Field(default=None, max_length=20)
    method_code: Optional[str] = Field(default=None, max_length=30)
    organization_name: Optional[str] = Field(default=None, max_length=200)
    business_no: Optional[str] = Field(default=None, max_length=40)
    mandatory_yn: bool = Field(default=False)
    job_code: Optional[str] = Field(default=None, max_length=30)
    edu_level: Optional[str] = Field(default=None, max_length=30)
    event_name: Optional[str] = Field(default=None, max_length=200)
    place: Optional[str] = Field(default=None, max_length=200)
    close_yn: bool = Field(default=False)
    applied_course_id: Optional[int] = Field(default=None, foreign_key="tra_courses.id")
    applied_event_id: Optional[int] = Field(default=None, foreign_key="tra_events.id")
    applied_history_id: Optional[int] = Field(default=None, foreign_key="tra_histories.id")
    note: Optional[str] = Field(default=None, max_length=2000)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
