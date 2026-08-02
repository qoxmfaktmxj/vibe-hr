package com.vibehr.menu;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vibehr.auth.AuthRoleRepository;
import com.vibehr.auth.AuthUserRoleRepository;
import com.vibehr.platform.error.ApiException;
import java.time.Clock;
import java.util.List;
import org.junit.jupiter.api.Test;

class MenuPermissionServiceTest {

    private final MenuRepository menus = mock(MenuRepository.class);
    private final MenuRoleRepository menuRoles = mock(MenuRoleRepository.class);
    private final MenuActionRepository menuActions = mock(MenuActionRepository.class);
    private final RoleMenuActionRepository roleActions = mock(RoleMenuActionRepository.class);
    private final AuthRoleRepository roles = mock(AuthRoleRepository.class);
    private final AuthUserRoleRepository userRoles = mock(AuthUserRoleRepository.class);
    private final MenuProjectionMapper projections = mock(MenuProjectionMapper.class);
    private final MenuPermissionService service = new MenuPermissionService(menus, menuRoles, menuActions, roleActions, roles, userRoles, projections, Clock.systemUTC());

    @Test
    void keepsDefaultFalseForActionsMissingFromConfiguredRows() {
        AppMenu menu = mock(AppMenu.class);
        when(menu.getId()).thenReturn(11);
        when(menus.findByPathAndActiveTrue("/settings/common-codes")).thenReturn(java.util.Optional.of(menu));
        when(projections.hasDirectMenuAccess(9, 11)).thenReturn(true);
        MenuActionProjectionRow query = new MenuActionProjectionRow();
        query.setActionCode("query");
        query.setEnabledDefault(true);
        when(projections.findActionProjection(9, 11)).thenReturn(List.of(query));

        MenuPermissionService.AllowedActions result = service.allowedActions(9L, null, "/settings/common-codes");

        assertThat(result.actions()).containsEntry("query", true).containsEntry("save", false);
    }

    @Test
    void rejectsActionQueriesWithoutAMenuCodeOrPath() {
        assertThatThrownBy(() -> service.allowedActions(9L, null, null))
                .isInstanceOf(ApiException.class)
                .hasMessage("menu_code or path is required.");
    }
}
