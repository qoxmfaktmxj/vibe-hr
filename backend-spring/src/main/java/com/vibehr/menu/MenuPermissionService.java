package com.vibehr.menu;

import com.vibehr.auth.AuthRole;
import com.vibehr.auth.AuthRoleRepository;
import com.vibehr.auth.AuthUserRoleRepository;
import com.vibehr.auth.CurrentUser;
import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.ids.IntegerId;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("!test")
public class MenuPermissionService {

    public static final List<String> STANDARD_ACTION_CODES = List.of(
            "query", "create", "copy", "template_download", "upload", "save", "download"
    );

    private final MenuRepository menus;
    private final MenuRoleRepository menuRoles;
    private final MenuActionRepository menuActions;
    private final RoleMenuActionRepository roleMenuActions;
    private final AuthRoleRepository roles;
    private final AuthUserRoleRepository userRoles;
    private final MenuProjectionMapper projections;
    private final Clock clock;

    MenuPermissionService(
            MenuRepository menus,
            MenuRoleRepository menuRoles,
            MenuActionRepository menuActions,
            RoleMenuActionRepository roleMenuActions,
            AuthRoleRepository roles,
            AuthUserRoleRepository userRoles,
            MenuProjectionMapper projections,
            Clock clock
    ) {
        this.menus = menus;
        this.menuRoles = menuRoles;
        this.menuActions = menuActions;
        this.roleMenuActions = roleMenuActions;
        this.roles = roles;
        this.userRoles = userRoles;
        this.projections = projections;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<MenuNode> treeForUser(long userId) {
        return buildNodes(projections.findActiveMenusForUser(IntegerId.required(userId, "user_id")));
    }

    @Transactional(readOnly = true)
    public AllowedActions allowedActions(long userId, String menuCode, String path) {
        AppMenu menu;
        if (menuCode != null && !menuCode.isEmpty()) {
            menu = menus.findByCodeAndActiveTrue(menuCode).orElseThrow(() -> ApiException.notFound("Menu not found."));
        } else if (path != null && !path.isEmpty()) {
            menu = menus.findByPathAndActiveTrue(path).orElseThrow(() -> ApiException.notFound("Menu not found."));
        } else {
            throw ApiException.badRequest("menu_code or path is required.");
        }
        int actorId = IntegerId.required(userId, "user_id");
        if (!projections.hasDirectMenuAccess(actorId, menu.getId())) {
            throw ApiException.forbidden("Access denied.");
        }
        Map<String, Boolean> result = new LinkedHashMap<>();
        for (String action : STANDARD_ACTION_CODES) {
            result.put(action, true);
        }
        List<MenuActionProjectionRow> rows = projections.findActionProjection(actorId, menu.getId());
        if (!rows.isEmpty()) {
            result.clear();
            for (MenuActionProjectionRow row : rows) {
                if (STANDARD_ACTION_CODES.contains(row.getActionCode())) {
                    result.put(row.getActionCode(), row.isHasOverride() ? row.isAllowedOverride() : row.isEnabledDefault());
                }
            }
        }
        Map<String, Boolean> ordered = new LinkedHashMap<>();
        for (String action : STANDARD_ACTION_CODES) {
            ordered.put(action, result.getOrDefault(action, false));
        }
        return new AllowedActions(menuCode == null ? "" : menuCode, path, ordered);
    }

    public void requireMenuAction(long userId, String path, String actionCode) {
        if (!allowedActions(userId, null, path).actions().getOrDefault(actionCode, false)) {
            throw ApiException.forbidden("Action not allowed.");
        }
    }

    public void requireAdmin(CurrentUser currentUser) {
        if (currentUser == null || !currentUser.hasRole("admin")) {
            throw ApiException.forbidden("접근 권한이 없습니다.");
        }
    }

    @Transactional(readOnly = true)
    public List<MenuAdminItem> adminTree() {
        return buildAdminTree(menus.findAllByOrderBySortOrderAscIdAsc());
    }

    @Transactional
    public MenuAdminItem createMenu(MenuCreateRequest request) {
        String code = request.code().strip();
        if (menus.findByCode(code).isPresent()) {
            throw ApiException.conflict("이미 존재하는 메뉴 코드입니다.");
        }
        Integer parentId = IntegerId.optional(request.parentId(), "parent_id");
        validateParent(parentId, null);
        AppMenu menu = menus.saveAndFlush(new AppMenu(
                code, request.name().strip(), parentId, blankToNull(request.path()), blankToNull(request.icon()),
                request.sortOrder(), request.isActive(), now()
        ));
        return toAdminItem(menu, List.of());
    }

    @Transactional
    public MenuAdminItem updateMenu(long menuId, MenuUpdateRequest request) {
        int id = IntegerId.required(menuId, "menu_id");
        AppMenu menu = menu(id);
        Integer parentId = IntegerId.optional(request.parentId(), "parent_id");
        validateParent(parentId, id);
        menu.update(request.name(), parentId, request.path(), request.icon(), request.sortOrder(), request.isActive(), now());
        return toAdminItem(menu, List.of());
    }

    @Transactional
    public void deleteMenu(long menuId) {
        int id = IntegerId.required(menuId, "menu_id");
        AppMenu menu = menu(id);
        if (menus.existsByParentId(id)) {
            throw ApiException.conflict("하위 메뉴가 있어 삭제할 수 없습니다. 하위 메뉴를 먼저 정리해 주세요.");
        }
        menuRoles.deleteByMenuId(id);
        menus.delete(menu);
    }

    @Transactional(readOnly = true)
    public List<RoleItem> listRoles() {
        return roles.findAll(Sort.by("id")).stream().map(this::toRoleItem).toList();
    }

    @Transactional
    public RoleItem createRole(RoleCreateRequest request) {
        String code = request.code().strip();
        if (roles.findByCode(code).isPresent()) {
            throw ApiException.conflict("이미 존재하는 역할 코드입니다.");
        }
        return toRoleItem(roles.saveAndFlush(new AuthRole(code, request.name().strip(), now())));
    }

    @Transactional
    public RoleItem updateRole(long roleId, String name) {
        AuthRole role = role(IntegerId.required(roleId, "role_id"));
        role.setName(name.strip());
        return toRoleItem(role);
    }

    @Transactional
    public void deleteRole(long roleId) {
        int id = IntegerId.required(roleId, "role_id");
        AuthRole role = role(id);
        if (userRoles.existsByRoleId(id)) {
            throw ApiException.conflict("사용자에 연결된 역할은 삭제할 수 없습니다.");
        }
        menuRoles.deleteByRoleId(id);
        roles.delete(role);
    }

    @Transactional(readOnly = true)
    public List<RoleItem> menuRoles(long menuId) {
        int id = IntegerId.required(menuId, "menu_id");
        menu(id);
        return menuRoles.findByMenuId(id).stream()
                .map(AppMenuRole::getRoleId)
                .map(this::role)
                .sorted(Comparator.comparing(AuthRole::getId))
                .map(this::toRoleItem)
                .toList();
    }

    @Transactional
    public List<RoleItem> replaceMenuRoles(long menuId, List<Long> roleIds) {
        int id = IntegerId.required(menuId, "menu_id");
        menu(id);
        List<Integer> ids = integerIds(roleIds, "role_id");
        validateRoleIds(ids);
        menuRoles.deleteByMenuId(id);
        distinctSorted(ids).forEach(roleId -> menuRoles.save(new AppMenuRole(id, roleId)));
        return menuRoles(menuId);
    }

    @Transactional(readOnly = true)
    public List<MenuAdminItem> roleMenus(long roleId) {
        int id = IntegerId.required(roleId, "role_id");
        role(id);
        Set<Integer> selected = menuRoles.findByRoleId(id).stream().map(AppMenuRole::getMenuId).collect(java.util.stream.Collectors.toSet());
        if (selected.isEmpty()) {
            return List.of();
        }
        List<AppMenu> allMenus = menus.findAllByOrderBySortOrderAscIdAsc();
        Map<Integer, AppMenu> byId = allMenus.stream().collect(java.util.stream.Collectors.toMap(AppMenu::getId, row -> row));
        Set<Integer> included = new HashSet<>(selected);
        for (Integer menuId : selected) {
            AppMenu current = byId.get(menuId);
            while (current != null && current.getParentId() != null) {
                included.add(current.getParentId());
                current = byId.get(current.getParentId());
            }
        }
        return buildAdminTree(allMenus.stream().filter(row -> included.contains(row.getId())).toList());
    }

    @Transactional
    public List<MenuAdminItem> replaceRoleMenus(long roleId, List<Long> menuIds) {
        int id = IntegerId.required(roleId, "role_id");
        role(id);
        List<Integer> ids = integerIds(menuIds, "menu_id");
        validateMenuIds(ids, null);
        menuRoles.deleteByRoleId(id);
        distinctSorted(ids).forEach(menuId -> menuRoles.save(new AppMenuRole(menuId, id)));
        return roleMenus(roleId);
    }

    @Transactional(readOnly = true)
    public List<RoleMenuPermission> permissionMatrix() {
        List<Integer> roleIds = roles.findAll(Sort.by("id")).stream().map(AuthRole::getId).toList();
        return permissionMatrix(roleIds);
    }

    @Transactional
    public List<RoleMenuPermission> replacePermissionMatrix(List<RoleMenuPermission> mappings) {
        if (mappings.isEmpty()) {
            return List.of();
        }
        Map<Integer, List<Integer>> requested = new LinkedHashMap<>();
        mappings.forEach(item -> requested.put(IntegerId.required(item.roleId(), "role_id"), integerIds(item.menuIds(), "menu_id")));
        List<Integer> roleIds = new ArrayList<>(requested.keySet());
        List<Integer> unknownRoles = roleIds.stream().filter(roleId -> !roles.existsById(roleId)).toList();
        if (!unknownRoles.isEmpty()) {
            throw ApiException.badRequest("Invalid role_id: " + unknownRoles);
        }
        requested.forEach((roleId, menuIds) -> {
            List<Integer> unknownMenus = menuIds.stream().filter(menuId -> !menus.existsById(menuId)).toList();
            if (!unknownMenus.isEmpty()) {
                throw ApiException.badRequest("role_id=" + roleId + ", invalid menu_id: " + unknownMenus);
            }
        });
        menuRoles.deleteByRoleIdIn(roleIds);
        requested.forEach((roleId, menuIds) -> distinctSorted(menuIds).forEach(menuId -> menuRoles.save(new AppMenuRole(menuId, roleId))));
        return permissionMatrix(roleIds);
    }

    @Transactional(readOnly = true)
    public List<RoleMenuActionPermission> actionPermissionMatrix() {
        return roleMenuActions.findAll().stream().map(this::toActionPermission).toList();
    }

    @Transactional
    public List<RoleMenuActionPermission> replaceActionPermissionMatrix(List<RoleMenuActionPermission> mappings) {
        if (mappings.isEmpty()) {
            roleMenuActions.deleteAllInBatch();
            return List.of();
        }
        List<Integer> roleIds = mappings.stream().map(RoleMenuActionPermission::roleId).map(value -> IntegerId.required(value, "role_id")).distinct().sorted().toList();
        validateRoleIds(roleIds);
        validateMenuIds(mappings.stream().map(RoleMenuActionPermission::menuId).map(value -> IntegerId.required(value, "menu_id")).toList(), "Invalid menu_id: ");
        List<String> invalid = mappings.stream().map(RoleMenuActionPermission::actionCode).filter(code -> !STANDARD_ACTION_CODES.contains(code)).distinct().sorted().toList();
        if (!invalid.isEmpty()) {
            throw ApiException.badRequest("Invalid action_code: " + invalid);
        }
        roleMenuActions.deleteByRoleIdIn(roleIds);
        Map<String, RoleMenuActionPermission> deduped = new LinkedHashMap<>();
        mappings.forEach(item -> deduped.put(item.roleId() + ":" + item.menuId() + ":" + item.actionCode(), item));
        LocalDateTime now = now();
        deduped.values().forEach(item -> roleMenuActions.save(new AppRoleMenuAction(IntegerId.required(item.roleId(), "role_id"), IntegerId.required(item.menuId(), "menu_id"), item.actionCode(), item.allowed(), now)));
        return roleMenuActions.findByRoleIdIn(roleIds).stream().map(this::toActionPermission).toList();
    }

    private List<RoleMenuPermission> permissionMatrix(List<Integer> roleIds) {
        if (roleIds.isEmpty()) return List.of();
        Map<Integer, List<Integer>> byRole = new LinkedHashMap<>();
        roleIds.forEach(roleId -> byRole.put(roleId, new ArrayList<>()));
        menuRoles.findByRoleIdIn(roleIds).forEach(link -> byRole.get(link.getRoleId()).add(link.getMenuId()));
        return byRole.entrySet().stream().map(entry -> new RoleMenuPermission(entry.getKey(), distinctSorted(entry.getValue()).stream().map(Integer::longValue).toList())).toList();
    }

    private List<MenuNode> buildNodes(List<MenuProjectionRow> rows) {
        Map<Integer, List<MenuProjectionRow>> byParent = new HashMap<>();
        rows.forEach(row -> byParent.computeIfAbsent(row.getParentId(), ignored -> new ArrayList<>()).add(row));
        return buildNodes(byParent, null);
    }

    private List<MenuNode> buildNodes(Map<Integer, List<MenuProjectionRow>> byParent, Integer parentId) {
        return byParent.getOrDefault(parentId, List.of()).stream().sorted(Comparator.comparingInt(MenuProjectionRow::getSortOrder))
                .map(row -> new MenuNode(row.getId(), row.getCode(), row.getName(), row.getPath(), row.getIcon(), row.getSortOrder(), buildNodes(byParent, row.getId())))
                .toList();
    }

    private List<MenuAdminItem> buildAdminTree(List<AppMenu> rows) {
        Map<Integer, List<AppMenu>> byParent = new HashMap<>();
        rows.forEach(row -> byParent.computeIfAbsent(row.getParentId(), ignored -> new ArrayList<>()).add(row));
        return buildAdminTree(byParent, null);
    }

    private List<MenuAdminItem> buildAdminTree(Map<Integer, List<AppMenu>> byParent, Integer parentId) {
        return byParent.getOrDefault(parentId, List.of()).stream().sorted(Comparator.comparingInt(AppMenu::getSortOrder))
                .map(row -> toAdminItem(row, buildAdminTree(byParent, row.getId()))).toList();
    }

    private MenuAdminItem toAdminItem(AppMenu row, List<MenuAdminItem> children) {
        return new MenuAdminItem(row.getId(), row.getCode(), row.getName(), row.getParentId() == null ? null : row.getParentId().longValue(), row.getPath(), row.getIcon(), row.getSortOrder(), row.isActive(), row.getCreatedAt(), row.getUpdatedAt(), children);
    }

    private RoleItem toRoleItem(AuthRole role) { return new RoleItem(role.getId(), role.getCode(), role.getName()); }
    private RoleMenuActionPermission toActionPermission(AppRoleMenuAction row) { return new RoleMenuActionPermission(row.getRoleId(), row.getMenuId(), row.getActionCode(), row.isAllowed()); }
    private AppMenu menu(int id) { return menus.findById(id).orElseThrow(() -> ApiException.notFound("메뉴를 찾을 수 없습니다.")); }
    private AuthRole role(int id) { return roles.findById(id).orElseThrow(() -> ApiException.notFound("역할을 찾을 수 없습니다.")); }
    private LocalDateTime now() { return LocalDateTime.now(clock); }
    private static String blankToNull(String value) { return value == null || value.isEmpty() ? null : value; }
    private static List<Integer> distinctSorted(Collection<Integer> values) { return values.stream().distinct().sorted().toList(); }

    private void validateParent(Integer parentId, Integer selfId) {
        if (parentId != null && parentId.equals(selfId)) throw ApiException.badRequest("자기 자신을 부모로 지정할 수 없습니다.");
        if (parentId != null && !menus.existsById(parentId)) throw ApiException.badRequest("유효하지 않은 부모 메뉴입니다.");
    }
    private void validateRoleIds(List<Integer> roleIds) {
        List<Integer> unknown = roleIds.stream().filter(roleId -> !roles.existsById(roleId)).toList();
        if (!unknown.isEmpty()) throw ApiException.badRequest("유효하지 않은 role_id: " + unknown);
    }
    private void validateMenuIds(List<Integer> menuIds, String customPrefix) {
        List<Integer> unknown = menuIds.stream().filter(menuId -> !menus.existsById(menuId)).distinct().sorted().toList();
        if (!unknown.isEmpty()) throw ApiException.badRequest((customPrefix == null ? "유효하지 않은 menu_id: " : customPrefix) + unknown);
    }

    private static List<Integer> integerIds(Collection<Long> values, String fieldName) {
        return values.stream().map(value -> IntegerId.required(value, fieldName)).toList();
    }

    public record MenuCreateRequest(String code, String name, Long parentId, String path, String icon, int sortOrder, boolean isActive) { }
    public record MenuUpdateRequest(String name, Long parentId, String path, String icon, Integer sortOrder, Boolean isActive) { }
    public record MenuNode(long id, String code, String name, String path, String icon, int sortOrder, List<MenuNode> children) { }
    public record MenuAdminItem(long id, String code, String name, Long parentId, String path, String icon, int sortOrder, boolean isActive, LocalDateTime createdAt, LocalDateTime updatedAt, List<MenuAdminItem> children) { }
    public record RoleItem(long id, String code, String name) { }
    public record RoleCreateRequest(String code, String name) { }
    public record RoleMenuPermission(long roleId, List<Long> menuIds) { }
    public record RoleMenuActionPermission(long roleId, long menuId, String actionCode, boolean allowed) { }
    public record AllowedActions(String menuCode, String path, Map<String, Boolean> actions) { }
}
