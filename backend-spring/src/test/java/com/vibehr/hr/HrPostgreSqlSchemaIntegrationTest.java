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
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
    void finalistEmployeeCreationPersistsTheBasicProfileWithBothRequiredTimestamps() {
        HrRequests.FinalistCreate finalist = new HrRequests.FinalistCreate();
        finalist.fullName = "Profile regression candidate";
        finalist.loginId = "finalist-profile";
        finalist.employeeNo = "EMP-710001";
        finalist.birthDate = LocalDate.of(1990, 1, 2);
        finalist.residentNoMasked = "test-masked-id";
        finalist.expectedJoinDate = LocalDate.of(2026, 8, 1);
        int finalistId = ((Number) castMap(service.createFinalist(finalist).get("item")).get("id")).intValue();

        Map<String, Object> response = service.createEmployeesFromFinalists(ids(finalistId));

        assertThat(response).containsEntry("created_count", 1).containsEntry("skipped_count", 0).containsEntry("error_count", 0);
        List<?> results = (List<?>) response.get("results");
        assertThat(results).hasSize(1);
        Map<String, Object> result = castMap(results.getFirst());
        assertThat(result).containsEntry("outcome", "created").containsEntry("employee_no", finalist.employeeNo);
        int employeeId = ((Number) result.get("employee_id")).intValue();
        Map<String, Object> profile = jdbc.queryForMap("""
                select p.employee_id,p.birth_date,p.resident_no_masked,p.created_at,p.updated_at,
                       e.position_title,e.employment_status
                  from hr_employee_basic_profiles p join hr_employees e on e.id=p.employee_id
                 where p.employee_id=?
                """, employeeId);
        assertThat(profile).containsEntry("employee_id", employeeId)
                .containsEntry("birth_date", java.sql.Date.valueOf(finalist.birthDate))
                .containsEntry("resident_no_masked", finalist.residentNoMasked)
                .containsEntry("position_title", "채용대기").containsEntry("employment_status", "leave");
        assertThat(profile.get("created_at")).isNotNull();
        assertThat(profile.get("updated_at")).isNotNull();
        assertThat(jdbc.queryForObject("select updated_at>=created_at from hr_employee_basic_profiles where employee_id=?",
                Boolean.class, employeeId)).isTrue();
        assertThat(jdbc.queryForObject("select status_code from hr_recruit_finalists where id=?", String.class, finalistId))
                .isEqualTo("ready");
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

    @Test
    void permanentFollowUpClosesPreviousOnlyOnConfirmationAndPreservesItsHistory() {
        int employeeId = insertEmployee(17, "EMP-000017", LocalDate.of(2025, 1, 1));
        Map<String,Object> first = appointment(employeeId, "permanent", LocalDate.of(2026, 8, 1), null);
        int firstId = ((Number) first.get("id")).intValue(), firstOrderId = ((Number) first.get("order_id")).intValue();
        service.confirmAppointment(firstOrderId, 17);
        List<Map<String,Object>> originalHistory = jdbc.queryForList("select * from hr_personnel_histories where appointment_order_id=? order by id", firstOrderId);

        Map<String,Object> next = appointment(employeeId, "permanent", LocalDate.of(2026, 9, 1), null);
        int nextId = ((Number) next.get("id")).intValue(), nextOrderId = ((Number) next.get("order_id")).intValue();
        HrRequests.AppointmentRecordUpdate update = new HrRequests.AppointmentRecordUpdate();
        update.startDate = LocalDate.of(2026, 10, 1);
        update.effectiveDate = update.startDate;
        update.toPositionTitle = "Senior";
        service.updateAppointmentRecord(nextId, update);
        assertThat(jdbc.queryForObject("select end_date from hr_appointment_order_items where id=?", LocalDate.class, firstId)).isNull();

        assertThat(service.confirmAppointment(nextOrderId, 17)).containsEntry("applied_count", 1);
        assertThat(jdbc.queryForObject("select end_date from hr_appointment_order_items where id=?", LocalDate.class, firstId)).isEqualTo(LocalDate.of(2026, 9, 30));
        assertThat(jdbc.queryForMap("select start_date,end_date,apply_status from hr_appointment_order_items where id=?", nextId))
                .containsEntry("start_date", java.sql.Date.valueOf("2026-10-01")).containsEntry("end_date", null).containsEntry("apply_status", "applied");
        assertThat(jdbc.queryForObject("select position_title from hr_employees where id=?", String.class, employeeId)).isEqualTo("Senior");
        assertThat(jdbc.queryForList("select * from hr_personnel_histories where appointment_order_id=? and history_type<>'appointment_end' order by id", firstOrderId)).isEqualTo(originalHistory);
        assertThat(jdbc.queryForMap("select history_type,source_id,field_name,before_value,after_value,created_by from hr_personnel_histories where history_type='appointment_end'"))
                .containsEntry("source_id", firstId).containsEntry("field_name", "end_date").containsEntry("before_value", null)
                .containsEntry("after_value", "2026-09-30").containsEntry("created_by", 17);
        assertThat(jdbc.queryForList("select status from hr_appointment_orders order by id", String.class)).containsExactly("confirmed", "confirmed");
    }

    @Test
    void permanentFollowUpShortensAFiniteConfirmedPeriod() {
        int employeeId = insertEmployee(17, "EMP-000017", LocalDate.of(2025, 1, 1));
        Map<String,Object> first = appointment(employeeId, "permanent", LocalDate.of(2026, 8, 1), LocalDate.of(2026, 12, 31));
        service.confirmAppointment(((Number) first.get("order_id")).intValue(), 17);
        Map<String,Object> next = appointment(employeeId, "permanent", LocalDate.of(2026, 9, 1), null);

        service.confirmAppointment(((Number) next.get("order_id")).intValue(), 17);

        assertThat(jdbc.queryForObject("select end_date from hr_appointment_order_items where id=?", LocalDate.class, first.get("id"))).isEqualTo(LocalDate.of(2026, 8, 31));
        assertThat(jdbc.queryForMap("select before_value,after_value from hr_personnel_histories where history_type='appointment_end'"))
                .containsEntry("before_value", "2026-12-31").containsEntry("after_value", "2026-08-31");
    }

    @Test
    void sameDatePermanentOverlapIsRejectedOnCreationAndRecheckedOnConfirmation() {
        int employeeId = insertEmployee(17, "EMP-000017", LocalDate.of(2025, 1, 1));
        LocalDate start = LocalDate.of(2026, 8, 1);
        Map<String,Object> first = appointment(employeeId, "permanent", start, null);
        service.confirmAppointment(((Number) first.get("order_id")).intValue(), 17);
        ApiException createConflict = catchThrowableOfType(() -> appointment(employeeId, "permanent", start, null), ApiException.class);
        assertThat(createConflict.status().value()).isEqualTo(409);

        int staleOrder = jdbc.queryForObject("insert into hr_appointment_orders(appointment_no,title,effective_date,status,created_at,updated_at) values ('APT-STALE','Stale draft',?,'draft',now(),now()) returning id", Integer.class, start);
        jdbc.update("insert into hr_appointment_order_items(order_id,employee_id,appointment_kind,action_type,start_date,to_position_title,apply_status,created_at,updated_at) values (?,?,'permanent','transfer',?,'Wrong position','pending',now(),now())", staleOrder, employeeId, start);
        ApiException confirmConflict = catchThrowableOfType(() -> service.confirmAppointment(staleOrder, 17), ApiException.class);

        assertThat(confirmConflict.status().value()).isEqualTo(409);
        assertThat(jdbc.queryForObject("select status from hr_appointment_orders where id=?", String.class, staleOrder)).isEqualTo("draft");
        assertThat(jdbc.queryForObject("select position_title from hr_employees where id=?", String.class, employeeId)).isEqualTo("인사담당");
        assertThat(jdbc.queryForObject("select end_date from hr_appointment_order_items where id=?", LocalDate.class, first.get("id"))).isNull();
        assertThat(jdbc.queryForObject("select count(*) from hr_personnel_histories where appointment_order_id=?", Integer.class, staleOrder)).isZero();
    }

    @Test
    void draftAndTemporaryOverlapPoliciesArePreserved() {
        int employeeId = insertEmployee(17, "EMP-000017", LocalDate.of(2025, 1, 1));
        Map<String,Object> temporary = appointment(employeeId, "temporary", LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 10));
        ApiException draftConflict = catchThrowableOfType(() -> appointment(employeeId, "permanent", LocalDate.of(2026, 8, 5), null), ApiException.class);
        assertThat(draftConflict.status().value()).isEqualTo(409);
        service.confirmAppointment(((Number) temporary.get("order_id")).intValue(), 17);
        ApiException temporaryConflict = catchThrowableOfType(() -> appointment(employeeId, "permanent", LocalDate.of(2026, 8, 5), null), ApiException.class);
        assertThat(temporaryConflict.status().value()).isEqualTo(409);
        Map<String,Object> next = appointment(employeeId, "temporary", LocalDate.of(2026, 8, 11), LocalDate.of(2026, 8, 20));
        service.confirmAppointment(((Number) next.get("order_id")).intValue(), 17);
        assertThat(jdbc.queryForObject("select end_date from hr_appointment_order_items where id=?", LocalDate.class, temporary.get("id"))).isEqualTo(LocalDate.of(2026, 8, 10));
        assertThat(jdbc.queryForObject("select count(*) from hr_personnel_histories where history_type='appointment_end'", Integer.class)).isZero();

        Map<String,Object> permanent = appointment(employeeId, "permanent", LocalDate.of(2026, 9, 1), null);
        ApiException permanentDraftConflict = catchThrowableOfType(() -> appointment(employeeId, "permanent", LocalDate.of(2026, 10, 1), null), ApiException.class);
        assertThat(permanentDraftConflict.status().value()).isEqualTo(409);
        service.confirmAppointment(((Number) permanent.get("order_id")).intValue(), 17);
        ApiException overlap = catchThrowableOfType(() -> appointment(employeeId, "temporary", LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2)), ApiException.class);
        assertThat(overlap.status().value()).isEqualTo(409);
        assertThat(jdbc.queryForObject("select end_date from hr_appointment_order_items where id=?", LocalDate.class, permanent.get("id"))).isNull();
    }

    @Test
    void twoRetirementDraftsCannotBothConfirmAndCancellationRestoresOriginalStatus() {
        int employeeId = insertEmployee(17, "EMP-000017", LocalDate.of(2025, 1, 1));
        jdbc.update("update hr_employees set employment_status='leave' where id=?", employeeId);
        int first = retirementDraft(employeeId, LocalDate.of(2026, 8, 31));
        int second = retirementDraft(employeeId, LocalDate.of(2026, 9, 30));

        service.confirmRetireCase(first, 17);
        ApiException conflict = catchThrowableOfType(() -> service.confirmRetireCase(second, 17), ApiException.class);
        assertThat(conflict.status().value()).isEqualTo(409);
        assertThat(conflict.detail()).isEqualTo("Employee already has a confirmed retirement case.");
        assertThat(jdbc.queryForObject("select status from hr_retire_cases where id=?", String.class, second)).isEqualTo("draft");
        assertThat(jdbc.queryForObject("select count(*) from hr_retire_audit_logs where case_id=? and action_type='confirm'", Integer.class, second)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from hr_severance_calcs where retire_case_id=?", Integer.class, second)).isZero();

        HrRequests.RetireCancel cancel = new HrRequests.RetireCancel(); cancel.cancelReason = "Withdrawn";
        service.cancelRetireCase(first, cancel, 17);
        assertThat(jdbc.queryForObject("select employment_status from hr_employees where id=?", String.class, employeeId)).isEqualTo("leave");
        assertThat(jdbc.queryForObject("select retire_date from hr_employee_basic_profiles where employee_id=?", LocalDate.class, employeeId)).isNull();
        service.confirmRetireCase(second, 17);
        assertThat(jdbc.queryForObject("select previous_employment_status from hr_retire_cases where id=?", String.class, second)).isEqualTo("leave");
        assertThat(jdbc.queryForObject("select count(*) from hr_retire_cases where employee_id=? and status='confirmed'", Integer.class, employeeId)).isOne();
        assertThat(jdbc.queryForObject("select retire_date from hr_employee_basic_profiles where employee_id=?", LocalDate.class, employeeId)).isEqualTo(LocalDate.of(2026, 9, 30));
    }

    @Test
    void concurrentRetirementDraftConfirmationsSerializeOnEmployeeAndOnlyOneSucceeds() throws Exception {
        int employeeId = insertEmployee(17, "EMP-000017", LocalDate.of(2025, 1, 1));
        int firstCase = retirementDraft(employeeId, LocalDate.of(2026, 8, 31));
        int secondCase = retirementDraft(employeeId, LocalDate.of(2026, 9, 30));
        CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<String> first = executor.submit(() -> confirmRetirementAfter(firstCase, ready, start));
            Future<String> second = executor.submit(() -> confirmRetirementAfter(secondCase, ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder("confirmed", "Employee already has a confirmed retirement case.");
        }
        assertThat(jdbc.queryForObject("select count(*) from hr_retire_cases where employee_id=? and status='confirmed'", Integer.class, employeeId)).isOne();
        assertThat(jdbc.queryForObject("select count(*) from hr_retire_cases where employee_id=? and status='draft'", Integer.class, employeeId)).isOne();
        assertThat(jdbc.queryForObject("select count(*) from hr_severance_calcs where employee_id=?", Integer.class, employeeId)).isOne();
        assertThat(jdbc.queryForObject("select count(*) from hr_retire_audit_logs where action_type='confirm'", Integer.class)).isOne();
        assertThat(jdbc.queryForObject("select employment_status from hr_employees where id=?", String.class, employeeId)).isEqualTo("resigned");
    }

    @ParameterizedTest
    @CsvSource({ "active,true", "active,false", "leave,true", "leave,false" })
    void cancellingLegacyDuplicateRetirementsRestoresOriginalStatusInEitherOrder(String originalStatus, boolean cancelEarlierFirst) {
        int employeeId = insertEmployee(17, "EMP-000017", LocalDate.of(2025, 1, 1));
        jdbc.update("update hr_employees set employment_status=? where id=?", originalStatus, employeeId);
        int first = retirementDraft(employeeId, LocalDate.of(2026, 8, 31));
        int second = retirementDraft(employeeId, LocalDate.of(2026, 9, 30));
        service.confirmRetireCase(first, 17);
        jdbc.update("update hr_retire_cases set status='confirmed',previous_employment_status='resigned',confirmed_at=now(),confirmed_by=17 where id=?", second);
        jdbc.update("update hr_employee_basic_profiles set retire_date=date '2026-09-30' where employee_id=?", employeeId);
        HrRequests.RetireCancel cancel = new HrRequests.RetireCancel(); cancel.cancelReason = "Duplicate case";
        int cancelledFirst = cancelEarlierFirst ? first : second, cancelledLast = cancelEarlierFirst ? second : first;
        LocalDate remainingDate = cancelEarlierFirst ? LocalDate.of(2026, 9, 30) : LocalDate.of(2026, 8, 31);

        service.cancelRetireCase(cancelledFirst, cancel, 17);

        assertThat(jdbc.queryForObject("select employment_status from hr_employees where id=?", String.class, employeeId)).isEqualTo("resigned");
        assertThat(jdbc.queryForObject("select retire_date from hr_employee_basic_profiles where employee_id=?", LocalDate.class, employeeId)).isEqualTo(remainingDate);
        assertThat(jdbc.queryForObject("select status from hr_retire_cases where id=?", String.class, cancelledLast)).isEqualTo("confirmed");
        assertThat(jdbc.queryForObject("select detail from hr_retire_audit_logs where case_id=? and action_type='cancel'", String.class, cancelledFirst)).isEqualTo("employment_status:resigned->resigned");
        assertThat(jdbc.queryForMap("select before_value,after_value from hr_personnel_histories where source_table='hr_retire_cases' and source_id=? and history_type='retire_cancel'", cancelledFirst))
                .containsEntry("before_value", "resigned").containsEntry("after_value", "resigned");
        service.cancelRetireCase(cancelledLast, cancel, 17);
        assertThat(jdbc.queryForObject("select count(*) from hr_retire_cases where employee_id=? and status='confirmed'", Integer.class, employeeId)).isZero();
        assertThat(jdbc.queryForObject("select employment_status from hr_employees where id=?", String.class, employeeId)).isEqualTo(originalStatus);
        assertThat(jdbc.queryForObject("select retire_date from hr_employee_basic_profiles where employee_id=?", LocalDate.class, employeeId)).isNull();
        assertThat(jdbc.queryForObject("select detail from hr_retire_audit_logs where case_id=? and action_type='cancel'", String.class, cancelledLast)).isEqualTo("employment_status:resigned->" + originalStatus);
        assertThat(jdbc.queryForMap("select before_value,after_value from hr_personnel_histories where source_table='hr_retire_cases' and source_id=? and history_type='retire_cancel'", cancelledLast))
                .containsEntry("before_value", "resigned").containsEntry("after_value", originalStatus);
    }

    @Test
    void lastLegacyRetirementCancellationFollowsOverlappingCasesBackToOriginalLeaveStatus() {
        int employeeId = insertEmployee(17, "EMP-000017", LocalDate.of(2025, 1, 1));
        jdbc.update("update hr_employees set employment_status='leave' where id=?", employeeId);
        int first = retirementDraft(employeeId, LocalDate.of(2026, 8, 31));
        int second = retirementDraft(employeeId, LocalDate.of(2026, 9, 30));
        int third = retirementDraft(employeeId, LocalDate.of(2026, 10, 31));
        service.confirmRetireCase(first, 17);
        jdbc.update("update hr_retire_cases set status='cancelled',confirmed_at=timestamp '2026-08-01 09:00:00',cancelled_at=timestamp '2026-08-03 09:00:00' where id=?", first);
        jdbc.update("update hr_retire_cases set status='cancelled',previous_employment_status='resigned',confirmed_at=timestamp '2026-08-02 09:00:00',cancelled_at=timestamp '2026-08-05 09:00:00' where id=?", second);
        jdbc.update("update hr_retire_cases set status='confirmed',previous_employment_status='resigned',confirmed_at=timestamp '2026-08-04 09:00:00',confirmed_by=17 where id=?", third);
        List<Map<String,Object>> previousCases = jdbc.queryForList("select * from hr_retire_cases where id in (?,?) order by id", first, second);
        HrRequests.RetireCancel cancel = new HrRequests.RetireCancel(); cancel.cancelReason = "Last duplicate";

        service.cancelRetireCase(third, cancel, 17);

        assertThat(jdbc.queryForObject("select employment_status from hr_employees where id=?", String.class, employeeId)).isEqualTo("leave");
        assertThat(jdbc.queryForObject("select retire_date from hr_employee_basic_profiles where employee_id=?", LocalDate.class, employeeId)).isNull();
        assertThat(jdbc.queryForList("select * from hr_retire_cases where id in (?,?) order by id", first, second)).isEqualTo(previousCases);
        assertThat(jdbc.queryForObject("select detail from hr_retire_audit_logs where case_id=? and action_type='cancel'", String.class, third)).isEqualTo("employment_status:resigned->leave");
    }

    @Test
    void previousUnrelatedRetirementDoesNotReplaceAnUnknownResignedBaseline() {
        int employeeId = insertEmployee(17, "EMP-000017", LocalDate.of(2025, 1, 1));
        int previous = retirementDraft(employeeId, LocalDate.of(2026, 7, 31));
        int current = retirementDraft(employeeId, LocalDate.of(2026, 8, 31));
        service.confirmRetireCase(previous, 17);
        jdbc.update("update hr_retire_cases set status='cancelled',previous_employment_status='leave',confirmed_at=timestamp '2026-07-01 09:00:00',cancelled_at=timestamp '2026-07-02 09:00:00' where id=?", previous);
        jdbc.update("update hr_retire_cases set status='confirmed',previous_employment_status='resigned',confirmed_at=timestamp '2026-08-01 09:00:00',confirmed_by=17 where id=?", current);
        HrRequests.RetireCancel cancel = new HrRequests.RetireCancel(); cancel.cancelReason = "Unrelated cycle";

        service.cancelRetireCase(current, cancel, 17);

        assertThat(jdbc.queryForObject("select employment_status from hr_employees where id=?", String.class, employeeId)).isEqualTo("resigned");
        assertThat(jdbc.queryForObject("select detail from hr_retire_audit_logs where case_id=? and action_type='cancel'", String.class, current)).isEqualTo("employment_status:resigned->resigned");
    }

    @Test
    void concurrentLegacyRetirementCancellationsRestoreOriginalLeaveWithoutCrossCaseWrites() throws Exception {
        int employeeId = insertEmployee(17, "EMP-000017", LocalDate.of(2025, 1, 1));
        jdbc.update("update hr_employees set employment_status='leave' where id=?", employeeId);
        int firstCase = retirementDraft(employeeId, LocalDate.of(2026, 8, 31));
        int secondCase = retirementDraft(employeeId, LocalDate.of(2026, 9, 30));
        service.confirmRetireCase(firstCase, 17);
        jdbc.update("update hr_retire_cases set status='confirmed',previous_employment_status='resigned',confirmed_at=now(),confirmed_by=17 where id=?", secondCase);
        CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<Map<String,Object>> first = executor.submit(() -> cancelRetirementAfter(firstCase, ready, start));
            Future<Map<String,Object>> second = executor.submit(() -> cancelRetirementAfter(secondCase, ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(first.get(30, TimeUnit.SECONDS)).containsEntry("status", "cancelled");
            assertThat(second.get(30, TimeUnit.SECONDS)).containsEntry("status", "cancelled");
        }
        assertThat(jdbc.queryForObject("select count(*) from hr_retire_cases where employee_id=? and status='confirmed'", Integer.class, employeeId)).isZero();
        assertThat(jdbc.queryForObject("select employment_status from hr_employees where id=?", String.class, employeeId)).isEqualTo("leave");
        assertThat(jdbc.queryForObject("select retire_date from hr_employee_basic_profiles where employee_id=?", LocalDate.class, employeeId)).isNull();
        assertThat(jdbc.queryForList("select previous_employment_status from hr_retire_cases where employee_id=? order by id", String.class, employeeId)).containsExactly("leave", "resigned");
        assertThat(jdbc.queryForObject("select count(*) from hr_retire_audit_logs where action_type='cancel'", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from hr_personnel_histories where history_type='retire_cancel' and after_value='leave'", Integer.class)).isOne();
    }

    @Test
    void retirementConfirmationRechecksResignedStatusAfterDraftWasCreated() {
        int employeeId = insertEmployee(17, "EMP-000017", LocalDate.of(2025, 1, 1));
        int caseId = retirementDraft(employeeId, LocalDate.of(2026, 8, 31));
        jdbc.update("update hr_employees set employment_status='resigned' where id=?", employeeId);

        ApiException conflict = catchThrowableOfType(() -> service.confirmRetireCase(caseId, 17), ApiException.class);

        assertThat(conflict.status().value()).isEqualTo(409);
        assertThat(conflict.detail()).isEqualTo("Employee is already resigned.");
        assertThat(jdbc.queryForObject("select status from hr_retire_cases where id=?", String.class, caseId)).isEqualTo("draft");
        assertThat(jdbc.queryForObject("select count(*) from hr_severance_calcs where retire_case_id=?", Integer.class, caseId)).isZero();
    }

    private Map<String,Object> appointment(int employeeId, String kind, LocalDate start, LocalDate end) {
        HrRequests.AppointmentRecordCreate payload = new HrRequests.AppointmentRecordCreate();
        payload.employeeId = employeeId; payload.orderTitle = "Appointment"; payload.effectiveDate = start;
        payload.appointmentKind = kind; payload.actionType = "transfer"; payload.startDate = start; payload.endDate = end;
        return castMap(service.createAppointmentRecord(payload, 17).get("item"));
    }

    private int retirementDraft(int employeeId, LocalDate date) {
        if (jdbc.queryForObject("select count(*) from hr_retire_checklist_items", Integer.class) == 0)
            jdbc.update("insert into hr_retire_checklist_items(code,title,is_required,is_active,sort_order,created_at,updated_at) values ('handover','Handover',true,true,1,now(),now())");
        HrRequests.RetireCaseCreate payload = new HrRequests.RetireCaseCreate();
        payload.employeeId = employeeId; payload.retireDate = date; payload.reason = "Personal";
        int caseId = ((Number) service.createRetireCase(payload, 17).get("id")).intValue();
        int itemId = jdbc.queryForObject("select id from hr_retire_case_items where case_id=?", Integer.class, caseId);
        HrRequests.RetireItemUpdate check = new HrRequests.RetireItemUpdate(); check.isChecked = true;
        service.updateRetireItem(caseId, itemId, check, 17);
        return caseId;
    }

    private String confirmRetirementAfter(int caseId, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Retirement confirmation start timed out.");
        try { service.confirmRetireCase(caseId, 17); return "confirmed"; }
        catch (ApiException exception) { return String.valueOf(exception.detail()); }
    }

    private Map<String,Object> cancelRetirementAfter(int caseId, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Retirement cancellation start timed out.");
        HrRequests.RetireCancel cancel = new HrRequests.RetireCancel(); cancel.cancelReason = "Concurrent duplicate cancellation";
        return service.cancelRetireCase(caseId, cancel, 17);
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
