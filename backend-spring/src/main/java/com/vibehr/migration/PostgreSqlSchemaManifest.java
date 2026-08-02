package com.vibehr.migration;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/** Canonical PostgreSQL catalog capture used by both adoption and container tests. */
public final class PostgreSqlSchemaManifest {

    public static final String RESOURCE = "/db/migration/schema-metadata-manifest.json";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private PostgreSqlSchemaManifest() {
    }

    public static ObjectNode capture(Connection connection) throws SQLException {
        ObjectNode root = OBJECT_MAPPER.createObjectNode();
        ArrayNode tables = root.putArray("tables");
        for (String tableName : applicationTableNames(connection)) {
            ObjectNode table = tables.addObject();
            table.put("name", tableName);
            table.set("columns", captureColumns(connection, tableName));
            table.set("constraints", captureConstraints(connection, tableName));
            table.set("indexes", captureIndexes(connection, tableName));
        }
        root.set("sequences", captureSequences(connection));
        root.set("extensions", captureExtensions(connection));
        return root;
    }

    public static ObjectNode envelope(Connection connection, String sourceChecksum) throws SQLException {
        ObjectNode metadata = capture(connection);
        ObjectNode envelope = OBJECT_MAPPER.createObjectNode();
        envelope.put("schema_version", 1);
        envelope.put("source_flyway_v1_sha256", sourceChecksum);
        envelope.put("app_table_count", metadata.withArray("tables").size());
        envelope.put("metadata_sha256", sha256(canonicalJson(metadata)));
        envelope.set("metadata", metadata);
        return envelope;
    }

    public static void assertMatchesCheckedInManifest(Connection connection) throws SQLException {
        JsonNode expected = loadCheckedInManifest();
        ObjectNode actual = capture(connection);
        String expectedFingerprint = expected.path("metadata_sha256").asText();
        String actualFingerprint = sha256(canonicalJson(actual));
        if (!Objects.equals(expectedFingerprint, actualFingerprint)) {
            throw new IllegalStateException("PostgreSQL schema metadata drift detected; expected "
                    + expectedFingerprint + " but found " + actualFingerprint + ". Adoption was not started.");
        }
    }

    public static JsonNode loadCheckedInManifest() {
        try (InputStream stream = PostgreSqlSchemaManifest.class.getResourceAsStream(RESOURCE)) {
            if (stream == null) throw new IllegalStateException("Missing checked-in schema metadata manifest " + RESOURCE + ".");
            return OBJECT_MAPPER.readTree(stream);
        } catch (IOException exception) {
            throw new IllegalStateException("Cannot read checked-in schema metadata manifest.", exception);
        }
    }

    public static String canonicalJson(JsonNode node) {
        try {
            return OBJECT_MAPPER.writeValueAsString(node);
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot serialize schema metadata.", exception);
        }
    }

    private static List<String> applicationTableNames(Connection connection) throws SQLException {
        String sql = """
                select table_name
                from information_schema.tables
                where table_schema = 'public'
                  and table_type = 'BASE TABLE'
                  and table_name not in ('alembic_version', 'flyway_schema_history', 'bff_assertion_replays')
                order by table_name
                """;
        List<String> names = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql); ResultSet result = statement.executeQuery()) {
            while (result.next()) names.add(result.getString(1));
        }
        return names;
    }

    private static ArrayNode captureColumns(Connection connection, String tableName) throws SQLException {
        String sql = """
                select column_name, data_type, udt_name, is_nullable, column_default,
                       character_maximum_length, numeric_precision, numeric_scale, datetime_precision
                from information_schema.columns
                where table_schema = 'public' and table_name = ?
                order by ordinal_position
                """;
        ArrayNode values = OBJECT_MAPPER.createArrayNode();
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, tableName);
            try (ResultSet result = statement.executeQuery()) {
                while (result.next()) {
                    ObjectNode value = values.addObject();
                    value.put("name", result.getString(1));
                    value.put("data_type", result.getString(2));
                    value.put("udt_name", result.getString(3));
                    value.put("nullable", result.getString(4));
                    nullable(value, "default", result, 5);
                    nullable(value, "character_maximum_length", result, 6);
                    nullable(value, "numeric_precision", result, 7);
                    nullable(value, "numeric_scale", result, 8);
                    nullable(value, "datetime_precision", result, 9);
                }
            }
        }
        return values;
    }

    private static ArrayNode captureConstraints(Connection connection, String tableName) throws SQLException {
        String sql = """
                select pg_constraint.conname, pg_constraint.contype, pg_get_constraintdef(pg_constraint.oid, true)
                from pg_constraint
                join pg_class on pg_class.oid = pg_constraint.conrelid
                join pg_namespace on pg_namespace.oid = pg_class.relnamespace
                where pg_namespace.nspname = 'public' and pg_class.relname = ?
                order by pg_constraint.conname
                """;
        return captureNamedDefinitions(connection, tableName, sql, "type", "definition");
    }

    private static ArrayNode captureIndexes(Connection connection, String tableName) throws SQLException {
        String sql = """
                select indexname, indexdef
                from pg_indexes
                where schemaname = 'public' and tablename = ?
                order by indexname
                """;
        return captureNamedDefinitions(connection, tableName, sql, null, "definition");
    }

    private static ArrayNode captureNamedDefinitions(Connection connection, String tableName, String sql, String typeField, String definitionField) throws SQLException {
        ArrayNode values = OBJECT_MAPPER.createArrayNode();
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, tableName);
            try (ResultSet result = statement.executeQuery()) {
                while (result.next()) {
                    ObjectNode value = values.addObject();
                    value.put("name", result.getString(1));
                    if (typeField != null) value.put(typeField, result.getString(2));
                    value.put(definitionField, result.getString(typeField == null ? 2 : 3));
                }
            }
        }
        return values;
    }

    private static ArrayNode captureSequences(Connection connection) throws SQLException {
        String sql = """
                select sequence_name, data_type, start_value, minimum_value, maximum_value, increment, cycle_option
                from information_schema.sequences
                where sequence_schema = 'public'
                order by sequence_name
                """;
        ArrayNode values = OBJECT_MAPPER.createArrayNode();
        try (PreparedStatement statement = connection.prepareStatement(sql); ResultSet result = statement.executeQuery()) {
            while (result.next()) {
                ObjectNode value = values.addObject();
                value.put("name", result.getString(1));
                value.put("data_type", result.getString(2));
                value.put("start", result.getString(3));
                value.put("minimum", result.getString(4));
                value.put("maximum", result.getString(5));
                value.put("increment", result.getString(6));
                value.put("cycle", result.getString(7));
            }
        }
        return values;
    }

    private static ArrayNode captureExtensions(Connection connection) throws SQLException {
        ArrayNode values = OBJECT_MAPPER.createArrayNode();
        try (PreparedStatement statement = connection.prepareStatement("select extname, extversion from pg_extension where extname = 'btree_gist' order by extname");
             ResultSet result = statement.executeQuery()) {
            while (result.next()) {
                ObjectNode value = values.addObject();
                value.put("name", result.getString(1));
                value.put("version", result.getString(2));
            }
        }
        return values;
    }

    private static void nullable(ObjectNode node, String field, ResultSet result, int index) throws SQLException {
        Object value = result.getObject(index);
        if (value == null) node.putNull(field);
        else node.put(field, value.toString());
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }
}
