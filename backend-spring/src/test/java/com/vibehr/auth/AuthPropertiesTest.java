package com.vibehr.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.vibehr.testsupport.TestSecrets;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class AuthPropertiesTest {

    private static final String STRONG_SECRET = TestSecrets.random256BitHex();

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(AuthPropertiesConfiguration.class);

    @Test
    void bindsAStrongSecret() {
        contextRunner
                .withPropertyValues(
                        "vibehr.auth.secret=" + STRONG_SECRET,
                        "vibehr.auth.algorithm=HS256",
                        "vibehr.auth.issuer=vibe-hr",
                        "vibehr.auth.expires-minutes=480")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context.getBean(AuthProperties.class).secret()).isEqualTo(STRONG_SECRET);
                });
    }

    @Test
    void rejectsWeakSecretsAtConfigurationBinding() {
        for (String secret : new String[] {
                "short-but-not-blank",
                "has a whitespace character-but-is-long-enough",
                "replace-with-a-secret-that-is-long-enough",
                "a".repeat(64),
                "passwordpasswordpasswordpasswordpasswordpasswordpasswordpassword",
                "0".repeat(63)
        }) {
            contextRunner
                    .withPropertyValues(
                            "vibehr.auth.secret=" + secret,
                            "vibehr.auth.algorithm=HS256",
                            "vibehr.auth.issuer=vibe-hr",
                            "vibehr.auth.expires-minutes=480")
                    .run(context -> {
                        assertThat(context).hasFailed();
                        assertThat(context.getStartupFailure()).hasStackTraceContaining("Auth token secret must be exactly 64 hexadecimal");
                    });
        }
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(AuthProperties.class)
    static class AuthPropertiesConfiguration {
    }
}
