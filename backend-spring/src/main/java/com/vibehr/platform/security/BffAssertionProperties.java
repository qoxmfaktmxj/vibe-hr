package com.vibehr.platform.security;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("vibehr.bff-assertion")
public record BffAssertionProperties(
        String secret,
        @Min(10) @Max(120) int maxTtlSeconds
) {

    @AssertTrue(message = "BFF assertion secret must be exactly 64 hexadecimal characters and not a repeated-character value.")
    public boolean hasValidSecret() {
        return SecretPolicy.isValid(secret);
    }

    boolean isConfigured() {
        return hasValidSecret();
    }
}
