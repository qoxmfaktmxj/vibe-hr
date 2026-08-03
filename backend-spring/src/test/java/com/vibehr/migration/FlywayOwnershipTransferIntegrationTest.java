package com.vibehr.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.io.InputStream;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.sql.DataSource;
import com.vibehr.seed.FixtureSeedService;
import org.flywaydb.core.Flyway;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistry;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.hibernate.cfg.AvailableSettings;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.env.MockEnvironment;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Tag("integration")
@Testcontainers(disabledWithoutDocker = true)
class FlywayOwnershipTransferIntegrationTest {

    private static final long EXPECTED_REFERENCE_ROWS = 1_377;

    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
            .withDatabaseName("vibehr_test")
            .withUsername("vibehr")
            .withPassword("vibehr");

    @BeforeEach
    void resetDatabase() throws Exception {
        try (Connection connection = connection(); var statement = connection.createStatement()) {
            statement.execute("drop schema public cascade");
            statement.execute("create schema public");
            statement.execute("grant all on schema public to vibehr");
        }
    }

    @AfterEach
    void verifyNoPartialAdoptionHistory() throws Exception {
        try (Connection connection = connection()) {
            if (relationExists(connection, "flyway_schema_history") && relationExists(connection, "alembic_version")) {
                assertThat(flywayHistoryCount(connection)).isZero();
            }
        }
    }

    @Test
    void freshFlywayInstallCreatesExactAlembicHeadAndHibernateValidates() throws Exception {
        migrateFresh();
        try (Connection connection = connection()) {
            assertThat(applicationTableCount(connection)).isEqualTo(106);
            assertThat(relationExists(connection, "alembic_version")).isFalse();
            assertThat(relationExists(connection, "bff_assertion_replays")).isTrue();
            assertThat(requiredReferenceRowCount(connection)).isEqualTo(EXPECTED_REFERENCE_ROWS);
            PostgreSqlSchemaManifest.assertMatchesCheckedInManifest(connection);
        }
        StandardServiceRegistry registry = new StandardServiceRegistryBuilder()
                .applySetting(AvailableSettings.JAKARTA_JDBC_URL, POSTGRES.getJdbcUrl())
                .applySetting(AvailableSettings.JAKARTA_JDBC_USER, POSTGRES.getUsername())
                .applySetting(AvailableSettings.JAKARTA_JDBC_PASSWORD, POSTGRES.getPassword())
                .applySetting(AvailableSettings.HBM2DDL_AUTO, "validate")
                .build();
        try {
            new MetadataSources(registry).addAnnotatedClass(ExactAuthRole.class).buildMetadata().buildSessionFactory().close();
        } finally {
            StandardServiceRegistryBuilder.destroy(registry);
        }
    }

    @Test
    void verifiedAlembicHeadAdoptsWithoutChangingApplicationRowsAndIsIdempotent() throws Exception {
        provisionAlembicHead();
        try (Connection connection = connection(); var statement = connection.createStatement()) {
            statement.execute("insert into auth_roles (code, name, created_at) values ('adoption-check', 'adoption check', current_timestamp)");
        }
        Map<String, Long> before = applicationRowCounts();

        FlywayAdoptionService service = new FlywayAdoptionService(dataSource());
        assertThat(service.adopt()).isEqualTo(FlywayAdoptionService.AdoptionResult.ADOPTED);
        assertThat(applicationRowCounts()).isEqualTo(before);
        try (Connection connection = connection()) {
            assertThat(relationExists(connection, "alembic_version")).isFalse();
            assertThat(flywayHistoryCount(connection)).isEqualTo(2);
            PostgreSqlSchemaManifest.assertMatchesCheckedInManifest(connection);
        }
        assertThat(service.adopt()).isEqualTo(FlywayAdoptionService.AdoptionResult.ALREADY_ADOPTED);
        try (Connection connection = connection()) {
            assertThat(flywayHistoryCount(connection)).isEqualTo(2);
        }
    }

