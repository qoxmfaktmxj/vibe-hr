package com.vibehr.auth;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface AuthUserRepository extends JpaRepository<AuthUser, Integer> {
    Optional<AuthUser> findByLoginId(String loginId);
    Optional<AuthUser> findByEmail(String email);
    @Query("select user from AuthUser user where user.active = true and user.id <> :userId and (lower(user.loginId) like lower(concat('%', :query, '%')) or lower(user.displayName) like lower(concat('%', :query, '%')) or lower(user.email) like lower(concat('%', :query, '%'))) order by user.loginId")
    List<AuthUser> findActiveCandidates(Integer userId, String query, org.springframework.data.domain.Pageable pageable);
}
