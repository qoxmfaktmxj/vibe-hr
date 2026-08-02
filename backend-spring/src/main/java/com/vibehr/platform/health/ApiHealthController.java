package com.vibehr.platform.health;

import com.vibehr.platform.config.PlatformProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/health")
public class ApiHealthController {

    private final DatabaseHealthCheck databaseHealthCheck;
    private final PlatformProperties platformProperties;

    public ApiHealthController(DatabaseHealthCheck databaseHealthCheck, PlatformProperties platformProperties) {
        this.databaseHealthCheck = databaseHealthCheck;
        this.platformProperties = platformProperties;
    }

    @GetMapping
    ApiHealthResponse health() {
        boolean databaseAvailable = databaseHealthCheck.isAvailable();
        return new ApiHealthResponse(
                databaseAvailable ? "ok" : "degraded",
                platformProperties.name(),
                platformProperties.environment(),
                databaseAvailable ? "ok" : "error"
        );
    }

    public record ApiHealthResponse(String status, String app, String environment, String db) {
    }
}
