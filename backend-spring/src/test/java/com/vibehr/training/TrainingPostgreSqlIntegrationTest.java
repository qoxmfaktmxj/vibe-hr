package com.vibehr.training;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.DriverManager;
import java.time.Year;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import org.apache.ibatis.datasource.unpooled.UnpooledDataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Tag("integration")
@Testcontainers(disabledWithoutDocker = true)
class TrainingPostgreSqlIntegrationTest {

    private static final String LOCK_SQL = "select pg_advisory_xact_lock(hashtextextended(cast(? as text), 0))";

    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
            .withDatabaseName("vibehr_training_test")
            .withUsername("vibehr")
            .withPassword("vibehr");

    @Test
    void executesTheRealMyBatisProjectionWithEmployeeAndDepartmentEnrichmentAboveIntegerCache() throws Exception {
        String schema = "tra_projection";
        createSchema(schema);
        try (Connection connection = connection(schema); var statement = connection.createStatement()) {
            statement.execute("create table if not exists auth_users (id integer primary key, display_name varchar(200) not null)");
            statement.execute("create table if not exists org_departments (id integer primary key, name varchar(200) not null)");
            statement.execute("create table if not exists hr_employees (id integer primary key, user_id integer not null, employee_no varchar(40) not null, department_id integer not null, employment_status varchar(20) not null)");
            statement.execute("create table if not exists tra_courses (id integer primary key, course_name varchar(200) not null)");
            statement.execute("create table if not exists tra_events (id integer primary key, event_name varchar(200) not null)");
            statement.execute("create table if not exists tra_applications (id integer primary key, application_no varchar(40) not null, employee_id integer not null, course_id integer not null, event_id integer, in_out_type varchar(20), status varchar(20) not null, year_plan_yn boolean not null, survey_yn boolean not null, edu_memo varchar(2000), note varchar(2000), created_at timestamptz not null, updated_at timestamptz not null)");
            statement.execute("truncate table tra_applications, tra_events, tra_courses, hr_employees, org_departments, auth_users");
            statement.execute("insert into auth_users values (346, 'Employee 346')");
            statement.execute("insert into org_departments values (346, 'Platform')");
            statement.execute("insert into hr_employees values (346, 346, 'E0346', 346, 'active')");
            statement.execute("insert into tra_courses values (9, 'Secure Coding')");
            statement.execute("insert into tra_events values (19, 'August Session')");
            statement.execute("insert into tra_applications values (346, 'TRA-2026-000346', 346, 9, 19, 'EXTERNAL', 'submitted', false, false, null, null, now(), now())");
        }

        var dataSource = new UnpooledDataSource("org.postgresql.Driver", jdbcUrl(schema), POSTGRES.getUsername(), POSTGRES.getPassword());
        var configuration = new Configuration(new Environment("postgres", new JdbcTransactionFactory(), dataSource));
        configuration.addMapper(TrainingApplicationProjectionMapper.class);
        var factory = new SqlSessionFactoryBuilder().build(configuration);
        try (var session = factory.openSession()) {
            Map<String, Object> row = session.getMapper(TrainingApplicationProjectionMapper.class).findAll().getFirst();

            assertThat(((Number) row.get("id")).intValue()).isEqualTo(346);
            assertThat(row.get("employee_name")).isEqualTo("Employee 346");
            assertThat(row.get("department_name")).isEqualTo("Platform");
            assertThat(row.get("course_name")).isEqualTo("Secure Coding");
        }
    }

