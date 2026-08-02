package com.vibehr.platform.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.vibehr.auth.ActiveUserLookup;
import com.vibehr.auth.AuthProperties;
import com.vibehr.auth.CurrentUser;
import com.vibehr.auth.JwtTokenIssuer;
import com.vibehr.auth.JwtTokenVerifier;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Set;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import tools.jackson.databind.ObjectMapper;

class JwtAuthenticationFilterTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-01-01T00:30:00Z"), ZoneOffset.UTC);
    private static final AuthProperties PROPERTIES = new AuthProperties("compatibility-test-key", "HS256", "vibe-hr", 480);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authenticatesAnActiveBearerTokenUser() throws Exception {
        ActiveUserLookup users = mock(ActiveUserLookup.class);
        CurrentUser activeUser = new CurrentUser(42L, Set.of("admin"));
        given(users.find(42L)).willReturn(activeUser);
        JwtAuthenticationFilter filter = filter(users);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + validToken());

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authentication.getPrincipal()).isEqualTo(activeUser);
        assertThat(authentication.getAuthorities()).extracting(authority -> authority.getAuthority()).containsExactly("ROLE_admin");
    }

    @Test
    void leavesRequestsWithoutBearerAuthenticationUntouched() throws Exception {
        ActiveUserLookup users = mock(ActiveUserLookup.class);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter(users).doFilter(new MockHttpServletRequest(), response, new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(response.getStatus()).isEqualTo(200);
        verifyNoInteractions(users);
    }

    @Test
    void rejectsInvalidBearerTokensWithTheFastApiCompatibleResponse() throws Exception {
        ActiveUserLookup users = mock(ActiveUserLookup.class);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer invalid-token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter(users).doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).isEqualTo("{\"detail\":\"Invalid access token.\"}");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verifyNoInteractions(users);
    }

    @Test
    void rejectsAnOverflowJwtSubjectWithTheFastApiCompatibleResponse() throws Exception {
        ActiveUserLookup users = mock(ActiveUserLookup.class);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + new JwtTokenIssuer(PROPERTIES, CLOCK)
                .issue((long) Integer.MAX_VALUE + 1, 30).value());
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter(users).doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).isEqualTo("{\"detail\":\"Invalid access token.\"}");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verifyNoInteractions(users);
    }

    @Test
    void rejectsASignedNonNumericJwtSubjectWithTheFastApiCompatibleResponse() throws Exception {
        ActiveUserLookup users = mock(ActiveUserLookup.class);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + signedToken("not-a-user-id"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter(users).doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).isEqualTo("{\"detail\":\"Invalid access token.\"}");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verifyNoInteractions(users);
    }

    private JwtAuthenticationFilter filter(ActiveUserLookup users) {
        JwtTokenVerifier verifier = new JwtTokenVerifier(PROPERTIES, CLOCK, new ObjectMapper());
        return new JwtAuthenticationFilter(verifier, users, new FastApiSecurityErrorHandler());
    }

    private String validToken() {
        return new JwtTokenIssuer(PROPERTIES, CLOCK).issue(42L, 30).value();
    }

    private String signedToken(String subject) throws Exception {
        String header = Base64.getUrlEncoder().withoutPadding().encodeToString(
                "{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        String payload = Base64.getUrlEncoder().withoutPadding().encodeToString(("{\"sub\":\"" + subject
                + "\",\"iat\":1767227400,\"exp\":1767229200,\"iss\":\"vibe-hr\"}").getBytes(StandardCharsets.UTF_8));
        String content = header + "." + payload;
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(PROPERTIES.secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return content + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(content.getBytes(StandardCharsets.US_ASCII)));
    }
}
