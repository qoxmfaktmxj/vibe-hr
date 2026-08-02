package com.vibehr.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.mock.env.MockEnvironment;

class FlywayCutoverConfigurationTest {

    private final FlywayCutoverConfiguration configuration = new FlywayCutoverConfiguration();

    @Test
    void missingOwnerFailsBeforeItCanConnectOrMigrate() {
        assertCutoverIsBlockedBeforeMigration(new MockEnvironment()
                .withProperty("vibehr.migration.alembic-writer-disabled", "true"));
    }

    @Test
    void wrongOwnerFailsBeforeItCanConnectOrMigrate() {
        assertCutoverIsBlockedBeforeMigration(new MockEnvironment().withProperty("vibehr.migration.owner", "alembic"));
    }

    @Test
    void correctOwnerIsTheOnlyAcceptedCutoverFence() {
        MockEnvironment environment = new MockEnvironment().withProperty("vibehr.migration.owner", "flyway");

        FlywayCutoverConfiguration.requireFlywayOwnership(environment);

        assertThat(environment.getProperty("vibehr.migration.alembic-writer-disabled")).isNull();
    }

    @Test
    void cutoverProfileContainsNoLegacyWriterProperty() throws Exception {
        try (InputStream input = getClass().getResourceAsStream("/application-flyway-cutover.yml")) {
            assertThat(input).isNotNull();
            assertThat(new String(input.readAllBytes(), StandardCharsets.UTF_8))
                    .contains("owner: ${VIBEHR_SCHEMA_OWNER:unapproved}")
                    .doesNotContain("alembic-writer-disabled")
                    .doesNotContain("VIBEHR_ALEMBIC_WRITER_DISABLED");
        }
    }

    private void assertCutoverIsBlockedBeforeMigration(MockEnvironment environment) {
        DataSource dataSource = mock(DataSource.class);
        Flyway flyway = mock(Flyway.class);
        FlywayMigrationStrategy strategy = configuration.verifiedFlywayMigrationStrategy(dataSource, environment);

        assertThatThrownBy(() -> strategy.migrate(flyway))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Flyway cutover requires vibehr.migration.owner=flyway.");

        verifyNoInteractions(dataSource, flyway);
    }
}
