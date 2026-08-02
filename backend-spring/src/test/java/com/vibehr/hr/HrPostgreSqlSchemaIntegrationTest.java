package com.vibehr.hr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import java.sql.DriverManager;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
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
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

@Tag("integration")
@SpringBootTest(
        classes = HrPostgreSqlSchemaIntegrationTest.TestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = { "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false" })
class HrPostgreSqlSchemaIntegrationTest {
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
            .withDatabaseName("vibehr_hr_test")
            .withUsername("vibehr")
            .withPassword("vibehr");
    private static boolean externalSchemaInitialized;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        ensureExternalSchema();
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EntityScan(basePackageClasses = HrEmployee.class)
    @MapperScan(basePackageClasses = HrGridMapper.class)
    static class TestApplication {
        @Bean
        HrApplicationService hrApplicationService(EntityManager entityManager, ObjectMapper objectMapper,
                                                   HrGridMapper gridMapper, ApplicationEventPublisher events) {
            return new HrApplicationService(entityManager, objectMapper, gridMapper, events);
        }

        @Bean
        HrRetirementSeveranceListener retirementSeveranceListener(HrApplicationService service) {
            return new HrRetirementSeveranceListener(service);
        }
    }

    private final JdbcTemplate jdbc;
    private final HrApplicationService service;

    @Autowired
    HrPostgreSqlSchemaIntegrationTest(JdbcTemplate jdbc, HrApplicationService service) {
        this.jdbc = jdbc;
        this.service = service;
    }

    @BeforeEach
    void resetData() {
        jdbc.execute("truncate " + String.join(",", ownedTables()) + ",pay_income_tax_brackets,pay_severance_item_rules,pay_allowance_deductions,pay_payroll_run_items,pay_payroll_run_employees,pay_payroll_runs,org_departments,auth_user_roles,auth_roles,auth_users restart identity cascade");
        jdbc.update("insert into auth_users(id,login_id,email,password_hash,display_name,is_active,created_at,updated_at) values (17,'admin','admin@example.com','hash','인사 관리자',true,now(),now())");
        jdbc.update("insert into auth_roles(id,code) values (1,'employee')");
        jdbc.update("insert into org_departments(id,code,name,is_active,created_at,updated_at) values (3,'HQ-HR','인사팀',true,now(),now())");
    }

    @Test
    void postgresSchemaContainsEveryOwnedTableAndCanonicalConstraintAndIndex() {
        Set<String> tables = Set.copyOf(jdbc.queryForList("select table_name from information_schema.tables where table_schema='public' and table_name like 'hr_%'", String.class));
        assertThat(tables).containsAll(ownedTables());

        Set<String> constraints = Set.copyOf(jdbc.queryForList("""
                select con.conname from pg_constraint con
                join pg_class rel on rel.oid=con.conrelid
                where rel.relname like 'hr_%' and con.contype in ('c','u')
                """, String.class));
        assertThat(constraints).contains(
                "ck_hr_employees_employment_status", "uq_hr_employees_employee_no", "uq_hr_employees_user_id",
                "uq_hr_employee_basic_profiles_employee_id", "ck_hr_careers_scope",
                "ck_hr_reward_punish_type", "ck_hr_reward_punish_status",
                "uq_hr_appointment_orders_no", "ck_hr_appointment_orders_status",
                "uq_hr_appointment_order_items_order_employee", "ck_hr_appointment_order_items_kind",
                "ck_hr_appointment_order_items_apply_status", "ck_hr_appointment_order_items_temporary_end_date",
                "uq_hr_retire_checklist_items_code", "ck_hr_retire_cases_status",
                "uq_hr_retire_case_items_case_checklist", "uq_hr_recruit_finalists_no",
                "uq_hr_recruit_finalists_external_key", "ck_hr_recruit_finalists_source_type",
                "ck_hr_recruit_finalists_hire_type", "ck_hr_recruit_finalists_status_code",
                "uq_hr_severance_calcs_retire_case_id", "ck_hr_severance_calcs_status");

        Set<String> indexes = Set.copyOf(jdbc.queryForList("select indexname from pg_indexes where schemaname='public' and tablename like 'hr_%'", String.class));
        assertThat(indexes).contains(
                "ix_hr_employees_employee_no", "ix_hr_careers_employee_record_date",
                "ix_hr_appointment_orders_status_effective", "ix_hr_appointment_order_items_employee_start",
                "ix_hr_personnel_histories_source", "ix_hr_retire_cases_employee_created",
                "ix_hr_retire_case_items_case_checked", "ix_hr_recruit_finalists_status_created",
                "ix_hr_severance_calcs_employee_status");
        assertThat(jdbc.queryForObject("select data_type from information_schema.columns where table_name='hr_severance_calcs' and column_name='final_amount'", String.class)).isEqualTo("double precision");
        assertThat(jdbc.queryForObject("select column_default from information_schema.columns where table_name='hr_severance_calcs' and column_name='status'", String.class)).isNull();
    }

