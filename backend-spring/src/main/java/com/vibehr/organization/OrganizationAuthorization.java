package com.vibehr.organization;

import com.vibehr.auth.CurrentUser;
import com.vibehr.menu.MenuPermissionService;
import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.ids.IntegerId;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/** Retains FastAPI role gates and path-based menu action checks at the ORG boundary. */
@Component
class OrganizationAuthorization {
    private final EntityManager entityManager;
    private final MenuPermissionService menuPermissions;

    OrganizationAuthorization(EntityManager entityManager, MenuPermissionService menuPermissions) {
        this.entityManager = entityManager;
        this.menuPermissions = menuPermissions;
    }

    long requireAnyRole(Authentication authentication, String... allowedRoles) {
        long userId = userId(authentication);
        int databaseUserId = IntegerId.required(userId, "user_id");
        @SuppressWarnings("unchecked")
        List<String> roles = entityManager.createNativeQuery("""
                select r.code from auth_user_roles ur
                join auth_roles r on r.id = ur.role_id
                where ur.user_id = :userId
                """).setParameter("userId", databaseUserId).getResultList();
        for (String allowedRole : allowedRoles) {
            if (roles.contains(allowedRole)) return userId;
        }
        throw ApiException.forbidden("Not enough permissions.");
    }

    long userId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw ApiException.unauthorized("Not authenticated.");
        }
        if (authentication.getPrincipal() instanceof CurrentUser currentUser) return currentUser.id();
        try {
            return Long.parseLong(authentication.getName());
        } catch (NumberFormatException exception) {
            throw ApiException.unauthorized("Not authenticated.");
        }
    }

    void requireMenuAction(long userId, String path, String actionCode) {
        menuPermissions.requireMenuAction(IntegerId.required(userId, "user_id"), path, actionCode);
    }
}
