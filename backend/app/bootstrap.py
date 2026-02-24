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
    HrLeaveRequest,
    OrgDepartment,
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
        "name": "\uB300\uC2DC\uBCF4\uB4DC",
        "path": "/dashboard",
        "icon": "LayoutDashboard",
        "sort_order": 100,
        "roles": ["employee", "hr_manager", "payroll_mgr", "admin"],
        "children": [],
    },
    {
        "code": "hr",
        "name": "\uC778\uC0AC",
        "path": None,
        "icon": "UsersRound",
        "sort_order": 200,
        "roles": ["hr_manager", "admin"],
        "children": [
            {
                "code": "hr.basic",
                "name": "\uC778\uC0AC\uAE30\uBCF8",
                "path": "/hr/basic",
                "icon": "UserRound",
                "sort_order": 205,
                "roles": ["hr_manager", "admin"],
            },
            {
                "code": "hr.employee",
                "name": "\uC0AC\uC6D0\uAD00\uB9AC",
                "path": "/hr/employee",
                "icon": "UserRound",
                "sort_order": 210,
                "roles": ["hr_manager", "admin"],
            },
        ],
    },
    {
        "code": "org",
        "name": "\uC870\uC9C1",
        "path": None,
        "icon": "Building2",
        "sort_order": 210,
        "roles": ["hr_manager", "admin"],
        "children": [
            {
                "code": "org.departments",
                "name": "\uC870\uC9C1\uCF54\uB4DC\uAD00\uB9AC",
                "path": "/org/departments",
                "icon": "FolderTree",
                "sort_order": 211,
                "roles": ["hr_manager", "admin"],
            },
        ],
    },
    {
        "code": "tim",
        "name": "\uADFC\uD0DC",
        "path": None,
        "icon": "Clock",
        "sort_order": 220,
        "roles": ["employee", "hr_manager", "admin"],
        "children": [
            {
                "code": "hr.attendance",
                "name": "\uADFC\uD0DC\uCF54\uB4DC\uAD00\uB9AC",
                "path": "/tim/codes",
                "icon": "CalendarCheck2",
                "sort_order": 221,
                "roles": ["hr_manager", "admin"],
            },
            {
                "code": "hr.leave",
                "name": "\uD734\uC77C\uAD00\uB9AC",
                "path": "/tim/holidays",
                "icon": "CalendarDays",
                "sort_order": 222,
                "roles": ["hr_manager", "admin"],
            },
        ],
    },
    {
        "code": "payroll",
        "name": "\uAE09\uC5EC",
        "path": None,
        "icon": "Wallet",
        "sort_order": 300,
        "roles": ["payroll_mgr", "admin"],
        "children": [
            {
                "code": "payroll.calc",
                "name": "\uAE09\uC5EC\uACC4\uC0B0",
                "path": "/payroll/calc",
                "icon": "Calculator",
                "sort_order": 310,
                "roles": ["payroll_mgr", "admin"],
            },
            {
                "code": "payroll.slip",
                "name": "\uAE09\uC5EC\uBA85\uC138\uC11C",
                "path": "/payroll/slip",
                "icon": "FileText",
                "sort_order": 320,
                "roles": ["employee", "payroll_mgr", "admin"],
            },
        ],
    },
    {
        "code": "settings",
        "name": "\uC2DC\uC2A4\uD15C",
        "path": None,
        "icon": "Settings",
        "sort_order": 900,
        "roles": ["admin"],
        "children": [
            {
                "code": "settings.roles",
                "name": "\uAD8C\uD55C\uAD00\uB9AC",
                "path": "/settings/roles",
                "icon": "Shield",
                "sort_order": 910,
                "roles": ["admin"],
            },
            {
                "code": "settings.permissions",
                "name": "\uBA54\uB274\uAD8C\uD55C\uAD00\uB9AC",
                "path": "/settings/permissions",
                "icon": "Menu",
                "sort_order": 915,
                "roles": ["admin"],
            },
            {
                "code": "settings.common-codes",
                "name": "\uACF5\uD1B5\uCF54\uB4DC\uAD00\uB9AC",
                "path": "/settings/common-codes",
                "icon": "ListOrdered",
                "sort_order": 918,
                "roles": ["admin"],
            },
            {
                "code": "settings.menus",
                "name": "\uBA54\uB274\uAD00\uB9AC",
                "path": "/settings/menus",
                "icon": "PanelLeft",
                "sort_order": 920,
                "roles": ["admin"],
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
    def _upsert(node: dict, parent_id: int | None = None) -> None:
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
