package com.vibehr.auth;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

@Component
public final class Pbkdf2PasswordVerifier {

    private static final String ALGORITHM = "pbkdf2_sha256";
    private static final int DIGEST_BYTES = 32;

    public boolean matches(String password, String encodedHash) {
        if (password == null || encodedHash == null) {
            return false;
        }

        String[] parts = encodedHash.split("\\$", -1);
        if (parts.length != 4 || !ALGORITHM.equals(parts[0])) {
            return false;
        }

        try {
            int iterations = Integer.parseInt(parts[1]);
            if (iterations <= 0) {
                return false;
            }
            byte[] salt = HexFormat.of().parseHex(parts[2]);
            byte[] expected = HexFormat.of().parseHex(parts[3]);
            if (expected.length != DIGEST_BYTES) {
                return false;
            }
            return MessageDigest.isEqual(derive(password, salt, expected.length, iterations), expected);
        } catch (IllegalArgumentException | GeneralSecurityException exception) {
            return false;
        }
    }

    private byte[] derive(String password, byte[] salt, int outputBytes, int iterations) throws GeneralSecurityException {
        byte[] passwordBytes = password.getBytes(StandardCharsets.UTF_8);
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(passwordBytes, "HmacSHA256"));
            byte[] derived = new byte[outputBytes];
            int offset = 0;
            for (int blockIndex = 1; offset < outputBytes; blockIndex++) {
                byte[] block = deriveBlock(mac, salt, iterations, blockIndex);
                int copied = Math.min(block.length, outputBytes - offset);
                System.arraycopy(block, 0, derived, offset, copied);
                offset += copied;
            }
            return derived;
        } finally {
            Arrays.fill(passwordBytes, (byte) 0);
        }
    }

    private byte[] deriveBlock(Mac mac, byte[] salt, int iterations, int blockIndex) {
        mac.update(salt);
        byte[] current = mac.doFinal(new byte[] {
                (byte) (blockIndex >>> 24),
                (byte) (blockIndex >>> 16),
                (byte) (blockIndex >>> 8),
                (byte) blockIndex
        });
        byte[] block = current.clone();
        for (int iteration = 1; iteration < iterations; iteration++) {
            current = mac.doFinal(current);
            for (int index = 0; index < block.length; index++) {
                block[index] ^= current[index];
            }
        }
        return block;
    }
}
