package com.vibehr.migration;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import tools.jackson.databind.ObjectMapper;

/** Captures a reviewed PostgreSQL 16 catalog manifest after Flyway V1 has been applied. */
public final class SchemaManifestTool {

    private SchemaManifestTool() {
    }

    public static void main(String[] args) throws Exception {
        Arguments arguments = Arguments.parse(args);
        try (var connection = DriverManager.getConnection(arguments.jdbcUrl(), arguments.username(), arguments.password())) {
            var envelope = PostgreSqlSchemaManifest.envelope(connection, arguments.sourceChecksum());
            if (envelope.path("app_table_count").asInt() != 105) {
                throw new IllegalStateException("Expected 105 application tables before capturing schema metadata.");
            }
            Files.createDirectories(arguments.output().getParent());
            new ObjectMapper().writerWithDefaultPrettyPrinter().writeValue(arguments.output().toFile(), envelope);
            System.out.println("Wrote PostgreSQL schema metadata manifest to " + arguments.output());
        }
    }

    private record Arguments(String jdbcUrl, String username, String password, String sourceChecksum, Path output) {
        private static Arguments parse(String[] args) {
            if (args.length != 5) {
                throw new IllegalArgumentException("Usage: SchemaManifestTool <jdbc-url> <username> <password> <v1-sha256> <output-file>");
            }
            return new Arguments(args[0], args[1], args[2], args[3], Path.of(args[4]));
        }
    }
}
