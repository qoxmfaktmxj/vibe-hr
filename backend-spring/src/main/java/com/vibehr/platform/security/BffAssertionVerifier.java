package com.vibehr.platform.security;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Set;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Component
public final class BffAssertionVerifier {

    public static final String HEADER_NAME = "X-VibeHR-BFF-Assertion";
    private static final String TYPE = "VIBEHR-BFF";
    private static final TypeReference<Map<String, Object>> JSON_OBJECT = new TypeReference<>() { };
    private static final Base64.Decoder BASE64_URL_DECODER = Base64.getUrlDecoder();
    private static final Set<String> SOCIAL_PROVIDERS = Set.of("google", "kakao");

    private final BffAssertionProperties properties;
    private final Clock clock;
    private final ObjectMapper objectMapper;

    public BffAssertionVerifier(BffAssertionProperties properties, Clock clock, ObjectMapper objectMapper) {
        this.properties = properties;
        this.clock = clock;
        this.objectMapper = objectMapper;
    }

    public VerifiedAssertion verify(String token, String expectedMethod, String expectedPath) {
        if (!properties.isConfigured()) {
            throw new InvalidBffAssertionException("BFF assertion secret is not configured.");
        }
        String[] parts = token == null ? new String[0] : token.split("\\.", -1);
        if (parts.length != 3 || parts[0].isBlank() || parts[1].isBlank() || parts[2].isBlank()) {
            throw new InvalidBffAssertionException("BFF assertion must contain three non-empty segments.");
        }

        verifySignature(parts);
        Map<String, Object> header = readJson(parts[0], "header");
        if (!"HS256".equals(header.get("alg")) || !TYPE.equals(header.get("typ"))) {
            throw new InvalidBffAssertionException("BFF assertion header is not supported.");
        }

        Map<String, Object> payload = readJson(parts[1], "payload");
        if (requiredInt(payload, "ver") != 1) {
            throw new InvalidBffAssertionException("BFF assertion version is not supported.");
        }
        String method = requiredString(payload, "method", 3, 10);
        String path = requiredString(payload, "path", 1, 200);
        if (!expectedMethod.equals(method) || !expectedPath.equals(path)) {
            throw new InvalidBffAssertionException("BFF assertion method or path does not match this request.");
        }

        Instant issuedAt = requiredEpochSecond(payload, "iat");
        Instant expiresAt = requiredEpochSecond(payload, "exp");
        Instant now = clock.instant();
        if (issuedAt.isAfter(now.plusSeconds(10)) || !expiresAt.isAfter(now)
                || expiresAt.getEpochSecond() - issuedAt.getEpochSecond() > properties.maxTtlSeconds()) {
            throw new InvalidBffAssertionException("BFF assertion is stale or outside the allowed lifetime.");
        }
        String nonce = requiredToken(payload, "nonce", 22, 128);
        String requestBodyDigest = requiredToken(payload, "body_sha256", 43, 43);
        String sourceHash = requiredToken(payload, "source_hash", 43, 43);
        int replayBucket = requiredInt(payload, "replay_bucket");
        if (replayBucket != BffAssertionBinding.replayBucket(sourceHash)) {
            throw new InvalidBffAssertionException("BFF assertion replay bucket is invalid.");
        }
        String purpose = requiredString(payload, "purpose", 1, 30);
        BffAssertionPrincipal principal = switch (purpose) {
            case "login" -> loginPrincipal(payload, nonce, sourceHash, replayBucket, requestBodyDigest);
            case "social-exchange" -> socialPrincipal(payload, nonce, sourceHash, replayBucket, requestBodyDigest);
            default -> throw new InvalidBffAssertionException("BFF assertion purpose is not supported.");
        };
        return new VerifiedAssertion(principal, expiresAt);
    }

