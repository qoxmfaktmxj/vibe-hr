package com.vibehr.payroll;

import com.vibehr.auth.CurrentUser;
import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.ids.IntegerId;
import jakarta.persistence.EntityManager;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/** Compatibility authorization for the FastAPI PAY role and menu-action dependencies. */
@Component
public class PayrollAuthorization {
    private static final Set<String> STANDARD_ACTIONS = Set.of(
            "query", "create", "copy", "template_download", "upload", "save", "download");
    private final EntityManager entityManager;

    public PayrollAuthorization(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public int requireAnyRole(Authentication authentication, String... allowedRoles) {
        int userId = userId(authentication);
        boolean permitted = authentication.getAuthorities().stream()
                .anyMatch(authority -> {
                    for (String role : allowedRoles) {
                        if (("ROLE_" + role).equals(authority.getAuthority())) return true;
                    }
                    return false;
                });
        if (!permitted && authentication.getPrincipal() instanceof CurrentUser currentUser) {
            for (String role : allowedRoles) {
                if (currentUser.hasRole(role)) return userId;
            }
        }
        if (!permitted) throw ApiException.forbidden("Not enough permissions.");
        return userId;
    }

    public int currentUserId(Authentication authentication) {
        return userId(authentication);
    }

    public void requireMenuAction(int userId, String menuCode, String actionCode) {
        @SuppressWarnings("unchecked")
        List<Number> menuIds = entityManager.createNativeQuery("""
                select id from app_menus where code = :menuCode and is_active = true
                """).setParameter("menuCode", menuCode).getResultList();
        if (menuIds.isEmpty()) throw ApiException.notFound("Menu not found.");
        int menuId = menuIds.getFirst().intValue();
        Number accessCount = (Number) entityManager.createNativeQuery("""
                select count(*) from app_menu_roles mr
                join auth_user_roles ur on ur.role_id = mr.role_id
                where mr.menu_id = :menuId and ur.user_id = :userId
                """).setParameter("menuId", menuId).setParameter("userId", userId).getSingleResult();
        if (accessCount.longValue() == 0) throw ApiException.forbidden("Access denied.");

        Map<String, Boolean> allowed = new HashMap<>();
        STANDARD_ACTIONS.forEach(action -> allowed.put(action, true));
        @SuppressWarnings("unchecked")
        List<Object[]> defaults = entityManager.createNativeQuery("""
                select action_code, enabled_default from app_menu_actions where menu_id = :menuId
                """).setParameter("menuId", menuId).getResultList();
        if (!defaults.isEmpty()) {
            allowed.clear();
            for (Object[] row : defaults) {
                String code = (String) row[0];
                if (STANDARD_ACTIONS.contains(code)) allowed.put(code, (Boolean) row[1]);
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
            String code = (String) row[0];
            if (STANDARD_ACTIONS.contains(code)) {
                overrideAllowed.merge(code, (Boolean) row[1], Boolean::logicalOr);
            }
        }
        // FastAPI gives any role override precedence over a menu default, including false.
        allowed.putAll(overrideAllowed);
        if (!allowed.getOrDefault(actionCode, false)) throw ApiException.forbidden("Action not allowed.");
    }

    private int userId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw ApiException.unauthorized("Not authenticated.");
        }
        if (authentication.getPrincipal() instanceof CurrentUser currentUser) {
            return IntegerId.required(currentUser.id(), "user_id");
        }
        try {
            return Integer.parseInt(authentication.getName());
        } catch (NumberFormatException exception) {
            throw ApiException.unauthorized("Not authenticated.");
        }
    }
}
