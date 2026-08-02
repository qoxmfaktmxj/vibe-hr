package com.vibehr.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class Pbkdf2PasswordVerifierTest {

    private final Pbkdf2PasswordVerifier verifier = new Pbkdf2PasswordVerifier();

    @Test
    void verifiesLegacyPbkdf2Sha256Vector() {
        String encoded = "pbkdf2_sha256$100000$00112233445566778899aabbccddeeff$2a080fdedce213934a91e8142d2eb7165be949c295612ce4b7d87be90ae208b6";

        assertThat(verifier.matches("correct horse battery staple", encoded)).isTrue();
        assertThat(verifier.matches("incorrect", encoded)).isFalse();
    }

    @Test
    void honorsPositiveIterationCountEncodedByPythonHash() {
        String encoded = "pbkdf2_sha256$2500$deadc0de00112233445566778899aabb$60a222faa2347aa12dd8578680c9a283c740edd379819cd4ef3bc7ec9cf9256b";

        assertThat(verifier.matches("legacy-compatible", encoded)).isTrue();
        assertThat(verifier.matches("incorrect", encoded)).isFalse();
    }

    @Test
    void honorsPythonCompatibleEmptyHexSalt() {
        String encoded = "pbkdf2_sha256$1$$c1232f10f62715fda06ae7c0a2037ca19b33cf103b727ba56d870c11f290a2ab";

        assertThat(verifier.matches("password", encoded)).isTrue();
    }

    @Test
    void rejectsMalformedOrNonPositiveIterationCounts() {
        assertThat(verifier.matches("password", "pbkdf2_sha256$0$00$00")).isFalse();
        assertThat(verifier.matches("password", "pbkdf2_sha256$-1$00$00")).isFalse();
        assertThat(verifier.matches("password", "pbkdf2_sha256$not-a-number$00$00")).isFalse();
        assertThat(verifier.matches("password", "pbkdf2_sha256$100000$not-hex$00")).isFalse();
        assertThat(verifier.matches("password", "bcrypt$100000$00$00")).isFalse();
    }
}
