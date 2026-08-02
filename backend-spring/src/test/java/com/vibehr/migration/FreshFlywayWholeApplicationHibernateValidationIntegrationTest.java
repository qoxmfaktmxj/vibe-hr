package com.vibehr.migration;

import static org.assertj.core.api.Assertions.assertThat;

import com.vibehr.VibeHrApplication;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.context.ApplicationContext;
import org.springframework.core.env.Environment;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.containers.PostgreSQLContainer;

/** Proves the complete Spring model validates after a pristine Flyway V1-V5 installation. */
@Tag("integration")
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("flyway-cutover")
@SpringBootTest(
        classes = VibeHrApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.main.web-application-type=none",
                "spring.jpa.hibernate.ddl-auto=validate",
                "vibehr.migration.owner=flyway",
                // Keep the cached whole-application context from scheduling database work after Testcontainers stops.
                "vibehr.bff-assertion.replay-cleanup-delay-ms=86400000"
        })
class FreshFlywayWholeApplicationHibernateValidationIntegrationTest {

    @Container
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("vibehr_flyway_hibernate_validation")
            .withUsername("vibehr")
            .withPassword("vibehr");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private Environment environment;

    @Test
    void freshFlywaySchemaValidatesTheWholeApplicationModel() {
        assertThat(applicationContext).isNotNull();
        assertThat(environment.getProperty("vibehr.migration.owner")).isEqualTo("flyway");
        assertThat(environment.getProperty("vibehr.migration.alembic-writer-disabled")).isNull();
    }
}
