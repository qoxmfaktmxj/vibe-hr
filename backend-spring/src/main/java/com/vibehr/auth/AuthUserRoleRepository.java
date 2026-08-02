package com.vibehr.auth;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthUserRoleRepository extends JpaRepository<AuthUserRole, AuthUserRoleId> {
    boolean existsByRoleId(Integer roleId);
}
