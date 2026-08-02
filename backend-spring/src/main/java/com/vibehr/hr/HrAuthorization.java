package com.vibehr.hr;

import com.vibehr.auth.CurrentUser;
import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.ids.IntegerId;
import jakarta.persistence.EntityManager;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component
class HrAuthorization {
    private final EntityManager entityManager;

    HrAuthorization(EntityManager entityManager) { this.entityManager = entityManager; }

    int requireAnyRole(Authentication authentication, String... roles) {
        int userId = IntegerId.required(userId(authentication), "user_id");
        @SuppressWarnings("unchecked")
        List<String> values = entityManager.createNativeQuery("select r.code from auth_user_roles ur join auth_roles r on r.id = ur.role_id where ur.user_id = :userId")
                .setParameter("userId", userId).getResultList();
        Set<String> actual = new HashSet<>(values);
        for (String role : roles) if (actual.contains(role)) return userId;
        throw ApiException.forbidden("Not enough permissions.");
    }

    private long userId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) throw ApiException.unauthorized("Not authenticated.");
        if (authentication.getPrincipal() instanceof CurrentUser currentUser) return currentUser.id();
        try { return Long.parseLong(authentication.getName()); }
        catch (NumberFormatException exception) { throw ApiException.unauthorized("Not authenticated."); }
    }

    void requireEmployeeMenuAction(int userId, String action) {
        Object menu = entityManager.createNativeQuery("select id from app_menus where path = '/hr/employee' and is_active = true order by id limit 1").getResultStream().findFirst().orElse(null);
        if (menu == null) throw ApiException.notFound("Menu not found.");
        Number menuId = (Number) menu;
        Number access = (Number) entityManager.createNativeQuery("select count(*) from app_menu_roles mr join auth_user_roles ur on ur.role_id = mr.role_id where mr.menu_id = :menuId and ur.user_id = :userId")
                .setParameter("menuId", menuId.intValue()).setParameter("userId", userId).getSingleResult();
        if (access.longValue() == 0) throw ApiException.forbidden("Access denied.");
        @SuppressWarnings("unchecked")
        List<Object[]> defaults = entityManager.createNativeQuery("select action_code, enabled_default from app_menu_actions where menu_id = :menuId")
                .setParameter("menuId", menuId.intValue()).getResultList();
        boolean allowed = defaults.isEmpty() || defaults.stream().filter(row -> action.equals(row[0])).findFirst().map(row -> (Boolean) row[1]).orElse(false);
        @SuppressWarnings("unchecked")
        List<Boolean> overrides = entityManager.createNativeQuery("select rma.allowed from app_role_menu_actions rma join auth_user_roles ur on ur.role_id = rma.role_id where rma.menu_id = :menuId and ur.user_id = :userId and rma.action_code = :action")
                .setParameter("menuId", menuId.intValue()).setParameter("userId", userId).setParameter("action", action).getResultList();
        if (!overrides.isEmpty()) allowed = overrides.stream().anyMatch(Boolean.TRUE::equals);
        if (!allowed) throw ApiException.forbidden("Action not allowed.");
    }
}
