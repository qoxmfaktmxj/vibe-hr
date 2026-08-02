package com.vibehr.auth;

import java.util.Set;

public record CurrentUser(long id, Set<String> roles) {
    public boolean hasRole(String role) {
        return roles.contains(role);
    }
}
