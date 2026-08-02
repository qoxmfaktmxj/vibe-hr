package com.vibehr.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class JwtTokenVerifierTest {

    private static final String TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsImlhdCI6MTc2NzIyNTYwMCwiZXhwIjoxNzY3MjI5MjAwLCJpc3MiOiJ2aWJlLWhyIn0.4m72mw76dRviTsxSbw1voBEVWI8p-8TEvxLMBua8t4M";
    private static final AuthProperties PROPERTIES = new AuthProperties("compatibility-test-key", "HS256", "vibe-hr", 480);

    @Test
    void verifiesDeterministicFastApiCompatibleHs256Token() {
        JwtTokenVerifier verifier = verifierAt("2026-01-01T00:30:00Z");

        JwtClaims claims = verifier.verify(TOKEN);

        assertThat(claims.subject()).isEqualTo("42");
        assertThat(claims.issuer()).isEqualTo("vibe-hr");
        assertThat(claims.issuedAt()).isEqualTo(Instant.parse("2026-01-01T00:00:00Z"));
        assertThat(claims.expiresAt()).isEqualTo(Instant.parse("2026-01-01T01:00:00Z"));
    }

    @Test
    void rejectsExpiredOrTamperedTokens() {
        assertThatThrownBy(() -> verifierAt("2026-01-01T01:00:00Z").verify(TOKEN))
                .isInstanceOf(InvalidJwtException.class)
                .hasMessageContaining("expired");

        assertThatThrownBy(() -> verifierAt("2026-01-01T00:30:00Z").verify(TOKEN.substring(0, TOKEN.length() - 1) + "A"))
                .isInstanceOf(InvalidJwtException.class)
                .hasMessageContaining("signature");
    }

    @Test
    void rejectsSignedTokenWithNonNumericPythonUserIdSubject() throws Exception {
        assertThatThrownBy(() -> verifierAt("2026-01-01T00:30:00Z").verify(signedToken("user-42")))
                .isInstanceOf(InvalidJwtException.class)
                .hasMessageContaining("digit-only");
    }

    private JwtTokenVerifier verifierAt(String now) {
        Clock clock = Clock.fixed(Instant.parse(now), ZoneOffset.UTC);
        return new JwtTokenVerifier(PROPERTIES, clock, new ObjectMapper());
    }

    private String signedToken(String subject) throws GeneralSecurityException {
        Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
        String header = encoder.encodeToString("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        String payload = encoder.encodeToString(("{\"sub\":\"" + subject + "\",\"iat\":1767225600,\"exp\":1767229200,\"iss\":\"vibe-hr\"}")
                .getBytes(StandardCharsets.UTF_8));
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec("compatibility-test-key".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String signature = encoder.encodeToString(mac.doFinal((header + "." + payload).getBytes(StandardCharsets.US_ASCII)));
        return header + "." + payload + "." + signature;
    }
}
