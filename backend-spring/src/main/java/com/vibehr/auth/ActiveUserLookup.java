package com.vibehr.auth;

import com.vibehr.platform.ids.IntegerId;
import java.util.Set;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("!test")
public class ActiveUserLookup {

    private final AuthUserRepository users;
    private final AuthRoleRepository roles;

    ActiveUserLookup(AuthUserRepository users, AuthRoleRepository roles) {
        this.users = users;
        this.roles = roles;
    }

    @Transactional(readOnly = true)
    public CurrentUser find(long userId) {
        int id = IntegerId.required(userId, "user_id");
        AuthUser user = users.findById(id).filter(AuthUser::isActive).orElse(null);
        if (user == null) {
            return null;
        }
        return new CurrentUser(user.getId(), Set.copyOf(roles.findCodesByUserId(id)));
    }
}