    @Test
    void serializesApplicationSequenceAndNaturalKeyGeneratorsWithRepeatSkipBehavior() throws Exception {
        String schema = "tra_concurrency";
        createSchema(schema);
        try (Connection connection = connection(schema); var statement = connection.createStatement()) {
            statement.execute("create table if not exists tra_applications (id integer primary key, application_no varchar(40) not null unique)");
            statement.execute("create table if not exists tra_events (id integer generated by default as identity primary key, course_id integer not null, event_code varchar(40) not null, unique(course_id, event_code))");
            statement.execute("create table if not exists tra_required_targets (id integer generated by default as identity primary key, year integer not null, employee_id integer not null, rule_code varchar(30) not null, course_id integer not null, edu_month varchar(6) not null, unique(year, employee_id, rule_code, course_id, edu_month))");
            statement.execute("create table if not exists tra_cyber_uploads (id integer primary key, close_yn boolean not null)");
            statement.execute("truncate table tra_applications, tra_events, tra_required_targets, tra_cyber_uploads restart identity");
            statement.execute("insert into tra_cyber_uploads values (700, false)");
        }

        List<String> numbers = concurrently(() -> insertNextApplication(schema), () -> insertNextApplication(schema));
        int eventProcessed = concurrently(() -> insertEventIfAbsent(schema), () -> insertEventIfAbsent(schema)).stream().mapToInt(Integer::intValue).sum();
        int targetProcessed = concurrently(() -> insertTargetIfAbsent(schema), () -> insertTargetIfAbsent(schema)).stream().mapToInt(Integer::intValue).sum();
        int cyberProcessed = concurrently(() -> closeCyberUploadIfOpen(schema), () -> closeCyberUploadIfOpen(schema)).stream().mapToInt(Integer::intValue).sum();

        int year = Year.now().getValue();
        assertThat(numbers).containsExactlyInAnyOrder("TRA-" + year + "-000001", "TRA-" + year + "-000002");
        assertThat(eventProcessed).isEqualTo(1);
        assertThat(insertEventIfAbsent(schema)).isZero();
        assertThat(targetProcessed).isEqualTo(1);
        assertThat(insertTargetIfAbsent(schema)).isZero();
        assertThat(cyberProcessed).isEqualTo(1);
        assertThat(closeCyberUploadIfOpen(schema)).isZero();
    }

    private String insertNextApplication(String schema) throws Exception {
        try (Connection connection = connection(schema)) {
            connection.setAutoCommit(false);
            lock(connection, "tra:application-sequence");
            int nextId;
            try (var statement = connection.createStatement(); var result = statement.executeQuery("select coalesce(max(id), 0) + 1 from tra_applications")) {
                result.next();
                nextId = result.getInt(1);
            }
            String number = "TRA-" + Year.now().getValue() + "-%06d".formatted(nextId);
            try (var insert = connection.prepareStatement("insert into tra_applications(id, application_no) values (?, ?)")) {
                insert.setInt(1, nextId);
                insert.setString(2, number);
                insert.executeUpdate();
            }
            connection.commit();
            return number;
        }
    }

    private int insertEventIfAbsent(String schema) throws Exception {
        try (Connection connection = connection(schema)) {
            connection.setAutoCommit(false);
            lock(connection, "tra:event:9:202608");
            int inserted;
            try (var statement = connection.prepareStatement("insert into tra_events(course_id, event_code) select 9, '202608' where not exists (select 1 from tra_events where course_id=9 and event_code='202608')")) {
                inserted = statement.executeUpdate();
            }
            connection.commit();
            return inserted;
        }
    }

    private int insertTargetIfAbsent(String schema) throws Exception {
        try (Connection connection = connection(schema)) {
            connection.setAutoCommit(false);
            lock(connection, "tra:required-target:2026:346:LEGAL:9:202608");
            int inserted;
            try (var statement = connection.prepareStatement("insert into tra_required_targets(year, employee_id, rule_code, course_id, edu_month) select 2026, 346, 'LEGAL', 9, '202608' where not exists (select 1 from tra_required_targets where year=2026 and employee_id=346 and rule_code='LEGAL' and course_id=9 and edu_month='202608')")) {
                inserted = statement.executeUpdate();
            }
            connection.commit();
            return inserted;
        }
    }

    private int closeCyberUploadIfOpen(String schema) throws Exception {
        try (Connection connection = connection(schema)) {
            connection.setAutoCommit(false);
            lock(connection, "tra:cyber-upload:700");
            int updated;
            try (var statement = connection.prepareStatement("update tra_cyber_uploads set close_yn=true where id=700 and close_yn=false")) {
                updated = statement.executeUpdate();
            }
            connection.commit();
            return updated;
        }
    }

    private void lock(Connection connection, String key) throws Exception {
        try (var statement = connection.prepareStatement(LOCK_SQL)) {
            statement.setString(1, key);
            statement.executeQuery().close();
        }
    }

    private <T> List<T> concurrently(Callable<T> first, Callable<T> second) throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var one = executor.submit(() -> { start.await(); return first.call(); });
            var two = executor.submit(() -> { start.await(); return second.call(); });
            start.countDown();
            return List.of(one.get(), two.get());
        }
    }

    private void createSchema(String schema) throws Exception {
        try (Connection connection = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var statement = connection.createStatement()) {
            statement.execute("create schema if not exists " + schema);
        }
    }

    private Connection connection(String schema) throws Exception {
        return DriverManager.getConnection(jdbcUrl(schema), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    private String jdbcUrl(String schema) {
        return POSTGRES.getJdbcUrl() + (POSTGRES.getJdbcUrl().contains("?") ? "&" : "?") + "currentSchema=" + schema;
    }
}
