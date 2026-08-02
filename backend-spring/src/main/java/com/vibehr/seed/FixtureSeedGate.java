package com.vibehr.seed;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.core.env.Environment;

/** Refuses fixture writes unless the caller proves an intentionally local development target. */
public final class FixtureSeedGate {

    private static final Set<String> LOCAL_PROFILES = Set.of("local", "dev");
    private static final Set<String> PRODUCTION_PROFILES = Set.of("prod", "production", "stage", "staging", "flyway-cutover", "flyway-adoption");
    private static final Set<String> LOOPBACK_HOSTS = Set.of("localhost", "127.0.0.1", "::1", "[::1]");
    private static final Pattern POSTGRES_URL = Pattern.compile("^jdbc:postgresql://(\\[[^]]+]|[^/:?]+)(?::\\d+)?/([^?]+).*$", Pattern.CASE_INSENSITIVE);

    public void requireAllowed(Environment environment, Connection connection) throws SQLException {
        Set<String> activeProfiles = Arrays.stream(environment.getActiveProfiles())
                .map(profile -> profile.toLowerCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
        if (activeProfiles.stream().noneMatch(LOCAL_PROFILES::contains)) {
            throw new IllegalStateException("Fixture seeding requires an explicit local or dev Spring profile.");
        }
        if (activeProfiles.stream().anyMatch(PRODUCTION_PROFILES::contains)) {
            throw new IllegalStateException("Fixture seeding is blocked by a production-like Spring profile.");
        }
        if (!Boolean.parseBoolean(environment.getProperty("vibehr.allow-fixture-seeding", "false"))) {
            throw new IllegalStateException("Fixture seeding requires VIBEHR_ALLOW_FIXTURE_SEEDING=true.");
        }
        String jdbcUrl = connection.getMetaData().getURL();
        Matcher matcher = POSTGRES_URL.matcher(jdbcUrl == null ? "" : jdbcUrl);
        if (!matcher.matches()) {
            throw new IllegalStateException("Fixture seeding requires an explicit local PostgreSQL JDBC URL.");
        }
        String host = matcher.group(1).toLowerCase(Locale.ROOT);
        String database = matcher.group(2).toLowerCase(Locale.ROOT);
        if (!LOOPBACK_HOSTS.contains(host) || database.contains("prod") || database.contains("live")) {
            throw new IllegalStateException("Fixture seeding is blocked for a production-like PostgreSQL host or database.");
        }
    }
}
