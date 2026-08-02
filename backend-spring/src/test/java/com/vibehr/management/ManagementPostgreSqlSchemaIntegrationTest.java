package com.vibehr.management;

import static org.assertj.core.api.Assertions.assertThat;

import com.vibehr.management.api.ManagementDtos.DevRequestCreateRequest;
import com.vibehr.management.api.ManagementDtos.InfraConfigUpsertRequest;
import com.vibehr.management.api.ManagementDtos.InfraConfigUpsertRow;
import com.vibehr.management.application.ManagementService;
import com.vibehr.management.persistence.ManagementEntities;
import com.vibehr.management.persistence.ManagementRepository;
import java.sql.DriverManager;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Tag("integration")
@SpringBootTest(
        classes = ManagementPostgreSqlSchemaIntegrationTest.TestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.jpa.hibernate.ddl-auto=validate",
                "spring.flyway.enabled=false"
        })
class ManagementPostgreSqlSchemaIntegrationTest {
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
            .withDatabaseName("vibehr_management_test")
            .withUsername("vibehr")
            .withPassword("vibehr");
    private static boolean schemaInitialized;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        ensureSchema();
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EntityScan(basePackageClasses = {
            ManagementEntities.Company.class,
            ManagementEntities.ManagerCompany.class,
            ManagementEntities.DevRequest.class,
            ManagementEntities.DevProject.class,
            ManagementEntities.DevInquiry.class,
            ManagementEntities.OutsourceContract.class,
            ManagementEntities.OutsourceAttendance.class,
            ManagementEntities.InfraMaster.class,
            ManagementEntities.InfraConfig.class
    })
    static class TestApplication {
        @Bean
        ManagementRepository managementRepository() { return new ManagementRepository(); }

        @Bean
        ManagementService managementService(ManagementRepository repository) { return new ManagementService(repository); }
    }

    private final JdbcTemplate jdbc;
    private final ManagementService service;

    @Autowired
    ManagementPostgreSqlSchemaIntegrationTest(JdbcTemplate jdbc, ManagementService service) {
        this.jdbc = jdbc;
        this.service = service;
    }

    @BeforeEach
    void resetData() {
        jdbc.execute("truncate mng_outsource_attendances, mng_outsource_contracts, mng_manager_companies, "
                + "mng_dev_requests, mng_dev_projects, mng_dev_inquiries, mng_infra_configs, mng_infra_masters, "
                + "mng_companies, hr_employees, auth_users restart identity cascade");
        jdbc.update("insert into mng_companies(company_code, company_name, is_active, created_at, updated_at) "
                + "values ('VIBE', 'Vibe', true, now(), now())");
        jdbc.update("insert into mng_infra_masters(company_id, service_type, env_type, is_active, created_at, updated_at) "
                + "values (1, 'DATABASE', 'PROD', true, now(), now())");
    }

    @Test
    void hibernateValidateBootsAllNineMappingsAndBaselineConstraintCluesExist() {
        Integer tableCount = jdbc.queryForObject("select count(*) from information_schema.tables "
                + "where table_schema = 'public' and table_name like 'mng_%'", Integer.class);
        Integer integerPrimaryKeys = jdbc.queryForObject("select count(*) from information_schema.columns "
                + "where table_schema = 'public' and table_name like 'mng_%' and column_name = 'id' "
                + "and data_type = 'integer'", Integer.class);
        Integer foreignKeys = jdbc.queryForObject("select count(*) from information_schema.table_constraints "
                + "where table_schema = 'public' and table_name like 'mng_%' and constraint_type = 'FOREIGN KEY'", Integer.class);
        Set<String> uniqueConstraints = Set.copyOf(jdbc.queryForList(
                "select constraint_name from information_schema.table_constraints where table_schema = 'public' "
                        + "and table_name like 'mng_%' and constraint_type = 'UNIQUE'",
                String.class));
        Set<String> indexes = Set.copyOf(jdbc.queryForList(
                "select indexname from pg_indexes where schemaname = 'public' and tablename like 'mng_%'",
                String.class));

        assertThat(tableCount).isEqualTo(9);
        assertThat(integerPrimaryKeys).isEqualTo(9);
        assertThat(foreignKeys).isEqualTo(12);
        assertThat(uniqueConstraints).contains(
                "uq_mng_companies_code",
                "uq_mng_manager_companies_emp_comp_sdate",
                "uq_mng_outsource_contracts_emp_sdate",
                "uq_mng_infra_masters_comp_svc_env",
                "uq_mng_infra_configs_master_section_key");
        assertThat(indexes).contains(
                "ix_mng_companies_company_code",
                "ix_mng_dev_requests_company_ym",
                "ix_mng_outsource_attendances_contract",
                "ix_mng_infra_configs_master_id");
    }

