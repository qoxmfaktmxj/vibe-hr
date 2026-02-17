from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.menu import (
    MenuAdminDetailResponse,
    MenuAdminItem,
    MenuAdminTreeResponse,
    MenuCreateRequest,
    MenuRoleMappingResponse,
    MenuRoleUpdateRequest,
    MenuTreeResponse,
    MenuUpdateRequest,
    RoleListResponse,
)
from app.services.menu_service import (
    create_menu,
    delete_menu,
    get_admin_menu_tree,
    get_menu_roles,
    get_menu_tree_for_user,
    list_roles,
    replace_menu_roles,
    update_menu,
)

router = APIRouter(prefix="/menus", tags=["menus"])


@router.get("/tree", response_model=MenuTreeResponse)
def menu_tree(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> MenuTreeResponse:
    """현재 로그인 사용자의 역할 기반으로 접근 가능한 메뉴 트리를 반환한다."""
    tree = get_menu_tree_for_user(session, current_user.id)
    return MenuTreeResponse(menus=tree)


@router.get(
    "/admin/tree",
    response_model=MenuAdminTreeResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_menu_tree(session: Session = Depends(get_session)) -> MenuAdminTreeResponse:
    return MenuAdminTreeResponse(menus=get_admin_menu_tree(session))


@router.post(
    "/admin",
    response_model=MenuAdminDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_create_menu(
    payload: MenuCreateRequest,
    session: Session = Depends(get_session),
) -> MenuAdminDetailResponse:
    menu = create_menu(
        session,
        code=payload.code,
        name=payload.name,
        parent_id=payload.parent_id,
        path=payload.path,
        icon=payload.icon,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    return MenuAdminDetailResponse(
        menu=MenuAdminItem(
            id=menu.id,
            code=menu.code,
            name=menu.name,
            parent_id=menu.parent_id,
            path=menu.path,
            icon=menu.icon,
            sort_order=menu.sort_order,
            is_active=menu.is_active,
            created_at=menu.created_at,
            updated_at=menu.updated_at,
        )
    )


@router.put(
    "/admin/{menu_id}",
    response_model=MenuAdminDetailResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_update_menu(
    menu_id: int,
    payload: MenuUpdateRequest,
    session: Session = Depends(get_session),
) -> MenuAdminDetailResponse:
    menu = update_menu(
        session,
        menu_id=menu_id,
        name=payload.name,
        parent_id=payload.parent_id,
        path=payload.path,
        icon=payload.icon,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    return MenuAdminDetailResponse(
        menu=MenuAdminItem(
            id=menu.id,
            code=menu.code,
            name=menu.name,
            parent_id=menu.parent_id,
            path=menu.path,
            icon=menu.icon,
            sort_order=menu.sort_order,
            is_active=menu.is_active,
            created_at=menu.created_at,
            updated_at=menu.updated_at,
        )
    )


@router.delete(
    "/admin/{menu_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_delete_menu(menu_id: int, session: Session = Depends(get_session)) -> Response:
    delete_menu(session, menu_id=menu_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/admin/roles",
    response_model=RoleListResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_role_list(session: Session = Depends(get_session)) -> RoleListResponse:
    return RoleListResponse(roles=list_roles(session))


@router.get(
    "/admin/{menu_id}/roles",
    response_model=MenuRoleMappingResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_menu_roles(menu_id: int, session: Session = Depends(get_session)) -> MenuRoleMappingResponse:
    return MenuRoleMappingResponse(menu_id=menu_id, roles=get_menu_roles(session, menu_id=menu_id))


@router.put(
    "/admin/{menu_id}/roles",
    response_model=MenuRoleMappingResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_update_menu_roles(
    menu_id: int,
    payload: MenuRoleUpdateRequest,
    session: Session = Depends(get_session),
) -> MenuRoleMappingResponse:
    roles = replace_menu_roles(session, menu_id=menu_id, role_ids=payload.role_ids)
    return MenuRoleMappingResponse(menu_id=menu_id, roles=roles)
