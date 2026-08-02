package com.vibehr.management.api;

import com.vibehr.auth.CurrentUser;
import com.vibehr.menu.MenuPermissionService;
import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.ids.IntegerId;
import jakarta.persistence.EntityManager;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/** Keeps the legacy role and company-screen action checks at the feature boundary. */
@Component
public class ManagementAuthorization {
    private final EntityManager entityManager;
    private final MenuPermissionService menuPermissions;

    public ManagementAuthorization(EntityManager entityManager, MenuPermissionService menuPermissions) {
        this.entityManager = entityManager;
        this.menuPermissions = menuPermissions;
    }

    public int requireAnyRole(Authentication authentication, String... expectedRoles) {
        int userId = IntegerId.required(userId(authentication), "user_id");
        @SuppressWarnings("unchecked")
        List<String> roles = entityManager.createNativeQuery("""
                select r.code from auth_user_roles ur
                join auth_roles r on r.id = ur.role_id
                where ur.user_id = :userId
                """).setParameter("userId", userId).getResultList();
        Set<String> actualRoles = new HashSet<>(roles);
        for (String expectedRole : expectedRoles) if (actualRoles.contains(expectedRole)) return userId;
        throw ApiException.forbidden("Not enough permissions.");
    }

    public void requireCompanyAction(int userId, String action) {
        menuPermissions.requireMenuAction(userId, "/mng/companies", action);
    }

    private long userId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) throw ApiException.unauthorized("Not authenticated.");
        if (authentication.getPrincipal() instanceof CurrentUser currentUser) return currentUser.id();
        try {
            return Long.parseLong(authentication.getName());
        } catch (NumberFormatException exception) {
            throw ApiException.unauthorized("Not authenticated.");
        }
    }
}
