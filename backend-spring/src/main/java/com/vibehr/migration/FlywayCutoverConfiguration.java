package com.vibehr.migration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

/** Blocks Flyway unless the explicit, sole-writer cutover fence is enabled. */
@Configuration
@Profile("flyway-cutover")
public class FlywayCutoverConfiguration {

    @Bean
    FlywayMigrationStrategy verifiedFlywayMigrationStrategy(DataSource dataSource, Environment environment) {
        return flyway -> {
            requireFlywayOwnership(environment);
            try (Connection connection = dataSource.getConnection()) {
                boolean hasAlembic = relationExists(connection, "alembic_version");
                boolean hasFlyway = relationExists(connection, "flyway_schema_history");
                boolean hasApplicationTables = applicationTableCount(connection) > 0;
                if (hasAlembic) throw new IllegalStateException("Alembic marker present. Run the explicit flyway-adoption command instead of Flyway migrate.");
                if (hasApplicationTables && !hasFlyway) throw new IllegalStateException("Existing schema has no Flyway history. Run the explicit flyway-adoption command instead of Flyway migrate.");
                flyway.migrate();
                PostgreSqlSchemaManifest.assertMatchesCheckedInManifest(connection);
            } catch (Exception exception) {
                if (exception instanceof RuntimeException runtimeException) throw runtimeException;
                throw new IllegalStateException("Flyway cutover preflight failed.", exception);
            }
        };
    }

    static void requireFlywayOwnership(Environment environment) {
        if (!"flyway".equals(environment.getProperty("vibehr.migration.owner"))) {
            throw new IllegalStateException("Flyway cutover requires vibehr.migration.owner=flyway.");
        }
    }

    private boolean relationExists(Connection connection, String relationName) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement("select to_regclass(?::text) is not null")) {
            statement.setString(1, "public." + relationName);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getBoolean(1);
            }
        }
    }

    private int applicationTableCount(Connection connection) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement("""
                select count(*)
                from information_schema.tables
                where table_schema = 'public' and table_type = 'BASE TABLE'
                  and table_name not in ('alembic_version', 'flyway_schema_history')
                """); ResultSet result = statement.executeQuery()) {
            result.next();
            return result.getInt(1);
        }
    }
}
