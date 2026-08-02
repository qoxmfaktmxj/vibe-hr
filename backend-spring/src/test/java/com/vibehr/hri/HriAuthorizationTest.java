package com.vibehr.hri;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import com.vibehr.auth.CurrentUser;
import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.TestingAuthenticationToken;

class HriAuthorizationTest {

    @Test
    void rejectsAnOverflowCurrentUserIdWithTheStandardBadRequestException() {
        var authentication = new TestingAuthenticationToken(
                new CurrentUser((long) Integer.MAX_VALUE + 1, Set.of("admin")), "token");
        authentication.setAuthenticated(true);

        ApiException exception = assertThrows(ApiException.class,
                () -> new HriAuthorization(mock(EntityManager.class)).userId(authentication));

        assertThat(exception.status()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(exception.detail()).isEqualTo("user_id is outside the supported INTEGER range.");
    }
}
