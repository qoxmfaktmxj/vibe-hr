package com.vibehr.platform.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.vibehr.testsupport.TestSecrets;
import org.junit.jupiter.api.Test;

class SecretPolicyTest {

    @Test
    void acceptsStrongMixedSecretsAndRejectsEveryWeakSecretCategory() {
        String auth = TestSecrets.random256BitHex();
        String bff = auth.substring(0, 63) + (auth.endsWith("0") ? "1" : "0");
        assertThat(SecretPolicy.isValid(auth)).isTrue();
        assertThat(SecretPolicy.areDistinct(auth, bff)).isTrue();
        assertThat(SecretPolicy.areDistinct(auth, auth)).isFalse();

        for (String weakSecret : new String[] {
                null,
                "",
                "short-secret",
                "secret with whitespace-that-is-long-enough",
                "valid-secret-with-a-bom\uFEFF-at-the-end",
                "valid-secret-with-a-control\u0001-at-the-end",
                "valid-secret-with-a-format\u200B-at-the-end",
                "replace-with-a-secret-that-is-long-enough",
                "a".repeat(64),
                "passwordpasswordpasswordpasswordpasswordpasswordpasswordpassword",
                "4d1de25bfbc17cbeb6db0b7092627727d92879999a3be8a2442c7b2af87bcc6",
                "valid-secret-with-a-bom\uFEFF-at-the-end0000000000000000000000000"
        }) {
            assertThat(SecretPolicy.isValid(weakSecret)).isFalse();
        }
    }
}
