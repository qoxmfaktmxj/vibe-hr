package com.vibehr.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Set;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Proves the V4/V5 replay store is present on a pristine V1-V5 Flyway installation. */
@Tag("integration")
@Testcontainers(disabledWithoutDocker = true)
class FreshFlywayReplayStoreSchemaIntegrationTest {

    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
            .withDatabaseName("vibehr_flyway_replay_schema")
            .withUsername("vibehr")
            .withPassword("vibehr");

    @BeforeEach
    void migrateFreshDatabase() {
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .cleanDisabled(false).load().clean();
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration").load().migrate();
    }

    @Test
    void freshV1ThroughV5InstallCreatesTheBoundedReplayStoreSchema() throws Exception {
        try (Connection connection = connection()) {
            assertThat(appliedVersions(connection)).containsExactly("1", "2", "3", "4", "5");
            assertColumn(connection, "nonce", "character varying", 128, false);
            assertColumn(connection, "scope_hash", "character varying", 43, false);
            assertColumn(connection, "source_hash", "character varying", 43, false);
            assertColumn(connection, "replay_bucket", "smallint", null, false);
            assertColumn(connection, "expires_at", "timestamp with time zone", null, false);
            assertThat(primaryKeyColumns(connection)).containsExactly("nonce");
            assertThat(indexNames(connection)).contains(
                    "bff_assertion_replays_scope_expiry_idx",
                    "bff_assertion_replays_expiry_idx",
                    "bff_assertion_replays_bucket_expiry_idx",
                    "bff_assertion_replays_source_expiry_idx"
            );

            insertReplay(connection, "bucket-zero", "source-zero", 0);
            insertReplay(connection, "bucket-max", "source-max", 255);
            assertThatThrownBy(() -> insertReplay(connection, "bucket-too-low", "source-low", -1))
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> insertReplay(connection, "bucket-too-high", "source-high", 256))
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> insertReplay(connection, "missing-source", null, 0))
                    .isInstanceOf(SQLException.class);
        }
    }

    private Connection connection() throws SQLException {
        return DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    private List<String> appliedVersions(Connection connection) throws SQLException {
        try (var statement = connection.createStatement(); ResultSet result = statement.executeQuery("""
                select version from flyway_schema_history
                 where success and version is not null
                 order by installed_rank
                """)) {
            java.util.ArrayList<String> versions = new java.util.ArrayList<>();
            while (result.next()) versions.add(result.getString(1));
            return versions;
        }
    }

    private void assertColumn(
            Connection connection, String name, String dataType, Integer maximumLength, boolean nullable
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                select data_type, character_maximum_length, is_nullable
                  from information_schema.columns
                 where table_schema = 'public' and table_name = 'bff_assertion_replays' and column_name = ?
                """)) {
            statement.setString(1, name);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString("data_type")).isEqualTo(dataType);
                assertThat((Integer) result.getObject("character_maximum_length")).isEqualTo(maximumLength);
                assertThat(result.getString("is_nullable").equals("YES")).isEqualTo(nullable);
            }
        }
    }

    private List<String> primaryKeyColumns(Connection connection) throws SQLException {
        try (var statement = connection.createStatement(); ResultSet result = statement.executeQuery("""
                select column_name
                  from information_schema.key_column_usage
                 where table_schema = 'public' and table_name = 'bff_assertion_replays'
                   and constraint_name = 'bff_assertion_replays_pkey'
                 order by ordinal_position
                """)) {
            java.util.ArrayList<String> columns = new java.util.ArrayList<>();
            while (result.next()) columns.add(result.getString(1));
            return columns;
        }
    }

    private Set<String> indexNames(Connection connection) throws SQLException {
        try (var statement = connection.createStatement(); ResultSet result = statement.executeQuery("""
                select indexname from pg_indexes
                 where schemaname = 'public' and tablename = 'bff_assertion_replays'
                """)) {
            java.util.LinkedHashSet<String> indexes = new java.util.LinkedHashSet<>();
            while (result.next()) indexes.add(result.getString(1));
            return indexes;
        }
    }

    private void insertReplay(Connection connection, String nonce, String sourceHash, int replayBucket) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                insert into bff_assertion_replays (nonce, scope_hash, source_hash, replay_bucket, expires_at)
                values (?, 'scope', ?, ?, current_timestamp + interval '1 minute')
                """)) {
            statement.setString(1, nonce);
            statement.setString(2, sourceHash);
            statement.setInt(3, replayBucket);
            statement.executeUpdate();
        }
    }
}
