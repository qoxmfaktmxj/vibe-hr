package com.vibehr.auth;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

@Component
public final class JwtTokenIssuer {

    private static final Base64.Encoder BASE64_URL_ENCODER = Base64.getUrlEncoder().withoutPadding();

    private final AuthProperties properties;
    private final Clock clock;

    public JwtTokenIssuer(AuthProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    public IssuedToken issue(long userId, int expiresMinutes) {
        Instant issuedAt = clock.instant();
        Instant expiresAt = issuedAt.plusSeconds(expiresMinutes * 60L);
        String header = encode("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
        String payload = encode("{\"sub\":\"" + userId + "\",\"iat\":" + issuedAt.getEpochSecond()
                + ",\"exp\":" + expiresAt.getEpochSecond() + ",\"iss\":\"" + json(properties.issuer()) + "\"}");
        String signed = header + "." + payload;
        return new IssuedToken(signed + "." + BASE64_URL_ENCODER.encodeToString(sign(signed)), expiresAt.getEpochSecond());
    }

    private byte[] sign(String content) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(properties.secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(content.getBytes(StandardCharsets.US_ASCII));
        } catch (Exception exception) {
            throw new IllegalStateException("HmacSHA256 is unavailable.", exception);
        }
    }

    private static String encode(String value) {
        return BASE64_URL_ENCODER.encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String json(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    public record IssuedToken(String value, long expiresAt) {
    }
}
