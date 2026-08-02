package com.vibehr.seed;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HexFormat;
import org.springframework.core.env.Environment;

/** Explicit, deterministic local fixtures. Production Flyway migrations never call this service. */
public final class FixtureSeedService {

    // Existing Python-compatible PBKDF2 hash for the documented local-only `admin` password.
    private static final String DEV_PASSWORD_HASH = "pbkdf2_sha256$100000$b8779fb945e86d8b83bc6bfbbe2f6003$c0704e8b31440aac71f64b0303014b36e060d8236dd898df99808c8431557e01";

    public FixtureSeedReport seedDev(Connection connection, Environment environment) throws SQLException {
        new FixtureSeedGate().requireAllowed(environment, connection);
        requireFlywayOwned(connection);
        int departmentId = departmentId(connection);
        upsertEmployee(connection, "admin-local", "admin@vibe-hr.local", "Admin", "HR-0001", departmentId, "HR Director");
        upsertEmployee(connection, "admin", "admin2@vibe-hr.local", "Admin", "HR-0002", departmentId, "HR Manager");
        linkRole(connection, "admin-local", "admin");
        linkRole(connection, "admin", "admin");
        return report(connection, "admin%");
    }

    public FixtureSeedReport seedDemo(Connection connection, int employeeCount, Environment environment) throws SQLException {
        if (employeeCount < 1 || employeeCount > 6000) throw new IllegalArgumentException("Demo employee count must be between 1 and 6000.");
        new FixtureSeedGate().requireAllowed(environment, connection);
        requireFlywayOwned(connection);
        int departmentId = departmentId(connection);
        for (int index = 1; index <= employeeCount; index += 1) {
            String suffix = String.format("%04d", index);
            upsertEmployee(connection, "kr-" + suffix, "kr-" + suffix + "@vibe-hr.local", "Demo Employee " + suffix,
                    "DEMO-" + suffix, departmentId, index % 7 == 0 ? "Team Lead" : "Employee");
        }
        return report(connection, "kr-%");
    }

    private void requireFlywayOwned(Connection connection) throws SQLException {
        if (relationExists(connection, "alembic_version")) throw new IllegalStateException("Fixture seeding is blocked while the Alembic marker exists.");
        try (PreparedStatement statement = connection.prepareStatement("""
                select count(*) from flyway_schema_history where version = '3' and success = true
                """ ); ResultSet result = statement.executeQuery()) {
            result.next();
            if (result.getInt(1) != 1) throw new IllegalStateException("Fixture seeding requires successful Flyway V3 reference-data ownership.");
        }
    }

    private int departmentId(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("select id from org_departments where code = 'HQ-HR'" ); ResultSet result = statement.executeQuery()) {
            if (!result.next()) throw new IllegalStateException("Required reference department HQ-HR is missing.");
            return result.getInt(1);
        }
    }

    private void upsertEmployee(Connection connection, String loginId, String email, String displayName, String employeeNo, int departmentId, String title) throws SQLException {
        int userId;
        try (PreparedStatement statement = connection.prepareStatement("""
                insert into auth_users (login_id, email, password_hash, display_name, is_active, created_at, updated_at)
                values (?, ?, ?, ?, true, ?, ?)
                on conflict (login_id) do update set email = excluded.email, display_name = excluded.display_name,
                    is_active = true, updated_at = excluded.updated_at
                returning id
                """)) {
            LocalDateTime now = LocalDateTime.of(2026, 1, 1, 0, 0);
            statement.setString(1, loginId);
            statement.setString(2, email);
            statement.setString(3, DEV_PASSWORD_HASH);
            statement.setString(4, displayName);
            statement.setObject(5, now);
            statement.setObject(6, now);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                userId = result.getInt(1);
            }
        }
        try (PreparedStatement statement = connection.prepareStatement("""
                insert into auth_user_roles (user_id, role_id, assigned_at)
                select ?, id, ? from auth_roles where code = 'employee'
                on conflict do nothing
                """)) {
            statement.setInt(1, userId);
            statement.setObject(2, LocalDateTime.of(2026, 1, 1, 0, 0));
            statement.executeUpdate();
        }
        try (PreparedStatement statement = connection.prepareStatement("""
                insert into hr_employees (user_id, employee_no, department_id, position_title, hire_date, employment_status, created_at, updated_at)
                values (?, ?, ?, ?, ?, 'active', ?, ?)
                on conflict (user_id) do update set employee_no = excluded.employee_no, department_id = excluded.department_id,
                    position_title = excluded.position_title, employment_status = 'active', updated_at = excluded.updated_at
                """)) {
            LocalDateTime now = LocalDateTime.of(2026, 1, 1, 0, 0);
            statement.setInt(1, userId);
            statement.setString(2, employeeNo);
            statement.setInt(3, departmentId);
            statement.setString(4, title);
            statement.setObject(5, LocalDate.of(2025, 1, 1));
            statement.setObject(6, now);
            statement.setObject(7, now);
            statement.executeUpdate();
        }
    }

    private void linkRole(Connection connection, String loginId, String roleCode) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                insert into auth_user_roles (user_id, role_id, assigned_at)
                select auth_users.id, auth_roles.id, ? from auth_users join auth_roles on auth_roles.code = ?
                where auth_users.login_id = ?
                on conflict do nothing
                """)) {
            statement.setObject(1, LocalDateTime.of(2026, 1, 1, 0, 0));
            statement.setString(2, roleCode);
            statement.setString(3, loginId);
            statement.executeUpdate();
        }
    }

    private FixtureSeedReport report(Connection connection, String loginPattern) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                select count(*), coalesce(string_agg(auth_users.login_id || ':' || hr_employees.employee_no, ',' order by auth_users.login_id), '')
                from auth_users join hr_employees on hr_employees.user_id = auth_users.id
                where auth_users.login_id like ?
                """)) {
            statement.setString(1, loginPattern);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return new FixtureSeedReport(result.getInt(1), sha256(result.getString(2)));
            }
        }
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

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    public record FixtureSeedReport(int rowCount, String checksum) {
    }
}
