package com.vibehr.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "auth_user_roles")
@IdClass(AuthUserRoleId.class)
public class AuthUserRole {

    @Id
    @Column(name = "user_id")
    private Integer userId;
    @Id
    @Column(name = "role_id")
    private Integer roleId;
    @Column(name = "assigned_at", nullable = false)
    private LocalDateTime assignedAt;

    protected AuthUserRole() {
    }

    public AuthUserRole(Integer userId, Integer roleId, LocalDateTime assignedAt) {
        this.userId = userId;
        this.roleId = roleId;
        this.assignedAt = assignedAt;
    }
}
