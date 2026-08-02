package com.vibehr.organization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.vibehr.auth.CurrentUser;
import com.vibehr.menu.MenuPermissionService;
import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.TestingAuthenticationToken;

class OrganizationAuthorizationTest {

    @Test
    void bindsAnIntegerUserIdForTheIntegerBackedRoleQuery() {
        EntityManager entityManager = mock(EntityManager.class);
        Query roles = mock(Query.class);
        when(entityManager.createNativeQuery(anyString())).thenReturn(roles);
        when(roles.setParameter(anyString(), any())).thenReturn(roles);
        when(roles.getResultList()).thenReturn(List.of("hr_manager"));
        var authentication = new TestingAuthenticationToken(new CurrentUser(42L, Set.of("hr_manager")), "token");
        authentication.setAuthenticated(true);

        assertThat(new OrganizationAuthorization(entityManager, mock(MenuPermissionService.class))
                .requireAnyRole(authentication, "hr_manager")).isEqualTo(42L);

        ArgumentCaptor<Object> userId = ArgumentCaptor.forClass(Object.class);
        verify(roles).setParameter(eq("userId"), userId.capture());
        assertThat(userId.getValue()).isInstanceOf(Integer.class).isEqualTo(42);
    }

    @Test
    void rejectsAnOutOfRangeUserIdBeforeTheRoleQuery() {
        EntityManager entityManager = mock(EntityManager.class);
        var authentication = new TestingAuthenticationToken(
                new CurrentUser((long) Integer.MAX_VALUE + 1, Set.of("hr_manager")), "token");
        authentication.setAuthenticated(true);

        assertThatThrownBy(() -> new OrganizationAuthorization(entityManager, mock(MenuPermissionService.class))
                .requireAnyRole(authentication, "hr_manager"))
                .isInstanceOfSatisfying(ApiException.class, exception -> assertThat(exception.status().value()).isEqualTo(400));

        verifyNoInteractions(entityManager);
    }

    @Test
    void rejectsAnOutOfRangeUserIdBeforeMenuPermissionLookup() {
        MenuPermissionService menuPermissions = mock(MenuPermissionService.class);

        assertThatThrownBy(() -> new OrganizationAuthorization(mock(EntityManager.class), menuPermissions)
                .requireMenuAction((long) Integer.MAX_VALUE + 1, "/org/chart", "query"))
                .isInstanceOfSatisfying(ApiException.class, exception -> assertThat(exception.status().value()).isEqualTo(400));

        verifyNoInteractions(menuPermissions);
    }
}
