package com.vibehr.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.DriverManager;
import java.time.LocalDate;
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
class DashboardPostgreSqlIntegrationTest {

    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
            .withDatabaseName("vibehr_dashboard")
            .withUsername("vibehr")
            .withPassword("vibehr");

    @Test
    void executesTheTypedSummaryProjectionAgainstPostgres() throws Exception {
        try (var connection = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var statement = connection.createStatement()) {
            statement.execute("create table hr_employees (id integer primary key)");
            statement.execute("create table org_departments (id integer primary key)");
            statement.execute("create table tim_attendance_daily (id integer primary key, work_date date not null, attendance_status varchar(20) not null)");
            statement.execute("create table tim_leave_requests (id integer primary key, request_status varchar(20) not null)");
            statement.execute("insert into hr_employees values (1), (2), (3)");
            statement.execute("insert into org_departments values (10), (20)");
            statement.execute("insert into tim_attendance_daily values (1, '2026-08-02', 'present'), (2, '2026-08-02', 'present'), (3, '2026-08-02', 'late'), (4, '2026-08-02', 'absent'), (5, '2026-08-01', 'present')");
            statement.execute("insert into tim_leave_requests values (1, 'pending'), (2, 'pending'), (3, 'approved')");
        }

        var dataSource = new UnpooledDataSource("org.postgresql.Driver", POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        var configuration = new Configuration(new Environment("postgres", new JdbcTransactionFactory(), dataSource));
        configuration.addMapper(DashboardProjectionMapper.class);
        var factory = new SqlSessionFactoryBuilder().build(configuration);
        try (var session = factory.openSession()) {
            DashboardProjectionMapper.DashboardProjection counts = session.getMapper(DashboardProjectionMapper.class)
                    .summary(LocalDate.of(2026, 8, 2));

            assertThat(counts).isEqualTo(new DashboardProjectionMapper.DashboardProjection(3, 2, 2, 1, 1, 2));
        }
    }
}
