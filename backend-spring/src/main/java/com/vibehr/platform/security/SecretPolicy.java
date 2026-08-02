package com.vibehr.platform.security;

/** Validates runtime HMAC secrets before the application can accept traffic. */
public final class SecretPolicy {

    private static final String HEX_256_BIT = "[0-9a-fA-F]{64}";

    private SecretPolicy() {
    }

    public static boolean isValid(String secret) {
        return secret != null && secret.matches(HEX_256_BIT) && !isRepeatedCharacter(secret);
    }

    public static boolean areDistinct(String first, String second) {
        return isValid(first) && isValid(second) && !first.equals(second);
    }

    private static boolean isRepeatedCharacter(String value) {
        return value.codePoints().distinct().count() == 1;
    }
}
