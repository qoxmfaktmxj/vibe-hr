package com.vibehr.platform.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vibehr.auth.AuthController;
import com.vibehr.auth.AuthExceptionHandler;
import com.vibehr.auth.AuthService;
import com.vibehr.auth.AuthService.LoginResponse;
import com.vibehr.auth.AuthService.LoginUserResponse;
import com.vibehr.auth.LoginRateLimiter;
import com.vibehr.platform.config.CorsProperties;
import com.vibehr.platform.error.ApiExceptionHandler;
import com.vibehr.testsupport.TestSecrets;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(controllers = AuthController.class)
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "vibehr.bff-assertion.max-ttl-seconds=60",
        "vibehr.cors.origins=http://localhost:3000"
})
@Import({
        ApiExceptionHandler.class,
        AuthExceptionHandler.class,
        FastApiSecurityErrorHandler.class,
        SecurityConfiguration.class,
        AuthBffSecurityIntegrationTest.SecurityTestConfiguration.class
})
class AuthBffSecurityIntegrationTest {

    private static final String SECRET = TestSecrets.configured("vibehr.bff-assertion.secret");
    private static final Instant NOW = Instant.parse("2026-08-01T00:00:00Z");
    private static final AtomicInteger NONCE_SEQUENCE = new AtomicInteger();
    private static final Set<String> CONSUMED_NONCES = ConcurrentHashMap.newKeySet();
    private static final AtomicBoolean REPLAY_STORE_UNAVAILABLE = new AtomicBoolean();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AuthService authService;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void stubAuthService() {
        CONSUMED_NONCES.clear();
        REPLAY_STORE_UNAVAILABLE.set(false);
        when(authService.login(any())).thenReturn(loginResponse());
        when(authService.socialExchange(any())).thenReturn(loginResponse());
        clearInvocations(authService);
    }

    @Test
    void rejectsDirectLoginAndSocialExchangeCalls() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody("admin")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Invalid BFF assertion."));