    @Test
    void knownProductionDriftReconcilesThenAdoptsAndCutsOverWithoutChangingProtectedRows() throws Exception {
        provisionAlembicHead();
        runSqlResource("db/reconciliation/known-production-drift-fixture.sql");

        try (Connection connection = connection()) {
            assertThat(PostgreSqlSchemaManifest.fingerprint(connection))
                    .isEqualTo(PreAdoptionReconciliationService.SOURCE_FINGERPRINT);
        }

        PreAdoptionReconciliationService.ReconciliationReport report =
                new PreAdoptionReconciliationService(dataSource()).reconcile(
                        PreAdoptionReconciliationService.CONFIRMATION,
                        PreAdoptionReconciliationService.SOURCE_FINGERPRINT);
        assertThat(report.before()).isEqualTo(report.after());
        assertThat(report.before().values()).allSatisfy(evidence -> assertThat(evidence.rowCount()).isEqualTo(1));
        try (Connection connection = connection()) {
            PostgreSqlSchemaManifest.assertMatchesCheckedInManifest(connection);
            assertThat(relationExists(connection, "alembic_version")).isTrue();
        }

        assertThat(new FlywayAdoptionService(dataSource()).adopt())
                .isEqualTo(FlywayAdoptionService.AdoptionResult.ADOPTED);
        migrateFresh();
        try (Connection connection = connection()) {
            assertThat(applicationTableCount(connection)).isEqualTo(106);
            assertThat(flywayHistoryCount(connection)).isEqualTo(5);
            assertThat(relationExists(connection, "alembic_version")).isFalse();
            PostgreSqlSchemaManifest.assertMatchesCheckedInManifest(connection);
        }
    }

    @Test
    void alreadyAdoptedRejectsMissingExtraDuplicatedFailedAndTamperedHistory() throws Exception {
        assertAlreadyAdoptedHistoryRejected("delete from flyway_schema_history where version = '2'");
        assertAlreadyAdoptedHistoryRejected("delete from flyway_schema_history where version = '1'");
        assertAlreadyAdoptedHistoryRejected("""
                insert into flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, installed_on, execution_time, success)
                values (3, '99', 'unexpected migration', 'SQL', 'V99__unexpected.sql', 1, 'test', current_timestamp, 0, true)
                """);
        assertAlreadyAdoptedHistoryRejected("""
                insert into flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, installed_on, execution_time, success)
                select 3, version, description, type, script, checksum, installed_by, installed_on, execution_time, success
                from flyway_schema_history where version = '2'
                """);
        assertAlreadyAdoptedHistoryRejected("update flyway_schema_history set success = false where version = '2'");
        assertAlreadyAdoptedHistoryRejected("update flyway_schema_history set checksum = checksum + 1 where version = '2'");
        assertAlreadyAdoptedHistoryRejected("update flyway_schema_history set checksum = 1 where version = '1'");
        assertAlreadyAdoptedHistoryRejected("update flyway_schema_history set description = 'tampered' where version = '1'");
        assertAlreadyAdoptedHistoryRejected("update flyway_schema_history set script = 'tampered' where version = '1'");
        assertAlreadyAdoptedHistoryRejected("update flyway_schema_history set type = 'JDBC' where version = '2'");
    }

    @Test
    void driftRejectsBeforeFlywayHistoryIsCreated() throws Exception {
        provisionAlembicHead();
        try (Connection connection = connection(); var statement = connection.createStatement()) {
            statement.execute("alter table auth_roles add column unsafe_drift integer");
        }

        assertThatThrownBy(() -> new FlywayAdoptionService(dataSource()).adopt())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("schema metadata drift");
        try (Connection connection = connection()) {
            assertThat(relationExists(connection, "flyway_schema_history")).isFalse();
            assertThat(relationExists(connection, "alembic_version")).isTrue();
        }
    }

    @Test
    void wrongAlembicHeadRejectsBeforeFlywayHistoryIsCreated() throws Exception {
        provisionAlembicHead();
        try (Connection connection = connection(); var statement = connection.createStatement()) {
            statement.execute("update alembic_version set version_num = 'wrong_head'");
        }

        assertThatThrownBy(() -> new FlywayAdoptionService(dataSource()).adopt())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("expected exactly one Alembic head");
        try (Connection connection = connection()) {
            assertThat(relationExists(connection, "flyway_schema_history")).isFalse();
        }
    }