    @Test
    void myBatisGridAndSeveranceSnapshotRunAgainstRealPostgresWithLockingAndIdempotency() throws Exception {
        int employeeId = insertEmployee(17, "EMP-000017", LocalDate.of(2016, 1, 1));
        int caseId = jdbc.queryForObject("insert into hr_retire_cases(employee_id,retire_date,reason,status,created_at,updated_at) values (?,date '2026-06-30','개인사유','confirmed',now(),now()) returning id", Integer.class, employeeId);
        jdbc.update("insert into pay_payroll_runs(id,year_month,status) values (1,'2026-05','paid')");
        jdbc.update("insert into pay_payroll_run_employees(id,run_id,employee_id) values (1,1,?)", employeeId);
        jdbc.update("insert into pay_payroll_run_items(run_employee_id,item_code,item_name,amount,direction) values (1,'BASE','기본급',100000000,'earning')");
        jdbc.update("insert into pay_income_tax_brackets(year,annual_taxable_from,annual_taxable_to,tax_rate,quick_deduction) values (2025,0,null,15,1260000)");

        Map<String,Object> grid = service.listEmployees(1, 100, false, "EMP-000017", "인사", "인사팀", "active", true);
        assertThat(grid).containsEntry("total_count", 1L);
        assertThat((List<?>) grid.get("employees")).singleElement().isInstanceOf(Map.class);

        service.createSeveranceDraftFromRetireCase(caseId);
        service.createSeveranceDraftFromRetireCase(caseId);
        assertThat(jdbc.queryForObject("select count(*) from hr_severance_calcs where retire_case_id=?", Integer.class, caseId)).isOne();
        int calcId = jdbc.queryForObject("select id from hr_severance_calcs where retire_case_id=?", Integer.class, caseId);
        Map<String,Object> tax = castMap(service.severanceDetail(calcId).get("tax_detail"));
        assertThat(tax).containsEntry("tax_table_year", 2026).containsEntry("bracket_year", 2025)
                .containsEntry("warning", "2026년 기본세율 구간이 없어 최신 연도(2025) 기준으로 계산했습니다.");
        assertThat(jdbc.queryForObject("select warning from hr_severance_calcs where id=?", String.class, calcId))
                .isEqualTo("2026년 기본세율 구간이 없어 최신 연도(2025) 기준으로 계산했습니다.");

        CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<String> first = executor.submit(() -> confirmAfter(calcId, ready, start));
            Future<String> second = executor.submit(() -> confirmAfter(calcId, ready, start));
            ready.await(); start.countDown();
            assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder("confirmed", "Calc is already confirmed.");
        }
        assertThat(jdbc.queryForObject("select status from hr_severance_calcs where id=?", String.class, calcId)).isEqualTo("confirmed");
    }

    @Test
    void careerScopeIsDerivedFromTypeAndUpdated() {
        int employeeId = insertEmployee(17, "EMP-000017", LocalDate.of(2025, 1, 1));
        HrRequests.BasicRecordCreate create = new HrRequests.BasicRecordCreate();
        create.category = "careers";
        create.title = "VIBE HR";
        create.type = "사내경력";

        Map<String,Object> created = service.createBasicRecord(employeeId, create);
        int recordId = ((Number) created.get("id")).intValue();
        assertThat(jdbc.queryForObject("select career_scope from hr_careers where id=?", String.class, recordId))
                .isEqualTo("INTERNAL");

        HrRequests.BasicRecordUpdate update = new HrRequests.BasicRecordUpdate();
        update.type = "external";
        service.updateBasicRecord(employeeId, recordId, "careers", update);
        assertThat(jdbc.queryForObject("select career_scope from hr_careers where id=?", String.class, recordId))
                .isEqualTo("EXTERNAL");
    }

    @Test
    void employeeNumbersUseOneNamespaceForReservationsAndConcurrentFinalistAllocation() throws Exception {
        insertFinalist("RC20260802-0001", "EMP-700001", "reserved-login");

        ApiException directCreateConflict = catchThrowableOfType(
                () -> service.createEmployee(employeeCreate("EMP-700001", "direct-login")), ApiException.class);

        assertThat(directCreateConflict.status().value()).isEqualTo(409);
        assertThat(directCreateConflict.detail()).isEqualTo("employee_no is reserved by a recruitment finalist.");
        assertThat(jdbc.queryForObject("select count(*) from auth_users", Integer.class)).isEqualTo(1);

        jdbc.update("insert into auth_users(id,login_id,email,password_hash,display_name,is_active,created_at,updated_at) values (18,'existing-login','existing@example.com','hash','Existing employee',true,now(),now())");
        insertEmployee(18, "EMP-700002", LocalDate.of(2026, 1, 1));
        HrRequests.FinalistCreate finalistCreate = new HrRequests.FinalistCreate();
        finalistCreate.fullName = "Colliding finalist";
        finalistCreate.loginId = "other-login";
        finalistCreate.employeeNo = "EMP-700002";

        ApiException finalistCreateConflict = catchThrowableOfType(() -> service.createFinalist(finalistCreate), ApiException.class);
        assertThat(finalistCreateConflict.status().value()).isEqualTo(409);

        int unrelated = insertFinalist("RC20260802-0002", "EMP-700002", "other-login");
        @SuppressWarnings("unchecked") List<Map<String, Object>> results = (List<Map<String, Object>>) service.createEmployeesFromFinalists(ids(unrelated)).get("results");
        assertThat(results).singleElement().satisfies(result -> assertThat(result)
                .containsEntry("outcome", "error")
                .containsEntry("employee_id", null));
        assertThat(jdbc.queryForObject("select count(*) from hr_employees where employee_no='EMP-700002'", Integer.class)).isOne();
        assertThat(jdbc.queryForObject("select status_code from hr_recruit_finalists where id=?", String.class, unrelated)).isEqualTo("ready");

        int first = insertFinalist("RC20260802-0003", null, null);
        int second = insertFinalist("RC20260802-0004", null, null);
        CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<Map<String, Object>> firstResult = executor.submit(() -> generateEmployeeNoAfter(first, ready, start));
            Future<Map<String, Object>> secondResult = executor.submit(() -> generateEmployeeNoAfter(second, ready, start));
            ready.await();
            start.countDown();
            assertThat(firstResult.get()).containsEntry("updated_count", 1);
            assertThat(secondResult.get()).containsEntry("updated_count", 1);
        }
        List<String> generated = jdbc.queryForList("select employee_no from hr_recruit_finalists where id in (?,?) order by id", String.class, first, second);
        assertThat(generated).allSatisfy(value -> assertThat(value).startsWith("EMP-"));
        assertThat(generated).doesNotHaveDuplicates();
    }

    @Test
    void appointmentAndRetirementTransitionsPersistExactHistoryAuditAndKoreanRecords() {
        int employeeId = insertEmployee(17, "EMP-000017", LocalDate.of(2025, 1, 1));
        jdbc.update("insert into hr_recruit_finalists(candidate_no,source_type,full_name,hire_type,login_id,employee_no,status_code,is_active,created_at,updated_at) values ('RC20260801-0001','manual','인사 관리자','new','admin','EMP-000017','ready',true,now(),now())");
        int orderId = jdbc.queryForObject("insert into hr_appointment_orders(appointment_no,title,effective_date,status,created_at,updated_at) values ('APT-20260801-0001','정기 발령',date '2026-08-01','draft',now(),now()) returning id", Integer.class);
        jdbc.update("insert into hr_appointment_order_items(order_id,employee_id,appointment_kind,action_type,start_date,apply_status,created_at,updated_at) values (?,?,'permanent','승진',date '2026-08-01','pending',now(),now())", orderId, employeeId);

        assertThat(service.confirmAppointment(orderId, 17)).containsEntry("applied_count", 1);
        assertThat(jdbc.queryForMap("select history_type,field_name,description from hr_personnel_histories where appointment_order_id=?", orderId))
                .containsEntry("history_type", "승진").containsEntry("field_name", null).containsEntry("description", "APT-20260801-0001 승진");
        assertThat(jdbc.queryForMap("select category,title,type from hr_employee_info_records where employee_id=?", employeeId))
                .containsEntry("category", "appointment").containsEntry("title", "정기 발령").containsEntry("type", "승진");
        assertThat(jdbc.queryForObject("select status_code from hr_recruit_finalists where employee_no='EMP-000017'", String.class)).isEqualTo("appointed");

        int checklistId = jdbc.queryForObject("insert into hr_retire_checklist_items(code,title,is_required,is_active,sort_order,created_at,updated_at) values ('handover','인수인계',true,true,1,now(),now()) returning id", Integer.class);
        int caseId = jdbc.queryForObject("insert into hr_retire_cases(employee_id,retire_date,reason,status,created_at,updated_at) values (?,date '2026-08-31','개인사유','draft',now(),now()) returning id", Integer.class, employeeId);
        jdbc.update("insert into hr_retire_case_items(case_id,checklist_item_id,is_required,is_checked,created_at,updated_at) values (?,?,true,true,now(),now())", caseId, checklistId);
        service.confirmRetireCase(caseId, 17);
        assertThat(jdbc.queryForMap("select title,type,value,note from hr_employee_info_records where employee_id=? order by id desc limit 1", employeeId))
                .containsEntry("title", "퇴직처리").containsEntry("type", "retire").containsEntry("value", "개인사유").containsEntry("note", "퇴직처리 확정(case_id=" + caseId + ")");
        assertThat(jdbc.queryForObject("select description from hr_personnel_histories where source_table='hr_retire_cases' and source_id=? order by id desc", String.class, caseId)).isEqualTo("Retire case confirmed.");
        assertThat(jdbc.queryForMap("select action_type,detail from hr_retire_audit_logs where case_id=? order by id desc limit 1", caseId))
                .containsEntry("action_type", "confirm").containsEntry("detail", "employment_status:active->resigned");
        assertThat(jdbc.queryForObject("select count(*) from hr_severance_calcs where retire_case_id=?", Integer.class, caseId)).isOne();

        HrRequests.RetireCancel cancel = new HrRequests.RetireCancel(); cancel.cancelReason = "요청 철회";
        service.cancelRetireCase(caseId, cancel, 17);
        assertThat(jdbc.queryForMap("select title,type,value,note from hr_employee_info_records where employee_id=? order by id desc limit 1", employeeId))
                .containsEntry("title", "퇴직처리 취소").containsEntry("type", "retire_cancel").containsEntry("value", "요청 철회").containsEntry("note", "퇴직처리 취소(case_id=" + caseId + ")");
        assertThat(jdbc.queryForObject("select description from hr_personnel_histories where source_table='hr_retire_cases' and source_id=? order by id desc limit 1", String.class, caseId)).isEqualTo("Retire case cancelled.");
        assertThat(jdbc.queryForMap("select action_type,detail from hr_retire_audit_logs where case_id=? order by id desc limit 1", caseId))
                .containsEntry("action_type", "cancel").containsEntry("detail", "employment_status:resigned->active");
    }

    private int insertEmployee(int userId, String employeeNo, LocalDate hireDate) {
        return jdbc.queryForObject("insert into hr_employees(user_id,employee_no,department_id,position_title,hire_date,employment_status,created_at,updated_at) values (?,?,3,'인사담당',?,'active',now(),now()) returning id", Integer.class, userId, employeeNo, hireDate);
    }

    private int insertFinalist(String candidateNo, String employeeNo, String loginId) {
        return jdbc.queryForObject("insert into hr_recruit_finalists(candidate_no,source_type,full_name,hire_type,login_id,employee_no,status_code,is_active,created_at,updated_at) values (?,'manual','Candidate','new',?,?,'ready',true,now(),now()) returning id", Integer.class, candidateNo, loginId, employeeNo);
    }

    private HrRequests.EmployeeCreate employeeCreate(String employeeNo, String loginId) {
        HrRequests.EmployeeCreate request = new HrRequests.EmployeeCreate();
        request.employeeNo = employeeNo;
        request.displayName = "Direct employee";
        request.departmentId = 3;
        request.positionTitle = "Staff";
        request.employmentStatus = "active";
        request.loginId = loginId;
        request.email = loginId + "@example.com";
        request.password = "password";
        return request;
    }

    private HrRequests.Ids ids(int id) {
        HrRequests.Ids request = new HrRequests.Ids();
        request.ids = List.of(id);
        return request;
    }

    private Map<String, Object> generateEmployeeNoAfter(int finalistId, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        start.await();
        return service.generateFinalistEmployeeNos(ids(finalistId));
    }

    private String confirmAfter(int calcId, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown(); start.await();
        try { service.confirmSeverance(calcId, 17); return "confirmed"; }
        catch (ApiException exception) { return String.valueOf(exception.detail()); }
    }

    @SuppressWarnings("unchecked")
    private static Map<String,Object> castMap(Object value) { return (Map<String,Object>) value; }

    private static synchronized void ensureExternalSchema() {
        if (externalSchemaInitialized) return;
        POSTGRES.start();
        try (var connection = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()); var statement = connection.createStatement()) {
            for (String ddl : externalSchemaDdl()) statement.execute(ddl);
            externalSchemaInitialized = true;
        } catch (Exception exception) { throw new IllegalStateException("Failed to initialize disposable HR PostgreSQL schema", exception); }
    }

    private static Set<String> ownedTables() {
        return Set.of("hr_employees", "hr_employee_basic_profiles", "hr_employee_info_records", "hr_contact_points", "hr_careers", "hr_licenses", "hr_military", "hr_reward_punish", "hr_appointment_orders", "hr_appointment_order_items", "hr_personnel_histories", "hr_retire_checklist_items", "hr_retire_cases", "hr_retire_case_items", "hr_retire_audit_logs", "hr_recruit_finalists", "hr_severance_calcs");
    }

    private static List<String> externalSchemaDdl() {
        return List.of(
                "create table auth_users(id serial primary key,login_id varchar(50),email varchar(255),password_hash varchar(255),display_name varchar(100),is_active boolean,created_at timestamp,updated_at timestamp)",
                "create table auth_roles(id serial primary key,code varchar(40) not null unique)",
                "create table auth_user_roles(user_id integer not null,role_id integer not null,assigned_at timestamp not null,primary key(user_id,role_id))",
                "create table org_departments(id serial primary key,code varchar(30),name varchar(100),is_active boolean,created_at timestamp,updated_at timestamp)",
                "create table pay_payroll_runs(id serial primary key,year_month varchar(7),status varchar(20))",
                "create table pay_payroll_run_employees(id serial primary key,run_id integer,employee_id integer)",
                "create table pay_payroll_run_items(id serial primary key,run_employee_id integer,item_code varchar(30),item_name varchar(100),amount double precision,direction varchar(20))",
                "create table pay_severance_item_rules(id serial primary key,pay_item_code varchar(30),include_type varchar(20),is_active boolean)",
                "create table pay_allowance_deductions(id serial primary key,code varchar(20),name varchar(100))",
                "create table pay_income_tax_brackets(id serial primary key,year integer,annual_taxable_from double precision,annual_taxable_to double precision,tax_rate double precision,quick_deduction double precision)"
        );
    }
}
