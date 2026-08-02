package com.vibehr.management.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vibehr.auth.CurrentUser;
import com.vibehr.menu.MenuPermissionService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.TestingAuthenticationToken;

class ManagementAuthorizationTest {

    @Test
    void acceptsCurrentUserPrincipalAndBindsAnIntegerUserId() {
        EntityManager entityManager = mock(EntityManager.class);
        Query roles = mock(Query.class);
        when(entityManager.createNativeQuery(anyString())).thenReturn(roles);
        when(roles.setParameter(anyString(), any())).thenReturn(roles);
        when(roles.getResultList()).thenReturn(List.of("hr_manager"));
        var authentication = new TestingAuthenticationToken(new CurrentUser(42L, Set.of("hr_manager")), "token");
        authentication.setAuthenticated(true);

        assertThat(new ManagementAuthorization(entityManager, mock(MenuPermissionService.class))
                .requireAnyRole(authentication, "hr_manager")).isEqualTo(42);

        ArgumentCaptor<Object> userId = ArgumentCaptor.forClass(Object.class);
        verify(roles).setParameter(eq("userId"), userId.capture());
        assertThat(userId.getValue()).isInstanceOf(Integer.class).isEqualTo(42);
    }
}
