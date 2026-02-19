"""메뉴 트리/관리 서비스"""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, delete, select

from app.models import AppMenu, AppMenuRole, AuthRole, AuthUserRole
from app.schemas.menu import MenuAdminItem, MenuNode, RoleItem


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _build_tree(
    menus: list[AppMenu],
    accessible_menu_ids: set[int],
) -> list[MenuNode]:
    """메뉴 리스트를 트리 구조로 조립한다.

    부모 메뉴는 자신이 접근 가능하지 않더라도
    자식 중 하나라도 접근 가능하면 표시한다.
    """
    children_map: dict[int | None, list[AppMenu]] = {}
    for m in menus:
        children_map.setdefault(m.parent_id, []).append(m)

    def _recurse(parent_id: int | None) -> list[MenuNode]:
        nodes: list[MenuNode] = []
        for m in sorted(children_map.get(parent_id, []), key=lambda x: x.sort_order):
            child_nodes = _recurse(m.id)
            if m.id in accessible_menu_ids or child_nodes:
                nodes.append(
                    MenuNode(
                        id=m.id,
                        code=m.code,
                        name=m.name,
                        path=m.path,
                        icon=m.icon,
                        sort_order=m.sort_order,
                        children=child_nodes,
                    )
                )
        return nodes

    return _recurse(None)


def _build_admin_tree(menus: list[AppMenu]) -> list[MenuAdminItem]:
    children_map: dict[int | None, list[AppMenu]] = {}
    for m in menus:
        children_map.setdefault(m.parent_id, []).append(m)

    def _recurse(parent_id: int | None) -> list[MenuAdminItem]:
        nodes: list[MenuAdminItem] = []
        for m in sorted(children_map.get(parent_id, []), key=lambda x: x.sort_order):
            nodes.append(
                MenuAdminItem(
                    id=m.id,
                    code=m.code,
                    name=m.name,
                    parent_id=m.parent_id,
                    path=m.path,
                    icon=m.icon,
                    sort_order=m.sort_order,
                    is_active=m.is_active,
                    created_at=m.created_at,
                    updated_at=m.updated_at,
                    children=_recurse(m.id),
                )
            )
        return nodes

    return _recurse(None)


def _get_menu_or_404(session: Session, menu_id: int) -> AppMenu:
    menu = session.get(AppMenu, menu_id)
    if menu is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="메뉴를 찾을 수 없습니다.")
    return menu


def get_menu_tree_for_user(session: Session, user_id: int) -> list[MenuNode]:
    user_role_ids = list(
        session.exec(select(AuthUserRole.role_id).where(AuthUserRole.user_id == user_id)).all()
    )
    if not user_role_ids:
        return []

    accessible_menu_ids = set(
        session.exec(select(AppMenuRole.menu_id).where(AppMenuRole.role_id.in_(user_role_ids))).all()
    )
    if not accessible_menu_ids:
        return []

    all_menus = list(session.exec(select(AppMenu).where(AppMenu.is_active == True)).all())
    return _build_tree(all_menus, accessible_menu_ids)


def get_admin_menu_tree(session: Session) -> list[MenuAdminItem]:
    all_menus = list(session.exec(select(AppMenu)).all())
    return _build_admin_tree(all_menus)


