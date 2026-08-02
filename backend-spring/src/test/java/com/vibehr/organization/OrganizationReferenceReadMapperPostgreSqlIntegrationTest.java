package com.vibehr.organization;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.DriverManager;
import java.time.LocalDate;
import java.util.List;
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
class OrganizationReferenceReadMapperPostgreSqlIntegrationTest {

    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
            .withDatabaseName("vibehr_organization_references")
            .withUsername("vibehr")
            .withPassword("vibehr");

    @Test
    void executesEveryForeignTableProjectionAgainstPostgres() throws Exception {
        try (var connection = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var statement = connection.createStatement()) {
            statement.execute("create table auth_users (id integer primary key, display_name varchar(100) not null)");
            statement.execute("create table hr_employees (id integer primary key, user_id integer not null, employee_no varchar(30) not null, department_id integer not null, position_title varchar(80) not null, hire_date date not null, employment_status varchar(20) not null)");
            statement.execute("create table hr_personnel_histories (id integer primary key, employee_id integer not null, effective_date date not null, field_name varchar(60), before_value varchar(200))");
            statement.execute("create table app_code_groups (id integer primary key, code varchar(30) not null, is_active boolean not null)");
            statement.execute("create table app_codes (id integer primary key, group_id integer not null, code varchar(30) not null, name varchar(100) not null, is_active boolean not null, sort_order integer not null)");
            statement.execute("insert into auth_users values (1, 'Employee One'), (2, 'Changed By')");
            statement.execute("insert into hr_employees values (10, 1, 'EMP-0010', 30, 'Engineer', '2026-01-01', 'active'), (11, 2, 'EMP-0011', 40, 'Manager', '2026-09-01', 'leave')");
            statement.execute("insert into hr_personnel_histories values (1, 10, '2026-08-01', 'department_id', '20'), (2, 10, '2026-07-01', 'employment_status', 'leave'), (3, 10, '2026-06-01', 'position_title', 'Junior')");
            statement.execute("insert into app_code_groups values (5, 'ORG_MAPPING_TYPE', true), (6, 'ORG_MAPPING_TYPE', false)");
            statement.execute("insert into app_codes values (1, 5, 'ROLE', 'Role', true, 20), (2, 5, 'COST', 'Cost center', true, 10), (3, 5, 'OLD', 'Old', false, 0)");
        }

        var dataSource = new UnpooledDataSource("org.postgresql.Driver", POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        var configuration = new Configuration(new Environment("postgres", new JdbcTransactionFactory(), dataSource));
        configuration.addMapper(OrganizationReferenceReadMapper.class);
        var factory = new SqlSessionFactoryBuilder().build(configuration);
        try (var session = factory.openSession()) {
            OrganizationReferenceReadMapper mapper = session.getMapper(OrganizationReferenceReadMapper.class);
            List<Long> employeeIds = mapper.employeeIdsHiredOnOrBefore(LocalDate.of(2026, 8, 1));

            assertThat(mapper.employeeCountForDepartment(30)).isEqualTo(1);
            assertThat(mapper.employeeCountsByDepartment()).containsExactlyInAnyOrder(
                    new OrganizationReferenceReadMapper.DepartmentEmployeeCount(30, 1),
                    new OrganizationReferenceReadMapper.DepartmentEmployeeCount(40, 1));
            assertThat(employeeIds).containsExactly(10L);
            assertThat(mapper.employeesWithUsers(employeeIds)).containsExactly(
                    new OrganizationReferenceReadMapper.EmployeeSnapshotReference(10, "EMP-0010", "Employee One", 30, "Engineer", "active"));
            assertThat(mapper.personnelHistoriesAfter(employeeIds, LocalDate.of(2026, 6, 15))).containsExactly(
                    new OrganizationReferenceReadMapper.PersonnelHistoryReference(10, LocalDate.of(2026, 8, 1), "department_id", "20"),
                    new OrganizationReferenceReadMapper.PersonnelHistoryReference(10, LocalDate.of(2026, 7, 1), "employment_status", "leave"));
            assertThat(mapper.activeCodeGroupId("ORG_MAPPING_TYPE")).isEqualTo(5L);
            assertThat(mapper.activeCodes(5)).containsExactly(
                    new OrganizationReferenceReadMapper.CodeReference("COST", "Cost center"),
                    new OrganizationReferenceReadMapper.CodeReference("ROLE", "Role"));
            assertThat(mapper.userDisplayName(2)).isEqualTo("Changed By");
        }
    }
}
