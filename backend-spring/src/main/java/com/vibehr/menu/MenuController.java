package com.vibehr.menu;

import com.vibehr.auth.CurrentUser;
import com.vibehr.menu.MenuPermissionService.AllowedActions;
import com.vibehr.menu.MenuPermissionService.MenuAdminItem;
import com.vibehr.menu.MenuPermissionService.MenuCreateRequest;
import com.vibehr.menu.MenuPermissionService.MenuNode;
import com.vibehr.menu.MenuPermissionService.MenuUpdateRequest;
import com.vibehr.menu.MenuPermissionService.RoleCreateRequest;
import com.vibehr.menu.MenuPermissionService.RoleItem;
import com.vibehr.menu.MenuPermissionService.RoleMenuActionPermission;
import com.vibehr.menu.MenuPermissionService.RoleMenuPermission;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/menus")
@Validated
@Profile("!test")
public class MenuController {

    private final MenuPermissionService service;

    MenuController(MenuPermissionService service) {
        this.service = service;
    }

    @GetMapping("/tree")
    MenuTreeResponse tree(@AuthenticationPrincipal CurrentUser currentUser) {
        return new MenuTreeResponse(service.treeForUser(currentUser.id()));
    }

    @GetMapping("/actions/current")
    MenuActionPermissionResponse actions(
            @AuthenticationPrincipal CurrentUser currentUser,
            @RequestParam(required = false) String menuCode,
            @RequestParam(required = false) String path
    ) {
        AllowedActions result = service.allowedActions(currentUser.id(), menuCode, path);
        List<MenuActionPermissionItem> actions = result.actions().entrySet().stream()
                .map(entry -> new MenuActionPermissionItem(entry.getKey(), entry.getValue())).toList();
        List<String> allowedActions = actions.stream().filter(MenuActionPermissionItem::allowed).map(MenuActionPermissionItem::actionCode).toList();
        return new MenuActionPermissionResponse(result.menuCode(), result.path(), allowedActions, actions);
    }

    @GetMapping("/admin/tree")
    MenuAdminTreeResponse adminTree(@AuthenticationPrincipal CurrentUser currentUser) {
        service.requireAdmin(currentUser);
        return new MenuAdminTreeResponse(service.adminTree());
    }

    @PostMapping("/admin")
    @ResponseStatus(HttpStatus.CREATED)
    MenuAdminDetailResponse createMenu(@AuthenticationPrincipal CurrentUser currentUser, @Valid @RequestBody MenuCreatePayload payload) {
        service.requireAdmin(currentUser);
        return new MenuAdminDetailResponse(service.createMenu(payload.toRequest()));
    }

    @PutMapping("/admin/{menuId}")
    MenuAdminDetailResponse updateMenu(
            @AuthenticationPrincipal CurrentUser currentUser,
            @PathVariable long menuId,
            @Valid @RequestBody MenuUpdatePayload payload
    ) {
        service.requireAdmin(currentUser);
        return new MenuAdminDetailResponse(service.updateMenu(menuId, payload.toRequest()));
    }

    @DeleteMapping("/admin/{menuId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteMenu(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable long menuId) {
        service.requireAdmin(currentUser);
        service.deleteMenu(menuId);
    }

    @GetMapping("/admin/roles")
    RoleListResponse roles(@AuthenticationPrincipal CurrentUser currentUser) {
        service.requireAdmin(currentUser);
        return new RoleListResponse(service.listRoles());
    }

    @GetMapping("/admin/roles/permissions")
    RoleMenuPermissionMatrixResponse permissionMatrix(@AuthenticationPrincipal CurrentUser currentUser) {
        service.requireAdmin(currentUser);
        return new RoleMenuPermissionMatrixResponse(service.permissionMatrix());
    }

    @PutMapping("/admin/roles/permissions")
    RoleMenuPermissionMatrixResponse replacePermissionMatrix(
            @AuthenticationPrincipal CurrentUser currentUser,
            @Valid @RequestBody RoleMenuPermissionMatrixPayload payload
    ) {
        service.requireAdmin(currentUser);
        return new RoleMenuPermissionMatrixResponse(service.replacePermissionMatrix(payload.mappings()));
    }

    @GetMapping("/admin/roles/action-permissions")
    RoleMenuActionPermissionMatrixResponse actionPermissionMatrix(@AuthenticationPrincipal CurrentUser currentUser) {
        service.requireAdmin(currentUser);
        return new RoleMenuActionPermissionMatrixResponse(service.actionPermissionMatrix());
    }

    @PutMapping("/admin/roles/action-permissions")
    RoleMenuActionPermissionMatrixResponse replaceActionPermissionMatrix(
            @AuthenticationPrincipal CurrentUser currentUser,
            @Valid @RequestBody RoleMenuActionPermissionMatrixPayload payload
    ) {
        service.requireAdmin(currentUser);
        return new RoleMenuActionPermissionMatrixResponse(service.replaceActionPermissionMatrix(payload.mappings()));
    }

