package com.vibehr.payroll;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import java.sql.DriverManager;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.ObjectMapper;

@Tag("integration")
@Testcontainers
@SpringBootTest(
        classes = PayrollPostgreSqlIntegrationTest.TestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = { "spring.jpa.hibernate.ddl-auto=validate", "spring.flyway.enabled=false" })
class PayrollPostgreSqlIntegrationTest {
    @Container
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("vibehr_payroll_test")
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
    @EntityScan(basePackageClasses = PayrollEntities.class)
    @MapperScan(basePackageClasses = PayrollProjectionMapper.class)
    static class TestApplication {
        @Bean
        Clock clock() {
            return Clock.fixed(Instant.parse("2026-08-01T00:00:00Z"), ZoneOffset.UTC);
        }

        @Bean
        PayrollService payrollService(EntityManager entityManager, PayrollProjectionMapper projections, Clock clock,
                                      ObjectMapper objectMapper, PlatformTransactionManager transactionManager) {
            return new PayrollService(entityManager, projections, clock, objectMapper, transactionManager);
        }
    }

    private final JdbcTemplate jdbc;
    private final PayrollService service;
    private final PayrollProjectionMapper projections;

    @Autowired
    PayrollPostgreSqlIntegrationTest(JdbcTemplate jdbc, PayrollService service, PayrollProjectionMapper projections) {
        this.jdbc = jdbc;
        this.service = service;
        this.projections = projections;
    }

    @BeforeEach
    void resetData() {
        jdbc.execute("truncate " + String.join(",", allTables()) + " restart identity cascade");
        jdbc.update("insert into auth_users(id, display_name) values (1, 'Payroll Admin')");
        jdbc.update("insert into org_departments(id, name, cost_center_code) values (1, 'Headquarters', 'HQ')");
        jdbc.update("insert into hr_employees(id, user_id, employee_no, department_id, position_title, employment_status, hire_date) values (1, 1, 'EMP-001', 1, 'Engineer', 'active', date '2020-01-01')");
        jdbc.update("insert into hr_employee_basic_profiles(employee_id, retire_date) values (1, null)");
    }

    @Test
    void validatesAlembicShapedSchemaWithOwnedConstraintsAndJsonColumns() {
        Set<String> tables = Set.copyOf(jdbc.queryForList("""
                select table_name from information_schema.tables
                 where table_schema = 'public' and (table_name like 'pay_%' or table_name = 'gl_accounts')
                """, String.class));
        assertThat(tables).containsAll(ownedTables());

        Set<String> constraints = Set.copyOf(jdbc.queryForList("""
                select con.conname from pg_constraint con
                join pg_class rel on rel.oid = con.conrelid
                where rel.relname like 'pay_%' or rel.relname = 'gl_accounts'
                """, String.class));
        assertThat(constraints).contains(
                "uq_pay_payroll_codes_code", "uq_pay_tax_rates_year_type", "uq_pay_income_tax_brackets_year_from",
                "uq_pay_allowance_deductions_code", "uq_pay_item_groups_code", "uq_pay_item_group_details_link",
                "uq_pay_employee_profiles_employee_period", "uq_pay_variable_inputs_month_employee_item",
                "uq_pay_payroll_runs_month_code", "uq_pay_payroll_run_targets_run_employee",
                "uq_pay_payroll_run_employees_run_employee", "uq_gl_accounts_code", "uq_pay_gl_mappings_item_period",
                "uq_pay_vouchers_voucher_no", "uq_pay_vouchers_run_id_voucher_type", "uq_pay_severance_item_rules_item_code",
                "ck_pay_severance_item_rules_include_type");

        Set<String> indexes = Set.copyOf(jdbc.queryForList("""
                select indexname from pg_indexes
                 where schemaname = 'public' and (tablename like 'pay_%' or tablename = 'gl_accounts')
                """, String.class));
        assertThat(indexes).contains(
                "ix_pay_payroll_runs_month_status", "ix_pay_payroll_run_targets_run",
                "ix_pay_payroll_run_employees_run", "ix_pay_payroll_run_items_run_employee",
                "ix_pay_payroll_run_target_events_run_employee", "ix_pay_gl_mappings_item_code",
                "ix_pay_voucher_lines_voucher", "ix_pay_severance_item_rules_pay_item_code");
        assertThat(jdbc.queryForObject("select data_type from information_schema.columns where table_name='pay_payroll_run_targets' and column_name='snapshot_json'", String.class)).isEqualTo("json");
        assertThat(jdbc.queryForObject("select data_type from information_schema.columns where table_name='pay_payroll_run_target_events' and column_name='payload_json'", String.class)).isEqualTo("json");
        assertThat(jdbc.queryForObject("select column_default from information_schema.columns where table_name='pay_vouchers' and column_name='voucher_type'", String.class)).isEqualTo("'accrual'::character varying");
    }

