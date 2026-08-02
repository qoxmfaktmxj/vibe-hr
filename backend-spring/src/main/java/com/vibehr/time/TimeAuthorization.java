package com.vibehr.time;

import com.vibehr.auth.CurrentUser;
import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.ids.IntegerId;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component
class TimeAuthorization {
    private final EntityManager entityManager;

    TimeAuthorization(EntityManager entityManager) { this.entityManager = entityManager; }

    int requireAnyRole(Authentication authentication, String... roles) {
        int userId = userId(authentication);
        @SuppressWarnings("unchecked")
        List<String> assignedRoles = entityManager.createNativeQuery("""
                select r.code from auth_user_roles ur
                join auth_roles r on r.id = ur.role_id
                where ur.user_id = :userId
                """).setParameter("userId", userId).getResultList();
        for (String role : roles) if (assignedRoles.contains(role)) return userId;
        throw ApiException.forbidden("권한이 없습니다.");
    }

    int userId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) throw ApiException.unauthorized("인증이 필요합니다.");
        if (authentication.getPrincipal() instanceof CurrentUser currentUser) {
            return IntegerId.required(currentUser.id(), "user_id");
        }
        try { return Integer.parseInt(authentication.getName()); }
        catch (NumberFormatException exception) { throw ApiException.unauthorized("인증이 필요합니다."); }
    }

    int employeeIdForUser(int userId) {
        Object employeeId = entityManager.createNativeQuery("select id from hr_employees where user_id = :userId")
                .setParameter("userId", userId).getResultStream().findFirst().orElse(null);
        if (employeeId == null) throw ApiException.notFound("사원 프로필을 찾을 수 없습니다.");
        return ((Number) employeeId).intValue();
    }

    void requireSelfOrManager(Authentication authentication, Integer requestedEmployeeId) {
        int userId = userId(authentication);
        int ownEmployeeId = employeeIdForUser(userId);
        if (requestedEmployeeId == null || requestedEmployeeId == ownEmployeeId) return;
        requireAnyRole(authentication, "hr_manager", "admin");
    }
}
