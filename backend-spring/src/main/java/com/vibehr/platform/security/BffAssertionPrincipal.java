package com.vibehr.platform.security;

import com.vibehr.platform.error.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

public record BffAssertionPrincipal(
        String purpose,
        String provider,
        String providerUserId,
        String email,
        String displayName,
        boolean emailVerified,
        String clientId,
        String sourceHash,
        int replayBucket,
        String requestBinding,
        String requestBodyDigest,
        String nonce
) {

    public void requireLoginBinding(String enterCd, String loginId) {
        if (!"login".equals(purpose) || clientId == null || requestBinding == null) {
            throw ApiException.unauthorized("Invalid BFF assertion.");
        }
        String expected = BffAssertionBinding.loginRequest(enterCd, loginId);
        if (!MessageDigest.isEqual(
                requestBinding.getBytes(StandardCharsets.US_ASCII),
                expected.getBytes(StandardCharsets.US_ASCII)
        )) {
            throw ApiException.unauthorized("Invalid BFF assertion.");
        }
    }

    public void requireSocialBinding(String requestedProvider, String requestedProviderUserId, String requestedEmail, String requestedDisplayName) {
        if (!"social-exchange".equals(purpose)
                || !emailVerified
                || !same(provider, requestedProvider)
                || !same(providerUserId, requestedProviderUserId)
                || !same(email, requestedEmail)
                || !same(displayName, requestedDisplayName)) {
            throw ApiException.unauthorized("Invalid BFF assertion.");
        }
    }

    public void requireRequestBodyDigest(String actualDigest) {
        if (requestBodyDigest == null || actualDigest == null || !MessageDigest.isEqual(
                requestBodyDigest.getBytes(StandardCharsets.US_ASCII),
                actualDigest.getBytes(StandardCharsets.US_ASCII)
        )) {
            throw new InvalidBffAssertionException("BFF assertion body digest is invalid.");
        }
    }

    private static boolean same(String actual, String expected) {
        return actual != null && expected != null && MessageDigest.isEqual(
                actual.getBytes(StandardCharsets.UTF_8),
                expected.getBytes(StandardCharsets.UTF_8)
        );
    }
}