    @Test
    void jpaLifecycleLocksAndMyBatisProjectionRunAgainstPostgres() throws Exception {
        int payrollCodeId = createPayrollCode();
        createProfile(payrollCodeId);
        createVoucherSetup();

        int runId = service.createPayrollRun(new PayrollContracts.PayrollRunCreateRequest("2026-01", payrollCodeId, "January payroll")).run().id();
        assertThat(jdbc.queryForObject("select count(*) from pay_payroll_run_targets where run_id=?", Integer.class, runId)).isOne();
        assertThatThrownBy(() -> service.createPayrollRun(new PayrollContracts.PayrollRunCreateRequest("2026-01", payrollCodeId, "repeat")))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).detail())
                .isEqualTo("Payroll run already exists for year_month + payroll_code.");

        PayrollContracts.PayrollRunItem calculated = service.calculatePayrollRun(runId).run();
        assertThat(calculated.status()).isEqualTo("calculated");
        assertThat(calculated.totalEmployees()).isEqualTo(1);
        assertThat(calculated.totalGross()).isEqualTo(1000d);

        List<PayrollProjectionMapper.RunEmployeeProjection> grid = projections.findRunEmployees(runId);
        assertThat(grid).singleElement().satisfies(row -> {
            assertThat(row.employeeNo()).isEqualTo("EMP-001");
            assertThat(row.employeeName()).isEqualTo("Payroll Admin");
            assertThat(row.netPay()).isEqualTo(1000d);
        });

        assertThat(service.closePayrollRun(runId).run().status()).isEqualTo("closed");
        int voucherId = jdbc.queryForObject("select id from pay_vouchers where run_id=? and voucher_type='accrual'", Integer.class, runId);
        assertThat(jdbc.queryForObject("select status from pay_vouchers where id=?", String.class, voucherId)).isEqualTo("draft");
        assertThatThrownBy(() -> service.closePayrollRun(runId)).isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).detail()).isEqualTo("Only calculated run can be closed.");

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<String> first = executor.submit(() -> confirmAfter(voucherId, ready, start));
            Future<String> second = executor.submit(() -> confirmAfter(voucherId, ready, start));
            ready.await();
            start.countDown();
            assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder("confirmed", "Only draft voucher can be confirmed.");
        }
        assertThat(jdbc.queryForObject("select status from pay_vouchers where id=?", String.class, voucherId)).isEqualTo("confirmed");
    }

    @Test
    void materializesSourceEventsAndAppliesWelfareAmountsWithRepeatableGoldenTotals() {
        int payrollCodeId = createPayrollCode();
        createProfile(payrollCodeId);
        service.saveEmployeeProfiles(new PayrollContracts.EmployeeProfileBatchRequest(List.of(
                new PayrollContracts.EmployeeProfileBatchItem(null, 1, payrollCodeId, null, 1100d, "regular", "fixed_day", null,
                        "previous_business_day", LocalDate.of(2026, 1, 15), null, true)), null));
        service.saveAllowanceDeductions(new PayrollContracts.AllowanceDeductionBatchRequest(List.of(
                new PayrollContracts.AllowanceDeductionBatchItem(null, "MEAL", "식대", "earning", "non-taxable", "fixed", true, 1),
                new PayrollContracts.AllowanceDeductionBatchItem(null, "LOAN", "사내대출상환", "deduction", "tax", "fixed", true, 2)), null));

        jdbc.update("insert into org_departments(id, name, cost_center_code) values (2, 'People', 'PEOPLE')");
        jdbc.update("insert into hr_appointment_orders(id, appointment_no, title, effective_date, status) values (1, 'APT-001', '부서 이동', date '2026-01-10', 'confirmed')");
        jdbc.update("""
                insert into hr_appointment_order_items(
                    id, order_id, employee_id, appointment_kind, action_type, start_date,
                    from_department_id, to_department_id, from_position_title, to_position_title,
                    from_employment_status, to_employment_status)
                values (1, 1, 1, 'permanent', '부서이동', date '2026-01-10', 1, 2, 'Engineer', 'Engineer', 'active', 'active')
                """);
        jdbc.update("""
                insert into tim_leave_requests(id, employee_id, leave_type, start_date, end_date, reason, request_status, approved_at, decision_comment)
                values (1, 1, 'unpaid', date '2026-01-20', date '2026-01-21', '개인 사유', 'approved', timestamp '2026-01-05 09:00:00', '승인')
                """);
        jdbc.update("insert into wel_benefit_types(id, code, name, is_deduction, pay_item_code, is_active) values (1, 'MEAL_BENEFIT', '식대지원', false, 'MEAL', true)");
        jdbc.update("insert into wel_benefit_types(id, code, name, is_deduction, pay_item_code, is_active) values (2, 'LOAN_REPAY', '대출상환', true, 'LOAN', true)");
        jdbc.update("""
                insert into wel_benefit_requests(
                    id, request_no, benefit_type_code, benefit_type_name, employee_no, status_code,
                    requested_amount, approved_amount, description, requested_at, approved_at, created_at, updated_at)
                values (1, 'WEL-001', 'MEAL_BENEFIT', '식대지원', 'EMP-001', 'approved', 180, 200,
                        '1월 식대', timestamp '2026-01-02 09:00:00', timestamp '2026-01-03 09:00:00', timestamp '2026-01-02 09:00:00', timestamp '2026-01-03 09:00:00')
                """);
        jdbc.update("""
                insert into wel_benefit_requests(
                    id, request_no, benefit_type_code, benefit_type_name, employee_no, status_code,
                    requested_amount, approved_amount, description, requested_at, approved_at, created_at, updated_at)
                values (2, 'WEL-002', 'LOAN_REPAY', '대출상환', 'EMP-001', 'approved', 50, null,
                        '1월 상환', timestamp '2026-01-02 09:00:00', timestamp '2026-01-04 09:00:00', timestamp '2026-01-02 09:00:00', timestamp '2026-01-04 09:00:00')
                """);

        int runId = service.createPayrollRun(new PayrollContracts.PayrollRunCreateRequest("2026-01", payrollCodeId, "January payroll")).run().id();

        assertThat(projections.findAppointmentEvents(List.of(1), LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31)))
                .singleElement().satisfies(row -> assertThat(row.toDepartmentName()).isEqualTo("People"));
        assertThat(projections.findApprovedLeaveEvents(List.of(1), LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31)))
                .singleElement().satisfies(row -> assertThat(row.leaveType()).isEqualTo("unpaid"));
        assertThat(projections.findWelfareRequests(List.of("EMP-001"), "2026-01")).hasSize(2);
        assertThat(jdbc.queryForObject("select event_count from pay_payroll_run_targets where run_id=?", Integer.class, runId)).isEqualTo(6);
        assertThat(jdbc.queryForObject("select review_required from pay_payroll_run_targets where run_id=?", Boolean.class, runId)).isTrue();
        assertThat(jdbc.queryForList("select event_code from pay_payroll_run_target_events where run_id=? order by id", String.class, runId))
                .containsExactly("appointment_order_confirmed", "department_changed", "base_salary_changed",
                        "unpaid_leave_approved", "welfare_allowance_approved", "welfare_deduction_approved");
        assertThat(jdbc.queryForObject("select payload_json::jsonb ->> 'approved_amount' from pay_payroll_run_target_events where run_id=? and event_code='welfare_allowance_approved'", String.class, runId))
                .isEqualTo("200");

        PayrollContracts.PayrollRunItem calculated = service.calculatePayrollRun(runId).run();

        assertThat(calculated.totalEmployees()).isOne();
        assertThat(calculated.totalGross()).isEqualTo(1300d);
        assertThat(calculated.totalDeductions()).isEqualTo(50d);
        assertThat(calculated.totalNet()).isEqualTo(1250d);
        assertThat(jdbc.queryForObject("select taxable_income from pay_payroll_run_employees where run_id=?", Double.class, runId)).isEqualTo(1100d);
        assertThat(jdbc.queryForObject("select non_taxable_income from pay_payroll_run_employees where run_id=?", Double.class, runId)).isEqualTo(200d);
        assertThat(jdbc.queryForObject("select warning_message from pay_payroll_run_employees where run_id=?", String.class, runId))
                .contains("payroll events: 기본급 변경, 무급휴가 승인");
        assertThat(jdbc.queryForList("select item_code from pay_payroll_run_items where source_type='welfare' order by item_code", String.class))
                .containsExactly("LOAN", "MEAL");
        assertThat(jdbc.queryForObject("select message from pay_payroll_run_events where run_id=? and event_type='calculated' order by id desc limit 1", String.class, runId))
                .isEqualTo("Payroll calculated for 1 employees (review targets: 1).");
        assertThat(jdbc.queryForList("select distinct status_code from wel_benefit_requests", String.class)).containsExactly("payroll_reflected");
        assertThat(jdbc.queryForList("select distinct payroll_run_label from wel_benefit_requests", String.class)).containsExactly("2026-01 정기급여");

        PayrollContracts.PayrollRunItem repeated = service.calculatePayrollRun(runId).run();
        assertThat(repeated.totalGross()).isEqualTo(1300d);
        assertThat(repeated.totalDeductions()).isEqualTo(50d);
        assertThat(repeated.totalNet()).isEqualTo(1250d);
        assertThat(jdbc.queryForObject("select count(*) from pay_payroll_run_employees where run_id=?", Integer.class, runId)).isOne();
        assertThat(jdbc.queryForObject("select count(*) from pay_payroll_run_items where source_type='welfare'", Integer.class)).isEqualTo(2);
    }

    @Test
    void advisoryNaturalKeyLockMakesConcurrentRunCreationDeterministic() throws Exception {
        int payrollCodeId = createPayrollCode();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<String> first = executor.submit(() -> createAfter(payrollCodeId, ready, start));
            Future<String> second = executor.submit(() -> createAfter(payrollCodeId, ready, start));
            ready.await();
            start.countDown();
            assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder("created", "Payroll run already exists for year_month + payroll_code.");
        }
        assertThat(jdbc.queryForObject("select count(*) from pay_payroll_runs where year_month='2026-02' and payroll_code_id=?", Integer.class, payrollCodeId)).isOne();
    }

    private int createPayrollCode() {
        return service.savePayrollCodes(new PayrollContracts.PayrollCodeBatchRequest(
                List.of(new PayrollContracts.PayrollCodeBatchItem(null, "REG", "Regular", "regular", "25", null, null, null)), null))
                .items().getFirst().id();
    }

    private void createProfile(int payrollCodeId) {
        service.saveEmployeeProfiles(new PayrollContracts.EmployeeProfileBatchRequest(List.of(
                new PayrollContracts.EmployeeProfileBatchItem(null, 1, payrollCodeId, null, 1000d, null, null, null, null,
                        LocalDate.of(2020, 1, 1), null, null)), null));
    }

    private void createVoucherSetup() {
        service.saveGlAccounts(new PayrollContracts.GlAccountBatchRequest(List.of(
                new PayrollContracts.GlAccountBatchItem(null, "5100", "Salary expense", "expense", false, false, true, 1),
                new PayrollContracts.GlAccountBatchItem(null, "2100", "Net-pay liability", "liability", true, false, true, 2)), null));
        service.saveGlMappings(new PayrollContracts.GlMappingBatchRequest(List.of(
                new PayrollContracts.GlMappingBatchItem(null, "BSC", "5100", LocalDate.of(2020, 1, 1), null, true)), null));
    }

    private String confirmAfter(int voucherId, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        start.await();
        try {
            service.confirmVoucher(voucherId, 1);
            return "confirmed";
        } catch (ApiException exception) {
            return String.valueOf(exception.detail());
        }
    }

    private String createAfter(int payrollCodeId, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        start.await();
        try {
            service.createPayrollRun(new PayrollContracts.PayrollRunCreateRequest("2026-02", payrollCodeId, "February payroll"));
            return "created";
        } catch (ApiException exception) {
            return String.valueOf(exception.detail());
        }
    }

    private static synchronized void ensureSchema() {
        if (schemaInitialized) return;
        POSTGRES.start();
        try (var connection = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var statement = connection.createStatement()) {
            for (String ddl : schemaDdl()) statement.execute(ddl);
            schemaInitialized = true;
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to initialize disposable PAY PostgreSQL schema", exception);
        }
    }

    private static Set<String> ownedTables() {
        return Set.of("pay_allowance_deductions", "pay_income_tax_brackets", "pay_item_groups", "pay_item_group_details",
                "pay_payroll_codes", "pay_tax_rates", "pay_employee_profiles", "pay_variable_inputs", "pay_payroll_runs",
                "pay_payroll_run_targets", "pay_payroll_run_employees", "pay_payroll_run_items", "pay_payroll_run_events",
                "pay_payroll_run_target_events", "gl_accounts", "pay_gl_mappings", "pay_vouchers", "pay_voucher_lines",
                "pay_severance_item_rules");
    }

    private static List<String> allTables() {
        return List.of("pay_voucher_lines", "pay_vouchers", "pay_payroll_run_target_events", "pay_payroll_run_events",
                "pay_payroll_run_items", "pay_payroll_run_employees", "pay_payroll_run_targets", "pay_payroll_runs",
                "pay_variable_inputs", "pay_employee_profiles", "pay_item_group_details", "pay_item_groups",
                "pay_allowance_deductions", "pay_income_tax_brackets", "pay_tax_rates", "pay_payroll_codes", "pay_gl_mappings",
                "gl_accounts", "pay_severance_item_rules", "wel_benefit_requests", "wel_benefit_types", "tim_leave_requests",
                "hr_appointment_order_items", "hr_appointment_orders", "hr_employee_basic_profiles", "hr_employees", "org_departments", "auth_users");
    }

    private static List<String> schemaDdl() {
        return List.of(
                "create table auth_users(id integer generated by default as identity primary key, display_name varchar(100))",
                "create table org_departments(id integer generated by default as identity primary key, name varchar(100), cost_center_code varchar(30))",
                "create table hr_employees(id integer generated by default as identity primary key, user_id integer, employee_no varchar(30), department_id integer, position_title varchar(100), employment_status varchar(20), hire_date date, foreign key(user_id) references auth_users(id), foreign key(department_id) references org_departments(id))",
                "create table hr_employee_basic_profiles(employee_id integer primary key, retire_date date, foreign key(employee_id) references hr_employees(id))",
                "create table hr_appointment_orders(id integer generated by default as identity primary key, appointment_no varchar(30) not null, title varchar(120) not null, effective_date date not null, status varchar(20) not null)",
                "create table hr_appointment_order_items(id integer generated by default as identity primary key, order_id integer not null, employee_id integer not null, appointment_kind varchar(20) not null, action_type varchar(30) not null, start_date date not null, end_date date, from_department_id integer, to_department_id integer, from_position_title varchar(80), to_position_title varchar(80), from_employment_status varchar(20), to_employment_status varchar(20), temporary_reason varchar(500), note varchar(500), foreign key(order_id) references hr_appointment_orders(id), foreign key(employee_id) references hr_employees(id))",
                "create table tim_leave_requests(id integer generated by default as identity primary key, employee_id integer not null, leave_type varchar(20) not null, start_date date not null, end_date date not null, reason varchar(500), request_status varchar(20) not null, approved_at timestamp, decision_comment varchar(500), foreign key(employee_id) references hr_employees(id))",
                "create table wel_benefit_types(id integer generated by default as identity primary key, code varchar(40) not null unique, name varchar(100) not null, is_deduction boolean not null, pay_item_code varchar(60), is_active boolean not null)",
                "create table wel_benefit_requests(id integer generated by default as identity primary key, request_no varchar(40) not null unique, benefit_type_code varchar(40) not null, benefit_type_name varchar(100) not null, employee_no varchar(40) not null, status_code varchar(30) not null, requested_amount bigint not null, approved_amount bigint, payroll_run_label varchar(120), description varchar(500), requested_at timestamp not null, approved_at timestamp, created_at timestamp not null, updated_at timestamp not null)",
                "create table pay_payroll_codes(id integer generated by default as identity primary key, code varchar(20) not null, name varchar(100) not null, pay_type varchar(20) not null, payment_day varchar(20) not null, tax_deductible boolean not null, social_ins_deductible boolean not null, is_active boolean not null, created_at timestamp not null, updated_at timestamp not null, constraint uq_pay_payroll_codes_code unique(code))",
                "create index ix_pay_payroll_codes_code on pay_payroll_codes(code)",
                "create table pay_tax_rates(id integer generated by default as identity primary key, year integer not null, rate_type varchar(50) not null, employee_rate double precision, employer_rate double precision, min_limit integer, max_limit integer, created_at timestamp not null, updated_at timestamp not null, constraint uq_pay_tax_rates_year_type unique(year, rate_type))",
                "create index ix_pay_tax_rates_year on pay_tax_rates(year)",
                "create table pay_income_tax_brackets(id integer generated by default as identity primary key, year integer not null, annual_taxable_from integer not null, annual_taxable_to integer, tax_rate double precision not null, quick_deduction double precision not null, created_at timestamp not null, updated_at timestamp not null, constraint uq_pay_income_tax_brackets_year_from unique(year, annual_taxable_from))",
                "create index ix_pay_income_tax_brackets_year_range on pay_income_tax_brackets(year, annual_taxable_from, annual_taxable_to)",
                "create table pay_allowance_deductions(id integer generated by default as identity primary key, code varchar(20) not null, name varchar(100) not null, type varchar(20) not null, tax_type varchar(20) not null, calculation_type varchar(20) not null, is_active boolean not null, sort_order integer not null, created_at timestamp not null, updated_at timestamp not null, constraint uq_pay_allowance_deductions_code unique(code))",
                "create index ix_pay_allowance_deductions_code on pay_allowance_deductions(code)",
                "create table pay_item_groups(id integer generated by default as identity primary key, code varchar(20) not null, name varchar(100) not null, description varchar(200), is_active boolean not null, created_at timestamp not null, updated_at timestamp not null, constraint uq_pay_item_groups_code unique(code))",
                "create index ix_pay_item_groups_code on pay_item_groups(code)",
                "create table pay_item_group_details(id integer generated by default as identity primary key, group_id integer not null, item_id integer not null, type varchar(20) not null, created_at timestamp not null, foreign key(group_id) references pay_item_groups(id), foreign key(item_id) references pay_allowance_deductions(id), constraint uq_pay_item_group_details_link unique(group_id, item_id))",
                "create index ix_pay_item_group_details_group_id on pay_item_group_details(group_id)",
                "create table pay_employee_profiles(id integer generated by default as identity primary key, employee_id integer not null, payroll_code_id integer not null, item_group_id integer, base_salary double precision not null, pay_type_code varchar(20) not null, payment_day_type varchar(20) not null, payment_day_value integer, holiday_adjustment varchar(30) not null, effective_from date not null, effective_to date, is_active boolean not null, created_at timestamp not null, updated_at timestamp not null, foreign key(employee_id) references hr_employees(id), foreign key(payroll_code_id) references pay_payroll_codes(id), foreign key(item_group_id) references pay_item_groups(id), constraint uq_pay_employee_profiles_employee_period unique(employee_id, effective_from))",
                "create index ix_pay_employee_profiles_employee_id on pay_employee_profiles(employee_id)",
                "create table pay_variable_inputs(id integer generated by default as identity primary key, year_month varchar(7) not null, employee_id integer not null, item_code varchar(20) not null, direction varchar(20) not null, amount double precision not null, memo varchar(200), created_at timestamp not null, updated_at timestamp not null, foreign key(employee_id) references hr_employees(id), constraint uq_pay_variable_inputs_month_employee_item unique(year_month, employee_id, item_code))",
                "create index ix_pay_variable_inputs_year_month on pay_variable_inputs(year_month, employee_id)",
                "create table pay_payroll_runs(id integer generated by default as identity primary key, year_month varchar(7) not null, payroll_code_id integer not null, run_name varchar(120), status varchar(20) not null, total_employees integer not null, total_gross double precision not null, total_deductions double precision not null, total_net double precision not null, calculated_at timestamp, closed_at timestamp, paid_at timestamp, created_at timestamp not null, updated_at timestamp not null, foreign key(payroll_code_id) references pay_payroll_codes(id), constraint uq_pay_payroll_runs_month_code unique(year_month, payroll_code_id))",
                "create index ix_pay_payroll_runs_month_status on pay_payroll_runs(year_month, status)",
                "create table pay_payroll_run_targets(id integer generated by default as identity primary key, run_id integer not null, employee_id integer not null, profile_id integer, event_count integer not null, review_required boolean not null, snapshot_json json not null, created_at timestamp not null, updated_at timestamp not null, foreign key(run_id) references pay_payroll_runs(id), foreign key(employee_id) references hr_employees(id), foreign key(profile_id) references pay_employee_profiles(id), constraint uq_pay_payroll_run_targets_run_employee unique(run_id, employee_id))",
                "create index ix_pay_payroll_run_targets_run on pay_payroll_run_targets(run_id, employee_id)",
                "create table pay_payroll_run_employees(id integer generated by default as identity primary key, run_id integer not null, employee_id integer not null, profile_id integer, gross_pay double precision not null, taxable_income double precision not null, non_taxable_income double precision not null, total_deductions double precision not null, net_pay double precision not null, status varchar(20) not null, warning_message varchar(500), created_at timestamp not null, updated_at timestamp not null, foreign key(run_id) references pay_payroll_runs(id), foreign key(employee_id) references hr_employees(id), foreign key(profile_id) references pay_employee_profiles(id), constraint uq_pay_payroll_run_employees_run_employee unique(run_id, employee_id))",
                "create index ix_pay_payroll_run_employees_run on pay_payroll_run_employees(run_id, employee_id)",
                "create table pay_payroll_run_items(id integer generated by default as identity primary key, run_employee_id integer not null, item_code varchar(30) not null, item_name varchar(120) not null, direction varchar(20) not null, amount double precision not null, tax_type varchar(30) not null, calculation_type varchar(30) not null, source_type varchar(30) not null, created_at timestamp not null, foreign key(run_employee_id) references pay_payroll_run_employees(id))",
                "create index ix_pay_payroll_run_items_run_employee on pay_payroll_run_items(run_employee_id, direction)",
                "create table pay_payroll_run_events(id integer generated by default as identity primary key, run_id integer not null, event_type varchar(30) not null, message varchar(500) not null, created_by integer, created_at timestamp not null, foreign key(run_id) references pay_payroll_runs(id), foreign key(created_by) references auth_users(id))",
                "create index ix_pay_payroll_run_events_run on pay_payroll_run_events(run_id, created_at)",
                "create table pay_payroll_run_target_events(id integer generated by default as identity primary key, run_id integer not null, target_id integer, employee_id integer not null, event_code varchar(50) not null, event_name varchar(120) not null, source_type varchar(30) not null, source_table varchar(50) not null, source_id integer, effective_date date not null, decision_code varchar(20) not null, payload_json json not null, created_at timestamp not null, foreign key(run_id) references pay_payroll_runs(id), foreign key(target_id) references pay_payroll_run_targets(id), foreign key(employee_id) references hr_employees(id))",
                "create index ix_pay_payroll_run_target_events_run_employee on pay_payroll_run_target_events(run_id, employee_id, effective_date)",
                "create table gl_accounts(id integer generated by default as identity primary key, code varchar(20) not null, name varchar(100) not null, account_type varchar(20) not null, is_net_pay_account boolean not null, is_cash_account boolean not null default false, is_active boolean not null, sort_order integer not null, created_at timestamp not null, updated_at timestamp not null, constraint uq_gl_accounts_code unique(code))",
                "create index ix_gl_accounts_code on gl_accounts(code)",
                "create table pay_gl_mappings(id integer generated by default as identity primary key, pay_item_code varchar(30) not null, gl_account_code varchar(20) not null, effective_from date not null, note varchar(200), is_active boolean not null, created_at timestamp not null, updated_at timestamp not null, foreign key(gl_account_code) references gl_accounts(code), constraint uq_pay_gl_mappings_item_period unique(pay_item_code, effective_from))",
                "create index ix_pay_gl_mappings_item_code on pay_gl_mappings(pay_item_code)",
                "create table pay_vouchers(id integer generated by default as identity primary key, voucher_no varchar(30) not null, run_id integer not null, voucher_type varchar(20) not null default 'accrual', voucher_date date not null, status varchar(20) not null, total_debit double precision not null, total_credit double precision not null, summary varchar(200), created_by integer, confirmed_by integer, confirmed_at timestamp, created_at timestamp not null, updated_at timestamp not null, foreign key(run_id) references pay_payroll_runs(id), foreign key(created_by) references auth_users(id), foreign key(confirmed_by) references auth_users(id), constraint uq_pay_vouchers_voucher_no unique(voucher_no), constraint uq_pay_vouchers_run_id_voucher_type unique(run_id, voucher_type))",
                "create table pay_voucher_lines(id integer generated by default as identity primary key, voucher_id integer not null, line_no integer not null, gl_account_code varchar(20) not null, cost_center_code varchar(30), debit_amount double precision not null, credit_amount double precision not null, summary varchar(200), source_item_code varchar(30), created_at timestamp not null, foreign key(voucher_id) references pay_vouchers(id), foreign key(gl_account_code) references gl_accounts(code))",
                "create index ix_pay_voucher_lines_voucher on pay_voucher_lines(voucher_id, line_no)",
                "create table pay_severance_item_rules(id integer generated by default as identity primary key, pay_item_code varchar(30) not null, include_type varchar(20) not null, note varchar(200), is_active boolean not null, created_at timestamp not null, updated_at timestamp not null, constraint ck_pay_severance_item_rules_include_type check (include_type in ('full', 'prorate_12', 'exclude')), constraint uq_pay_severance_item_rules_item_code unique(pay_item_code))",
                "create index ix_pay_severance_item_rules_pay_item_code on pay_severance_item_rules(pay_item_code)");
    }
}
