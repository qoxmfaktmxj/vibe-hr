from __future__ import annotations

from datetime import date
import random
import string

from sqlalchemy import text
from sqlmodel import Session, select

from app.core.security import hash_password
from app.models import (
    AppMenu,
    AppMenuRole,
    AuthRole,
    AuthUser,
    AuthUserRole,
    HrAttendanceDaily,
    HrEmployee,
    HrLeaveRequest,
    OrgDepartment,
)

DEV_EMPLOYEE_TOTAL = 2000
DEV_EMPLOYEE_LOGIN_PREFIX = "kr-"
DEV_EMPLOYEE_PASSWORD_HASH = hash_password("admin")

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

DEPARTMENT_SEEDS = [
    ("HQ-HR", "\uC778\uC0AC\uD300"),
    ("HQ-ENG", "\uAC1C\uBC1C\uD300"),
    ("HQ-SALES", "\uC601\uC5C5\uD300"),
    ("HQ-FIN", "\uC7AC\uBB34\uD300"),
    ("HQ-OPS", "\uC6B4\uC601\uD300"),
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
        if department.code == "HQ-HR":
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

    department_ids = [department.id for department in departments]

    for index in range(1, total + 1):
        login_id = _build_dev_login_id(index)
        email = f"{login_id}@vibe-hr.local"
        display_name = _build_korean_name(index)

        user = user_by_login.get(login_id)
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
                department_id=department_ids[(index - 1) % len(department_ids)],
                position_title="Staff",
                hire_date=date(hire_year, hire_month, hire_day),
                employment_status="active",
            )
            session.add(employee)
            employee_by_user_id[user.id] = employee

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
