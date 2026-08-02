package com.vibehr.hri;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vibehr.platform.error.ApiException;
import com.vibehr.welfare.HriWelfareProjection;
import com.vibehr.welfare.WelfareApplicationService;
import jakarta.persistence.EntityManager;
import java.sql.DriverManager;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

@Tag("integration")
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(classes = HriWelfarePostgreSqlIntegrationTest.TestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.flyway.enabled=false",
                "spring.jpa.hibernate.ddl-auto=validate",
                "spring.jpa.open-in-view=false",
                "spring.jpa.properties.hibernate.jdbc.time_zone=UTC"
        })
class HriWelfarePostgreSqlIntegrationTest {
    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
            .withDatabaseName("vibehr_hri_welfare_test").withUsername("vibehr").withPassword("vibehr");

    @Autowired private JdbcTemplate jdbc;
    @Autowired private HriApplicationService hri;
    @Autowired private WelfareApplicationService welfare;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) throws Exception {
        POSTGRES.start();
        provisionSchema();
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }

    @BeforeEach
    void cleanAndSeed() {
        jdbc.execute("""
                truncate table hri_request_step_snapshots, hri_request_histories, hri_request_attachments,
                  hri_req_tim_attendance, hri_req_tim_correction, hri_req_cert_employment, hri_req_leave,
                  wel_benefit_requests, hri_request_masters, hri_request_counters, hri_form_type_approval_maps,
                  hri_form_type_policies, hri_approval_line_steps, hri_form_types, hri_approval_line_templates,
                  hri_approval_actor_rules, wel_benefit_types, auth_user_roles, auth_roles, hr_employees,
                  org_departments, auth_users restart identity cascade
                """);
        jdbc.update("insert into auth_users(id, login_id, display_name, is_active) values (1,'employee','홍길동',true),(2,'approver','김결재',true),(3,'delegate','이대리',true)");
        jdbc.update("insert into org_departments(id, name) values (10,'인사팀')");
        jdbc.update("insert into hr_employees(id,user_id,employee_no,department_id,position_title,employment_status) values (101,1,'E001',10,'사원','active'),(102,2,'E002',10,'팀장','active'),(103,3,'E003',10,'대리','active')");
        jdbc.update("insert into wel_benefit_types(code,name,module_path,is_deduction,pay_item_code,is_active,sort_order,created_at,updated_at) values ('MEDICAL','의료비','/wel/medical',false,null,true,1,current_timestamp,current_timestamp)");
        jdbc.update("insert into hri_form_types(id,form_code,form_name_ko,form_name_en,module_code,is_active,allow_draft,allow_withdraw,requires_receive,default_priority,created_by,updated_by,created_at,updated_at) values (11,'WEL_BENEFIT_REQUEST','복리후생 신청','Benefit request','WEL',true,true,true,false,10,1,1,current_timestamp,current_timestamp)");
        jdbc.update("insert into hri_approval_line_templates(id,template_code,template_name,scope_type,scope_id,is_default,is_active,priority,created_at,updated_at) values (21,'WEL_APPROVAL','복리후생 승인','GLOBAL',null,true,true,100,current_timestamp,current_timestamp)");
        jdbc.update("insert into hri_approval_line_steps(template_id,step_order,step_type,actor_resolve_type,actor_role_code,actor_user_id,allow_delegate,required_action,created_at,updated_at) values (21,1,'APPROVAL','USER_FIXED',null,2,true,'APPROVE',current_timestamp,current_timestamp)");
        jdbc.update("insert into hri_form_type_approval_maps(form_type_id,template_id,is_active,effective_from,effective_to,created_at,updated_at) values (11,21,true,date '2020-01-01',null,current_timestamp,current_timestamp)");
        jdbc.update("insert into hri_form_type_policies(form_type_id,policy_key,policy_value,effective_from,effective_to,created_at,updated_at) values (11,'attachment_required','false',date '2020-01-01',null,current_timestamp,current_timestamp),(11,'max_attachment_count','5',date '2020-01-01',null,current_timestamp,current_timestamp),(11,'benefit_type_required','true',date '2020-01-01',null,current_timestamp,current_timestamp),(11,'require_reason','true',date '2020-01-01',null,current_timestamp,current_timestamp)");
    }

    @Test
    void schemaContainsTheLegacyConstraintsAndIndexesAndRejectsInvalidRows() {
        assertThat(AopUtils.isAopProxy(hri)).isTrue();
        assertThat(AopUtils.isAopProxy(welfare)).isTrue();

        Set<String> constraints = Set.copyOf(jdbc.queryForList("""
                select conname from pg_constraint where conrelid::regclass::text like 'hri_%'
                   or conrelid::regclass::text like 'wel_%'
                """, String.class));
        assertThat(constraints).contains(
                "uq_hri_approval_actor_rules_role_code", "ck_hri_approval_actor_rules_fallback_rule",
                "ck_hri_approval_actor_rules_resolve_method", "uq_hri_approval_line_templates_code",
                "ck_hri_approval_line_templates_scope_type", "uq_hri_approval_line_steps_order",
                "ck_hri_approval_line_steps_actor_resolve_type", "ck_hri_approval_line_steps_required_action",
                "ck_hri_approval_line_steps_step_type", "uq_hri_form_types_form_code",
                "uq_hri_form_type_approval_maps_link", "uq_hri_form_type_policies_key_period",
                "uq_hri_request_masters_request_no", "ck_hri_request_masters_status_code",
                "uq_hri_request_step_snapshots_request_step", "ck_hri_request_step_snapshots_action_status",
                "ck_hri_request_step_snapshots_step_type", "uq_hri_req_tim_attendance_request_id",
                "uq_hri_req_tim_correction_request_id", "uq_hri_req_cert_employment_request_id",
                "uq_hri_req_leave_request_id", "uq_wel_benefit_types_code",
                "uq_wel_benefit_types_module_path", "uq_wel_benefit_requests_request_no");

        Set<String> indexes = Set.copyOf(jdbc.queryForList("""
                select indexname from pg_indexes where schemaname = 'public'
                  and (tablename like 'hri_%' or tablename like 'wel_%')
                """, String.class));
        assertThat(indexes).contains(
                "ix_hri_approval_actor_rules_role_code", "ix_hri_approval_line_templates_scope_id",
                "ix_hri_approval_line_templates_template_code", "ix_hri_approval_line_steps_template_id",
                "ix_hri_form_types_form_code", "ix_hri_form_type_approval_maps_form_type_id",
                "ix_hri_form_type_approval_maps_template_id", "ix_hri_form_type_policies_form_type_id",
                "ix_hri_request_masters_form_type_id", "ix_hri_request_masters_request_no",
                "ix_hri_request_masters_requester_created_at", "ix_hri_request_masters_requester_id",
                "ix_hri_request_masters_status_created_at", "ix_hri_request_step_snapshots_actor_status",
                "ix_hri_request_step_snapshots_actor_user_id", "ix_hri_request_step_snapshots_request_id",
                "ix_hri_request_histories_actor_created_at", "ix_hri_request_histories_event_type",
                "ix_hri_request_histories_request_created_at", "ix_hri_request_histories_request_id",
                "ix_hri_request_attachments_request_id", "ix_hri_request_attachments_request_uploaded_at",
                "ix_hri_req_tim_attendance_dates", "ix_hri_req_tim_attendance_request_id",
                "ix_hri_req_tim_correction_request_id", "ix_hri_req_tim_correction_work_date",
                "ix_hri_req_cert_employment_request_id", "ix_hri_req_leave_dates", "ix_hri_req_leave_request_id",
                "ix_wel_benefit_types_code", "ix_wel_benefit_requests_benefit_type_code",
                "ix_wel_benefit_requests_employee_id", "ix_wel_benefit_requests_employee_no",
                "ix_wel_benefit_requests_request_no", "ix_wel_benefit_requests_status_code");

        assertThatThrownBy(() -> jdbc.update("insert into hri_form_types(form_code,form_name_ko,module_code,is_active,allow_draft,allow_withdraw,requires_receive,default_priority,created_at,updated_at) values ('WEL_BENEFIT_REQUEST','duplicate','WEL',true,true,true,false,1,current_timestamp,current_timestamp)"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("insert into hri_request_masters(request_no,form_type_id,requester_id,title,content_json,status_code,created_at,updated_at) values ('BAD-FK',999,1,'bad','{}','DRAFT',current_timestamp,current_timestamp)"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("insert into hri_request_masters(request_no,form_type_id,requester_id,title,content_json,status_code,created_at,updated_at) values ('BAD-CHECK',11,1,'bad','{}','INVALID',current_timestamp,current_timestamp)"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("insert into wel_benefit_types(code,name,module_path,is_deduction,is_active,sort_order,created_at,updated_at) values (repeat('X',41),'too long','/too-long',false,true,1,current_timestamp,current_timestamp)"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("insert into wel_benefit_requests(request_no,benefit_type_code,benefit_type_name,employee_no,employee_name,department_name,status_code,requested_amount,requested_at,created_at,updated_at) values ('NULL-TEST','MEDICAL','의료비',null,'name','dept','draft',1,current_timestamp,current_timestamp,current_timestamp)"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void hriWelfareProjectionIsIdempotentVisibleToTheEmployeeAndDirectActorOnly() {
        HriRequestItem draft = hri.saveDraft(1, draftCommand(null, 120_000));
        assertThat(jdbc.queryForObject("select employee_id from wel_benefit_requests where request_no = ?", Integer.class,
                draft.requestNo())).isEqualTo(101);
        Object myRequests = welfare.myRequests(1);
        assertThat(myRequests).hasFieldOrPropertyWithValue("totalCount", 1);

        HriRequestItem updated = hri.saveDraft(1, draftCommand(draft.id(), 180_000));
        assertThat(updated.id()).isEqualTo(draft.id());
        assertThat(jdbc.queryForObject("select count(*) from wel_benefit_requests where request_no = ?", Integer.class,
                draft.requestNo())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select requested_amount from wel_benefit_requests where request_no = ?", Integer.class,
                draft.requestNo())).isEqualTo(180_000);

        HriRequestSubmitResponse submitted = hri.submit(1, draft.id());
        assertThat(submitted.statusCode()).isEqualTo("APPROVAL_IN_PROGRESS");
        assertThatThrownBy(() -> hri.approve(3, draft.id(), "delegate attempt"))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.status().value()).isEqualTo(403);
                    assertThat(error.detail()).isEqualTo("No actionable task for current user.");
                });
        assertThat(hri.approve(2, draft.id(), "ok").statusCode()).isEqualTo("COMPLETED");
        assertThat(jdbc.queryForMap("select employee_id,status_code,requested_amount from wel_benefit_requests where request_no = ?",
                draft.requestNo())).containsEntry("employee_id", 101).containsEntry("status_code", "payroll_reflected")
                .containsEntry("requested_amount", 180_000);
    }

    @Test
    void requiresReceiveMismatchAndExactKoreanWelfareConflictAreEnforced() {
        jdbc.update("update hri_form_types set requires_receive=true where id=11");
        HriRequestItem draft = hri.saveDraft(1, draftCommand(null, 90_000));
        assertThatThrownBy(() -> hri.submit(1, draft.id()))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.status().value()).isEqualTo(400);
                    assertThat(error.detail()).isEqualTo("This form type requires a RECEIVE step in its approval template.");
                });

        jdbc.update("insert into wel_benefit_requests(request_no,benefit_type_code,benefit_type_name,employee_id,employee_no,employee_name,department_name,status_code,requested_amount,requested_at,created_at,updated_at) values ('WEL-KO-1','MEDICAL','의료비',101,'E001','홍길동','인사팀','approved',1,current_timestamp,current_timestamp,current_timestamp)");
        int id = jdbc.queryForObject("select id from wel_benefit_requests where request_no='WEL-KO-1'", Integer.class);
        assertThatThrownBy(() -> welfare.approve(id, null))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.status().value()).isEqualTo(409);
                    assertThat(error.detail()).isEqualTo("승인 대기(submitted) 상태가 아닙니다. 현재 상태: approved");
                });
    }

    @Test
    void typedDetailsAttachmentPolicyAndResubmissionLineageUseRealTransactions() {
        jdbc.update("insert into hri_form_types(id,form_code,form_name_ko,module_code,is_active,allow_draft,allow_withdraw,requires_receive,default_priority,created_by,updated_by,created_at,updated_at) values (12,'TIM_CORRECTION','근태 정정','TIM',true,true,true,false,20,1,1,current_timestamp,current_timestamp)");
        jdbc.update("insert into hri_form_type_approval_maps(form_type_id,template_id,is_active,effective_from,effective_to,created_at,updated_at) values (12,21,true,date '2020-01-01',null,current_timestamp,current_timestamp)");
        jdbc.update("insert into hri_form_type_policies(form_type_id,policy_key,policy_value,effective_from,effective_to,created_at,updated_at) values (12,'attachment_required','true',date '2020-01-01',null,current_timestamp,current_timestamp),(12,'max_attachment_count','2',date '2020-01-01',null,current_timestamp,current_timestamp)");
        HriRequestDraftUpsertRequest command = new HriRequestDraftUpsertRequest(null, 12, "근태 정정", Map.of(
                "work_date", "2026-07-31", "before_status", "absent", "after_status", "present", "reason", "출입 기록 확인"));
        HriRequestItem draft = hri.saveDraft(1, command);
        assertThat(jdbc.queryForMap("select work_date,before_status,after_status from hri_req_tim_correction where request_id=?", draft.id()))
                .containsEntry("before_status", "absent").containsEntry("after_status", "present");
        assertThat(hri.detail(1, draft.id()).detailData()).containsEntry("work_date", "2026-07-31");

        assertThatThrownBy(() -> hri.submit(1, draft.id()))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.status().value()).isEqualTo(422);
                    assertThat(error.detail().toString()).contains("At least one attachment is required");
                });
        jdbc.update("insert into hri_request_attachments(request_id,file_key,file_name,file_size,mime_type,uploaded_by,uploaded_at) values (?,'hri/test','evidence.pdf',120,'application/pdf',1,current_timestamp)", draft.id());
        hri.submit(1, draft.id());
        assertThat(hri.reject(2, draft.id(), "보완 필요").statusCode()).isEqualTo("APPROVAL_REJECTED");
        hri.saveDraft(1, new HriRequestDraftUpsertRequest(draft.id(), 12, "근태 정정 재신청", Map.of(
                "work_date", "2026-07-31", "before_status", "absent", "after_status", "late", "reason", "보완 완료")));
        hri.submit(1, draft.id());

        String payload = jdbc.queryForObject("select event_payload_json from hri_request_histories where request_id=? and event_type='SUBMIT' order by id desc limit 1",
                String.class, draft.id());
        assertThat(payload).contains("prior_steps", "REJECTED", "보완 필요");
        assertThat(jdbc.queryForObject("select count(*) from hri_request_step_snapshots where request_id=?", Integer.class,
                draft.id())).isEqualTo(1);
        assertThat(hri.detail(1, draft.id()).detailData()).containsEntry("after_status", "late");
    }

    @Test
    void matchingRequiresReceiveTemplateTransitionsThroughBothPhases() {
        jdbc.update("update hri_form_types set requires_receive=true where id=11");
        jdbc.update("insert into hri_approval_line_steps(template_id,step_order,step_type,actor_resolve_type,actor_user_id,allow_delegate,required_action,created_at,updated_at) values (21,2,'RECEIVE','USER_FIXED',3,false,'RECEIVE',current_timestamp,current_timestamp)");
        HriRequestItem draft = hri.saveDraft(1, draftCommand(null, 70_000));

        assertThat(hri.submit(1, draft.id()).statusCode()).isEqualTo("APPROVAL_IN_PROGRESS");
        assertThat(hri.approve(2, draft.id(), null).statusCode()).isEqualTo("RECEIVE_IN_PROGRESS");
        assertThat(hri.receiveComplete(3, draft.id(), "접수 완료").statusCode()).isEqualTo("COMPLETED");
    }

    @Test
    void concurrentTransactionsSerializeRequestNumbersAndNaturalKeyProjection() throws Exception {
        try (var executor = Executors.newFixedThreadPool(2)) {
            CountDownLatch start = new CountDownLatch(1);
            var first = executor.submit(() -> { start.await(); return hri.saveDraft(1, draftCommand(null, 10_000)); });
            var second = executor.submit(() -> { start.await(); return hri.saveDraft(1, draftCommand(null, 20_000)); });
            start.countDown();
            assertThat(Set.of(first.get(20, TimeUnit.SECONDS).requestNo(), second.get(20, TimeUnit.SECONDS).requestNo())).hasSize(2);
        }
        assertThat(jdbc.queryForObject("select count(*) from hri_request_masters", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from wel_benefit_requests", Integer.class)).isEqualTo(2);

        HriWelfareProjection projection = new HriWelfareProjection("HRI-IDEMPOTENT-1", "DRAFT", "MEDICAL", "의료비",
                50_000, "동시성", null, null, Instant.now(), Instant.now(), 101, "E001", "홍길동", "인사팀");
        try (var executor = Executors.newFixedThreadPool(2)) {
            CountDownLatch start = new CountDownLatch(1);
            var first = executor.submit(() -> { start.await(); welfare.syncFromHri(projection); return null; });
            var second = executor.submit(() -> { start.await(); welfare.syncFromHri(projection); return null; });
            start.countDown();
            first.get(20, TimeUnit.SECONDS);
            second.get(20, TimeUnit.SECONDS);
        }
        assertThat(jdbc.queryForObject("select count(*) from wel_benefit_requests where request_no='HRI-IDEMPOTENT-1'", Integer.class)).isEqualTo(1);
    }

    private HriRequestDraftUpsertRequest draftCommand(Integer requestId, int amount) {
        return new HriRequestDraftUpsertRequest(requestId, 11, "의료비 신청", Map.of(
                "benefit_type_code", "MEDICAL", "benefit_type_name", "의료비",
                "requested_amount", amount, "description", "검진", "reason", "정기 검진"));
    }

    private static void provisionSchema() throws Exception {
        try (var connection = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var statement = connection.createStatement()) {
            for (String ddl : SCHEMA.split(";")) if (!ddl.isBlank()) statement.execute(ddl);
        }
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EnableTransactionManagement
    @EntityScan(basePackages = {"com.vibehr.hri", "com.vibehr.welfare"})
    static class TestApplication {
        @Bean WelfareApplicationService welfareApplicationService(EntityManager entityManager) {
            return new WelfareApplicationService(entityManager);
        }

        @Bean HriApplicationService hriApplicationService(EntityManager entityManager, ObjectMapper objectMapper,
                WelfareApplicationService welfareApplicationService, ObjectProvider<HriRequestProjectionMapper> mapper) {
            return new HriApplicationService(entityManager, objectMapper, welfareApplicationService, mapper);
        }
    }

    private static final String SCHEMA = """
            create table auth_users (id integer primary key, login_id varchar(120) not null unique, display_name varchar(100), is_active boolean not null);
            create table auth_roles (id integer primary key, code varchar(50) not null unique);
            create table auth_user_roles (user_id integer not null references auth_users(id), role_id integer not null references auth_roles(id), primary key(user_id,role_id));
            create table org_departments (id integer primary key, parent_id integer references org_departments(id), name varchar(120) not null);
            create table hr_employees (id integer primary key, user_id integer not null unique references auth_users(id), employee_no varchar(40) not null unique, department_id integer references org_departments(id), position_title varchar(120), employment_status varchar(20) not null);
            create table hri_approval_actor_rules (id integer generated by default as identity primary key, role_code varchar(30) not null, resolve_method varchar(30) not null, fallback_rule varchar(30) not null, position_keywords_json varchar, is_active boolean not null, created_at timestamp not null, updated_at timestamp not null, constraint ck_hri_approval_actor_rules_fallback_rule check (fallback_rule in ('ESCALATE','SKIP','HR_ADMIN')), constraint ck_hri_approval_actor_rules_resolve_method check (resolve_method in ('ORG_CHAIN','JOB_POSITION','FIXED_USER')), constraint uq_hri_approval_actor_rules_role_code unique(role_code));
            create index ix_hri_approval_actor_rules_role_code on hri_approval_actor_rules(role_code);
            create table hri_approval_line_templates (id integer generated by default as identity primary key, template_code varchar(30) not null, template_name varchar(100) not null, scope_type varchar(20) not null, scope_id varchar(40), is_default boolean not null, is_active boolean not null, priority integer not null, created_at timestamp not null, updated_at timestamp not null, constraint ck_hri_approval_line_templates_scope_type check (scope_type in ('GLOBAL','COMPANY','DEPT','TEAM','USER')), constraint uq_hri_approval_line_templates_code unique(template_code));
            create index ix_hri_approval_line_templates_scope_id on hri_approval_line_templates(scope_id);
            create index ix_hri_approval_line_templates_template_code on hri_approval_line_templates(template_code);
            create table hri_request_counters (counter_key varchar(80) primary key, last_seq integer not null, updated_at timestamp not null);
            create table hri_approval_line_steps (id integer generated by default as identity primary key, template_id integer not null references hri_approval_line_templates(id), step_order integer not null, step_type varchar(20) not null, actor_resolve_type varchar(30) not null, actor_role_code varchar(30), actor_user_id integer references auth_users(id), allow_delegate boolean not null, required_action varchar(20) not null, created_at timestamp not null, updated_at timestamp not null, constraint ck_hri_approval_line_steps_actor_resolve_type check (actor_resolve_type in ('ROLE_BASED','USER_FIXED')), constraint ck_hri_approval_line_steps_required_action check (required_action in ('APPROVE','RECEIVE')), constraint ck_hri_approval_line_steps_step_type check (step_type in ('APPROVAL','RECEIVE','REFERENCE')), constraint uq_hri_approval_line_steps_order unique(template_id,step_order));
            create index ix_hri_approval_line_steps_template_id on hri_approval_line_steps(template_id);
            create table hri_form_types (id integer generated by default as identity primary key, form_code varchar(30) not null, form_name_ko varchar(100) not null, form_name_en varchar(100), module_code varchar(30) not null, is_active boolean not null, allow_draft boolean not null, allow_withdraw boolean not null, requires_receive boolean not null, default_priority integer not null, created_by integer references auth_users(id), updated_by integer references auth_users(id), created_at timestamp not null, updated_at timestamp not null, constraint uq_hri_form_types_form_code unique(form_code));
            create index ix_hri_form_types_form_code on hri_form_types(form_code);
            create table hri_form_type_approval_maps (id integer generated by default as identity primary key, form_type_id integer not null references hri_form_types(id), template_id integer not null references hri_approval_line_templates(id), is_active boolean not null, effective_from date not null, effective_to date, created_at timestamp not null, updated_at timestamp not null, constraint uq_hri_form_type_approval_maps_link unique(form_type_id,template_id,effective_from));
            create index ix_hri_form_type_approval_maps_form_type_id on hri_form_type_approval_maps(form_type_id);
            create index ix_hri_form_type_approval_maps_template_id on hri_form_type_approval_maps(template_id);
            create table hri_form_type_policies (id integer generated by default as identity primary key, form_type_id integer not null references hri_form_types(id), policy_key varchar(50) not null, policy_value varchar(500) not null, effective_from date not null, effective_to date, created_at timestamp not null, updated_at timestamp not null, constraint uq_hri_form_type_policies_key_period unique(form_type_id,policy_key,effective_from));
            create index ix_hri_form_type_policies_form_type_id on hri_form_type_policies(form_type_id);
            create table hri_request_masters (id integer generated by default as identity primary key, request_no varchar(40) not null, form_type_id integer not null references hri_form_types(id), requester_id integer not null references auth_users(id), requester_org_id integer references org_departments(id), title varchar(200) not null, content_json varchar not null, status_code varchar(30) not null, current_step_order integer, submitted_at timestamp, completed_at timestamp, created_at timestamp not null, updated_at timestamp not null, constraint ck_hri_request_masters_status_code check (status_code in ('DRAFT','APPROVAL_IN_PROGRESS','APPROVAL_REJECTED','RECEIVE_IN_PROGRESS','RECEIVE_REJECTED','COMPLETED','WITHDRAWN')), constraint uq_hri_request_masters_request_no unique(request_no));
            create index ix_hri_request_masters_form_type_id on hri_request_masters(form_type_id);
            create index ix_hri_request_masters_request_no on hri_request_masters(request_no);
            create index ix_hri_request_masters_requester_created_at on hri_request_masters(requester_id,created_at);
            create index ix_hri_request_masters_requester_id on hri_request_masters(requester_id);
            create index ix_hri_request_masters_status_created_at on hri_request_masters(status_code,created_at);
            create table hri_request_step_snapshots (id integer generated by default as identity primary key, request_id integer not null references hri_request_masters(id), step_order integer not null, step_type varchar(20) not null, actor_user_id integer not null references auth_users(id), actor_name varchar(100) not null, actor_org_id integer references org_departments(id), actor_role_code varchar(30), action_status varchar(20) not null, acted_at timestamp, comment varchar(1000), created_at timestamp not null, updated_at timestamp not null, constraint ck_hri_request_step_snapshots_action_status check (action_status in ('WAITING','APPROVED','REJECTED','RECEIVED')), constraint ck_hri_request_step_snapshots_step_type check (step_type in ('APPROVAL','RECEIVE','REFERENCE')), constraint uq_hri_request_step_snapshots_request_step unique(request_id,step_order));
            create index ix_hri_request_step_snapshots_actor_status on hri_request_step_snapshots(actor_user_id,action_status);
            create index ix_hri_request_step_snapshots_actor_user_id on hri_request_step_snapshots(actor_user_id);
            create index ix_hri_request_step_snapshots_request_id on hri_request_step_snapshots(request_id);
            create table hri_request_histories (id integer generated by default as identity primary key, request_id integer not null references hri_request_masters(id), event_type varchar(30) not null, from_status varchar(30), to_status varchar(30), actor_user_id integer not null references auth_users(id), actor_ip varchar(45), event_payload_json varchar, created_at timestamp not null);
            create index ix_hri_request_histories_actor_created_at on hri_request_histories(actor_user_id,created_at);
            create index ix_hri_request_histories_event_type on hri_request_histories(event_type);
            create index ix_hri_request_histories_request_created_at on hri_request_histories(request_id,created_at);
            create index ix_hri_request_histories_request_id on hri_request_histories(request_id);
            create table hri_request_attachments (id integer generated by default as identity primary key, request_id integer not null references hri_request_masters(id), file_key varchar(300) not null, file_name varchar(255) not null, file_size integer not null, mime_type varchar(120), uploaded_by integer not null references auth_users(id), uploaded_at timestamp not null);
            create index ix_hri_request_attachments_request_id on hri_request_attachments(request_id);
            create index ix_hri_request_attachments_request_uploaded_at on hri_request_attachments(request_id,uploaded_at);
            create table hri_req_tim_attendance (id integer generated by default as identity primary key, request_id integer not null references hri_request_masters(id), attendance_code varchar(30) not null, start_date date not null, end_date date not null, start_time varchar(5), end_time varchar(5), applied_minutes integer not null, reason varchar(1000), created_at timestamp not null, updated_at timestamp not null, constraint uq_hri_req_tim_attendance_request_id unique(request_id));
            create index ix_hri_req_tim_attendance_dates on hri_req_tim_attendance(start_date,end_date);
            create index ix_hri_req_tim_attendance_request_id on hri_req_tim_attendance(request_id);
            create table hri_req_tim_correction (id integer generated by default as identity primary key, request_id integer not null references hri_request_masters(id), work_date date not null, before_status varchar(30) not null, after_status varchar(30) not null, reason varchar(1000), created_at timestamp not null, updated_at timestamp not null, constraint uq_hri_req_tim_correction_request_id unique(request_id));
            create index ix_hri_req_tim_correction_request_id on hri_req_tim_correction(request_id);
            create index ix_hri_req_tim_correction_work_date on hri_req_tim_correction(work_date);
            create table hri_req_cert_employment (id integer generated by default as identity primary key, request_id integer not null references hri_request_masters(id), purpose varchar(200) not null, copies integer not null, recipient varchar(200), reason varchar(1000), created_at timestamp not null, updated_at timestamp not null, constraint uq_hri_req_cert_employment_request_id unique(request_id));
            create index ix_hri_req_cert_employment_request_id on hri_req_cert_employment(request_id);
            create table hri_req_leave (id integer generated by default as identity primary key, request_id integer not null references hri_request_masters(id), leave_type_code varchar(30) not null, start_date date not null, end_date date not null, start_time varchar(5), end_time varchar(5), applied_minutes integer not null, reason varchar(1000), created_at timestamp not null, updated_at timestamp not null, constraint uq_hri_req_leave_request_id unique(request_id));
            create index ix_hri_req_leave_dates on hri_req_leave(start_date,end_date);
            create index ix_hri_req_leave_request_id on hri_req_leave(request_id);
            create table wel_benefit_types (id integer generated by default as identity primary key, code varchar(40) not null, name varchar(100) not null, module_path varchar(200) not null, is_deduction boolean not null, pay_item_code varchar(60), is_active boolean not null, sort_order integer not null, created_at timestamp not null, updated_at timestamp not null, constraint uq_wel_benefit_types_code unique(code), constraint uq_wel_benefit_types_module_path unique(module_path));
            create index ix_wel_benefit_types_code on wel_benefit_types(code);
            create table wel_benefit_requests (id integer generated by default as identity primary key, request_no varchar(40) not null, benefit_type_code varchar(40) not null, benefit_type_name varchar(100) not null, employee_id integer references hr_employees(id), employee_no varchar(40) not null, employee_name varchar(100) not null, department_name varchar(120) not null, status_code varchar(30) not null, requested_amount integer not null, approved_amount integer, payroll_run_label varchar(120), description varchar(500), requested_at timestamp not null, approved_at timestamp, created_at timestamp not null, updated_at timestamp not null, constraint uq_wel_benefit_requests_request_no unique(request_no));
            create index ix_wel_benefit_requests_benefit_type_code on wel_benefit_requests(benefit_type_code);
            create index ix_wel_benefit_requests_employee_id on wel_benefit_requests(employee_id);
            create index ix_wel_benefit_requests_employee_no on wel_benefit_requests(employee_no);
            create index ix_wel_benefit_requests_request_no on wel_benefit_requests(request_no);
            create index ix_wel_benefit_requests_status_code on wel_benefit_requests(status_code);
            """;
}