    @Test
    void missingAlembicMarkerRejectsBeforeFlywayHistoryIsCreated() throws Exception {
        provisionAlembicHead();
        try (Connection connection = connection(); var statement = connection.createStatement()) {
            statement.execute("drop table alembic_version");
        }

        assertThatThrownBy(() -> new FlywayAdoptionService(dataSource()).adopt())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("alembic_version is missing");
        try (Connection connection = connection()) {
            assertThat(relationExists(connection, "flyway_schema_history")).isFalse();
        }
    }

    @Test
    void multipleAlembicHeadsRejectBeforeFlywayHistoryIsCreated() throws Exception {
        provisionAlembicHead();
        try (Connection connection = connection(); var statement = connection.createStatement()) {
            statement.execute("insert into alembic_version (version_num) values ('another_head')");
        }

        assertThatThrownBy(() -> new FlywayAdoptionService(dataSource()).adopt())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("expected exactly one Alembic head");
        try (Connection connection = connection()) {
            assertThat(relationExists(connection, "flyway_schema_history")).isFalse();
        }
    }

    @Test
    void productionMigrationsNeverSeedFixturesAndExplicitSeedsAreIdempotent() throws Exception {
        migrateFresh();
        try (Connection connection = connection()) {
            assertThat(rowCount(connection, "auth_users")).isZero();
        }

        FixtureSeedService fixtureSeedService = new FixtureSeedService();
        FixtureSeedService.FixtureSeedReport firstDev;
        FixtureSeedService.FixtureSeedReport secondDev;
        FixtureSeedService.FixtureSeedReport firstDemo;
        FixtureSeedService.FixtureSeedReport secondDemo;
        try (Connection connection = connection()) {
            firstDev = fixtureSeedService.seedDev(connection, fixtureEnvironment("dev", "dev-seed"));
            secondDev = fixtureSeedService.seedDev(connection, fixtureEnvironment("dev", "dev-seed"));
            firstDemo = fixtureSeedService.seedDemo(connection, 5, fixtureEnvironment("dev", "demo-seed"));
            secondDemo = fixtureSeedService.seedDemo(connection, 5, fixtureEnvironment("dev", "demo-seed"));
        }

        assertThat(firstDev).isEqualTo(secondDev);
        assertThat(firstDev.rowCount()).isEqualTo(2);
        assertThat(firstDemo).isEqualTo(secondDemo);
        assertThat(firstDemo.rowCount()).isEqualTo(5);
        try (Connection connection = connection()) {
            assertThat(rowCount(connection, "auth_users")).isEqualTo(7);
            assertThat(rowCount(connection, "hr_employees")).isEqualTo(7);
        }
    }