    @PostMapping("/admin/roles")
    @ResponseStatus(HttpStatus.CREATED)
    RoleDetailResponse createRole(@AuthenticationPrincipal CurrentUser currentUser, @Valid @RequestBody RoleCreatePayload payload) {
        service.requireAdmin(currentUser);
        return new RoleDetailResponse(service.createRole(new RoleCreateRequest(payload.code(), payload.name())));
    }

    @PutMapping("/admin/roles/{roleId}")
    RoleDetailResponse updateRole(
            @AuthenticationPrincipal CurrentUser currentUser,
            @PathVariable long roleId,
            @Valid @RequestBody RoleUpdatePayload payload
    ) {
        service.requireAdmin(currentUser);
        return new RoleDetailResponse(service.updateRole(roleId, payload.name()));
    }

    @DeleteMapping("/admin/roles/{roleId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteRole(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable long roleId) {
        service.requireAdmin(currentUser);
        service.deleteRole(roleId);
    }

    @GetMapping("/admin/roles/{roleId}/menus")
    RoleMenuMappingResponse roleMenus(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable long roleId) {
        service.requireAdmin(currentUser);
        return new RoleMenuMappingResponse(roleId, service.roleMenus(roleId));
    }

    @PutMapping("/admin/roles/{roleId}/menus")
    RoleMenuMappingResponse replaceRoleMenus(
            @AuthenticationPrincipal CurrentUser currentUser,
            @PathVariable long roleId,
            @Valid @RequestBody RoleMenuPayload payload
    ) {
        service.requireAdmin(currentUser);
        return new RoleMenuMappingResponse(roleId, service.replaceRoleMenus(roleId, payload.menuIds()));
    }

    @GetMapping("/admin/{menuId}/roles")
    MenuRoleMappingResponse menuRoles(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable long menuId) {
        service.requireAdmin(currentUser);
        return new MenuRoleMappingResponse(menuId, service.menuRoles(menuId));
    }

    @PutMapping("/admin/{menuId}/roles")
    MenuRoleMappingResponse replaceMenuRoles(
            @AuthenticationPrincipal CurrentUser currentUser,
            @PathVariable long menuId,
            @Valid @RequestBody MenuRolePayload payload
    ) {
        service.requireAdmin(currentUser);
        return new MenuRoleMappingResponse(menuId, service.replaceMenuRoles(menuId, payload.roleIds()));
    }

    record MenuTreeResponse(List<MenuNode> menus) { }
    record MenuAdminTreeResponse(List<MenuAdminItem> menus) { }
    record MenuAdminDetailResponse(MenuAdminItem menu) { }
    record RoleListResponse(List<RoleItem> roles) { }
    record RoleDetailResponse(RoleItem role) { }
    record RoleMenuMappingResponse(long roleId, List<MenuAdminItem> menus) { }
    record MenuRoleMappingResponse(long menuId, List<RoleItem> roles) { }
    record RoleMenuPermissionMatrixResponse(List<RoleMenuPermission> mappings) { }
    record RoleMenuActionPermissionMatrixResponse(List<RoleMenuActionPermission> mappings) { }
    record MenuActionPermissionItem(String actionCode, boolean allowed) { }
    record MenuActionPermissionResponse(String menuCode, String path, List<String> allowedActions, List<MenuActionPermissionItem> actions) { }

    record MenuCreatePayload(
            @NotBlank @Size(max = 60) String code,
            @NotBlank @Size(max = 100) String name,
            Long parentId,
            @Size(max = 200) String path,
            @Size(max = 60) String icon,
            int sortOrder,
            Boolean isActive
    ) { MenuCreateRequest toRequest() { return new MenuCreateRequest(code, name, parentId, path, icon, sortOrder, isActive == null || isActive); } }
    record MenuUpdatePayload(
            @Size(min = 1, max = 100) String name,
            Long parentId,
            @Size(max = 200) String path,
            @Size(max = 60) String icon,
            Integer sortOrder,
            Boolean isActive
    ) { MenuUpdateRequest toRequest() { return new MenuUpdateRequest(name, parentId, path, icon, sortOrder, isActive); } }
    record RoleCreatePayload(@NotBlank @Size(max = 40) String code, @NotBlank @Size(max = 60) String name) { }
    record RoleUpdatePayload(@NotBlank @Size(max = 60) String name) { }
    record RoleMenuPayload(List<Long> menuIds) { public RoleMenuPayload { menuIds = menuIds == null ? List.of() : menuIds; } }
    record MenuRolePayload(List<Long> roleIds) { public MenuRolePayload { roleIds = roleIds == null ? List.of() : roleIds; } }
    record RoleMenuPermissionMatrixPayload(List<RoleMenuPermission> mappings) { public RoleMenuPermissionMatrixPayload { mappings = mappings == null ? List.of() : mappings; } }
    record RoleMenuActionPermissionMatrixPayload(List<RoleMenuActionPermission> mappings) { public RoleMenuActionPermissionMatrixPayload { mappings = mappings == null ? List.of() : mappings; } }
}
