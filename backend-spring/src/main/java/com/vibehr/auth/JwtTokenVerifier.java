package com.vibehr.auth;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Component
public final class JwtTokenVerifier {

    private static final TypeReference<Map<String, Object>> JSON_OBJECT = new TypeReference<>() { };
    private static final Base64.Decoder BASE64_URL_DECODER = Base64.getUrlDecoder();

    private final AuthProperties authProperties;
    private final Clock clock;
    private final ObjectMapper objectMapper;

    public JwtTokenVerifier(AuthProperties authProperties, Clock clock, ObjectMapper objectMapper) {
        this.authProperties = authProperties;
        this.clock = clock;
        this.objectMapper = objectMapper;
    }

    public JwtClaims verify(String token) {
        String[] parts = token == null ? new String[0] : token.split("\\.", -1);
        if (parts.length != 3 || parts[0].isBlank() || parts[1].isBlank() || parts[2].isBlank()) {
            throw new InvalidJwtException("JWT must contain three non-empty segments.");
        }

        verifySignature(parts);
        Map<String, Object> header = readJson(parts[0], "header");
        if (!"HS256".equals(header.get("alg"))) {
            throw new InvalidJwtException("JWT algorithm must be HS256.");
        }

        Map<String, Object> payload = readJson(parts[1], "payload");
        String issuer = requiredString(payload, "iss");
        if (!authProperties.issuer().equals(issuer)) {
            throw new InvalidJwtException("JWT issuer does not match the configured issuer.");
        }

        String subject = requiredUserIdSubject(payload);
        Instant issuedAt = requiredEpochSecond(payload, "iat");
        Instant expiresAt = requiredEpochSecond(payload, "exp");
        Instant now = clock.instant();
        if (issuedAt.isAfter(now)) {
            throw new InvalidJwtException("JWT was issued in the future.");
        }
        if (!expiresAt.isAfter(now)) {
            throw new InvalidJwtException("JWT has expired.");
        }

        return new JwtClaims(subject, issuer, issuedAt, expiresAt);
    }

    private void verifySignature(String[] parts) {
        byte[] expected = hmacSha256((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        byte[] actual;
        try {
            actual = BASE64_URL_DECODER.decode(parts[2]);
        } catch (IllegalArgumentException exception) {
            throw new InvalidJwtException("JWT signature is not valid Base64URL.", exception);
        }
        if (!MessageDigest.isEqual(expected, actual)) {
            throw new InvalidJwtException("JWT signature is invalid.");
        }
    }

    private byte[] hmacSha256(byte[] signedContent) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(authProperties.secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(signedContent);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("HmacSHA256 is unavailable.", exception);
        }
    }

    private Map<String, Object> readJson(String encoded, String partName) {
        try {
            return objectMapper.readValue(BASE64_URL_DECODER.decode(encoded), JSON_OBJECT);
        } catch (IllegalArgumentException | JacksonException exception) {
            throw new InvalidJwtException("JWT " + partName + " is not valid JSON.", exception);
        }
    }

    private static String requiredString(Map<String, Object> payload, String claimName) {
        Object value = payload.get(claimName);
        if (!(value instanceof String stringValue) || stringValue.isBlank()) {
            throw new InvalidJwtException("JWT claim " + claimName + " must be a non-empty string.");
        }
        return stringValue;
    }

    private static String requiredUserIdSubject(Map<String, Object> payload) {
        String subject = requiredString(payload, "sub");
        if (!subject.chars().allMatch(Character::isDigit)) {
            throw new InvalidJwtException("JWT claim sub must be a digit-only user id.");
        }
        return subject;
    }

    private static Instant requiredEpochSecond(Map<String, Object> payload, String claimName) {
        Object value = payload.get(claimName);
        if (!(value instanceof Number numberValue)) {
            throw new InvalidJwtException("JWT claim " + claimName + " must be an epoch second number.");
        }
        try {
            return Instant.ofEpochSecond(numberValue.longValue());
        } catch (DateTimeException exception) {
            throw new InvalidJwtException("JWT claim " + claimName + " is outside the supported time range.", exception);
        }
    }
}
