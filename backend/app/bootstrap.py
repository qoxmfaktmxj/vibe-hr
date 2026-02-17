from datetime import date

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


def ensure_auth_user_login_id_schema(session: Session) -> None:
    columns = session.exec(text("PRAGMA table_info(auth_users)")).all()
    column_names = {row[1] for row in columns}

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
    session.exec(
        text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_auth_users_login_id ON auth_users (login_id)"
        )
    )
    session.commit()


def ensure_roles(session: Session) -> None:
    role_map = {
        "admin": "관리자",
        "hr_manager": "인사담당자",
        "payroll_mgr": "급여담당자",
        "employee": "일반직원",
    }
    for code, name in role_map.items():
        existing_role = session.exec(select(AuthRole).where(AuthRole.code == code)).first()
        if existing_role is None:
            session.add(AuthRole(code=code, name=name))
    session.commit()


def ensure_department(session: Session) -> OrgDepartment:
    dept = session.exec(select(OrgDepartment).where(OrgDepartment.code == "HQ-HR")).first()
    if dept is None:
        dept = OrgDepartment(code="HQ-HR", name="인사팀")
        session.add(dept)
        session.commit()
        session.refresh(dept)
    return dept


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
                reason="샘플 연차 신청",
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


def _link_menu_roles(session: Session, menu: AppMenu, role_codes: list[str]) -> None:
    roles = session.exec(select(AuthRole).where(AuthRole.code.in_(role_codes))).all()
    existing = session.exec(
        select(AppMenuRole).where(AppMenuRole.menu_id == menu.id)
    ).all()
    existing_role_ids = {link.role_id for link in existing}

    for role in roles:
        if role.id not in existing_role_ids:
            session.add(AppMenuRole(menu_id=menu.id, role_id=role.id))
    session.commit()


# ── 메뉴 구조 정의 ──
_MENU_TREE: list[dict] = [
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
        "name": "인사관리",
        "path": None,
        "icon": "UsersRound",
        "sort_order": 200,
        "roles": ["hr_manager", "admin"],
        "children": [
            {
                "code": "hr.employee",
                "name": "사원관리",
                "path": "/hr/employee",
                "icon": "UserRound",
                "sort_order": 210,
                "roles": ["hr_manager", "admin"],
            },
            {
                "code": "hr.attendance",
                "name": "근태관리",
                "path": "/hr/attendance",
                "icon": "Clock",
                "sort_order": 220,
                "roles": ["employee", "hr_manager", "admin"],
            },
            {
                "code": "hr.leave",
                "name": "휴가관리",
                "path": "/hr/leave",
                "icon": "CalendarDays",
                "sort_order": 230,
                "roles": ["employee", "hr_manager", "admin"],
            },
        ],
    },
    {
        "code": "payroll",
        "name": "급여관리",
        "path": None,
        "icon": "Wallet",
        "sort_order": 300,
        "roles": ["payroll_mgr", "admin"],
        "children": [
            {
                "code": "payroll.calc",
                "name": "급여계산",
                "path": "/payroll/calc",
                "icon": "Calculator",
                "sort_order": 310,
                "roles": ["payroll_mgr", "admin"],
            },
            {
                "code": "payroll.slip",
                "name": "급여명세서",
                "path": "/payroll/slip",
                "icon": "FileText",
                "sort_order": 320,
                "roles": ["employee", "payroll_mgr", "admin"],
            },
        ],
    },
    {
        "code": "settings",
        "name": "설정",
        "path": None,
        "icon": "Settings",
        "sort_order": 900,
        "roles": ["admin"],
        "children": [
            {
                "code": "settings.roles",
                "name": "권한관리",
                "path": "/settings/roles",
                "icon": "Shield",
                "sort_order": 910,
                "roles": ["admin"],
            },
            {
                "code": "settings.menus",
                "name": "메뉴관리",
                "path": "/settings/menus",
                "icon": "Menu",
                "sort_order": 920,
                "roles": ["admin"],
            },
        ],
    },
]


def ensure_menus(session: Session) -> None:
    for top in _MENU_TREE:
        parent_menu = _get_or_create_menu(
            session,
            code=top["code"],
            name=top["name"],
            path=top.get("path"),
            icon=top.get("icon"),
            sort_order=top.get("sort_order", 0),
        )
        _link_menu_roles(session, parent_menu, top["roles"])

        for child in top.get("children", []):
            child_menu = _get_or_create_menu(
                session,
                code=child["code"],
                name=child["name"],
                parent_id=parent_menu.id,
                path=child.get("path"),
                icon=child.get("icon"),
                sort_order=child.get("sort_order", 0),
            )
            _link_menu_roles(session, child_menu, child["roles"])


def seed_initial_data(session: Session) -> None:
    ensure_auth_user_login_id_schema(session)
    ensure_roles(session)
    department = ensure_department(session)

    admin_local_user = ensure_user(
        session,
        login_id="admin-local",
        email="admin@vibe-hr.local",
        password="admin1234",
        display_name="Vibe HR 관리자",
    )
    quick_admin_user = ensure_user(
        session,
        login_id="admin",
        email="admin2@vibe-hr.local",
        password="admin",
        display_name="기본 관리자",
        reset_password=True,
    )

    ensure_user_roles(session, admin_local_user, ["admin", "employee"])
    ensure_user_roles(session, quick_admin_user, ["admin", "employee"])

    admin_local_employee = ensure_employee(
        session,
        user=admin_local_user,
        employee_no="HR-0001",
        department_id=department.id,
        position_title="HR Director",
    )
    ensure_employee(
        session,
        user=quick_admin_user,
        employee_no="HR-0002",
        department_id=department.id,
        position_title="HR Manager",
    )

    ensure_sample_records(session, admin_local_employee)

    # 메뉴 및 메뉴-역할 매핑 시드
    ensure_menus(session)
