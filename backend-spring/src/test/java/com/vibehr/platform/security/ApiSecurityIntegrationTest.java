package com.vibehr.platform.security;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.mock;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vibehr.platform.config.CorsProperties;
import com.vibehr.platform.config.PlatformProperties;
import com.vibehr.platform.error.ApiExceptionHandler;
import com.vibehr.platform.error.RequestBodyCachingFilter;
import com.vibehr.platform.health.ApiHealthController;
import com.vibehr.platform.health.DatabaseHealthCheck;
import com.vibehr.platform.health.HealthController;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Clock;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.datasource.AbstractDataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@WebMvcTest(controllers = {
        HealthController.class,
        ApiHealthController.class,
        ApiSecurityIntegrationTest.ValidationProbeController.class,
        ApiSecurityIntegrationTest.PublicRouteProbeController.class
})
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "vibehr.bff-assertion.max-ttl-seconds=60",
        "vibehr.cors.origins=http://localhost:3000"
})
@Import({
        ApiExceptionHandler.class,
        RequestBodyCachingFilter.class,
        DatabaseHealthCheck.class,
        FastApiSecurityErrorHandler.class,
        SecurityConfiguration.class,
        ApiSecurityIntegrationTest.TestPlatformConfiguration.class
})
class ApiSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SwitchableDataSource dataSource;

    @BeforeEach
    void resetDataSource() {
        dataSource.setFailure(FailureMode.NONE);
    }

    @Test
    void permitsHealthEndpointsWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));

        mockMvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void reportsLegacyApiHealthWhenDatabaseIsReachable() throws Exception {
        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.app").value("Vibe-HR API"))
                .andExpect(jsonPath("$.environment").value("local"))
                .andExpect(jsonPath("$.db").value("ok"));
    }

    @Test
    void reportsLegacyApiHealthDegradationWhenDatabaseCheckFails() throws Exception {
        dataSource.setFailure(FailureMode.SQL);

        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("degraded"))
                .andExpect(jsonPath("$.db").value("error"));
    }

    @Test
    void degradesApiHealthForRuntimeDatabaseFailures() throws Exception {
        dataSource.setFailure(FailureMode.RUNTIME);

        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("degraded"))
                .andExpect(jsonPath("$.db").value("error"));
    }

    @Test
    void permitsOnlyThePublicCorporationLookupWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/auth/enter-cds"))
                .andExpect(status().isOk());
    }

    @Test
    void deniesUnmigratedApiPathsWithFastApiCompatible401() throws Exception {
        mockMvc.perform(get("/api/v1/employees"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Not authenticated."));
    }

    @Test
    void rejectsDirectBffProtectedAuthCallsBeforeControllerDispatch() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enter_cd\":\"VIBE\",\"login_id\":\"admin\",\"password\":\"password\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Invalid BFF assertion."));
    }

    @Test
    void returnsFastApiShaped422ForInvalidBodyField() throws Exception {
        mockMvc.perform(post("/api/v1/test-validation")
                        .with(user("test-user"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employee_no\":\"\"}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").isArray())
                .andExpect(jsonPath("$.detail[0].loc[0]").value("body"))
                .andExpect(jsonPath("$.detail[0].loc[1]").value("employee_no"))
                .andExpect(jsonPath("$.detail[0].type").isNotEmpty())
                .andExpect(jsonPath("$.detail[0].msg").isNotEmpty())
                .andExpect(jsonPath("$.detail[0].input").value(""));
    }

    @Test
    void returnsFastApiShaped422ForMissingQueryParameter() throws Exception {
        mockMvc.perform(get("/api/v1/test-validation/method")
                        .with(user("test-user")))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail[0].type").value("missing"))
                .andExpect(jsonPath("$.detail[0].loc[0]").value("query"))
                .andExpect(jsonPath("$.detail[0].loc[1]").value("page"))
                .andExpect(jsonPath("$.detail[0].msg").value("Field required"))
                .andExpect(jsonPath("$.detail[0].input").value(nullValue()));
    }

    @Test
    void returnsFastApiShaped422ForQueryTypeConversion() throws Exception {
        mockMvc.perform(get("/api/v1/test-validation/method")
                        .with(user("test-user"))
                        .param("page", "abc"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail[0].type").value("int_parsing"))
                .andExpect(jsonPath("$.detail[0].loc[0]").value("query"))
                .andExpect(jsonPath("$.detail[0].loc[1]").value("page"))
                .andExpect(jsonPath("$.detail[0].msg").value("Input should be a valid integer, unable to parse string as an integer"))
                .andExpect(jsonPath("$.detail[0].input").value("abc"));
    }

    @Test
    void preservesTheRawQueryStringForConstraintViolations() throws Exception {
        mockMvc.perform(get("/api/v1/test-validation/method")
                        .with(user("test-user"))
                        .param("page", "0"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail[0].type").value("greater_than_equal"))
                .andExpect(jsonPath("$.detail[0].loc[0]").value("query"))
                .andExpect(jsonPath("$.detail[0].loc[1]").value("page"))
                .andExpect(jsonPath("$.detail[0].msg").value("Input should be greater than or equal to 1"))
                .andExpect(jsonPath("$.detail[0].input").value("0"));
    }

    @Test
    void returnsFastApiShaped422ForMalformedJson() throws Exception {
        mockMvc.perform(post("/api/v1/test-validation")
                        .with(user("test-user"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employee_no\":"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail[0].type").value("json_invalid"))
                .andExpect(jsonPath("$.detail[0].loc[0]").value("body"))
                .andExpect(jsonPath("$.detail[0].loc[1]").value(15))
                .andExpect(jsonPath("$.detail[0].msg").value("JSON decode error"))
                .andExpect(jsonPath("$.detail[0].input").isMap());
    }

    @TestConfiguration(proxyBeanMethods = false)
    @EnableConfigurationProperties({PlatformProperties.class, CorsProperties.class, BffAssertionProperties.class})
    static class TestPlatformConfiguration {

        @Bean
        Clock clock() {
            return Clock.systemUTC();
        }

        @Bean
        BffAssertionVerifier bffAssertionVerifier(BffAssertionProperties properties, Clock clock, tools.jackson.databind.ObjectMapper objectMapper) {
            return new BffAssertionVerifier(properties, clock, objectMapper);
        }

        @Bean
        BffAssertionReplayStore bffAssertionReplayStore() {
            return new BffAssertionReplayStore(mock(JdbcTemplate.class));
        }

        @Bean
        SwitchableDataSource dataSource() {
            return new SwitchableDataSource();
        }

        @Bean
        ValidationProbeController validationProbeController() {
            return new ValidationProbeController();
        }

        @Bean
        PublicRouteProbeController publicRouteProbeController() {
            return new PublicRouteProbeController();
        }
    }

    @RestController
    static class ValidationProbeController {

        @PostMapping("/api/v1/test-validation")
        void validateBody(@Valid @RequestBody ValidationPayload payload) {
        }

        @GetMapping("/api/v1/test-validation/method")
        void validatePage(@RequestParam("page") @Min(1) int page) {
        }
    }

    @RestController
    static class PublicRouteProbeController {

        @GetMapping("/actuator/health/readiness")
        Map<String, String> readiness() {
            return Map.of("status", "UP");
        }

        @GetMapping("/api/v1/auth/enter-cds")
        Map<String, String> enterCds() {
            return Map.of("status", "ok");
        }

    }

    record ValidationPayload(@NotBlank String employeeNo) {
    }

    enum FailureMode {
        NONE,
        SQL,
        RUNTIME
    }

    static final class SwitchableDataSource extends AbstractDataSource {

        private volatile FailureMode failure = FailureMode.NONE;

        void setFailure(FailureMode failure) {
            this.failure = failure;
        }

        @Override
        public Connection getConnection() throws SQLException {
            if (failure == FailureMode.SQL) {
                throw new SQLException("Database is unavailable for this test.");
            }
            if (failure == FailureMode.RUNTIME) {
                throw new IllegalStateException("Database client failed at runtime.");
            }
            return (Connection) Proxy.newProxyInstance(
                    Connection.class.getClassLoader(),
                    new Class<?>[] {Connection.class},
                    (proxy, method, arguments) -> switch (method.getName()) {
                        case "createStatement" -> statement();
                        case "close" -> null;
                        case "isClosed" -> false;
                        case "toString" -> "SwitchableDataSource connection";
                        default -> throw new UnsupportedOperationException(method.getName());
                    }
            );
        }

        @Override
        public Connection getConnection(String username, String password) throws SQLException {
            return getConnection();
        }

        private Statement statement() {
            return (Statement) Proxy.newProxyInstance(
                    Statement.class.getClassLoader(),
                    new Class<?>[] {Statement.class},
                    (proxy, method, arguments) -> switch (method.getName()) {
                        case "execute" -> true;
                        case "close" -> null;
                        case "toString" -> "SwitchableDataSource statement";
                        default -> throw new UnsupportedOperationException(method.getName());
                    }
            );
        }
    }
}