    @Test
    void concurrentRequestNumberAllocationIsSerializedByTheCompanyLock() throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<Integer> first = executor.submit(() -> createRequestAfter(ready, start));
            Future<Integer> second = executor.submit(() -> createRequestAfter(ready, start));
            ready.await();
            start.countDown();

            assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder(1, 2);
        }
        assertThat(jdbc.queryForList("select request_seq from mng_dev_requests order by request_seq", Integer.class))
                .containsExactly(1, 2);
    }

    @Test
    void concurrentInfraUpsertLocksAndRemainsIdempotent() throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<Integer> first = executor.submit(() -> upsertConfigAfter(ready, start));
            Future<Integer> second = executor.submit(() -> upsertConfigAfter(ready, start));
            ready.await();
            start.countDown();

            assertThat(first.get()).isEqualTo(1);
            assertThat(second.get()).isEqualTo(1);
        }
        assertThat(jdbc.queryForObject("select count(*) from mng_infra_configs where master_id = 1 "
                + "and section = 'connection' and config_key = 'host'", Integer.class)).isEqualTo(1);
    }

    private int createRequestAfter(CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        start.await();
        return service.createDevRequest(new DevRequestCreateRequest(
                1, LocalDate.of(2026, 8, 1), 0, null, null, null, null, null, null,
                false, null, false, null, null, null, null, null, null, null)).item().requestSeq();
    }

    private int upsertConfigAfter(CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        start.await();
        return service.upsertInfraConfigs(1, new InfraConfigUpsertRequest(List.of(
                new InfraConfigUpsertRow("connection", "host", "db.internal", 1)))).totalCount();
    }

    private static synchronized void ensureSchema() {
        if (schemaInitialized) return;
        POSTGRES.start();
        try (var connection = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var statement = connection.createStatement()) {
            for (String ddl : schemaDdl()) statement.execute(ddl);
            schemaInitialized = true;
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to initialize disposable management schema", exception);
        }
    }

    private static List<String> schemaDdl() {
        return List.of(
                "create table auth_users (id serial primary key, display_name varchar(100) not null)",
                "create table hr_employees (id serial primary key, user_id integer references auth_users(id), employee_no varchar(40) not null)",
                """
                create table mng_companies (
                    id serial primary key, company_code varchar(20) not null, company_name varchar(100) not null,
                    company_group_code varchar(20), company_type varchar(40), management_type varchar(40),
                    representative_company varchar(20), start_date date, is_active boolean not null,
                    created_at timestamp not null, updated_at timestamp not null,
                    constraint uq_mng_companies_code unique (company_code)
                )
                """,
                "create index ix_mng_companies_company_code on mng_companies(company_code)",
                """
                create table mng_manager_companies (
                    id serial primary key, employee_id integer not null references hr_employees(id),
                    company_id integer not null references mng_companies(id), start_date date not null,
                    end_date date, note varchar(500), is_active boolean not null,
                    created_at timestamp not null, updated_at timestamp not null,
                    constraint uq_mng_manager_companies_emp_comp_sdate unique (employee_id, company_id, start_date)
                )
                """,
                "create index ix_mng_manager_companies_employee_id on mng_manager_companies(employee_id)",
                "create index ix_mng_manager_companies_company_id on mng_manager_companies(company_id)",
                """
                create table mng_dev_requests (
                    id serial primary key, company_id integer not null references mng_companies(id),
                    request_ym date not null, request_seq integer not null, status_code varchar(20), part_code varchar(20),
                    requester_name varchar(100), request_content varchar, manager_employee_id integer references hr_employees(id),
                    developer_employee_id integer references hr_employees(id), is_paid boolean not null,
                    paid_content varchar(500), has_tax_bill boolean not null, start_ym date, end_ym date,
                    dev_start_date date, dev_end_date date, paid_man_months double precision,
                    actual_man_months double precision, note varchar(500), created_at timestamp not null,
                    updated_at timestamp not null
                )
                """,
                "create index ix_mng_dev_requests_company_id on mng_dev_requests(company_id)",
                "create index ix_mng_dev_requests_company_ym on mng_dev_requests(company_id, request_ym)",
                """
                create table mng_dev_projects (
                    id serial primary key, project_name varchar(200) not null,
                    company_id integer not null references mng_companies(id), part_code varchar(20),
                    assigned_staff varchar(200), contract_start_date date, contract_end_date date,
                    dev_start_date date, dev_end_date date, inspection_status varchar(20), has_tax_bill boolean not null,
                    actual_man_months double precision, contract_amount integer, note varchar(500),
                    created_at timestamp not null, updated_at timestamp not null
                )
                """,
                "create index ix_mng_dev_projects_company_id on mng_dev_projects(company_id)",
                """
                create table mng_dev_inquiries (
                    id serial primary key, company_id integer not null references mng_companies(id),
                    inquiry_content varchar, hoped_start_date date, estimated_man_months double precision,
                    sales_rep_name varchar(100), client_contact_name varchar(100), progress_code varchar(20),
                    is_confirmed boolean not null, project_name varchar(200), note varchar(500),
                    created_at timestamp not null, updated_at timestamp not null
                )
                """,
                "create index ix_mng_dev_inquiries_company_id on mng_dev_inquiries(company_id)",
                """
                create table mng_outsource_contracts (
                    id serial primary key, employee_id integer not null references hr_employees(id),
                    start_date date not null, end_date date not null, total_leave_count double precision not null,
                    extra_leave_count double precision not null, note varchar(500), is_active boolean not null,
                    created_at timestamp not null, updated_at timestamp not null,
                    constraint uq_mng_outsource_contracts_emp_sdate unique (employee_id, start_date)
                )
                """,
                "create index ix_mng_outsource_contracts_employee_id on mng_outsource_contracts(employee_id)",
                """
                create table mng_outsource_attendances (
                    id serial primary key, contract_id integer not null references mng_outsource_contracts(id),
                    employee_id integer not null references hr_employees(id), attendance_code varchar(20) not null,
                    apply_date date, status_code varchar(20), start_date date not null, end_date date not null,
                    apply_count double precision, note varchar(500), created_at timestamp not null, updated_at timestamp not null
                )
                """,
                "create index ix_mng_outsource_attendances_contract on mng_outsource_attendances(contract_id)",
                "create index ix_mng_outsource_attendances_contract_id on mng_outsource_attendances(contract_id)",
                "create index ix_mng_outsource_attendances_emp on mng_outsource_attendances(employee_id)",
                "create index ix_mng_outsource_attendances_employee_id on mng_outsource_attendances(employee_id)",
                """
                create table mng_infra_masters (
                    id serial primary key, company_id integer not null references mng_companies(id),
                    service_type varchar(40) not null, env_type varchar(10) not null, is_active boolean not null,
                    created_at timestamp not null, updated_at timestamp not null,
                    constraint uq_mng_infra_masters_comp_svc_env unique (company_id, service_type, env_type)
                )
                """,
                "create index ix_mng_infra_masters_company_id on mng_infra_masters(company_id)",
                """
                create table mng_infra_configs (
                    id serial primary key, master_id integer not null references mng_infra_masters(id),
                    section varchar(100) not null, config_key varchar(100) not null, config_value varchar,
                    sort_order integer not null, created_at timestamp not null, updated_at timestamp not null,
                    constraint uq_mng_infra_configs_master_section_key unique (master_id, section, config_key)
                )
                """,
                "create index ix_mng_infra_configs_master_id on mng_infra_configs(master_id)"
        );
    }
}