def create_menu(
    session: Session,
    *,
    code: str,
    name: str,
    parent_id: int | None,
    path: str | None,
    icon: str | None,
    sort_order: int,
    is_active: bool,
) -> AppMenu:
    code = code.strip()
    name = name.strip()

    exists = session.exec(select(AppMenu).where(AppMenu.code == code)).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 존재하는 메뉴 코드입니다.")

    if parent_id is not None and session.get(AppMenu, parent_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 부모 메뉴입니다.")

    menu = AppMenu(
        code=code,
        name=name,
        parent_id=parent_id,
        path=(path or None),
        icon=(icon or None),
        sort_order=sort_order,
        is_active=is_active,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(menu)
    session.commit()
    session.refresh(menu)
    return menu


def update_menu(
    session: Session,
    *,
    menu_id: int,
    name: str | None,
    parent_id: int | None,
    path: str | None,
    icon: str | None,
    sort_order: int | None,
    is_active: bool | None,
) -> AppMenu:
    menu = _get_menu_or_404(session, menu_id)

    if parent_id == menu.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자기 자신을 부모로 지정할 수 없습니다.")
    if parent_id is not None and session.get(AppMenu, parent_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 부모 메뉴입니다.")

    if name is not None:
        menu.name = name.strip()
    if path is not None:
        menu.path = path or None
    if icon is not None:
        menu.icon = icon or None
    if sort_order is not None:
        menu.sort_order = sort_order
    if is_active is not None:
        menu.is_active = is_active

    menu.parent_id = parent_id
    menu.updated_at = _utc_now()

    session.add(menu)
    session.commit()
    session.refresh(menu)
    return menu


def delete_menu(session: Session, *, menu_id: int) -> None:
    menu = _get_menu_or_404(session, menu_id)
    child_exists = session.exec(select(AppMenu.id).where(AppMenu.parent_id == menu_id)).first()
    if child_exists is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="하위 메뉴가 있어 삭제할 수 없습니다. 하위 메뉴를 먼저 정리해 주세요.",
        )

    session.exec(delete(AppMenuRole).where(AppMenuRole.menu_id == menu_id))
    session.delete(menu)
    session.commit()


def list_roles(session: Session) -> list[RoleItem]:
    rows = session.exec(select(AuthRole).order_by(AuthRole.id)).all()
    return [RoleItem(id=r.id, code=r.code, name=r.name) for r in rows]


def get_menu_roles(session: Session, *, menu_id: int) -> list[RoleItem]:
    _get_menu_or_404(session, menu_id)
    rows = session.exec(
        select(AuthRole)
        .join(AppMenuRole, AppMenuRole.role_id == AuthRole.id)
        .where(AppMenuRole.menu_id == menu_id)
        .order_by(AuthRole.id)
    ).all()
    return [RoleItem(id=r.id, code=r.code, name=r.name) for r in rows]


def replace_menu_roles(session: Session, *, menu_id: int, role_ids: list[int]) -> list[RoleItem]:
    _get_menu_or_404(session, menu_id)

    valid_role_ids = set(session.exec(select(AuthRole.id)).all())
    unknown = [role_id for role_id in role_ids if role_id not in valid_role_ids]
    if unknown:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"유효하지 않은 role_id: {unknown}")

    session.exec(delete(AppMenuRole).where(AppMenuRole.menu_id == menu_id))
    for role_id in sorted(set(role_ids)):
        session.add(AppMenuRole(menu_id=menu_id, role_id=role_id))
    session.commit()

    return get_menu_roles(session, menu_id=menu_id)


def check_menu_access(session: Session, user_id: int, menu_code: str) -> bool:
    menu = session.exec(select(AppMenu).where(AppMenu.code == menu_code, AppMenu.is_active == True)).first()
    if menu is None:
        return False

    user_role_ids = list(
        session.exec(select(AuthUserRole.role_id).where(AuthUserRole.user_id == user_id)).all()
    )
    if not user_role_ids:
        return False

    link = session.exec(
        select(AppMenuRole).where(
            AppMenuRole.menu_id == menu.id,
            AppMenuRole.role_id.in_(user_role_ids),
        )
    ).first()
    return link is not None


def _get_role_or_404(session: Session, role_id: int) -> AuthRole:
    role = session.get(AuthRole, role_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="역할을 찾을 수 없습니다.")
    return role


def create_role(session: Session, *, code: str, name: str) -> AuthRole:
    code = code.strip()
    name = name.strip()

    exists = session.exec(select(AuthRole).where(AuthRole.code == code)).first()
    if exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 존재하는 역할 코드입니다.")

    role = AuthRole(code=code, name=name)
    session.add(role)
    session.commit()
    session.refresh(role)
    return role


def update_role(session: Session, *, role_id: int, name: str) -> AuthRole:
    role = _get_role_or_404(session, role_id)
    role.name = name.strip()
    session.add(role)
    session.commit()
    session.refresh(role)
    return role


def delete_role(session: Session, *, role_id: int) -> None:
    role = _get_role_or_404(session, role_id)

    linked_users = session.exec(select(AuthUserRole.user_id).where(AuthUserRole.role_id == role_id)).first()
    if linked_users is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="사용자에 연결된 역할은 삭제할 수 없습니다.")

    session.exec(delete(AppMenuRole).where(AppMenuRole.role_id == role_id))
    session.delete(role)
    session.commit()


