package com.vibehr.platform.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.vibehr.testsupport.TestSecrets;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class BffAssertionPropertiesTest {

    private static final String STRONG_SECRET = TestSecrets.random256BitHex();

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(BffAssertionPropertiesConfiguration.class);

    @Test
    void acceptsTheProductionSafeSmokeLifetime() {
        contextRunner
                .withPropertyValues(
                        "vibehr.bff-assertion.secret=" + STRONG_SECRET,
                        "vibehr.bff-assertion.max-ttl-seconds=60")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context.getBean(BffAssertionProperties.class).maxTtlSeconds()).isEqualTo(60);
                });
    }

    @Test
    void rejectsAZeroSecondAssertionLifetime() {
        contextRunner
                .withPropertyValues(
                        "vibehr.bff-assertion.secret=" + STRONG_SECRET,
                        "vibehr.bff-assertion.max-ttl-seconds=0")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void rejectsWeakSecretsAtConfigurationBinding() {
        for (String secret : new String[] {
                "",
                "valid-secret-that-is-at-least-thirty-two-bytes\t",
                "too-short",
                "replace-me-with-a-secret-that-is-long-enough",
                "a".repeat(64),
                "passwordpasswordpasswordpasswordpasswordpasswordpasswordpassword"
        }) {
            assertThat(new BffAssertionProperties(secret, 60).hasValidSecret()).isFalse();
        }
        contextRunner
                .withPropertyValues(
                "vibehr.bff-assertion.secret=passwordpasswordpasswordpasswordpasswordpasswordpasswordpassword",
                        "vibehr.bff-assertion.max-ttl-seconds=60")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasStackTraceContaining("BFF assertion secret must be exactly 64 hexadecimal");
                });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(BffAssertionProperties.class)
    static class BffAssertionPropertiesConfiguration {
    }
}
