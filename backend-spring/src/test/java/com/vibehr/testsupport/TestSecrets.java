package com.vibehr.testsupport;

import java.security.SecureRandom;
import java.util.HexFormat;

public final class TestSecrets {

    private static final SecureRandom RANDOM = new SecureRandom();

    private TestSecrets() {
    }

    public static String random256BitHex() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    public static String configured(String property) {
        String secret = System.getProperty(property);
        if (secret == null) {
            throw new IllegalStateException("Missing test secret system property: " + property);
        }
        return secret;
    }
}
