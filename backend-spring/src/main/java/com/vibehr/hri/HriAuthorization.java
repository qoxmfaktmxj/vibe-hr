package com.vibehr.hri;

import com.vibehr.auth.CurrentUser;
import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.ids.IntegerId;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component
public class HriAuthorization {
    private final EntityManager entityManager;

    public HriAuthorization(EntityManager entityManager) { this.entityManager = entityManager; }

    public int requireAnyRole(Authentication authentication, String... roles) {
        int userId = userId(authentication);
        @SuppressWarnings("unchecked")
        List<String> assigned = entityManager.createNativeQuery("select r.code from auth_user_roles ur join auth_roles r on r.id = ur.role_id where ur.user_id = :userId")
                .setParameter("userId", userId).getResultList();
        for (String role : roles) if (assigned.contains(role)) return userId;
        throw ApiException.forbidden("Not enough permissions.");
    }

    public int userId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) throw ApiException.unauthorized("Not authenticated.");
        if (authentication.getPrincipal() instanceof CurrentUser currentUser) {
            return IntegerId.required(currentUser.id(), "user_id");
        }
        try { return Integer.parseInt(authentication.getName()); }
        catch (NumberFormatException exception) { throw ApiException.unauthorized("Not authenticated."); }
    }
}
