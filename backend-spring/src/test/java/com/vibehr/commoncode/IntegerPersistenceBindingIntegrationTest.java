package com.vibehr.commoncode;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vibehr.VibeHrApplication;
import com.vibehr.platform.error.ApiException;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Guards INTEGER-backed JPA binding against the former Long JDBC override workaround. */
@Tag("integration")
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("flyway-cutover")
@SpringBootTest(
        classes = VibeHrApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.main.web-application-type=none",
                "spring.jpa.hibernate.ddl-auto=validate",
                "vibehr.migration.owner=flyway"
        })
class IntegerPersistenceBindingIntegrationTest {

    @Container
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("vibehr_integer_binding")
            .withUsername("vibehr")
            .withPassword("vibehr");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private CodeGroupRepository groups;

    @Autowired
    private CommonCodeService commonCodes;

    @Test
    void persistsAndQueriesCanonicalIntegerIdsWithoutJdbcOverrides() {
        AppCodeGroup group = groups.saveAndFlush(new AppCodeGroup(
                "INTEGER_BINDING_TEST", "Integer binding", null, true, 0, LocalDateTime.now()));

        assertThat(group.getId()).isInstanceOf(Integer.class);
        assertThat(groups.findById(group.getId())).isPresent();
    }

    @Test
    void rejectsOutOfRangeHttpCompatibleIdsBeforePersistenceCanBindThem() {
        long countBefore = groups.count();
        long outOfRangeId = (long) Integer.MAX_VALUE + 1;

        assertThatThrownBy(() -> commonCodes.updateGroup(outOfRangeId,
                new CommonCodeService.CodeGroupUpdateRequest(null, null, null, null, null)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("group_id is outside the supported INTEGER range");

        assertThat(groups.count()).isEqualTo(countBefore);
    }
}
