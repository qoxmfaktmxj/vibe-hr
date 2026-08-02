package com.vibehr.auth;

import java.security.SecureRandom;
import java.util.HexFormat;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.springframework.stereotype.Component;

@Component
final class Pbkdf2PasswordHasher {

    private static final int ITERATIONS = 100_000;
    private static final int SALT_BYTES = 16;
    private final SecureRandom secureRandom = new SecureRandom();

    String hash(String password) {
        byte[] salt = new byte[SALT_BYTES];
        secureRandom.nextBytes(salt);
        char[] characters = password.toCharArray();
        try {
            byte[] digest = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(new PBEKeySpec(characters, salt, ITERATIONS, 256))
                    .getEncoded();
            return "pbkdf2_sha256$" + ITERATIONS + "$" + HexFormat.of().formatHex(salt) + "$" + HexFormat.of().formatHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("PBKDF2WithHmacSHA256 is unavailable.", exception);
        } finally {
            java.util.Arrays.fill(characters, '\0');
        }
    }
}
