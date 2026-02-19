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
    RoleCreateRequest,
    RoleDetailResponse,
    RoleListResponse,
    RoleMenuPermissionItem,
    RoleMenuPermissionMatrixResponse,
    RoleMenuPermissionMatrixUpdateRequest,
    RoleMenuMappingResponse,
    RoleMenuUpdateRequest,
    RoleUpdateRequest,
)
from app.services.menu_service import (
    create_menu,
    create_role,
    delete_menu,
    delete_role,
    get_admin_menu_tree,
    get_menu_roles,
    get_role_menu_permission_matrix,
    get_menu_tree_for_user,
    get_role_menus,
    list_roles,
    replace_menu_roles,
    replace_role_menu_permission_matrix,
    replace_role_menus,
    update_menu,
    update_role,
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
    "/admin/roles/permissions",
    response_model=RoleMenuPermissionMatrixResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_role_permission_matrix(
    session: Session = Depends(get_session),
) -> RoleMenuPermissionMatrixResponse:
    matrix = get_role_menu_permission_matrix(session)
    mappings = [
        RoleMenuPermissionItem(role_id=role_id, menu_ids=menu_ids)
        for role_id, menu_ids in matrix.items()
    ]
    return RoleMenuPermissionMatrixResponse(mappings=mappings)


@router.put(
    "/admin/roles/permissions",
    response_model=RoleMenuPermissionMatrixResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_update_role_permission_matrix(
    payload: RoleMenuPermissionMatrixUpdateRequest,
    session: Session = Depends(get_session),
) -> RoleMenuPermissionMatrixResponse:
    requested: dict[int, list[int]] = {}
    for item in payload.mappings:
        requested[item.role_id] = item.menu_ids

    matrix = replace_role_menu_permission_matrix(session, mappings=requested)
    mappings = [
        RoleMenuPermissionItem(role_id=role_id, menu_ids=menu_ids)
        for role_id, menu_ids in matrix.items()
    ]
    return RoleMenuPermissionMatrixResponse(mappings=mappings)


@router.post(
    "/admin/roles",
    response_model=RoleDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_create_role(payload: RoleCreateRequest, session: Session = Depends(get_session)) -> RoleDetailResponse:
    role = create_role(session, code=payload.code, name=payload.name)
    return RoleDetailResponse(role={"id": role.id, "code": role.code, "name": role.name})


@router.put(
    "/admin/roles/{role_id}",
    response_model=RoleDetailResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_update_role(
    role_id: int,
    payload: RoleUpdateRequest,
    session: Session = Depends(get_session),
) -> RoleDetailResponse:
    role = update_role(session, role_id=role_id, name=payload.name)
    return RoleDetailResponse(role={"id": role.id, "code": role.code, "name": role.name})


@router.delete(
    "/admin/roles/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_delete_role(role_id: int, session: Session = Depends(get_session)) -> Response:
    delete_role(session, role_id=role_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/admin/roles/{role_id}/menus",
    response_model=RoleMenuMappingResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_role_menus(role_id: int, session: Session = Depends(get_session)) -> RoleMenuMappingResponse:
    return RoleMenuMappingResponse(role_id=role_id, menus=get_role_menus(session, role_id=role_id))


@router.put(
    "/admin/roles/{role_id}/menus",
    response_model=RoleMenuMappingResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def admin_update_role_menus(
    role_id: int,
    payload: RoleMenuUpdateRequest,
    session: Session = Depends(get_session),
) -> RoleMenuMappingResponse:
    menus = replace_role_menus(session, role_id=role_id, menu_ids=payload.menu_ids)
    return RoleMenuMappingResponse(role_id=role_id, menus=menus)


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
