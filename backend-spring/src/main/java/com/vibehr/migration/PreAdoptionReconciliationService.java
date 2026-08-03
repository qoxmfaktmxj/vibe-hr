package com.vibehr.migration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

/** Rebuilds the one reviewed production-drift shape without deleting its source tables or rows. */
public final class PreAdoptionReconciliationService {

    public static final String CONFIRMATION = "reconcile-known-production-drift-20260803";
    public static final String SOURCE_FINGERPRINT = "e9cf20a655e8f4a06b4e93db40661843ab94d363a906be19e8450397a7a12ec1";
    public static final String ARCHIVE_SCHEMA = "vibehr_pre_adoption_20260803";
    private static final String RESOURCE = "db/reconciliation/pre-adoption-production-drift-20260803.sql";
    private static final long RECONCILIATION_LOCK = 382_671_113_083L;
    private static final List<String> TABLES = List.of(
            "hri_approval_actor_rules",
            "org_departments",
            "tim_attendance_daily",
            "tim_leave_requests",
            "wel_benefit_requests");
    private static final List<SequenceTarget> SEQUENCES = List.of(
            new SequenceTarget("hri_approval_actor_rules_id_seq", "hri_approval_actor_rules"),
            new SequenceTarget("org_departments_id_seq", "org_departments"),
            new SequenceTarget("tim_attendance_daily_id_seq", "tim_attendance_daily"),
            new SequenceTarget("tim_leave_requests_id_seq", "tim_leave_requests"),
            new SequenceTarget("wel_benefit_requests_id_seq", "wel_benefit_requests"));

    private final DataSource dataSource;

