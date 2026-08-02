package com.vibehr.auth;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AuthRoleRepository extends JpaRepository<AuthRole, Integer> {
    Optional<AuthRole> findByCode(String code);

    @Query("select role.code from AuthRole role join AuthUserRole link on link.roleId = role.id where link.userId = :userId order by role.id")
    List<String> findCodesByUserId(Integer userId);
}
