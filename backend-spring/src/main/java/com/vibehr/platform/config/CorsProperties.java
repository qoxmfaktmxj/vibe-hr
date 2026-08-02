package com.vibehr.platform.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("vibehr.cors")
public record CorsProperties(@NotEmpty List<@NotBlank String> origins) {
}
