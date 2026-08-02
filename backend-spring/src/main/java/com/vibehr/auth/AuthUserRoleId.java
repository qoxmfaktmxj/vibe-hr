package com.vibehr.auth;

import java.io.Serializable;
import java.util.Objects;

public class AuthUserRoleId implements Serializable {
    private Integer userId;
    private Integer roleId;

    public AuthUserRoleId() {
    }

    public AuthUserRoleId(Integer userId, Integer roleId) {
        this.userId = userId;
        this.roleId = roleId;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof AuthUserRoleId that
                && Objects.equals(userId, that.userId)
                && Objects.equals(roleId, that.roleId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, roleId);
    }
}