    public PreAdoptionReconciliationService(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public ReconciliationReport reconcile(String confirmation, String expectedSourceFingerprint) throws SQLException {
        if (!CONFIRMATION.equals(confirmation)) {
            throw new IllegalStateException("Pre-adoption reconciliation requires the exact explicit confirmation token.");
        }
        if (!SOURCE_FINGERPRINT.equals(expectedSourceFingerprint)) {
            throw new IllegalStateException("Pre-adoption reconciliation requires the exact reviewed source fingerprint.");
        }

        try (Connection connection = dataSource.getConnection()) {
            boolean originalAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            connection.setTransactionIsolation(Connection.TRANSACTION_SERIALIZABLE);
            try {
                execute(connection, "select pg_advisory_xact_lock(?)", RECONCILIATION_LOCK);
                execute(connection, "set local search_path to public, pg_catalog");
                execute(connection, "set local time zone 'UTC'");
                requirePreconditions(connection);

                String actualSourceFingerprint = PostgreSqlSchemaManifest.fingerprint(connection);
                if (!SOURCE_FINGERPRINT.equals(actualSourceFingerprint)) {
                    throw new IllegalStateException("Refusing reconciliation: expected source fingerprint "
                            + SOURCE_FINGERPRINT + " but found " + actualSourceFingerprint + ".");
                }
                Map<String, TableEvidence> before = evidence(connection, true);
                setLocal(connection, "vibehr.reconciliation_confirmation", confirmation);
                setLocal(connection, "vibehr.reconciliation_expected_source_fingerprint", expectedSourceFingerprint);

                ScriptUtils.executeSqlScript(
                        connection,
                        new EncodedResource(new ClassPathResource(RESOURCE)),
                        false,
                        false,
                        ScriptUtils.DEFAULT_COMMENT_PREFIX,
                        ScriptUtils.EOF_STATEMENT_SEPARATOR,
                        ScriptUtils.DEFAULT_BLOCK_COMMENT_START_DELIMITER,
                        ScriptUtils.DEFAULT_BLOCK_COMMENT_END_DELIMITER);
                PostgreSqlSchemaManifest.assertMatchesCheckedInManifest(connection);
                Map<String, TableEvidence> after = evidence(connection, false);
                if (!before.equals(after)) {
                    throw new IllegalStateException("Reconciliation changed protected row counts or deterministic checksums: before="
                            + before + ", after=" + after + ".");
                }
                Map<String, SequenceEvidence> sequences = sequenceEvidence(connection);
                connection.commit();
                return new ReconciliationReport(actualSourceFingerprint,
                        PostgreSqlSchemaManifest.loadCheckedInManifest().path("metadata_sha256").asText(), before, after, sequences);
            } catch (Exception exception) {
                connection.rollback();
                if (exception instanceof SQLException sqlException) throw sqlException;
                if (exception instanceof RuntimeException runtimeException) throw runtimeException;
                throw new IllegalStateException("Pre-adoption reconciliation failed and was rolled back.", exception);
            } finally {
                connection.setAutoCommit(originalAutoCommit);
            }
        }
    }

    private void requirePreconditions(Connection connection) throws SQLException {
        if (!"public".equals(singleString(connection, "select current_schema()"))) {
            throw new IllegalStateException("Pre-adoption reconciliation requires current_schema()=public.");
        }
        if (relationExists(connection, "public.flyway_schema_history")) {
            throw new IllegalStateException("Refusing reconciliation after Flyway history exists.");
        }
        if (!relationExists(connection, "public.alembic_version")) {
            throw new IllegalStateException("Refusing reconciliation without alembic_version.");
        }
        String head = singleString(connection, "select version_num from public.alembic_version order by version_num");
        if (!FlywayAdoptionService.ALEMBIC_HEAD.equals(head)
                || singleLong(connection, "select count(*) from public.alembic_version") != 1L) {
            throw new IllegalStateException("Refusing reconciliation: expected exactly one Alembic head "
                    + FlywayAdoptionService.ALEMBIC_HEAD + ".");
        }
        if (singleLong(connection, "select count(*) from pg_namespace where nspname = '" + ARCHIVE_SCHEMA + "'") != 0L) {
            throw new IllegalStateException("Refusing reconciliation because archive schema already exists.");
        }
    }

    private Map<String, TableEvidence> evidence(Connection connection, boolean source) throws SQLException {
        Map<String, TableEvidence> evidence = new LinkedHashMap<>();
        for (String table : TABLES) {
            String payload = "to_jsonb(t)";
            if ("tim_leave_requests".equals(table)) {
                String decidedAt = source
                        ? "to_char(t.decided_at at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US')"
                        : "to_char(t.decided_at, 'YYYY-MM-DD\"T\"HH24:MI:SS.US')";
                payload = "to_jsonb(t) || jsonb_build_object('decided_at', case when t.decided_at is null then null else "
                        + decidedAt + " end)";
            }
            String sql = "select count(*), md5(coalesce(string_agg(payload::text, E'\\n' order by id), '')) "
                    + "from (select t.id, " + payload + " payload from public." + table + " t) protected_rows";
            try (PreparedStatement statement = connection.prepareStatement(sql); ResultSet result = statement.executeQuery()) {
                result.next();
                evidence.put(table, new TableEvidence(result.getLong(1), result.getString(2)));
            }
        }
        return evidence;
    }

    private Map<String, SequenceEvidence> sequenceEvidence(Connection connection) throws SQLException {
        Map<String, SequenceEvidence> evidence = new LinkedHashMap<>();
        for (SequenceTarget target : SEQUENCES) {
            String sql = "select s.last_value, s.is_called, q.seqincrement, coalesce((select max(id) from public."
                    + target.table() + "), 0) from public." + target.sequence() + " s "
                    + "join pg_class c on c.oid = 'public." + target.sequence() + "'::regclass "
                    + "join pg_sequence q on q.seqrelid = c.oid";
            try (PreparedStatement statement = connection.prepareStatement(sql); ResultSet result = statement.executeQuery()) {
                result.next();
                long lastValue = result.getLong(1);
                boolean called = result.getBoolean(2);
                long increment = result.getLong(3);
                long maxId = result.getLong(4);
                long nextValue = called ? lastValue + increment : lastValue;
                if (nextValue <= maxId) {
                    throw new IllegalStateException("Sequence " + target.sequence() + " would generate " + nextValue
                            + " at or below max id " + maxId + ".");
                }
                evidence.put(target.sequence(), new SequenceEvidence(lastValue, called, nextValue, maxId));
            }
        }
        return evidence;
    }

    private boolean relationExists(Connection connection, String relation) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("select to_regclass(?::text) is not null")) {
            statement.setString(1, relation);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getBoolean(1);
            }
        }
    }

    private String singleString(Connection connection, String sql) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql); ResultSet result = statement.executeQuery()) {
            if (!result.next()) return null;
            String value = result.getString(1);
            if (result.next()) throw new IllegalStateException("Expected one row from reconciliation precondition query.");
            return value;
        }
    }

    private long singleLong(Connection connection, String sql) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql); ResultSet result = statement.executeQuery()) {
            result.next();
            return result.getLong(1);
        }
    }

    private void setLocal(Connection connection, String key, String value) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("select set_config(?, ?, true)")) {
            statement.setString(1, key);
            statement.setString(2, value);
            statement.execute();
        }
    }

    private void execute(Connection connection, String sql, Object... values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int index = 0; index < values.length; index += 1) statement.setObject(index + 1, values[index]);
            statement.execute();
        }
    }

    public record TableEvidence(long rowCount, String checksum) { }
    public record SequenceEvidence(long lastValue, boolean called, long nextValue, long maxId) { }
    public record ReconciliationReport(String sourceFingerprint, String targetFingerprint,
                                       Map<String, TableEvidence> before, Map<String, TableEvidence> after,
                                       Map<String, SequenceEvidence> sequences) { }
    private record SequenceTarget(String sequence, String table) { }
}
