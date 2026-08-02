package com.vibehr.auth;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import com.vibehr.platform.security.SecretPolicy;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("vibehr.auth")
public record AuthProperties(
        @NotBlank String secret,
        @Pattern(regexp = "HS256", message = "Only HS256 is supported during migration.") String algorithm,
        @NotBlank String issuer,
        @Min(1) int expiresMinutes
) {

    @AssertTrue(message = "Auth token secret must be exactly 64 hexadecimal characters and not a repeated-character value.")
    public boolean hasValidSecret() {
        return SecretPolicy.isValid(secret);
    }
}
