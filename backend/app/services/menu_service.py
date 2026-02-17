"""메뉴 트리 서비스 – 사용자 역할 기반으로 접근 가능한 메뉴를 트리 구조로 반환"""

from sqlmodel import Session, select

from app.models import AppMenu, AppMenuRole, AuthRole, AuthUserRole
from app.schemas.menu import MenuNode


def _build_tree(
    menus: list[AppMenu],
    accessible_menu_ids: set[int],
) -> list[MenuNode]:
    """메뉴 리스트를 트리 구조로 조립한다.

    부모 메뉴는 자신이 접근 가능하지 않더라도
    자식 중 하나라도 접근 가능하면 표시한다.
    """
    menu_map: dict[int, AppMenu] = {m.id: m for m in menus}
    children_map: dict[int | None, list[AppMenu]] = {}
    for m in menus:
        children_map.setdefault(m.parent_id, []).append(m)

    def _recurse(parent_id: int | None) -> list[MenuNode]:
        nodes: list[MenuNode] = []
        for m in sorted(children_map.get(parent_id, []), key=lambda x: x.sort_order):
            child_nodes = _recurse(m.id)
            # 메뉴 자체가 접근 가능하거나, 하위에 접근 가능한 메뉴가 있으면 포함
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


def get_menu_tree_for_user(session: Session, user_id: int) -> list[MenuNode]:
    """사용자의 역할 기반으로 접근 가능한 메뉴 트리를 반환한다."""

    # 1. 사용자의 role_id 목록 조회
    user_role_ids = list(
        session.exec(
            select(AuthUserRole.role_id).where(AuthUserRole.user_id == user_id)
        ).all()
    )

    if not user_role_ids:
        return []

    # 2. 해당 역할들에 매핑된 menu_id 조회
    accessible_menu_ids = set(
        session.exec(
            select(AppMenuRole.menu_id).where(
                AppMenuRole.role_id.in_(user_role_ids)
            )
        ).all()
    )

    if not accessible_menu_ids:
        return []

    # 3. 활성화된 전체 메뉴 조회 (트리 조립용)
    all_menus = list(
        session.exec(
            select(AppMenu).where(AppMenu.is_active == True)
        ).all()
    )

    # 4. 트리 구조로 조립
    return _build_tree(all_menus, accessible_menu_ids)


def check_menu_access(session: Session, user_id: int, menu_code: str) -> bool:
    """특정 메뉴에 대한 사용자의 접근 권한을 확인한다."""

    menu = session.exec(
        select(AppMenu).where(AppMenu.code == menu_code, AppMenu.is_active == True)
    ).first()

    if menu is None:
        return False

    user_role_ids = list(
        session.exec(
            select(AuthUserRole.role_id).where(AuthUserRole.user_id == user_id)
        ).all()
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
