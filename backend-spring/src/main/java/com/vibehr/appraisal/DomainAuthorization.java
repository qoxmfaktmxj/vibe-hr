package com.vibehr.appraisal;

import com.vibehr.auth.CurrentUser;
import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.ids.IntegerId;
import jakarta.persistence.EntityManager;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component
public class DomainAuthorization {

    private static final Set<String> STANDARD_ACTIONS = Set.of("query", "create", "copy", "template", "upload", "save", "download");
    private final EntityManager entityManager;

    public DomainAuthorization(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public int requireAnyRole(Authentication authentication, String... allowedRoles) {
        int userId = IntegerId.required(userId(authentication), "user_id");
        @SuppressWarnings("unchecked")
        List<String> roles = entityManager.createNativeQuery("""
                select r.code from auth_user_roles ur
                join auth_roles r on r.id = ur.role_id
                where ur.user_id = :userId
                """).setParameter("userId", userId).getResultList();
        Set<String> roleSet = new HashSet<>(roles);
        for (String allowedRole : allowedRoles) {
            if (roleSet.contains(allowedRole)) {
                return userId;
            }
        }
        throw ApiException.forbidden("Not enough permissions.");
    }

    public void requireMenuAction(int userId, String menuCode, String actionCode) {
        List<?> menus = entityManager.createNativeQuery("""
                select id from app_menus where code = :menuCode and is_active = true
                """).setParameter("menuCode", menuCode).getResultList();
        if (menus.isEmpty()) {
            throw ApiException.notFound("Menu not found.");
        }
        Object menuIdValue = menus.getFirst();
        int menuId = ((Number) menuIdValue).intValue();
        Number accessCount = (Number) entityManager.createNativeQuery("""
                select count(*) from app_menu_roles mr
                join auth_user_roles ur on ur.role_id = mr.role_id
                where mr.menu_id = :menuId and ur.user_id = :userId
                """).setParameter("menuId", menuId).setParameter("userId", userId).getSingleResult();
        if (accessCount.longValue() == 0) {
            throw ApiException.forbidden("Access denied.");
        }

        Map<String, Boolean> allowed = new HashMap<>();
        for (String action : STANDARD_ACTIONS) {
            allowed.put(action, true);
        }
        @SuppressWarnings("unchecked")
        List<Object[]> defaults = entityManager.createNativeQuery("""
                select action_code, enabled_default from app_menu_actions where menu_id = :menuId
                """).setParameter("menuId", menuId).getResultList();
        if (!defaults.isEmpty()) {
            allowed.clear();
            for (Object[] row : defaults) {
                String action = (String) row[0];
                if (STANDARD_ACTIONS.contains(action)) {
                    allowed.put(action, (Boolean) row[1]);
                }
            }
        }
        @SuppressWarnings("unchecked")
        List<Object[]> overrides = entityManager.createNativeQuery("""
                select rma.action_code, rma.allowed from app_role_menu_actions rma
                join auth_user_roles ur on ur.role_id = rma.role_id
                where rma.menu_id = :menuId and ur.user_id = :userId
                """).setParameter("menuId", menuId).setParameter("userId", userId).getResultList();
        Map<String, Boolean> overrideAllowed = new HashMap<>();
        for (Object[] row : overrides) {
            String action = (String) row[0];
            if (STANDARD_ACTIONS.contains(action)) {
                overrideAllowed.merge(action, (Boolean) row[1], Boolean::logicalOr);
            }
        }
        allowed.putAll(overrideAllowed);
        if (!allowed.getOrDefault(actionCode, false)) {
            throw ApiException.forbidden("Action not allowed.");
        }
    }

    private long userId(Authentication authentication) {
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
}