        mockMvc.perform(post("/api/v1/auth/social/exchange")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(socialBody("google", "subject-1", "person@example.com", "Person")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Invalid BFF assertion."));
    }

    @Test
    void rejectsForgedExpiredAndPathMismatchedAssertions() throws Exception {
        String valid = assertion(loginClaims(clientId(1), "admin"), NOW, NOW.plusSeconds(30));
        String forged = valid.substring(0, valid.length() - 1) + (valid.endsWith("A") ? "B" : "A");

        mockMvc.perform(login(forged, "admin"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Invalid BFF assertion."));

        mockMvc.perform(login(assertion(loginClaims(clientId(2), "admin"), NOW.minusSeconds(90), NOW.minusSeconds(60)), "admin"))
                .andExpect(status().isUnauthorized());

        Map<String, Object> pathMismatch = loginClaims(clientId(3), "admin");
        pathMismatch.put("path", "/api/v1/auth/social/exchange");
        mockMvc.perform(login(assertion(pathMismatch, NOW, NOW.plusSeconds(30)), "admin"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void executesAValidSignedLoginForTheBoundRequestOnly() throws Exception {
        String assertion = assertion(loginClaims(clientId(4), "admin"), NOW, NOW.plusSeconds(30));

        mockMvc.perform(login(assertion, "admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token").value("access-token"));

        mockMvc.perform(login(assertion(loginClaims(clientId(4), "other-user"), NOW, NOW.plusSeconds(30)), "admin"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Invalid BFF assertion."));
    }

    @Test
    void requiresProviderVerifiedEmailAndExactSocialIdentity() throws Exception {
        Map<String, Object> unverified = socialClaims("google", "subject-2", "person@example.com", "Person", false);
        mockMvc.perform(social(assertion(unverified, NOW, NOW.plusSeconds(30)), "google", "subject-2", "person@example.com", "Person"))
                .andExpect(status().isUnauthorized());

        String valid = assertion(socialClaims("kakao", "subject-3", "verified@example.com", "Verified Person", true), NOW, NOW.plusSeconds(30));
        mockMvc.perform(social(valid, "kakao", "subject-3", "verified@example.com", "Verified Person"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token").value("access-token"));

        mockMvc.perform(social(
                        assertion(socialClaims("google", "subject-4", "verified@example.com", "Verified Person", true), NOW, NOW.plusSeconds(30)),
                        "google",
                        "subject-4",
                        "different@example.com",
                        "Verified Person"
                ))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsReplayAndCapsTheSameLoginBindingAcrossDistinctBffClients() throws Exception {
        String cappedLoginId = "capped-user";
        String replayAssertion = assertion(loginClaims(clientId(5), "replay-user"), NOW, NOW.plusSeconds(30));
        mockMvc.perform(login(replayAssertion, "replay-user")).andExpect(status().isOk());
        mockMvc.perform(login(replayAssertion, "replay-user")).andExpect(status().isUnauthorized());

        for (int attempt = 0; attempt < 10; attempt++) {
            mockMvc.perform(login(assertion(loginClaims(clientId(10 + attempt), cappedLoginId), NOW, NOW.plusSeconds(30)), cappedLoginId))
                    .andExpect(status().isOk());
        }
        mockMvc.perform(login(assertion(loginClaims(clientId(20), cappedLoginId), NOW, NOW.plusSeconds(30)), cappedLoginId))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "300"))
                .andExpect(jsonPath("$.detail").value("Too many login attempts. Please try again later."));

        mockMvc.perform(login(assertion(loginClaims(clientId(21), "other-user"), NOW, NOW.plusSeconds(30)), "other-user"))
                .andExpect(status().isOk());
    }

    @Test
    void rejectsLoginAndSocialBodiesThatDoNotMatchTheSignedDigest() throws Exception {
        String loginAssertion = assertion(loginClaims(clientId(30), "digest-user"), NOW, NOW.plusSeconds(30));
        mockMvc.perform(post("/api/v1/auth/login")
                        .header(BffAssertionVerifier.HEADER_NAME, loginAssertion)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody("digest-user") + " "))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Invalid BFF assertion."));

        String socialAssertion = assertion(socialClaims("google", "subject-digest", "person@example.com", "Person", true), NOW, NOW.plusSeconds(30));
        mockMvc.perform(post("/api/v1/auth/social/exchange")
                        .header(BffAssertionVerifier.HEADER_NAME, socialAssertion)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(socialBody("google", "subject-digest", "person@example.com", "Person") + "\n"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Invalid BFF assertion."));
    }

    @Test
    void failsClosedWithoutLeakingDatabaseDetailsWhenReplayPersistenceFails() throws Exception {
        REPLAY_STORE_UNAVAILABLE.set(true);

        mockMvc.perform(login(assertion(loginClaims(clientId(50), "database-failure"), NOW, NOW.plusSeconds(30)), "database-failure"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.detail").value("Authentication service unavailable."));

        verify(authService, never()).login(any());
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder login(String assertion, String loginId) {
        return post("/api/v1/auth/login")
                .header(BffAssertionVerifier.HEADER_NAME, assertion)
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody(loginId));
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder social(
            String assertion,
            String provider,
            String providerUserId,
            String email,
            String displayName
    ) {
        return post("/api/v1/auth/social/exchange")
                .header(BffAssertionVerifier.HEADER_NAME, assertion)
                .contentType(MediaType.APPLICATION_JSON)
                .content(socialBody(provider, providerUserId, email, displayName));
    }

    private static String loginBody(String loginId) {
        return "{\"enter_cd\":\"VIBE\",\"login_id\":\"" + loginId + "\",\"password\":\"password\"}";
    }

    private static String socialBody(String provider, String providerUserId, String email, String displayName) {
        return "{\"provider\":\"" + provider + "\",\"provider_user_id\":\"" + providerUserId
                + "\",\"email\":\"" + email + "\",\"display_name\":\"" + displayName + "\"}";
    }

    private Map<String, Object> loginClaims(String clientId, String loginId) {
        Map<String, Object> claims = commonClaims("login");
        claims.put("client_id", clientId);
        claims.put("request_binding", BffAssertionBinding.loginRequest("VIBE", loginId));
        claims.put("body_sha256", BffAssertionBinding.sha256Base64Url(loginBody(loginId)));
        return claims;
    }

    private Map<String, Object> socialClaims(String provider, String providerUserId, String email, String displayName, boolean emailVerified) {
        Map<String, Object> claims = commonClaims("social-exchange");
        claims.put("path", "/api/v1/auth/social/exchange");
        claims.put("provider", provider);
        claims.put("provider_user_id", providerUserId);
        claims.put("email", email);
        claims.put("display_name", displayName);
        claims.put("email_verified", emailVerified);
        claims.put("client_id", clientId(NONCE_SEQUENCE.incrementAndGet()));
        claims.put("body_sha256", BffAssertionBinding.sha256Base64Url(socialBody(provider, providerUserId, email, displayName)));
        return claims;
    }

    private Map<String, Object> commonClaims(String purpose) {
        Map<String, Object> claims = new LinkedHashMap<>();
        String sourceHash = BffAssertionBinding.sha256Base64Url("test-source-" + NONCE_SEQUENCE.incrementAndGet());
        claims.put("ver", 1);
        claims.put("method", "POST");
        claims.put("path", "/api/v1/auth/login");
        claims.put("nonce", String.format("%043d", NONCE_SEQUENCE.incrementAndGet()));
        claims.put("purpose", purpose);
        claims.put("source_hash", sourceHash);
        claims.put("replay_bucket", BffAssertionBinding.replayBucket(sourceHash));
        return claims;
    }

    private String assertion(Map<String, Object> claims, Instant issuedAt, Instant expiresAt) throws Exception {
        claims.put("iat", issuedAt.getEpochSecond());
        claims.put("exp", expiresAt.getEpochSecond());
        String header = base64Url("{\"alg\":\"HS256\",\"typ\":\"VIBEHR-BFF\"}");
        String payload = base64Url(objectMapper.writeValueAsString(claims));
        String signed = header + "." + payload;
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return signed + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(signed.getBytes(StandardCharsets.US_ASCII)));
    }

    private static String base64Url(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String clientId(int value) {
        return String.format("%043d", value);
    }

    private static LoginResponse loginResponse() {
        return new LoginResponse(
                "access-token",
                "bearer",
                new LoginUserResponse(1, "person@example.com", "Person", List.of("employee")),
                NOW.plusSeconds(3_600).getEpochSecond(),
                3_600,
                60,
                30,
                true,
                43_200,
                true
        );
    }

    @TestConfiguration(proxyBeanMethods = false)
    @EnableConfigurationProperties({BffAssertionProperties.class, CorsProperties.class})
    static class SecurityTestConfiguration {

        @Bean
        Clock clock() {
            return Clock.fixed(NOW, ZoneOffset.UTC);
        }

        @Bean
        AuthService authService() {
            return mock(AuthService.class);
        }

        @Bean
        LoginRateLimiter loginRateLimiter(Clock clock) {
            return new LoginRateLimiter(clock);
        }

        @Bean
        BffAssertionVerifier bffAssertionVerifier(BffAssertionProperties properties, Clock clock, ObjectMapper objectMapper) {
            return new BffAssertionVerifier(properties, clock, objectMapper);
        }

        @Bean
        BffAssertionReplayStore bffAssertionReplayStore() {
            JdbcTemplate jdbc = mock(JdbcTemplate.class);
            when(jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class))).thenAnswer(invocation -> {
                if (REPLAY_STORE_UNAVAILABLE.get()) {
                    throw new DataAccessResourceFailureException("database write failed");
                }
                return CONSUMED_NONCES.add((String) invocation.getArgument(5)) ? 1 : 0;
            });
            return new BffAssertionReplayStore(jdbc);
        }

    }
}