    private BffAssertionPrincipal loginPrincipal(
            Map<String, Object> payload,
            String nonce,
            String sourceHash,
            int replayBucket,
            String requestBodyDigest
    ) {
        return new BffAssertionPrincipal(
                "login", null, null, null, null, false,
                requiredToken(payload, "client_id", 22, 128),
                sourceHash,
                replayBucket,
                requiredToken(payload, "request_binding", 43, 43),
                requestBodyDigest,
                nonce
        );
    }

    private BffAssertionPrincipal socialPrincipal(
            Map<String, Object> payload,
            String nonce,
            String sourceHash,
            int replayBucket,
            String requestBodyDigest
    ) {
        String provider = requiredString(payload, "provider", 2, 20);
        if (!SOCIAL_PROVIDERS.contains(provider) || !requiredBoolean(payload, "email_verified")) {
            throw new InvalidBffAssertionException("BFF assertion social identity is not verified.");
        }
        return new BffAssertionPrincipal(
                "social-exchange",
                provider,
                requiredString(payload, "provider_user_id", 1, 100),
                requiredString(payload, "email", 3, 320),
                requiredString(payload, "display_name", 1, 100),
                true,
                requiredToken(payload, "client_id", 22, 128),
                sourceHash,
                replayBucket,
                null,
                requestBodyDigest,
                nonce
        );
    }

    private void verifySignature(String[] parts) {
        byte[] actual;
        try {
            actual = BASE64_URL_DECODER.decode(parts[2]);
        } catch (IllegalArgumentException exception) {
            throw new InvalidBffAssertionException("BFF assertion signature is not valid Base64URL.", exception);
        }
        byte[] expected = hmacSha256((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        if (!MessageDigest.isEqual(expected, actual)) {
            throw new InvalidBffAssertionException("BFF assertion signature is invalid.");
        }
    }

    private byte[] hmacSha256(byte[] content) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(properties.secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(content);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("HmacSHA256 is unavailable.", exception);
        }
    }

    private Map<String, Object> readJson(String encoded, String partName) {
        try {
            return objectMapper.readValue(BASE64_URL_DECODER.decode(encoded), JSON_OBJECT);
        } catch (IllegalArgumentException | JacksonException exception) {
            throw new InvalidBffAssertionException("BFF assertion " + partName + " is not valid JSON.", exception);
        }
    }

    private static String requiredString(Map<String, Object> payload, String name, int minLength, int maxLength) {
        Object value = payload.get(name);
        if (!(value instanceof String text) || text.isBlank() || text.length() < minLength || text.length() > maxLength) {
            throw new InvalidBffAssertionException("BFF assertion claim " + name + " is invalid.");
        }
        return text;
    }

    private static String requiredToken(Map<String, Object> payload, String name, int minLength, int maxLength) {
        String value = requiredString(payload, name, minLength, maxLength);
        if (!value.matches("[A-Za-z0-9_-]+")) {
            throw new InvalidBffAssertionException("BFF assertion claim " + name + " is not a token.");
        }
        return value;
    }

    private static int requiredInt(Map<String, Object> payload, String name) {
        Object value = payload.get(name);
        if (!(value instanceof Integer integer)) {
            throw new InvalidBffAssertionException("BFF assertion claim " + name + " must be an integer.");
        }
        return integer;
    }

    private static boolean requiredBoolean(Map<String, Object> payload, String name) {
        Object value = payload.get(name);
        if (!(value instanceof Boolean booleanValue)) {
            throw new InvalidBffAssertionException("BFF assertion claim " + name + " must be a boolean.");
        }
        return booleanValue;
    }

    private static Instant requiredEpochSecond(Map<String, Object> payload, String name) {
        Object value = payload.get(name);
        if (!(value instanceof Integer || value instanceof Long)) {
            throw new InvalidBffAssertionException("BFF assertion claim " + name + " must be an epoch second.");
        }
        try {
            return Instant.ofEpochSecond(((Number) value).longValue());
        } catch (DateTimeException exception) {
            throw new InvalidBffAssertionException("BFF assertion claim " + name + " is outside the supported time range.", exception);
        }
    }

    public record VerifiedAssertion(BffAssertionPrincipal principal, Instant expiresAt) {
    }
}
