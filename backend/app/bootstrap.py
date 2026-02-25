from __future__ import annotations

from datetime import date
import random
import string

from sqlalchemy import text
from sqlmodel import Session, select

from app.core.security import hash_password
from app.models import (
    AppCode,
    AppCodeGroup,
    AppMenu,
    AppMenuRole,
    AuthRole,
    AuthUser,
    AuthUserRole,
    HrAttendanceDaily,
    HrEmployee,
    HrEmployeeBasicProfile,
    HrEmployeeInfoRecord,
    HrAnnualLeave,
    HrLeaveRequest,
    OrgDepartment,
    TimAttendanceCode,
    TimHoliday,
    TimWorkScheduleCode,
    PayPayrollCode,
    PayTaxRate,
    PayAllowanceDeduction,
    PayItemGroup,
    PayItemGroupDetail,
    HriFormType,
    HriFormTypePolicy,
    HriApprovalLineTemplate,
    HriApprovalLineStep,
    HriFormTypeApprovalMap,
    HriApprovalActorRule,
)

DEV_EMPLOYEE_TOTAL = 2000
DEV_EMPLOYEE_LOGIN_PREFIX = "kr-"
DEV_EMPLOYEE_PASSWORD_HASH = hash_password("admin")
PRIMARY_DEPARTMENT_CODE = "HQ-HR"

KOREAN_SURNAMES = [
    "\uAE40",
    "\uC774",
    "\uBC15",
    "\uCD5C",
    "\uC815",
    "\uAC15",
    "\uC870",
    "\uC724",
    "\uC7A5",
    "\uC784",
    "\uC624",
    "\uD55C",
    "\uC11C",
    "\uC2E0",
    "\uAD8C",
    "\uD669",
    "\uC548",
    "\uC1A1",
    "\uB958",
    "\uC804",
]
KOREAN_GIVEN_FIRST = [
    "\uBBFC",
    "\uC11C",
    "\uC9C0",
    "\uC218",
    "\uC608",
    "\uD604",
    "\uC720",
    "\uC6B0",
    "\uC900",
    "\uD558",
    "\uC815",
    "\uC740",
    "\uC601",
    "\uB3D9",
    "\uC131",
    "\uC7AC",
    "\uC9C4",
    "\uD0DC",
    "\uC9C4",
    "\uC5F0",
]
KOREAN_GIVEN_SECOND = [
    "\uC900",
    "\uC544",
    "\uD76C",
    "\uC5F0",
    "\uD604",
    "\uC6B0",
    "\uD6C8",
    "\uC11D",
    "\uB9BC",
    "\uC11D",
    "\uC6D0",
    "\uB9AC",
    "\uC740",
    "\uB0A8",
    "\uC120",
    "\uBE48",
    "\uC601",
    "\uC548",
    "\uBBFC",
    "\uD658",
]

KOREAN_POSITION_TITLES = [
    "\uC0AC\uC6D0",
    "\uB300\uB9AC",
    "\uACFC\uC7A5",
    "\uCC28\uC7A5",
    "\uBD80\uC7A5",
]

DEPARTMENT_SEEDS = [
    ("HQ-HR", "\uC778\uC0AC\uBCF8\uBD80"),
    ("HQ-ENG", "\uAC1C\uBC1C\uBCF8\uBD80"),
    ("HQ-SALES", "\uC601\uC5C5\uBCF8\uBD80"),
    ("HQ-FIN", "\uC7AC\uBB34\uBCF8\uBD80"),
    ("HQ-OPS", "\uC6B4\uC601\uBCF8\uBD80"),
    *[(f"ORG-{index:04d}", f"\uC870\uC9C1{index:02d}") for index in range(1, 46)],
]