    @Test
    void fixtureSeedsRequireLocalDevProfileExplicitOptInAndNonProductionDatabase() throws Exception {
        migrateFresh();
        FixtureSeedService service = new FixtureSeedService();
        try (Connection connection = connection()) {
            MockEnvironment missingOptIn = new MockEnvironment();
            missingOptIn.setActiveProfiles("dev", "dev-seed");
            assertThatThrownBy(() -> service.seedDev(connection, missingOptIn))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("VIBEHR_ALLOW_FIXTURE_SEEDING=true");
            assertThatThrownBy(() -> service.seedDev(connection, fixtureEnvironment("dev-seed")))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("local or dev Spring profile");
            assertThatThrownBy(() -> service.seedDev(connection, fixtureEnvironment("dev", "production", "dev-seed")))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("production-like Spring profile");
            assertThat(rowCount(connection, "auth_users")).isZero();
        }

        // The gate rejects before any fixture SQL can execute, including the documented admin account path.
        assertThatThrownBy(() -> service.seedDev(productionLikeConnection(), fixtureEnvironment("dev", "dev-seed")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("production-like PostgreSQL host or database");
        try (Connection connection = connection()) {
            assertThat(rowCount(connection, "auth_users")).isZero();
        }
    }

    @Test
    void v3FailureRollsBackEarlierCanonicalReconciliationAndDoesNotMarkHistorySuccessful() throws Exception {
        migrateThroughV2();
        try (Connection connection = connection(); var statement = connection.createStatement()) {
            statement.execute("insert into auth_roles (code, name, created_at) values ('admin', 'before-v3', current_timestamp)");
            statement.execute("""
                    create function vibehr_fail_v3_reference_seed() returns trigger language plpgsql as $$
                    begin
                        raise exception 'controlled V3 transaction failure';
                    end;
                    $$
                    """);
            statement.execute("""
                    create trigger vibehr_fail_v3_reference_seed
                    before insert on org_departments
                    for each row execute function vibehr_fail_v3_reference_seed()
                    """);
        }

        assertThatThrownBy(this::migrateThroughV3)
                .isInstanceOf(RuntimeException.class)
                .hasStackTraceContaining("controlled V3 transaction failure");

        try (Connection connection = connection()) {
            assertThat(stringValue(connection, "select name from auth_roles where code = 'admin'")).isEqualTo("before-v3");
            assertThat(rowCount(connection, "org_departments")).isZero();
            assertThat(requiredReferenceRowCount(connection)).isEqualTo(1);
            assertThat(longValue(connection, "select count(*) from flyway_schema_history where version = '3' and success")).isZero();
            assertThat(flywayHistoryCount(connection)).isEqualTo(2);
        }
    }

    @Test
    void v3ReconcilesDriftedAlembicDataIsRepeatableAndPreservesBusinessRows() throws Exception {
        provisionAlembicHead();
        try (Connection connection = connection(); var statement = connection.createStatement()) {
            statement.execute("insert into auth_roles (code, name, created_at) values ('business-role', 'Business role', current_timestamp)");
            statement.execute("""
                    insert into auth_users (login_id, email, password_hash, display_name, is_active, created_at, updated_at)
                    values ('business-user', 'business-user@example.test', 'not-a-fixture', 'Business user', true, current_timestamp, current_timestamp)
                    """);
            statement.execute("""
                    insert into org_departments (code, name, organization_type, cost_center_code, description, is_active, created_at, updated_at)
                    values ('HQ-HR', 'drifted', 'drifted', 'drifted', 'drifted', false, current_timestamp, current_timestamp)
                    """);
            statement.execute("""
                    insert into app_menus (code, name, path, icon, sort_order, is_active, created_at, updated_at)
                    values ('dashboard', 'drifted', '/drifted', 'Drifted', 1, false, current_timestamp, current_timestamp)
                    """);
            statement.execute("""
                    insert into app_menus (code, name, sort_order, is_active, created_at, updated_at)
                    values ('obsolete-menu', 'Obsolete', 9999, true, current_timestamp, current_timestamp)
                    """);
        }

        FlywayAdoptionService service = new FlywayAdoptionService(dataSource());
        assertThat(service.adopt()).isEqualTo(FlywayAdoptionService.AdoptionResult.ADOPTED);
        migrateFresh();
        try (Connection connection = connection()) {
            assertThat(stringValue(connection, "select name from org_departments where code = 'HQ-HR'")).isEqualTo("인사본부");
            assertThat(booleanValue(connection, "select is_active from org_departments where code = 'HQ-HR'")).isTrue();
            assertThat(stringValue(connection, "select name from app_menus where code = 'dashboard'")).isEqualTo("대시보드");
            assertThat(booleanValue(connection, "select is_active from app_menus where code = 'obsolete-menu'")).isFalse();
            assertThat(rowCount(connection, "auth_users")).isEqualTo(1);
            assertThat(stringValue(connection, "select name from auth_roles where code = 'business-role'")).isEqualTo("Business role");
            Map<String, Long> beforeRerun = referenceTableRowCounts(connection);
            runReferenceReconciliation(connection);
            assertThat(referenceTableRowCounts(connection)).isEqualTo(beforeRerun);
            assertThat(rowCount(connection, "auth_users")).isEqualTo(1);
            assertThat(stringValue(connection, "select name from auth_roles where code = 'business-role'")).isEqualTo("Business role");
        }
    }

    private void migrateFresh() {
        Flyway.configure().dataSource(dataSource()).locations("classpath:db/migration").cleanDisabled(true).load().migrate();
    }

    private void migrateThroughV2() {
        Flyway.configure().dataSource(dataSource()).locations("classpath:db/migration").target("2").cleanDisabled(true).load().migrate();
    }

    private void migrateThroughV3() {
        Flyway.configure().dataSource(dataSource()).locations("classpath:db/migration").target("3").cleanDisabled(true).load().migrate();
    }

    private void assertAlreadyAdoptedHistoryRejected(String mutation) throws Exception {
        resetDatabase();
        provisionAlembicHead();
        FlywayAdoptionService service = new FlywayAdoptionService(dataSource());
        assertThat(service.adopt()).isEqualTo(FlywayAdoptionService.AdoptionResult.ADOPTED);
        try (Connection connection = connection(); var statement = connection.createStatement()) {
            statement.execute(mutation);
        }
        assertThatThrownBy(service::adopt)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Flyway history");
    }

    private void provisionAlembicHead() throws Exception {
        Flyway.configure()
                .dataSource(dataSource())
                .locations("classpath:db/migration")
                .target("1")
                .cleanDisabled(true)
                .load()
                .migrate();
        try (Connection connection = connection(); var statement = connection.createStatement()) {
            statement.execute("drop table flyway_schema_history");
            statement.execute("create table alembic_version (version_num varchar(32) not null primary key)");
            statement.execute("insert into alembic_version (version_num) values ('" + FlywayAdoptionService.ALEMBIC_HEAD + "')");
        }
    }

    private DataSource dataSource() {
        return new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    private Connection connection() throws Exception {
        return DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    private int applicationTableCount(Connection connection) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement("""
                select count(*) from information_schema.tables
                where table_schema = 'public' and table_type = 'BASE TABLE'
                  and table_name not in ('alembic_version', 'flyway_schema_history')
                """); ResultSet result = statement.executeQuery()) {
            result.next();
            return result.getInt(1);
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

    private long flywayHistoryCount(Connection connection) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement("select count(*) from flyway_schema_history"); ResultSet result = statement.executeQuery()) {
            result.next();
            return result.getLong(1);
        }
    }

    private long rowCount(Connection connection, String tableName) throws Exception {
        try (var statement = connection.createStatement(); ResultSet result = statement.executeQuery("select count(*) from \"" + tableName.replace("\"", "\"\"") + "\"")) {
            result.next();
            return result.getLong(1);
        }
    }

    private long requiredReferenceRowCount(Connection connection) throws Exception {
        String[] tables = {
                "PAP_APPRAISAL_MASTERS", "PAP_FINAL_RESULTS", "app_code_groups", "app_codes", "app_menu_actions",
                "app_menu_roles", "app_menus", "app_system_settings", "auth_roles", "gl_accounts", "hr_retire_checklist_items",
                "hri_approval_actor_rules", "hri_approval_line_steps", "hri_approval_line_templates", "hri_form_type_approval_maps",
                "hri_form_type_policies", "hri_form_types", "org_corporations", "org_departments", "pay_allowance_deductions",
                "pay_gl_mappings", "pay_income_tax_brackets", "pay_item_groups", "pay_payroll_codes", "pay_severance_item_rules",
                "pay_tax_rates", "tim_attendance_codes", "tim_department_schedule_assignments", "tim_holidays",
                "tim_schedule_pattern_days", "tim_schedule_patterns", "tim_work_schedule_codes", "wel_benefit_types"
        };
        long count = 0;
        for (String table : tables) count += rowCount(connection, table);
        return count;
    }

    private Map<String, Long> referenceTableRowCounts(Connection connection) throws Exception {
        Map<String, Long> result = new LinkedHashMap<>();
        String[] tables = {
                "PAP_APPRAISAL_MASTERS", "PAP_FINAL_RESULTS", "app_code_groups", "app_codes", "app_menu_actions",
                "app_menu_roles", "app_menus", "app_system_settings", "auth_roles", "gl_accounts", "hr_retire_checklist_items",
                "hri_approval_actor_rules", "hri_approval_line_steps", "hri_approval_line_templates", "hri_form_type_approval_maps",
                "hri_form_type_policies", "hri_form_types", "org_corporations", "org_departments", "pay_allowance_deductions",
                "pay_gl_mappings", "pay_income_tax_brackets", "pay_item_groups", "pay_payroll_codes", "pay_severance_item_rules",
                "pay_tax_rates", "tim_attendance_codes", "tim_department_schedule_assignments", "tim_holidays",
                "tim_schedule_pattern_days", "tim_schedule_patterns", "tim_work_schedule_codes", "wel_benefit_types"
        };
        for (String table : tables) result.put(table, rowCount(connection, table));
        return result;
    }

    private void runReferenceReconciliation(Connection connection) throws Exception {
        String sql;
        try (InputStream resource = getClass().getClassLoader().getResourceAsStream("db/migration/V3__required_reference_data.sql")) {
            if (resource == null) throw new IllegalStateException("V3 required-reference migration is missing from the test runtime.");
            sql = new String(resource.readAllBytes(), StandardCharsets.UTF_8);
        }
        boolean originalAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try (var statement = connection.createStatement()) {
            statement.execute(sql);
            connection.commit();
        } catch (Exception exception) {
            connection.rollback();
            throw exception;
        } finally {
            connection.setAutoCommit(originalAutoCommit);
        }
    }

    private void runSqlResource(String path) throws Exception {
        String sql;
        try (InputStream resource = getClass().getClassLoader().getResourceAsStream(path)) {
            if (resource == null) throw new IllegalStateException("Missing integration SQL resource " + path + ".");
            sql = new String(resource.readAllBytes(), StandardCharsets.UTF_8);
        }
        try (Connection connection = connection(); var statement = connection.createStatement()) {
            connection.setAutoCommit(false);
            try {
                statement.execute(sql);
                connection.commit();
            } catch (Exception exception) {
                connection.rollback();
                throw exception;
            }
        }
    }

    private MockEnvironment fixtureEnvironment(String... profiles) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles(profiles);
        environment.setProperty("vibehr.allow-fixture-seeding", "true");
        return environment;
    }

    private Connection productionLikeConnection() {
        DatabaseMetaData metadata = (DatabaseMetaData) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[] { DatabaseMetaData.class },
                (proxy, method, args) -> {
                    if (method.getName().equals("getURL")) return "jdbc:postgresql://production-db.internal:5432/vibehr_production";
                    throw new AssertionError("Fixture gate must not inspect a production-like connection beyond its JDBC URL.");
                });
        return (Connection) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[] { Connection.class },
                (proxy, method, args) -> {
                    if (method.getName().equals("getMetaData")) return metadata;
                    if (method.getName().equals("close")) return null;
                    throw new AssertionError("Fixture SQL must not execute against a production-like database.");
                });
    }

    private String stringValue(Connection connection, String sql) throws Exception {
        try (var statement = connection.createStatement(); ResultSet result = statement.executeQuery(sql)) {
            result.next();
            return result.getString(1);
        }
    }

    private boolean booleanValue(Connection connection, String sql) throws Exception {
        try (var statement = connection.createStatement(); ResultSet result = statement.executeQuery(sql)) {
            result.next();
            return result.getBoolean(1);
        }
    }

    private long longValue(Connection connection, String sql) throws Exception {
        try (var statement = connection.createStatement(); ResultSet result = statement.executeQuery(sql)) {
            result.next();
            return result.getLong(1);
        }
    }

    private Map<String, Long> applicationRowCounts() throws Exception {
        Map<String, Long> result = new LinkedHashMap<>();
        try (Connection connection = connection(); PreparedStatement statement = connection.prepareStatement("""
                select table_name from information_schema.tables
                where table_schema = 'public' and table_type = 'BASE TABLE'
                  and table_name not in ('alembic_version', 'flyway_schema_history')
                order by table_name
                """ ); ResultSet tables = statement.executeQuery()) {
            while (tables.next()) {
                String tableName = tables.getString(1);
                try (var count = connection.createStatement(); ResultSet rows = count.executeQuery("select count(*) from \"" + tableName.replace("\"", "\"\"") + "\"")) {
                    rows.next();
                    result.put(tableName, rows.getLong(1));
                }
            }
        }
        return result;
    }

    @Entity
    @Table(name = "auth_roles")
    static class ExactAuthRole {
        @Id
        @Column(name = "id", nullable = false)
        Integer id;

        @Column(name = "code", nullable = false, length = 40)
        String code;

        @Column(name = "name", nullable = false, length = 60)
        String name;
    }
}
