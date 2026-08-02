package com.vibehr.hr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vibehr.auth.CurrentUser;
import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.TestingAuthenticationToken;

class HrAuthorizationTest {

    @Test
    void acceptsCurrentUserPrincipalAndBindsAnIntegerUserId() {
        EntityManager entityManager = mock(EntityManager.class);
        Query roles = mock(Query.class);
        when(entityManager.createNativeQuery(anyString())).thenReturn(roles);
        when(roles.setParameter(anyString(), any())).thenReturn(roles);
        when(roles.getResultList()).thenReturn(List.of("hr_manager"));
        var authentication = new TestingAuthenticationToken(new CurrentUser(42L, Set.of("hr_manager")), "token");
        authentication.setAuthenticated(true);

        assertThat(new HrAuthorization(entityManager).requireAnyRole(authentication, "hr_manager")).isEqualTo(42);

        ArgumentCaptor<Object> userId = ArgumentCaptor.forClass(Object.class);
        verify(roles).setParameter(eq("userId"), userId.capture());
        assertThat(userId.getValue()).isInstanceOf(Integer.class).isEqualTo(42);
    }

    @Test
    void denyOverrideReplacesADefaultEnabledEmployeeAction() {
        EntityManager entityManager = mock(EntityManager.class);
        Query menu = mock(Query.class);
        Query access = mock(Query.class);
        Query defaults = mock(Query.class);
        Query overrides = mock(Query.class);
        stubEmployeeActionQueries(entityManager, menu, access, defaults, overrides);
        when(menu.getResultStream()).thenReturn(Stream.of(9));
        when(access.getSingleResult()).thenReturn(1L);
        when(defaults.getResultList()).thenReturn(List.<Object[]>of(new Object[] { "save", true }));
        when(overrides.getResultList()).thenReturn(List.of(false));

        assertThatThrownBy(() -> new HrAuthorization(entityManager).requireEmployeeMenuAction(17, "save"))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.status()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(exception.detail()).isEqualTo("Action not allowed.");
                });
    }

    @Test
    void anyTrueRoleOverrideStillAllowsTheEmployeeAction() {
        EntityManager entityManager = mock(EntityManager.class);
        Query menu = mock(Query.class);
        Query access = mock(Query.class);
        Query defaults = mock(Query.class);
        Query overrides = mock(Query.class);
        stubEmployeeActionQueries(entityManager, menu, access, defaults, overrides);
        when(menu.getResultStream()).thenReturn(Stream.of(9));
        when(access.getSingleResult()).thenReturn(1L);
        when(defaults.getResultList()).thenReturn(List.<Object[]>of(new Object[] { "save", false }));
        when(overrides.getResultList()).thenReturn(List.of(false, true));

        new HrAuthorization(entityManager).requireEmployeeMenuAction(17, "save");
    }

    private static void stubEmployeeActionQueries(EntityManager entityManager, Query menu, Query access, Query defaults, Query overrides) {
        when(entityManager.createNativeQuery(anyString())).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0, String.class);
            if (sql.contains("select id from app_menus")) return menu;
            if (sql.contains("select count(*) from app_menu_roles")) return access;
            if (sql.contains("select action_code, enabled_default")) return defaults;
            if (sql.contains("select rma.allowed")) return overrides;
            throw new AssertionError("Unexpected SQL: " + sql);
        });
        for (Query query : List.of(menu, access, defaults, overrides)) {
            when(query.setParameter(anyString(), any())).thenReturn(query);
        }
    }
}
