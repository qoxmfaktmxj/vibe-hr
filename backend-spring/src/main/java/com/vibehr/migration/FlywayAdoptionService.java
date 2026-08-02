package com.vibehr.migration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;

/** Performs the one-way Alembic-to-Flyway ownership transfer without blind baselining. */
public final class FlywayAdoptionService {

    public static final String ALEMBIC_HEAD = "org_mapping_foundation_20260722";
    private static final long ADOPTION_LOCK = 382_671_113_071L;
    private static final List<FlywayHistoryRow> EXPECTED_HISTORY = List.of(
            new FlywayHistoryRow(1, "1", "verified Alembic org_mapping_foundation_20260722", "BASELINE", "verified Alembic org_mapping_foundation_20260722", 0, true),
            new FlywayHistoryRow(2, "2", "retire alembic version marker", "SQL", "V2__retire_alembic_version_marker.sql", null, true));

    private final DataSource dataSource;

    public FlywayAdoptionService(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public AdoptionResult adopt() throws SQLException {
        try (Connection lockConnection = dataSource.getConnection()) {
            lock(lockConnection);
            try {
                if (relationExists(lockConnection, "flyway_schema_history")) return verifyAlreadyAdopted(lockConnection);
                verifyAlembicHead(lockConnection);
                PostgreSqlSchemaManifest.assertMatchesCheckedInManifest(lockConnection);
                Flyway flyway = Flyway.configure()
                        .dataSource(dataSource)
                        .locations("classpath:db/migration")
                        .baselineOnMigrate(false)
                        .baselineVersion("1")
                        .baselineDescription("verified Alembic org_mapping_foundation_20260722")
                        .target("2")
                        .validateOnMigrate(true)
                        .cleanDisabled(true)
                        .load();
                flyway.baseline();
                flyway.migrate();
                if (relationExists(lockConnection, "alembic_version")) {
                    throw new IllegalStateException("Flyway adoption did not retire alembic_version.");
                }
                PostgreSqlSchemaManifest.assertMatchesCheckedInManifest(lockConnection);
                return AdoptionResult.ADOPTED;
            } finally {
                unlock(lockConnection);
            }
        }
    }

    private AdoptionResult verifyAlreadyAdopted(Connection connection) throws SQLException {
        if (relationExists(connection, "alembic_version")) {
            throw new IllegalStateException("Both migration histories exist; manual recovery is required before retrying adoption.");
        }
        List<FlywayHistoryRow> history = readFlywayHistory(connection);
        if (history.size() != EXPECTED_HISTORY.size()) {
            throw new IllegalStateException("Flyway history must contain exactly the expected V1 baseline and V2 marker-retirement rows.");
        }
        for (int index = 0; index < EXPECTED_HISTORY.size(); index += 1) {
            FlywayHistoryRow expected = EXPECTED_HISTORY.get(index);
            FlywayHistoryRow actual = history.get(index);
            if (expected.installedRank() != actual.installedRank()
                    || !expected.version().equals(actual.version())
                    || !expected.description().equals(actual.description())
                    || !expected.type().equals(actual.type())
                    || !expected.script().equals(actual.script())
                    || expected.success() != actual.success()
                    || (expected.checksum() != null && !expected.checksum().equals(actual.checksum()))) {
                throw new IllegalStateException("Flyway history does not match the exact expected V1/V2 adoption records: " + history);
            }
        }
        Flyway flyway = configuredFlyway();
        try {
            // Flyway resolves V2 from the classpath and compares its exact expected checksum to history.
            flyway.validate();
        } catch (RuntimeException exception) {
            throw new IllegalStateException("Flyway history does not match the exact expected V1/V2 migration checksums.", exception);
        }
        Integer expectedV2Checksum = resolvedChecksum(flyway, "2");
        if (history.get(1).checksum() == null || !history.get(1).checksum().equals(expectedV2Checksum)) {
            throw new IllegalStateException("Flyway history does not match the exact expected V2 checksum.");
        }
        PostgreSqlSchemaManifest.assertMatchesCheckedInManifest(connection);
        return AdoptionResult.ALREADY_ADOPTED;
    }

    private void verifyAlembicHead(Connection connection) throws SQLException {
        if (!relationExists(connection, "alembic_version")) {
            throw new IllegalStateException("Refusing adoption: alembic_version is missing.");
        }
        List<String> heads = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement("select version_num from alembic_version order by version_num");
             ResultSet result = statement.executeQuery()) {
            while (result.next()) heads.add(result.getString(1));
        }
        if (heads.size() != 1 || !ALEMBIC_HEAD.equals(heads.getFirst())) {
            throw new IllegalStateException("Refusing adoption: expected exactly one Alembic head " + ALEMBIC_HEAD + " but found " + heads + ".");
        }
    }

    private List<FlywayHistoryRow> readFlywayHistory(Connection connection) throws SQLException {
        List<FlywayHistoryRow> rows = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement("""
                select installed_rank, version, description, type, script, checksum, success
                from flyway_schema_history
                order by installed_rank
                """); ResultSet result = statement.executeQuery()) {
            while (result.next()) {
                int checksum = result.getInt(6);
                rows.add(new FlywayHistoryRow(
                        result.getInt(1), result.getString(2), result.getString(3), result.getString(4), result.getString(5),
                        result.wasNull() ? null : checksum, result.getBoolean(7)));
            }
        }
        return rows;
    }

    private Flyway configuredFlyway() {
        return Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .baselineOnMigrate(false)
                .target("2")
                .validateOnMigrate(true)
                .cleanDisabled(true)
                .load();
    }

    private Integer resolvedChecksum(Flyway flyway, String version) {
        for (MigrationInfo migration : flyway.info().all()) {
            if (migration.getVersion() != null && version.equals(migration.getVersion().getVersion())) {
                return migration.getChecksum();
            }
        }
        throw new IllegalStateException("Expected Flyway migration V" + version + " is not resolvable from the classpath.");
    }

    private boolean relationExists(Connection connection, String relationName) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("select to_regclass(?::text) is not null")) {
            statement.setString(1, "public." + relationName);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getBoolean(1);
            }
        }
    }

    private void lock(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("select pg_advisory_lock(?)")) {
            statement.setLong(1, ADOPTION_LOCK);
            statement.execute();
        }
    }

    private void unlock(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("select pg_advisory_unlock(?)")) {
            statement.setLong(1, ADOPTION_LOCK);
            statement.execute();
        }
    }

    public enum AdoptionResult { ADOPTED, ALREADY_ADOPTED }

    private record FlywayHistoryRow(int installedRank, String version, String description, String type, String script, Integer checksum, boolean success) {
    }
}
