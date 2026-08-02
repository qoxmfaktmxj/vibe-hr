package com.vibehr.platform.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Locale;

public final class BffAssertionBinding {

    private BffAssertionBinding() {
    }

    public static String loginRequest(String enterCd, String loginId) {
        String canonical = enterCd.strip().toUpperCase(Locale.ROOT) + "\u0000" + loginId.strip();
        return sha256Base64Url(canonical);
    }

    public static String replayScope(String clientId, String remoteAddress) {
        return sha256Base64Url(clientId + "\u0000" + remoteAddress);
    }

    public static int replayBucket(String sourceHash) {
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(sourceHash);
            if (decoded.length != 32) {
                throw new InvalidBffAssertionException("BFF assertion source hash is invalid.");
            }
            return Byte.toUnsignedInt(decoded[0]);
        } catch (IllegalArgumentException exception) {
            throw new InvalidBffAssertionException("BFF assertion source hash is invalid.", exception);
        }
    }

    public static String sha256Base64Url(String value) {
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                    MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }
}