MENU_TREE: list[dict] = [
    {
        "code": "dashboard",
        "name": "대시보드",
        "path": "/dashboard",
        "icon": "LayoutDashboard",
        "sort_order": 100,
        "roles": ["employee", "hr_manager", "payroll_mgr", "admin"],
        "children": [],
    },
    {
        "code": "hr",
        "name": "인사",
        "path": None,
        "icon": "UsersRound",
        "sort_order": 200,
        "roles": ["hr_manager", "admin"],
        "children": [
            {
                "code": "hr.info",
                "name": "인사정보",
                "path": None,
                "icon": "UserRound",
                "sort_order": 201,
                "roles": ["hr_manager", "admin"],
                "children": [
                    {
                        "code": "hr.basic",
                        "name": "인사기본",
                        "path": "/hr/basic",
                        "icon": "UserRound",
                        "sort_order": 202,
                        "roles": ["hr_manager", "admin"],
                    },
                    {
                        "code": "hr.employee",
                        "name": "사원관리",
                        "path": "/hr/employee",
                        "icon": "UserRound",
                        "sort_order": 203,
                        "roles": ["hr_manager", "admin"],
                    },
                ],
            },
            {
                "code": "hr.admin",
                "name": "인사관리",
                "path": None,
                "icon": "UsersRound",
                "sort_order": 204,
                "roles": ["hr_manager", "admin"],
                "children": [
                    {"code": "hr.admin.appointments", "name": "발령관리", "path": "/hr/admin/appointments", "icon": "UserRound", "sort_order": 205, "roles": ["hr_manager", "admin"]},
                    {"code": "hr.admin.rewards", "name": "상벌관리", "path": "/hr/admin/rewards", "icon": "UserRound", "sort_order": 206, "roles": ["hr_manager", "admin"]},
                    {"code": "hr.admin.contacts", "name": "주소연락처관리", "path": "/hr/admin/contacts", "icon": "UserRound", "sort_order": 207, "roles": ["hr_manager", "admin"]},
                    {"code": "hr.admin.educations", "name": "학력관리", "path": "/hr/admin/educations", "icon": "UserRound", "sort_order": 208, "roles": ["hr_manager", "admin"]},
                    {"code": "hr.admin.careers", "name": "경력관리", "path": "/hr/admin/careers", "icon": "UserRound", "sort_order": 209, "roles": ["hr_manager", "admin"]},
                    {"code": "hr.admin.certificates", "name": "자격증관리", "path": "/hr/admin/certificates", "icon": "UserRound", "sort_order": 210, "roles": ["hr_manager", "admin"]},
                    {"code": "hr.admin.military", "name": "병역관리", "path": "/hr/admin/military", "icon": "UserRound", "sort_order": 211, "roles": ["hr_manager", "admin"]},
                    {"code": "hr.admin.evaluations", "name": "평가관리", "path": "/hr/admin/evaluations", "icon": "UserRound", "sort_order": 212, "roles": ["hr_manager", "admin"]}
                ],
            },
        ],
    },
    {
        "code": "org",
        "name": "조직",
        "path": None,
        "icon": "Building2",
        "sort_order": 300,
        "roles": ["hr_manager", "admin"],
        "children": [
            {
                "code": "org.manage",
                "name": "조직관리",
                "path": None,
                "icon": "FolderTree",
                "sort_order": 301,
                "roles": ["hr_manager", "admin"],
                "children": [
                    {"code": "org.corporations", "name": "법인관리", "path": "/org/corporations", "icon": "Building2", "sort_order": 302, "roles": ["hr_manager", "admin"]},
                    {"code": "org.departments", "name": "조직코드관리", "path": "/org/departments", "icon": "FolderTree", "sort_order": 303, "roles": ["hr_manager", "admin"]},
                    {"code": "org.chart", "name": "조직도관리", "path": "/org/chart", "icon": "FolderTree", "sort_order": 304, "roles": ["hr_manager", "admin"]},
                    {"code": "org.types", "name": "조직구분", "path": "/org/types", "icon": "FolderTree", "sort_order": 305, "roles": ["hr_manager", "admin"]},
                    {"code": "org.type-items", "name": "조직구분항목", "path": "/org/type-items", "icon": "FolderTree", "sort_order": 306, "roles": ["hr_manager", "admin"]},
                    {"code": "org.type-upload", "name": "조직구분업로드", "path": "/org/type-upload", "icon": "FolderTree", "sort_order": 307, "roles": ["hr_manager", "admin"]},
                    {"code": "org.type-personal-status", "name": "조직구분개인별현황", "path": "/org/type-personal-status", "icon": "FolderTree", "sort_order": 308, "roles": ["hr_manager", "admin"]}
                ],
            },
        ],
    },
    {
        "code": "tim",
        "name": "근태",
        "path": None,
        "icon": "Clock",
        "sort_order": 400,
        "roles": ["employee", "hr_manager", "admin"],
        "children": [
            {
                "code": "tim.base",
                "name": "근태기준관리",
                "path": None,
                "icon": "CalendarCheck2",
                "sort_order": 401,
                "roles": ["hr_manager", "admin"],
                "children": [
                    {"code": "tim.holidays", "name": "공휴일관리", "path": "/tim/holidays", "icon": "CalendarDays", "sort_order": 402, "roles": ["hr_manager", "admin"]},
                    {"code": "tim.codes", "name": "근태코드관리", "path": "/tim/codes", "icon": "CalendarCheck2", "sort_order": 403, "roles": ["hr_manager", "admin"]},
                    {"code": "tim.work-codes", "name": "근무코드관리", "path": "/tim/work-codes", "icon": "Clock", "sort_order": 404, "roles": ["hr_manager", "admin"]}
                ],
            },
            {
                "code": "tim.daily",
                "name": "일상근태",
                "path": None,
                "icon": "Clock",
                "sort_order": 410,
                "roles": ["employee", "hr_manager", "admin"],
                "children": [
                    {"code": "tim.check-in", "name": "출퇴근기록", "path": "/tim/check-in", "icon": "CalendarCheck2", "sort_order": 411, "roles": ["employee", "hr_manager", "admin"]},
                    {"code": "tim.status", "name": "근태현황", "path": "/tim/status", "icon": "ListOrdered", "sort_order": 412, "roles": ["hr_manager", "admin"]},
                    {"code": "tim.correction", "name": "근태수정", "path": "/tim/correction", "icon": "CalendarDays", "sort_order": 413, "roles": ["hr_manager", "admin"]}
                ],
            },
            {
                "code": "tim.leave",
                "name": "휴가관리",
                "path": None,
                "icon": "CalendarDays",
                "sort_order": 420,
                "roles": ["employee", "hr_manager", "admin"],
                "children": [
                    {"code": "tim.annual-leave", "name": "연차관리", "path": "/tim/annual-leave", "icon": "CalendarDays", "sort_order": 421, "roles": ["employee", "hr_manager", "admin"]},
                    {"code": "tim.leave-request", "name": "휴가신청", "path": "/tim/leave-request", "icon": "CalendarCheck2", "sort_order": 422, "roles": ["employee", "hr_manager", "admin"]},
                    {"code": "tim.leave-approval", "name": "휴가승인", "path": "/tim/leave-approval", "icon": "ListOrdered", "sort_order": 423, "roles": ["hr_manager", "admin"]}
                ],
            },
            {
                "code": "tim.reports",
                "name": "근태리포트",
                "path": "/tim/reports",
                "icon": "FileText",
                "sort_order": 430,
                "roles": ["hr_manager", "admin"],
                "children": [],
            },
        ],
    },
    {
        "code": "hri",
        "name": "신청서",
        "path": None,
        "icon": "FileText",
        "sort_order": 450,
        "roles": ["employee", "hr_manager", "admin"],
        "children": [
            {
                "code": "hri.requests",
                "name": "내 문서",
                "path": None,
                "icon": "ListOrdered",
                "sort_order": 451,
                "roles": ["employee", "hr_manager", "admin"],
                "children": [
                    {"code": "hri.requests.mine", "name": "내 신청서", "path": "/hri/requests/mine", "icon": "FileText", "sort_order": 452, "roles": ["employee", "hr_manager", "admin"]},
                    {"code": "hri.tasks.approvals", "name": "결재함", "path": "/hri/tasks/approvals", "icon": "ListOrdered", "sort_order": 453, "roles": ["employee", "hr_manager", "admin"]},
                    {"code": "hri.tasks.receives", "name": "수신함", "path": "/hri/tasks/receives", "icon": "ListOrdered", "sort_order": 454, "roles": ["employee", "hr_manager", "admin"]},
                ],
            },
            {
                "code": "hri.admin",
                "name": "신청서관리",
                "path": None,
                "icon": "Settings",
                "sort_order": 460,
                "roles": ["hr_manager", "admin"],
                "children": [
                    {"code": "hri.admin.form-types", "name": "신청서코드관리", "path": "/hri/admin/form-types", "icon": "ListOrdered", "sort_order": 461, "roles": ["hr_manager", "admin"]},
                    {"code": "hri.admin.approval-lines", "name": "결재선관리", "path": "/hri/admin/approval-lines", "icon": "ListOrdered", "sort_order": 462, "roles": ["hr_manager", "admin"]},
                ],
            },
        ],
    },
    {
        "code": "payroll",
        "name": "급여",
        "path": None,
        "icon": "Wallet",
        "sort_order": 500,
        "roles": ["payroll_mgr", "admin"],
        "children": [
            {
                "code": "payroll.base",
                "name": "급여기준관리",
                "path": None,
                "icon": "Calculator",
                "sort_order": 501,
                "roles": ["payroll_mgr", "admin"],
                "children": [
                    {"code": "payroll.allowance-deduction-items", "name": "수당공제항목관리", "path": "/payroll/allowance-deduction-items", "icon": "Calculator", "sort_order": 502, "roles": ["payroll_mgr", "admin"]},
                    {"code": "payroll.item-groups", "name": "항목그룹관리", "path": "/payroll/item-groups", "icon": "Calculator", "sort_order": 503, "roles": ["payroll_mgr", "admin"]},
                    {"code": "payroll.codes", "name": "급여코드관리", "path": "/payroll/codes", "icon": "Calculator", "sort_order": 504, "roles": ["payroll_mgr", "admin"]},
                    {"code": "payroll.tax-rates", "name": "세율및사회보험관리", "path": "/payroll/tax-rates", "icon": "Calculator", "sort_order": 505, "roles": ["payroll_mgr", "admin"]}
                ],
            },
        ],
    },
    {
        "code": "settings",
        "name": "시스템",
        "path": None,
        "icon": "Settings",
        "sort_order": 900,
        "roles": ["admin"],
        "children": [
            {
                "code": "settings.base",
                "name": "시스템기준관리",
                "path": None,
                "icon": "Settings",
                "sort_order": 901,
                "roles": ["admin"],
                "children": [
                    {"code": "settings.menus", "name": "메뉴관리", "path": "/settings/menus", "icon": "PanelLeft", "sort_order": 902, "roles": ["admin"]},
                    {"code": "settings.common-codes", "name": "공통코드관리", "path": "/settings/common-codes", "icon": "ListOrdered", "sort_order": 903, "roles": ["admin"]}
                ],
            },
            {
                "code": "settings.auth",
                "name": "권한",
                "path": None,
                "icon": "Shield",
                "sort_order": 910,
                "roles": ["admin"],
                "children": [
                    {"code": "settings.roles", "name": "권한관리", "path": "/settings/roles", "icon": "Shield", "sort_order": 911, "roles": ["admin"]},
                    {"code": "settings.permissions", "name": "메뉴권한관리", "path": "/settings/permissions", "icon": "Menu", "sort_order": 912, "roles": ["admin"]},
                    {"code": "settings.users", "name": "사용자관리", "path": "/settings/users", "icon": "UserRound", "sort_order": 913, "roles": ["admin"]}
                ],
            },
        ],
    },
]