def get_role_menus(session: Session, *, role_id: int) -> list[MenuAdminItem]:
    _get_role_or_404(session, role_id)

    selected_menu_ids = set(
        session.exec(select(AppMenuRole.menu_id).where(AppMenuRole.role_id == role_id)).all()
    )
    if not selected_menu_ids:
        return []

    all_menus = list(session.exec(select(AppMenu)).all())
    menu_map = {menu.id: menu for menu in all_menus}

    # Include ancestors so selected child menus appear in context.
    menu_ids_with_ancestors = set(selected_menu_ids)
    for menu_id in selected_menu_ids:
        current = menu_map.get(menu_id)
        while current is not None and current.parent_id is not None:
            parent_id = current.parent_id
            if parent_id in menu_ids_with_ancestors:
                current = menu_map.get(parent_id)
                continue
            menu_ids_with_ancestors.add(parent_id)
            current = menu_map.get(parent_id)

    return _build_admin_tree([m for m in all_menus if m.id in menu_ids_with_ancestors])


def replace_role_menus(session: Session, *, role_id: int, menu_ids: list[int]) -> list[MenuAdminItem]:
    _get_role_or_404(session, role_id)

    valid_menu_ids = set(session.exec(select(AppMenu.id)).all())
    unknown = [menu_id for menu_id in menu_ids if menu_id not in valid_menu_ids]
    if unknown:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"유효하지 않은 menu_id: {unknown}")

    session.exec(delete(AppMenuRole).where(AppMenuRole.role_id == role_id))
    for menu_id in sorted(set(menu_ids)):
        session.add(AppMenuRole(menu_id=menu_id, role_id=role_id))
    session.commit()

    return get_role_menus(session, role_id=role_id)


def get_role_menu_permission_matrix(
    session: Session,
    *,
    role_ids: list[int] | None = None,
) -> dict[int, list[int]]:
    if role_ids is None:
        target_role_ids = list(session.exec(select(AuthRole.id).order_by(AuthRole.id)).all())
    else:
        valid_role_ids = set(session.exec(select(AuthRole.id)).all())
        unknown = [role_id for role_id in role_ids if role_id not in valid_role_ids]
        if unknown:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role_id: {unknown}",
            )
        target_role_ids = sorted(set(role_ids))

    if not target_role_ids:
        return {}

    rows = session.exec(
        select(AppMenuRole.role_id, AppMenuRole.menu_id).where(AppMenuRole.role_id.in_(target_role_ids))
    ).all()
    matrix = {role_id: [] for role_id in target_role_ids}
    for role_id, menu_id in rows:
        matrix[role_id].append(menu_id)

    for role_id in matrix:
        matrix[role_id] = sorted(set(matrix[role_id]))

    return matrix


def replace_role_menu_permission_matrix(
    session: Session,
    *,
    mappings: dict[int, list[int]],
) -> dict[int, list[int]]:
    if not mappings:
        return {}

    role_ids = sorted(set(mappings.keys()))
    valid_role_ids = set(session.exec(select(AuthRole.id)).all())
    unknown_roles = [role_id for role_id in role_ids if role_id not in valid_role_ids]
    if unknown_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role_id: {unknown_roles}",
        )

    valid_menu_ids = set(session.exec(select(AppMenu.id)).all())
    for role_id, menu_ids in mappings.items():
        unknown_menus = [menu_id for menu_id in menu_ids if menu_id not in valid_menu_ids]
        if unknown_menus:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"role_id={role_id}, invalid menu_id: {unknown_menus}",
            )

    session.exec(delete(AppMenuRole).where(AppMenuRole.role_id.in_(role_ids)))
    for role_id in role_ids:
        for menu_id in sorted(set(mappings.get(role_id, []))):
            session.add(AppMenuRole(menu_id=menu_id, role_id=role_id))
    session.commit()

    return get_role_menu_permission_matrix(session, role_ids=role_ids)
