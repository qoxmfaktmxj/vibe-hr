package com.vibehr.platform.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("vibehr.application")
public record PlatformProperties(@NotBlank String name, @NotBlank String environment) {
}