COMMON_CODE_GROUP_SEEDS = [
    ("POSITION", "직위", "직위 구분", 1),
    ("RANK", "직급", "직급 구분", 2),
    ("JOB_GROUP", "직군", "직군 구분", 3),
    ("SALARY_TYPE", "연봉타입", "연봉 유형", 4),
    ("ORG_TYPE", "조직유형", "조직 유형 구분", 5),
]

COMMON_CODE_ITEM_SEEDS = {
    "POSITION": [
        ("01", "사원", 1),
        ("02", "대리", 2),
        ("03", "과장", 3),
        ("04", "차장", 4),
        ("05", "부장", 5),
        ("06", "이사", 6),
    ],
}


def ensure_auth_user_login_id_schema(session: Session) -> None:
    columns = session.exec(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'auth_users'
            """
        )
    ).all()
    column_names = {row[0] for row in columns}

    if "login_id" not in column_names:
        session.exec(text("ALTER TABLE auth_users ADD COLUMN login_id TEXT"))
        session.commit()

    session.exec(
        text(
            """
            UPDATE auth_users
            SET login_id = 'user-' || id
            WHERE login_id IS NULL OR TRIM(login_id) = ''
            """
        )
    )
    session.exec(
        text(
            """
            UPDATE auth_users
            SET login_id = 'admin-local'
            WHERE email = 'admin@vibe-hr.local'
            """
        )
    )
    session.exec(text("CREATE UNIQUE INDEX IF NOT EXISTS ux_auth_users_login_id ON auth_users (login_id)"))
    session.commit()


def ensure_roles(session: Session) -> None:
    role_map = {
        "admin": "\uAD00\uB9AC\uC790",
        "hr_manager": "\uC778\uC0AC\uB2F4\uB2F9\uC790",
        "payroll_mgr": "\uAE09\uC5EC\uB2F4\uB2F9\uC790",
        "employee": "\uC77C\uBC18\uC9C1\uC6D0",
    }
    for code, name in role_map.items():
        existing_role = session.exec(select(AuthRole).where(AuthRole.code == code)).first()
        if existing_role is None:
            session.add(AuthRole(code=code, name=name))
    session.commit()


def ensure_departments(session: Session) -> list[OrgDepartment]:
    departments: list[OrgDepartment] = []
    for code, name in DEPARTMENT_SEEDS:
        department = session.exec(select(OrgDepartment).where(OrgDepartment.code == code)).first()
        if department is None:
            department = OrgDepartment(code=code, name=name, is_active=True)
            session.add(department)
            session.commit()
            session.refresh(department)
        else:
            changed = False
            if department.name != name:
                department.name = name
                changed = True
            if not department.is_active:
                department.is_active = True
                changed = True
            if changed:
                session.add(department)
                session.commit()
                session.refresh(department)
        departments.append(department)
    return departments


def ensure_department(session: Session) -> OrgDepartment:
    departments = ensure_departments(session)
    for department in departments:
        if department.code == PRIMARY_DEPARTMENT_CODE:
            return department
    return departments[0]


def ensure_user(
    session: Session,
    *,
    login_id: str,
    email: str,
    password: str,
    display_name: str,
    reset_password: bool = False,
) -> AuthUser:
    user = session.exec(select(AuthUser).where(AuthUser.login_id == login_id)).first()
    if user is None:
        user = AuthUser(
            login_id=login_id,
            email=email,
            password_hash=hash_password(password),
            display_name=display_name,
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user

    changed = False
    if user.email != email:
        user.email = email
        changed = True
    if user.display_name != display_name:
        user.display_name = display_name
        changed = True
    if reset_password:
        user.password_hash = hash_password(password)
        changed = True
    if not user.is_active:
        user.is_active = True
        changed = True
    if changed:
        session.add(user)
        session.commit()
        session.refresh(user)

    return user


def ensure_user_roles(session: Session, user: AuthUser, role_codes: list[str]) -> None:
    roles = session.exec(select(AuthRole).where(AuthRole.code.in_(role_codes))).all()
    role_map = {role.code: role for role in roles}
    links = session.exec(select(AuthUserRole).where(AuthUserRole.user_id == user.id)).all()
    linked_role_ids = {link.role_id for link in links}

    for code in role_codes:
        role = role_map.get(code)
        if role and role.id not in linked_role_ids:
            session.add(AuthUserRole(user_id=user.id, role_id=role.id))
    session.commit()


def ensure_employee(
    session: Session,
    *,
    user: AuthUser,
    employee_no: str,
    department_id: int,
    position_title: str,
) -> HrEmployee:
    employee = session.exec(select(HrEmployee).where(HrEmployee.user_id == user.id)).first()
    if employee is None:
        employee = HrEmployee(
            user_id=user.id,
            employee_no=employee_no,
            department_id=department_id,
            position_title=position_title,
            hire_date=date(2024, 1, 1),
            employment_status="active",
        )
        session.add(employee)
        session.commit()
        session.refresh(employee)
    return employee


def _build_korean_name(index: int) -> str:
    rng = random.Random(20260219 + index * 97)
    surname = KOREAN_SURNAMES[rng.randrange(len(KOREAN_SURNAMES))]
    first = KOREAN_GIVEN_FIRST[rng.randrange(len(KOREAN_GIVEN_FIRST))]
    second = KOREAN_GIVEN_SECOND[rng.randrange(len(KOREAN_GIVEN_SECOND))]
    return f"{surname}{first}{second}"


def _build_dev_login_id(index: int) -> str:
    rng = random.Random(31000 + index * 173)
    chars = string.ascii_lowercase + string.digits
    token = "".join(rng.choice(chars) for _ in range(8))
    return f"{DEV_EMPLOYEE_LOGIN_PREFIX}{token}-{index:04d}"


def _build_position_title(index: int) -> str:
    return KOREAN_POSITION_TITLES[(index - 1) % len(KOREAN_POSITION_TITLES)]


def _build_department_distribution(
    *,
    total_employees: int,
    department_ids: list[int],
) -> list[int]:
    if not department_ids:
        return []

    min_per_department = 3
    counts = [min_per_department for _ in department_ids]
    remaining = total_employees - (min_per_department * len(department_ids))
    if remaining <= 0:
        counts[0] += max(remaining, 0)
        return counts

    # Guarantee a few high-density departments for load/perf verification scenarios.
    high_density_bonus = [140, 130, 120, 110, 100]
    for index, bonus in enumerate(high_density_bonus):
        if index >= len(counts):
            break
        add = min(remaining, bonus)
        counts[index] += add
        remaining -= add
        if remaining == 0:
            break

    if remaining > 0:
        base_add, extra = divmod(remaining, len(counts))
        for index in range(len(counts)):
            counts[index] += base_add + (1 if index < extra else 0)

    return counts


def ensure_bulk_korean_employees(
    session: Session,
    *,
    departments: list[OrgDepartment],
    total: int = DEV_EMPLOYEE_TOTAL,
) -> None:
    if not departments:
        return

    employee_role = session.exec(select(AuthRole).where(AuthRole.code == "employee")).first()
    if employee_role is None:
        return

    users = session.exec(
        select(AuthUser).where(AuthUser.login_id.like(f"{DEV_EMPLOYEE_LOGIN_PREFIX}%"))
    ).all()
    user_by_login = {user.login_id: user for user in users}

    employees = session.exec(select(HrEmployee)).all()
    employee_by_user_id = {employee.user_id: employee for employee in employees}

    employee_role_user_ids = set(
        session.exec(select(AuthUserRole.user_id).where(AuthUserRole.role_id == employee_role.id)).all()
    )

    sorted_departments = sorted(departments, key=lambda department: department.code)
    department_ids = [department.id for department in sorted_departments]
    distribution = _build_department_distribution(
        total_employees=total,
        department_ids=department_ids,
    )
    assignment: list[int] = []
    for department_id, count in zip(department_ids, distribution):
        assignment.extend([department_id] * count)
    if len(assignment) < total:
        assignment.extend([department_ids[0]] * (total - len(assignment)))
    elif len(assignment) > total:
        assignment = assignment[:total]

    for index in range(1, total + 1):
        login_id = _build_dev_login_id(index)
        email = f"{login_id}@vibe-hr.local"
        display_name = _build_korean_name(index)
        position_title = _build_position_title(index)

        user = user_by_login.get(login_id)
        assigned_department_id = assignment[index - 1]
        if user is None:
            user = AuthUser(
                login_id=login_id,
                email=email,
                password_hash=DEV_EMPLOYEE_PASSWORD_HASH,
                display_name=display_name,
                is_active=True,
            )
            session.add(user)
            session.flush()
            user_by_login[login_id] = user
        else:
            if user.email != email:
                user.email = email
            if user.display_name != display_name:
                user.display_name = display_name
            if not user.is_active:
                user.is_active = True
            if user.password_hash != DEV_EMPLOYEE_PASSWORD_HASH:
                user.password_hash = DEV_EMPLOYEE_PASSWORD_HASH
            session.add(user)

        employee = employee_by_user_id.get(user.id)
        if employee is None:
            hire_year = 2016 + (index % 10)
            hire_month = (index % 12) + 1
            hire_day = (index % 28) + 1
            employee = HrEmployee(
                user_id=user.id,
                employee_no=f"KR-{index:04d}",
                department_id=assigned_department_id,
                position_title=position_title,
                hire_date=date(hire_year, hire_month, hire_day),
                employment_status="active",
            )
            session.add(employee)
            employee_by_user_id[user.id] = employee
        else:
            changed = False
            if employee.department_id != assigned_department_id:
                employee.department_id = assigned_department_id
                changed = True
            if employee.position_title != position_title:
                employee.position_title = position_title
                changed = True
            if changed:
                session.add(employee)

        if user.id not in employee_role_user_ids:
            session.add(AuthUserRole(user_id=user.id, role_id=employee_role.id))
            employee_role_user_ids.add(user.id)

    session.commit()


def ensure_sample_records(session: Session, employee: HrEmployee) -> None:
    today = date.today()
    today_attendance = session.exec(
        select(HrAttendanceDaily).where(
            HrAttendanceDaily.employee_id == employee.id,
            HrAttendanceDaily.work_date == today,
        )
    ).first()
    if today_attendance is None:
        session.add(
            HrAttendanceDaily(
                employee_id=employee.id,
                work_date=today,
                attendance_status="present",
            )
        )

    pending_leave = session.exec(
        select(HrLeaveRequest).where(
            HrLeaveRequest.employee_id == employee.id,
            HrLeaveRequest.request_status == "pending",
        )
    ).first()
    if pending_leave is None:
        session.add(
            HrLeaveRequest(
                employee_id=employee.id,
                leave_type="annual",
                start_date=today,
                end_date=today,
                reason="\uC0D8\uD50C \uC5F0\uCC28 \uC2E0\uCCAD",
                request_status="pending",
            )
        )
    session.commit()


def _get_or_create_menu(
    session: Session,
    *,
    code: str,
    name: str,
    parent_id: int | None = None,
    path: str | None = None,
    icon: str | None = None,
    sort_order: int = 0,
) -> AppMenu:
    menu = session.exec(select(AppMenu).where(AppMenu.code == code)).first()
    if menu is None:
        menu = AppMenu(
            code=code,
            name=name,
            parent_id=parent_id,
            path=path,
            icon=icon,
            sort_order=sort_order,
        )
        session.add(menu)
        session.commit()
        session.refresh(menu)
        return menu

    changed = False
    if menu.name != name:
        menu.name = name
        changed = True
    if menu.parent_id != parent_id:
        menu.parent_id = parent_id
        changed = True
    if menu.path != path:
        menu.path = path
        changed = True
    if menu.icon != icon:
        menu.icon = icon
        changed = True
    if menu.sort_order != sort_order:
        menu.sort_order = sort_order
        changed = True
    if not menu.is_active:
        menu.is_active = True
        changed = True

    if changed:
        session.add(menu)
        session.commit()
        session.refresh(menu)

    return menu


def _link_menu_roles(session: Session, menu: AppMenu, role_codes: list[str]) -> None:
    roles = session.exec(select(AuthRole).where(AuthRole.code.in_(role_codes))).all()
    existing = session.exec(select(AppMenuRole).where(AppMenuRole.menu_id == menu.id)).all()
    existing_role_ids = {link.role_id for link in existing}

    for role in roles:
        if role.id not in existing_role_ids:
            session.add(AppMenuRole(menu_id=menu.id, role_id=role.id))
    session.commit()


def ensure_menus(session: Session) -> None:
    seeded_codes: set[str] = set()

    def _upsert(node: dict, parent_id: int | None = None) -> None:
        seeded_codes.add(node["code"])
        menu = _get_or_create_menu(
            session,
            code=node["code"],
            name=node["name"],
            parent_id=parent_id,
            path=node.get("path"),
            icon=node.get("icon"),
            sort_order=node.get("sort_order", 0),
        )
        _link_menu_roles(session, menu, node.get("roles", []))

        for child in node.get("children", []):
            _upsert(child, parent_id=menu.id)

    for top in MENU_TREE:
        _upsert(top)

    # Seed source-of-truth 기준으로 미사용 메뉴 비활성화
    all_menus = session.exec(select(AppMenu)).all()
    changed = False
    for menu in all_menus:
        if menu.code not in seeded_codes and menu.is_active:
            menu.is_active = False
            session.add(menu)
            changed = True
    if changed:
        session.commit()


def ensure_common_codes(session: Session) -> None:
    group_map: dict[str, AppCodeGroup] = {}

    for code, name, description, sort_order in COMMON_CODE_GROUP_SEEDS:
        group = session.exec(select(AppCodeGroup).where(AppCodeGroup.code == code)).first()
        if group is None:
            group = AppCodeGroup(
                code=code,
                name=name,
                description=description,
                is_active=True,
                sort_order=sort_order,
            )
            session.add(group)
            session.commit()
            session.refresh(group)
        else:
            changed = False
            if group.name != name:
                group.name = name
                changed = True
            if group.description != description:
                group.description = description
                changed = True
            if group.sort_order != sort_order:
                group.sort_order = sort_order
                changed = True
            if not group.is_active:
                group.is_active = True
                changed = True
            if changed:
                session.add(group)
                session.commit()
                session.refresh(group)
        group_map[code] = group

    for group_code, items in COMMON_CODE_ITEM_SEEDS.items():
        group = group_map.get(group_code)
        if group is None:
            continue

        for code, name, sort_order in items:
            item = session.exec(
                select(AppCode).where(AppCode.group_id == group.id, AppCode.code == code)
            ).first()
            if item is None:
                item = AppCode(
                    group_id=group.id,
                    code=code,
                    name=name,
                    is_active=True,
                    sort_order=sort_order,
                )
                session.add(item)
                session.commit()
            else:
                changed = False
                if item.name != name:
                    item.name = name
                    changed = True
                if item.sort_order != sort_order:
                    item.sort_order = sort_order
                    changed = True
                if not item.is_active:
                    item.is_active = True
                    changed = True
                if changed:
                    session.add(item)
                    session.commit()


def ensure_hr_basic_seed_data(session: Session) -> None:
    employees = session.exec(select(HrEmployee).order_by(HrEmployee.id).limit(30)).all()
    if not employees:
        return

    for index, employee in enumerate(employees, start=1):
        profile = session.exec(
            select(HrEmployeeBasicProfile).where(HrEmployeeBasicProfile.employee_id == employee.id)
        ).first()
        if profile is None:
            profile = HrEmployeeBasicProfile(
                employee_id=employee.id,
                gender="남" if index % 2 else "여",
                resident_no_masked=f"90{(index % 12) + 1:02d}15-1******",
                blood_type=["A", "B", "O", "AB"][index % 4],
                marital_status="기혼" if index % 3 == 0 else "미혼",
                mbti=["ISTJ", "ENFP", "INTJ", "ESFJ"][index % 4],
                job_family=["경영지원", "개발", "영업", "운영"][index % 4],
                job_role=employee.position_title,
                grade=["사원", "대리", "과장", "차장", "부장"][index % 5],
            )
            session.add(profile)

        record_exists = session.exec(
            select(HrEmployeeInfoRecord.id).where(HrEmployeeInfoRecord.employee_id == employee.id).limit(1)
        ).first()
        if record_exists is not None:
            continue

        seed_rows = [
            ("appointment", "정기 발령", "전보", "인사본부", "개발1팀", "정기 인사이동"),
            ("reward_penalty", "우수사원", "상", "대표이사", "표창", "분기 우수사원 선정"),
            ("contact", "연락처", "개인전화", None, "010-1234-56{:02d}".format(index), "개인 연락처"),
            ("education", "학력", "학사", "한국대학교", "컴퓨터공학", "졸업"),
            ("career", "경력", "이전회사", "샘플테크", "백엔드 개발", "3년"),
            ("certificate", "자격증", "정보처리기사", "한국산업인력공단", "취득", ""),
            ("military", "병역", "육군", "대한민국 육군", "병장", "만기전역"),
            ("evaluation", "연말평가", "A", None, "우수", "성과 우수"),
        ]
        for category, title, type_value, org, value, note in seed_rows:
            session.add(
                HrEmployeeInfoRecord(
                    employee_id=employee.id,
                    category=category,
                    title=title,
                    type=type_value,
                    organization=org,
                    value=value,
                    note=note,
                    record_date=date(2025, (index % 12) + 1, min(20, (index % 27) + 1)),
                )
            )

    session.commit()


ATTENDANCE_CODE_SEEDS = [
    # (code, name, category, unit, is_requestable, min_days, max_days, deduct_annual, sort_order)
    ("C01", "연차휴가", "leave", "day", True, 1.0, 25.0, True, 10),
    ("C01A", "오전반차", "leave", "am", True, 0.5, 0.5, True, 20),
    ("C01B", "오후반차", "leave", "pm", True, 0.5, 0.5, True, 30),
    ("C02", "하계휴가", "leave", "day", True, 1.0, 5.0, False, 40),
    ("C03", "대체휴가", "leave", "day", True, 1.0, 100.0, False, 50),
    ("C04", "병가", "leave", "day", True, 1.0, 90.0, False, 60),
    ("C05", "경조휴가", "leave", "day", True, 1.0, 5.0, False, 70),
    ("C06", "공가", "leave", "day", True, 1.0, 10.0, False, 80),
    ("C07", "교육", "leave", "day", True, 1.0, 30.0, False, 90),
    ("C08", "출산휴가", "leave", "day", True, 1.0, 120.0, False, 100),
    ("C09", "육아휴직", "leave", "day", True, 1.0, 365.0, False, 110),
    ("W01", "정상출근", "work", "day", False, None, None, False, 200),
    ("W02", "지각", "work", "day", False, None, None, False, 210),
    ("W03", "조퇴", "work", "day", False, None, None, False, 220),
    ("W04", "결근", "work", "day", False, None, None, False, 230),
    ("W05", "외출", "work", "hour", True, None, None, False, 240),
    ("W06", "출장", "work", "day", True, 1.0, 30.0, False, 250),
    ("W07", "재택근무", "work", "day", True, 1.0, 30.0, False, 260),
]

WORK_SCHEDULE_SEEDS = [
    # (code, name, work_start, work_end, break_min, is_overnight, work_hours, sort_order)
    ("WS01", "주간근무(표준)", "09:00", "18:00", 60, False, 8.0, 10),
    ("WS02", "주간근무(탄력)", "08:00", "17:00", 60, False, 8.0, 20),
    ("WS03", "시차출퇴근(A)", "07:00", "16:00", 60, False, 8.0, 30),
    ("WS04", "시차출퇴근(B)", "10:00", "19:00", 60, False, 8.0, 40),
    ("WS05", "야간근무", "22:00", "07:00", 60, True, 8.0, 50),
    ("WS06", "교대근무(주간)", "06:00", "14:00", 30, False, 7.5, 60),
    ("WS07", "교대근무(야간)", "14:00", "22:00", 30, False, 7.5, 70),
    ("WS08", "유연근무", "06:00", "22:00", 60, False, 8.0, 80),
]

HOLIDAY_SEEDS = [
    # 2025
    (date(2025, 1, 1), "신정", "legal"),
    (date(2025, 1, 28), "설날 전날", "legal"),
    (date(2025, 1, 29), "설날", "legal"),
    (date(2025, 1, 30), "설날 다음날", "legal"),
    (date(2025, 3, 1), "삼일절", "legal"),
    (date(2025, 5, 5), "어린이날", "legal"),
    (date(2025, 5, 6), "대체공휴일(석가탄신일)", "substitute"),
    (date(2025, 5, 15), "석가탄신일", "legal"),
    (date(2025, 6, 6), "현충일", "legal"),
    (date(2025, 8, 15), "광복절", "legal"),
    (date(2025, 10, 3), "개천절", "legal"),
    (date(2025, 10, 5), "추석 전날", "legal"),
    (date(2025, 10, 6), "추석", "legal"),
    (date(2025, 10, 7), "추석 다음날", "legal"),
    (date(2025, 10, 8), "대체공휴일(추석)", "substitute"),
    (date(2025, 10, 9), "한글날", "legal"),
    (date(2025, 12, 25), "크리스마스", "legal"),
    # 2026
    (date(2026, 1, 1), "신정", "legal"),
    (date(2026, 2, 16), "설날 전날", "legal"),
    (date(2026, 2, 17), "설날", "legal"),
    (date(2026, 2, 18), "설날 다음날", "legal"),
    (date(2026, 3, 1), "삼일절", "legal"),
    (date(2026, 3, 2), "대체공휴일(삼일절)", "substitute"),
    (date(2026, 5, 5), "어린이날", "legal"),
    (date(2026, 5, 24), "석가탄신일", "legal"),
    (date(2026, 5, 25), "대체공휴일(석가탄신일)", "substitute"),
    (date(2026, 6, 6), "현충일", "legal"),
    (date(2026, 8, 15), "광복절", "legal"),
    (date(2026, 9, 24), "추석 전날", "legal"),
    (date(2026, 9, 25), "추석", "legal"),
    (date(2026, 9, 26), "추석 다음날", "legal"),
    (date(2026, 10, 3), "개천절", "legal"),
    (date(2026, 10, 5), "대체공휴일(개천절)", "substitute"),
    (date(2026, 10, 9), "한글날", "legal"),
    (date(2026, 12, 25), "크리스마스", "legal"),
]


def ensure_attendance_codes(session: Session) -> None:
    for code, name, category, unit, is_requestable, min_days, max_days, deduct_annual, sort_order in ATTENDANCE_CODE_SEEDS:
        existing = session.exec(select(TimAttendanceCode).where(TimAttendanceCode.code == code)).first()
        if existing is None:
            session.add(TimAttendanceCode(
                code=code, name=name, category=category, unit=unit,
                is_requestable=is_requestable, min_days=min_days, max_days=max_days,
                deduct_annual=deduct_annual, sort_order=sort_order, is_active=True,
            ))
        else:
            changed = False
            if existing.name != name:
                existing.name = name
                changed = True
            if existing.category != category:
                existing.category = category
                changed = True
            if existing.sort_order != sort_order:
                existing.sort_order = sort_order
                changed = True
            if changed:
                session.add(existing)
    session.commit()


def ensure_work_schedule_codes(session: Session) -> None:
    for code, name, work_start, work_end, break_min, is_overnight, work_hours, sort_order in WORK_SCHEDULE_SEEDS:
        existing = session.exec(select(TimWorkScheduleCode).where(TimWorkScheduleCode.code == code)).first()
        if existing is None:
            session.add(TimWorkScheduleCode(
                code=code, name=name, work_start=work_start, work_end=work_end,
                break_minutes=break_min, is_overnight=is_overnight, work_hours=work_hours,
                sort_order=sort_order, is_active=True,
            ))
        else:
            changed = False
            if existing.name != name:
                existing.name = name
                changed = True
            if existing.sort_order != sort_order:
                existing.sort_order = sort_order
                changed = True
            if changed:
                session.add(existing)
    session.commit()


def ensure_holidays(session: Session) -> None:
    for holiday_date, name, holiday_type in HOLIDAY_SEEDS:
        existing = session.exec(select(TimHoliday).where(TimHoliday.holiday_date == holiday_date)).first()
        if existing is None:
            session.add(TimHoliday(
                holiday_date=holiday_date, name=name, holiday_type=holiday_type, is_active=True,
            ))
        else:
            changed = False
            if existing.name != name:
                existing.name = name
                changed = True
            if existing.holiday_type != holiday_type:
                existing.holiday_type = holiday_type
                changed = True
            if changed:
                session.add(existing)
    session.commit()


def ensure_annual_leave_seed(session: Session) -> None:
    year = date.today().year
    employees = session.exec(select(HrEmployee).order_by(HrEmployee.id)).all()

    for employee in employees:
        exists = session.exec(
            select(HrAnnualLeave.id).where(HrAnnualLeave.employee_id == employee.id, HrAnnualLeave.year == year)
        ).first()
        if exists is not None:
            continue

        years = max(0, year - employee.hire_date.year)
        if years <= 0:
            granted = 11.0
        elif years < 3:
            granted = 15.0
        else:
            granted = float(min(15 + ((years - 1) // 2), 25))

        carry = 0.0
        prev = session.exec(
            select(HrAnnualLeave).where(HrAnnualLeave.employee_id == employee.id, HrAnnualLeave.year == year - 1)
        ).first()
        if prev is not None:
            carry = min(prev.remaining_days, 5.0)

        session.add(
            HrAnnualLeave(
                employee_id=employee.id,
                year=year,
                granted_days=granted,
                used_days=0.0,
                carried_over_days=carry,
                remaining_days=granted + carry,
                grant_type="auto",
            )
        )
PAY_PAYROLL_CODE_SEEDS = [
    # code, name, pay_type, payment_day, tax_deductible, social_ins_deductible
    ("P100", "정규급여", "급여", "25", True, True),
    ("P200", "정기상여", "상여", "25", True, True),
    ("P300", "연차수당", "수당", "당월말일", True, True),
]

PAY_TAX_RATE_SEEDS = [
    # year, rate_type, employee_rate, employer_rate, min_limit, max_limit
    (2025, "국민연금", 4.5, 4.5, 390000, 6170000),
    (2025, "건강보험", 3.545, 3.545, 279266, 110332300),
    (2025, "장기요양", 0.4591, 0.4591, None, None),
    (2025, "고용보험", 0.9, 1.15, None, None),
]

HRI_FORM_TYPE_SEEDS = [
    # form_code, form_name_ko, module_code, requires_receive, default_priority
    ("CERT_EMPLOYMENT", "재직증명서 신청", "HR", True, 10),
    ("TIM_CORRECTION", "근태 정정 신청", "TIM", False, 20),
    ("EXPENSE_COMMON", "공통 경비 신청", "CPN", True, 30),
]

HRI_FORM_TYPE_POLICY_SEEDS = {
    "CERT_EMPLOYMENT": [
        ("attachment_required", "false"),
        ("max_attachment_count", "3"),
    ],
    "TIM_CORRECTION": [
        ("attachment_required", "true"),
        ("max_attachment_count", "5"),
    ],
    "EXPENSE_COMMON": [
        ("attachment_required", "true"),
        ("max_attachment_count", "10"),
    ],
}

HRI_APPROVAL_ACTOR_RULE_SEEDS = [
    # role_code, resolve_method, fallback_rule
    ("TEAM_LEADER", "ORG_CHAIN", "ESCALATE"),
    ("DEPT_HEAD", "ORG_CHAIN", "ESCALATE"),
    ("CEO", "JOB_POSITION", "HR_ADMIN"),
    ("HR_ADMIN", "FIXED_USER", "HR_ADMIN"),
]

HRI_APPROVAL_TEMPLATE_SEEDS = [
    {
        "template_code": "HRI_TMPL_CERT",
        "template_name": "증명서 기본 결재선",
        "scope_type": "GLOBAL",
        "scope_id": None,
        "is_default": False,
        "is_active": True,
        "priority": 120,
        "steps": [
            {"step_order": 1, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "TEAM_LEADER", "required_action": "APPROVE"},
            {"step_order": 2, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "DEPT_HEAD", "required_action": "APPROVE"},
            {"step_order": 3, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "CEO", "required_action": "APPROVE"},
            {"step_order": 4, "step_type": "RECEIVE", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "HR_ADMIN", "required_action": "RECEIVE"},
        ],
    },
    {
        "template_code": "HRI_TMPL_TIM_SIMPLE",
        "template_name": "근태 기본 결재선",
        "scope_type": "GLOBAL",
        "scope_id": None,
        "is_default": False,
        "is_active": True,
        "priority": 110,
        "steps": [
            {"step_order": 1, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "TEAM_LEADER", "required_action": "APPROVE"},
            {"step_order": 2, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "DEPT_HEAD", "required_action": "APPROVE"},
        ],
    },
    {
        "template_code": "HRI_TMPL_DEFAULT",
        "template_name": "공통 기본 결재선",
        "scope_type": "GLOBAL",
        "scope_id": None,
        "is_default": True,
        "is_active": True,
        "priority": 100,
        "steps": [
            {"step_order": 1, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "TEAM_LEADER", "required_action": "APPROVE"},
            {"step_order": 2, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "DEPT_HEAD", "required_action": "APPROVE"},
            {"step_order": 3, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "CEO", "required_action": "APPROVE"},
        ],
    },
]

HRI_FORM_TYPE_TEMPLATE_MAP_SEEDS = [
    # form_code, template_code
    ("CERT_EMPLOYMENT", "HRI_TMPL_CERT"),
    ("TIM_CORRECTION", "HRI_TMPL_TIM_SIMPLE"),
    ("EXPENSE_COMMON", "HRI_TMPL_DEFAULT"),
]


def ensure_pay_payroll_codes(session: Session) -> None:
    for code, name, pay_type, payment_day, tax_ded, social_ded in PAY_PAYROLL_CODE_SEEDS:
        existing = session.exec(select(PayPayrollCode).where(PayPayrollCode.code == code)).first()
        if existing is None:
            session.add(PayPayrollCode(
                code=code, name=name, pay_type=pay_type, payment_day=payment_day,
                tax_deductible=tax_ded, social_ins_deductible=social_ded, is_active=True
            ))
        else:
            changed = False
            if existing.name != name:
                existing.name = name
                changed = True
            if existing.tax_deductible != tax_ded:
                existing.tax_deductible = tax_ded
                changed = True
            if changed:
                session.add(existing)
    session.commit()


def ensure_hri_form_types(session: Session) -> None:
    for form_code, form_name_ko, module_code, requires_receive, default_priority in HRI_FORM_TYPE_SEEDS:
        existing = session.exec(select(HriFormType).where(HriFormType.form_code == form_code)).first()
        if existing is None:
            session.add(
                HriFormType(
                    form_code=form_code,
                    form_name_ko=form_name_ko,
                    module_code=module_code,
                    requires_receive=requires_receive,
                    is_active=True,
                    allow_draft=True,
                    allow_withdraw=True,
                    default_priority=default_priority,
                )
            )
        else:
            changed = False
            if existing.form_name_ko != form_name_ko:
                existing.form_name_ko = form_name_ko
                changed = True
            if existing.module_code != module_code:
                existing.module_code = module_code
                changed = True
            if existing.requires_receive != requires_receive:
                existing.requires_receive = requires_receive
                changed = True
            if existing.default_priority != default_priority:
                existing.default_priority = default_priority
                changed = True
            if not existing.is_active:
                existing.is_active = True
                changed = True
            if changed:
                session.add(existing)
    session.commit()


def ensure_hri_form_type_policies(session: Session) -> None:
    base_effective = date(2026, 1, 1)
    for form_code, policy_rows in HRI_FORM_TYPE_POLICY_SEEDS.items():
        form_type = session.exec(select(HriFormType).where(HriFormType.form_code == form_code)).first()
        if form_type is None:
            continue
        for policy_key, policy_value in policy_rows:
            existing = session.exec(
                select(HriFormTypePolicy).where(
                    HriFormTypePolicy.form_type_id == form_type.id,
                    HriFormTypePolicy.policy_key == policy_key,
                    HriFormTypePolicy.effective_from == base_effective,
                )
            ).first()
            if existing is None:
                session.add(
                    HriFormTypePolicy(
                        form_type_id=form_type.id,
                        policy_key=policy_key,
                        policy_value=policy_value,
                        effective_from=base_effective,
                        effective_to=None,
                    )
                )
            else:
                if existing.policy_value != policy_value:
                    existing.policy_value = policy_value
                    session.add(existing)
    session.commit()


def ensure_hri_approval_actor_rules(session: Session) -> None:
    for role_code, resolve_method, fallback_rule in HRI_APPROVAL_ACTOR_RULE_SEEDS:
        existing = session.exec(select(HriApprovalActorRule).where(HriApprovalActorRule.role_code == role_code)).first()
        if existing is None:
            session.add(
                HriApprovalActorRule(
                    role_code=role_code,
                    resolve_method=resolve_method,
                    fallback_rule=fallback_rule,
                    is_active=True,
                )
            )
        else:
            changed = False
            if existing.resolve_method != resolve_method:
                existing.resolve_method = resolve_method
                changed = True
            if existing.fallback_rule != fallback_rule:
                existing.fallback_rule = fallback_rule
                changed = True
            if not existing.is_active:
                existing.is_active = True
                changed = True
            if changed:
                session.add(existing)
    session.commit()


def ensure_hri_approval_templates(session: Session) -> None:
    for seed in HRI_APPROVAL_TEMPLATE_SEEDS:
        template = session.exec(
            select(HriApprovalLineTemplate).where(HriApprovalLineTemplate.template_code == seed["template_code"])
        ).first()
        if template is None:
            template = HriApprovalLineTemplate(
                template_code=seed["template_code"],
                template_name=seed["template_name"],
                scope_type=seed["scope_type"],
                scope_id=seed["scope_id"],
                is_default=seed["is_default"],
                is_active=seed["is_active"],
                priority=seed["priority"],
            )
            session.add(template)
            session.flush()
        else:
            template.template_name = seed["template_name"]
            template.scope_type = seed["scope_type"]
            template.scope_id = seed["scope_id"]
            template.is_default = seed["is_default"]
            template.is_active = seed["is_active"]
            template.priority = seed["priority"]
            session.add(template)
            session.flush()

        old_steps = session.exec(
            select(HriApprovalLineStep).where(HriApprovalLineStep.template_id == template.id)
        ).all()
        for old_step in old_steps:
            session.delete(old_step)
        session.flush()

        for step in seed["steps"]:
            session.add(
                HriApprovalLineStep(
                    template_id=template.id,
                    step_order=step["step_order"],
                    step_type=step["step_type"],
                    actor_resolve_type=step["actor_resolve_type"],
                    actor_role_code=step["actor_role_code"],
                    actor_user_id=None,
                    allow_delegate=True,
                    required_action=step["required_action"],
                )
            )

    session.commit()


def ensure_hri_form_type_template_maps(session: Session) -> None:
    effective_from = date(2026, 1, 1)
    for form_code, template_code in HRI_FORM_TYPE_TEMPLATE_MAP_SEEDS:
        form_type = session.exec(select(HriFormType).where(HriFormType.form_code == form_code)).first()
        template = session.exec(
            select(HriApprovalLineTemplate).where(HriApprovalLineTemplate.template_code == template_code)
        ).first()
        if form_type is None or template is None:
            continue

        existing = session.exec(
            select(HriFormTypeApprovalMap).where(
                HriFormTypeApprovalMap.form_type_id == form_type.id,
                HriFormTypeApprovalMap.template_id == template.id,
                HriFormTypeApprovalMap.effective_from == effective_from,
            )
        ).first()
        if existing is None:
            session.add(
                HriFormTypeApprovalMap(
                    form_type_id=form_type.id,
                    template_id=template.id,
                    is_active=True,
                    effective_from=effective_from,
                    effective_to=None,
                )
            )
        else:
            if not existing.is_active:
                existing.is_active = True
                session.add(existing)

    session.commit()


def ensure_pay_tax_rates(session: Session) -> None:
    for year, rate_type, emp_rate, empl_rate, min_l, max_l in PAY_TAX_RATE_SEEDS:
        existing = session.exec(select(PayTaxRate).where(
            PayTaxRate.year == year, PayTaxRate.rate_type == rate_type
        )).first()
        if existing is None:
            session.add(PayTaxRate(
                year=year, rate_type=rate_type, employee_rate=emp_rate, employer_rate=empl_rate,
                min_limit=min_l, max_limit=max_l
            ))
        else:
            changed = False
            if existing.employee_rate != emp_rate:
                existing.employee_rate = emp_rate
                changed = True
            if changed:
                session.add(existing)
    session.commit()
def seed_initial_data(session: Session) -> None:
    ensure_auth_user_login_id_schema(session)
    ensure_roles(session)
    departments = ensure_departments(session)
    department = next((item for item in departments if item.code == "HQ-HR"), departments[0])

    admin_local_user = ensure_user(
        session,
        login_id="admin-local",
        email="admin@vibe-hr.local",
        password="admin",
        display_name="Admin",
        reset_password=True,
    )
    quick_admin_user = ensure_user(
        session,
        login_id="admin",
        email="admin2@vibe-hr.local",
        password="admin",
        display_name="Admin",
        reset_password=True,
    )

    ensure_user_roles(session, admin_local_user, ["admin", "employee"])
    ensure_user_roles(session, quick_admin_user, ["admin", "employee"])

    admin_local_employee = ensure_employee(
        session,
        user=admin_local_user,
        employee_no="HR-0001",
        department_id=department.id,
        position_title="\uC778\uC0AC\uCD1D\uAD04",
    )
    ensure_employee(
        session,
        user=quick_admin_user,
        employee_no="HR-0002",
        department_id=department.id,
        position_title="\uC778\uC0AC\uB9E4\uB2C8\uC800",
    )

    ensure_bulk_korean_employees(session, departments=departments, total=DEV_EMPLOYEE_TOTAL)
    ensure_sample_records(session, admin_local_employee)
    ensure_menus(session)
    ensure_common_codes(session)
    ensure_hr_basic_seed_data(session)
    ensure_attendance_codes(session)
    ensure_work_schedule_codes(session)
    ensure_holidays(session)
    ensure_annual_leave_seed(session)
    ensure_pay_payroll_codes(session)
    ensure_pay_tax_rates(session)
    ensure_hri_form_types(session)
    ensure_hri_form_type_policies(session)
    ensure_hri_approval_actor_rules(session)
    ensure_hri_approval_templates(session)
    ensure_hri_form_type_template_maps(session)
