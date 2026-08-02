package com.vibehr.organization;

import static com.vibehr.organization.OrganizationContracts.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import java.sql.DriverManager;
import java.sql.SQLException;
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
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.mybatis.spring.annotation.MapperScan;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Tag("integration")
@SpringBootTest(
        classes = OrganizationPostgreSqlSchemaIntegrationTest.TestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.jpa.hibernate.ddl-auto=validate",
                "spring.flyway.enabled=false"
        })
class OrganizationPostgreSqlSchemaIntegrationTest {
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
            .withDatabaseName("vibehr_organization_test")
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
    @EntityScan(basePackageClasses = OrgCorporation.class)
    @MapperScan(basePackageClasses = OrganizationReferenceReadMapper.class)
    static class TestApplication {
        @Bean
        OrganizationService organizationService(EntityManager entityManager, OrganizationReferenceReadMapper references) {
            return new OrganizationService(entityManager, references);
        }
    }

    private final JdbcTemplate jdbc;
    private final OrganizationService service;

    @Autowired
    OrganizationPostgreSqlSchemaIntegrationTest(JdbcTemplate jdbc, OrganizationService service) {
        this.jdbc = jdbc;
        this.service = service;
    }

    @BeforeEach
    void resetData() {
        jdbc.execute("truncate org_restructure_plan_items, org_restructure_plans, org_dept_change_histories, "
                + "org_mapping_assignments, org_mapping_type_items, hr_personnel_histories, hr_employees, "
                + "org_departments, org_corporations, app_codes, app_code_groups, auth_users restart identity cascade");
        jdbc.update("insert into auth_users(id, display_name) values (17, '조직 관리자')");
    }

    @Test
    void hibernateValidatesSevenOwnedTablesAndEveryCurrentKeyAndIndexClue() {
        Set<String> ownedTables = Set.copyOf(jdbc.queryForList("""
                select table_name from information_schema.tables
                where table_schema = 'public' and table_name in (
                    'org_corporations', 'org_departments', 'org_mapping_type_items',
                    'org_mapping_assignments', 'org_dept_change_histories',
                    'org_restructure_plans', 'org_restructure_plan_items')
                """, String.class));
        Set<String> integerIds = Set.copyOf(jdbc.queryForList("""
                select table_name from information_schema.columns
                where table_schema = 'public' and column_name = 'id' and data_type = 'integer'
                  and table_name like 'org_%'
                """, String.class));
        Set<String> primaryKeys = constraintNames("p");
        Set<String> foreignKeys = constraintNames("f");
        Set<String> uniqueConstraints = constraintNames("u");
        Set<String> checks = constraintNames("c");
        Set<String> exclusions = constraintNames("x");
        Set<String> indexes = Set.copyOf(jdbc.queryForList("""
                select indexname from pg_indexes
                where schemaname = 'public' and tablename in (
                    'org_corporations', 'org_departments', 'org_mapping_type_items',
                    'org_mapping_assignments', 'org_dept_change_histories',
                    'org_restructure_plans', 'org_restructure_plan_items')
                """, String.class));

        assertThat(ownedTables).containsExactlyInAnyOrderElementsOf(ownedTableNames());
        assertThat(integerIds).containsExactlyInAnyOrderElementsOf(ownedTableNames());
        assertThat(primaryKeys).containsExactlyInAnyOrder(
                "org_corporations_pkey", "org_departments_pkey", "org_mapping_type_items_pkey",
                "org_mapping_assignments_pkey", "org_dept_change_histories_pkey",
                "org_restructure_plans_pkey", "org_restructure_plan_items_pkey");
        assertThat(foreignKeys).containsExactlyInAnyOrder(
                "org_departments_parent_id_fkey",
                "fk_org_mapping_type_items_created_by", "fk_org_mapping_type_items_updated_by",
                "fk_org_mapping_assignments_department", "fk_org_mapping_assignments_item_type",
                "fk_org_mapping_assignments_created_by", "fk_org_mapping_assignments_updated_by",
                "org_dept_change_histories_department_id_fkey", "org_dept_change_histories_changed_by_fkey",
                "org_restructure_plans_applied_by_fkey", "org_restructure_plans_created_by_fkey",
                "org_restructure_plan_items_new_parent_id_fkey", "org_restructure_plan_items_plan_id_fkey",
                "org_restructure_plan_items_target_dept_id_fkey");
        assertThat(uniqueConstraints).containsExactlyInAnyOrder(
                "uq_org_corporations_enter_cd", "uq_org_corporations_company_code",
                "uq_org_mapping_type_items_id_type");
        assertThat(checks).containsExactlyInAnyOrder(
                "ck_org_mapping_type_items_date_order", "ck_org_mapping_assignments_date_order",
                "ck_org_restructure_plans_status", "ck_org_restructure_plan_items_action",
                "ck_org_restructure_plan_items_status");
        assertThat(exclusions).containsExactlyInAnyOrder(
                "ex_org_mapping_type_items_period", "ex_org_mapping_assignments_period");
        assertThat(indexes).containsExactlyInAnyOrder(
                "org_corporations_pkey", "uq_org_corporations_enter_cd", "uq_org_corporations_company_code",
                "ix_org_corporations_enter_cd", "ix_org_corporations_company_code",
                "org_departments_pkey", "ix_org_departments_code",
                "org_mapping_type_items_pkey", "uq_org_mapping_type_items_id_type",
                "ex_org_mapping_type_items_period", "ix_org_mapping_type_items_type_item_from",
                "org_mapping_assignments_pkey", "ex_org_mapping_assignments_period",
                "ix_org_mapping_assignments_department_type_from", "ix_org_mapping_assignments_item_id",
                "org_dept_change_histories_pkey",
                "ix_org_dept_change_histories_changed_at", "ix_org_dept_change_histories_department_id",
                "ix_org_dept_change_histories_dept_changed",
                "org_restructure_plans_pkey", "ix_org_restructure_plans_status_created",
                "org_restructure_plan_items_pkey", "ix_org_restructure_plan_items_plan",
                "ix_org_restructure_plan_items_plan_id");
        assertThat(jdbc.queryForObject("select indexdef from pg_indexes where indexname = 'ix_org_departments_code'", String.class))
                .contains("UNIQUE INDEX");
        assertThat(jdbc.queryForObject("select data_type from information_schema.columns where table_name = 'org_corporations' and column_name = 'created_at'", String.class))
                .isEqualTo("timestamp without time zone");
        assertThat(jdbc.queryForObject("select data_type from information_schema.columns where table_name = 'org_mapping_type_items' and column_name = 'created_at'", String.class))
                .isEqualTo("timestamp with time zone");
    }

    @Test
    void concurrentAssignmentMutationUsesTheDatabaseExclusionGuardAtomically() throws Exception {
        long departmentId = insertDepartment("HQ", "본사");
        long itemId = service.createMappingTypeItem(new MappingTypeItemCreateRequest(
                "COST", "CC-100", "원가센터", LocalDate.of(2026, 1, 1), null,
                null, null, 0, null, true)).item().id();
        MappingAssignmentCreateRequest request = new MappingAssignmentCreateRequest(
                departmentId, "COST", itemId, LocalDate.of(2026, 8, 1), null);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<MutationOutcome> first = executor.submit(() -> createAssignmentAfter(request, ready, start));
            Future<MutationOutcome> second = executor.submit(() -> createAssignmentAfter(request, ready, start));
            ready.await();
            start.countDown();

            List<MutationOutcome> outcomes = List.of(first.get(), second.get());
            assertThat(outcomes.stream().map(MutationOutcome::success)).containsExactlyInAnyOrder(true, false);
            assertThat(outcomes.stream().filter(outcome -> !outcome.success())).singleElement()
                    .satisfies(outcome -> assertThat(outcome.detail()).isIn(
                            "Mapping assignment conflict.", "Mapping assignment period overlaps existing record."));
        }
        assertThat(jdbc.queryForObject("select count(*) from org_mapping_assignments", Integer.class)).isEqualTo(1);
        assertThatThrownBy(() -> jdbc.update("""
                        insert into org_mapping_assignments(
                            department_id, type_code, item_id, effective_from, created_at, updated_at)
                        values (?, 'COST', ?, '2026-08-01', now(), now())
                        """, departmentId, itemId))
                .rootCause().isInstanceOfSatisfying(SQLException.class,
                        exception -> assertThat(exception.getSQLState()).isEqualTo("23P01"));
        assertThat(jdbc.queryForObject("select count(*) from org_mapping_assignments", Integer.class)).isEqualTo(1);
    }

    @Test
    void uploadValidationWritesNothingThenConfirmationPersistsAndRepeatsIdempotently() {
        insertDepartment("HQ", "본사");
        service.createMappingTypeItem(new MappingTypeItemCreateRequest(
                "COST", "CC-100", "원가센터", LocalDate.of(2026, 1, 1), null,
                null, null, 0, null, true));
        service.createMappingTypeItem(new MappingTypeItemCreateRequest(
                "ROLE", "DEV", "개발", LocalDate.of(2026, 1, 1), null,
                null, null, 0, null, true));
        List<MappingAssignmentUploadRow> invalid = List.of(
                new MappingAssignmentUploadRow("HQ", "COST", "CC-100", LocalDate.of(2026, 8, 1), null),
                new MappingAssignmentUploadRow("MISSING", "ROLE", "DEV", LocalDate.of(2026, 8, 1), null));

        assertThatThrownBy(() -> service.confirmUpload(invalid, 17L))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.status().value()).isEqualTo(422);
                    assertThat(exception.detail()).isInstanceOf(java.util.Map.class);
                });
        assertThat(jdbc.queryForObject("select count(*) from org_mapping_assignments", Integer.class)).isZero();

        List<MappingAssignmentUploadRow> valid = List.of(
                new MappingAssignmentUploadRow("HQ", "COST", "CC-100", LocalDate.of(2026, 8, 1), null),
                new MappingAssignmentUploadRow("HQ", "ROLE", "DEV", LocalDate.of(2026, 8, 1), null));
        assertThat(service.confirmUpload(valid, 17L)).isEqualTo(new MappingAssignmentUploadConfirmResponse(2, 0));
        assertThat(service.confirmUpload(valid, 17L)).isEqualTo(new MappingAssignmentUploadConfirmResponse(0, 2));

        assertThat(jdbc.queryForObject("select count(*) from org_mapping_assignments", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForList("select distinct created_by from org_mapping_assignments", Long.class)).containsExactly(17L);
        assertThat(jdbc.queryForList("select distinct updated_by from org_mapping_assignments", Long.class)).containsExactly(17L);
    }

    @Test
    void typedPatchPresenceAndClosedTemporalBoundariesMatchPythonSemantics() {
        long parentId = insertDepartment("HQ", "본사");
        long childId = jdbc.queryForObject("""
                insert into org_departments(code, name, parent_id, is_active, created_at, updated_at)
                values ('DEV', '개발팀', ?, true, now(), now()) returning id
                """, Long.class, parentId);

        service.updateDepartment(childId, new DepartmentUpdateRequest(), 17L);
        assertThat(jdbc.queryForObject("select parent_id from org_departments where id = ?", Long.class, childId))
                .isEqualTo(parentId);
        DepartmentUpdateRequest clearParent = new DepartmentUpdateRequest();
        clearParent.setParentId(null);
        service.updateDepartment(childId, clearParent, 17L);
        assertThat(jdbc.queryForObject("select parent_id from org_departments where id = ?", Long.class, childId)).isNull();
        assertThat(jdbc.queryForMap("select before_value, after_value from org_dept_change_histories where department_id = ?", childId))
                .containsEntry("before_value", String.valueOf(parentId)).containsEntry("after_value", "None");

        service.createMappingTypeItem(new MappingTypeItemCreateRequest(
                "COST", "BOUNDARY", "경계", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 6, 30),
                null, null, 0, null, true));
        assertThatThrownBy(() -> service.createMappingTypeItem(new MappingTypeItemCreateRequest(
                "COST", "BOUNDARY", "중복", LocalDate.of(2026, 6, 30), LocalDate.of(2026, 7, 31),
                null, null, 0, null, true)))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.detail()).isEqualTo("Mapping item period overlaps existing record."));
        service.createMappingTypeItem(new MappingTypeItemCreateRequest(
                "COST", "BOUNDARY", "다음", LocalDate.of(2026, 7, 1), null,
                null, null, 0, null, true));

        long clearableId = service.createMappingTypeItem(new MappingTypeItemCreateRequest(
                "ROLE", "CLEAR", "초기", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31),
                null, null, 0, "기존", true)).item().id();
        service.updateMappingTypeItem(clearableId, new MappingTypeItemUpdateRequest());
        assertThat(jdbc.queryForObject("select effective_to from org_mapping_type_items where id = ?", LocalDate.class, clearableId))
                .isEqualTo(LocalDate.of(2026, 12, 31));
        MappingTypeItemUpdateRequest clearMappingFields = new MappingTypeItemUpdateRequest();
        clearMappingFields.setEffectiveTo(null);
        clearMappingFields.setRemark(null);
        service.updateMappingTypeItem(clearableId, clearMappingFields);
        assertThat(jdbc.queryForMap("select effective_to, remark from org_mapping_type_items where id = ?", clearableId))
                .containsEntry("effective_to", null).containsEntry("remark", null);
    }

    @Test
    void restructureServiceReturnsExactKoreanValidationAndMutationErrors() {
        long planId = jdbc.queryForObject("""
                insert into org_restructure_plans(title, status, created_by, created_at, updated_at)
                values ('검증', 'draft', 17, now(), now()) returning id
                """, Long.class);

        assertThatThrownBy(() -> service.addRestructurePlanItem(planId,
                new RestructurePlanItemCreateRequest("move", null, 1L, null, null, null, null, 0, null)))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.status().value()).isEqualTo(400);
                    assertThat(exception.detail()).isEqualTo("move 액션은 target_dept_id가 필요합니다.");
                });
        RestructurePlanUpdateRequest invalidStatus = new RestructurePlanUpdateRequest();
        invalidStatus.setStatus("applied");
        assertThatThrownBy(() -> service.updateRestructurePlan(planId, invalidStatus))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.detail()).isEqualTo("상태는 draft/reviewing/cancelled만 직접 변경 가능합니다."));

        jdbc.update("update org_restructure_plans set status = 'applied' where id = ?", planId);
        RestructurePlanUpdateRequest title = new RestructurePlanUpdateRequest();
        title.setTitle("수정 불가");
        assertThatThrownBy(() -> service.updateRestructurePlan(planId, title))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.detail()).isEqualTo("이미 적용됐거나 취소된 개편안은 수정할 수 없습니다."));
        assertThatThrownBy(() -> service.deleteRestructurePlan(planId))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.detail()).isEqualTo("이미 적용된 개편안은 삭제할 수 없습니다."));
    }

    @Test
    void concurrentApplyLocksOnceAndPersistsExactKoreanMessageAndAuditHistory() throws Exception {
        long departmentId = insertDepartment("DEV", "개발팀");
        long planId = jdbc.queryForObject("""
                insert into org_restructure_plans(title, status, created_by, created_at, updated_at)
                values ('플랫폼 개편', 'draft', 17, now(), now()) returning id
                """, Long.class);
        jdbc.update("""
                insert into org_restructure_plan_items(
                    plan_id, action_type, target_dept_id, new_name, new_code,
                    sort_order, item_status, created_at, updated_at)
                values (?, 'rename', ?, '플랫폼팀', 'PLATFORM', 0, 'pending', now(), now())
                """, planId, departmentId);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        List<ApplyOutcome> outcomes;
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<ApplyOutcome> first = executor.submit(() -> applyAfter(planId, ready, start));
            Future<ApplyOutcome> second = executor.submit(() -> applyAfter(planId, ready, start));
            ready.await();
            start.countDown();
            outcomes = List.of(first.get(), second.get());
        }

        assertThat(outcomes.stream().filter(ApplyOutcome::applied)).singleElement()
                .satisfies(outcome -> assertThat(outcome.messages()).containsExactly("[RENAME] 개발팀 → 플랫폼팀"));
        assertThat(outcomes.stream().filter(outcome -> !outcome.applied())).singleElement()
                .satisfies(outcome -> assertThat(outcome.detail()).isEqualTo("이미 적용된 개편안입니다."));
        assertThat(jdbc.queryForMap("select code, name from org_departments where id = ?", departmentId))
                .containsEntry("code", "PLATFORM").containsEntry("name", "플랫폼팀");
        assertThat(jdbc.queryForList("select field_name from org_dept_change_histories order by id", String.class))
                .containsExactly("code", "name");
        assertThat(jdbc.queryForList("select distinct change_reason from org_dept_change_histories", String.class))
                .containsExactly("조직개편 plan_id=" + planId);
        assertThat(jdbc.queryForObject("select applied_by from org_restructure_plans where id = ?", Long.class, planId))
                .isEqualTo(17L);

        assertThatThrownBy(() -> service.applyRestructurePlan(planId, 17L))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.status().value()).isEqualTo(409);
                    assertThat(exception.detail()).isEqualTo("이미 적용된 개편안입니다.");
                });
    }

    private Set<String> constraintNames(String type) {
        return Set.copyOf(jdbc.queryForList("""
                select con.conname from pg_constraint con
                join pg_class rel on rel.oid = con.conrelid
                join pg_namespace ns on ns.oid = rel.relnamespace
                where ns.nspname = 'public' and con.contype = ? and rel.relname in (
                    'org_corporations', 'org_departments', 'org_mapping_type_items',
                    'org_mapping_assignments', 'org_dept_change_histories',
                    'org_restructure_plans', 'org_restructure_plan_items')
                """, String.class, type));
    }

    private long insertDepartment(String code, String name) {
        return jdbc.queryForObject("""
                insert into org_departments(code, name, is_active, created_at, updated_at)
                values (?, ?, true, now(), now()) returning id
                """, Long.class, code, name);
    }

    private MutationOutcome createAssignmentAfter(MappingAssignmentCreateRequest request,
                                                  CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        start.await();
        try {
            service.createMappingAssignment(request);
            return new MutationOutcome(true, null);
        } catch (ApiException exception) {
            return new MutationOutcome(false, String.valueOf(exception.detail()));
        }
    }

    private ApplyOutcome applyAfter(long planId, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        start.await();
        try {
            RestructureApplyResponse response = service.applyRestructurePlan(planId, 17L);
            return new ApplyOutcome(true, null, response.messages());
        } catch (ApiException exception) {
            return new ApplyOutcome(false, String.valueOf(exception.detail()), List.of());
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
            throw new IllegalStateException("Failed to initialize disposable organization schema", exception);
        }
    }

    private static Set<String> ownedTableNames() {
        return Set.of(
                "org_corporations", "org_departments", "org_mapping_type_items",
                "org_mapping_assignments", "org_dept_change_histories",
                "org_restructure_plans", "org_restructure_plan_items");
    }

    private static List<String> schemaDdl() {
        return List.of(
                "create extension if not exists btree_gist",
                "create table auth_users (id serial primary key, display_name varchar(100) not null)",
                "create table app_code_groups (id serial primary key, code varchar(30) not null, is_active boolean not null)",
                "create table app_codes (id serial primary key, group_id integer not null, code varchar(30) not null, name varchar(100) not null, is_active boolean not null, sort_order integer not null)",
                """
                create table org_corporations (
                    id serial primary key, enter_cd varchar(20) not null, company_code varchar(20) not null,
                    corporation_name varchar(120) not null, corporation_number varchar(30), business_number varchar(30),
                    company_seal_url varchar(500), certificate_seal_url varchar(500), company_logo_url varchar(500),
                    is_active boolean not null, created_at timestamp not null, updated_at timestamp not null,
                    constraint uq_org_corporations_company_code unique (company_code),
                    constraint uq_org_corporations_enter_cd unique (enter_cd)
                )
                """,
                "create index ix_org_corporations_company_code on org_corporations(company_code)",
                "create index ix_org_corporations_enter_cd on org_corporations(enter_cd)",
                """
                create table org_departments (
                    id serial primary key, code varchar(30) not null, name varchar(100) not null,
                    parent_id integer references org_departments(id), organization_type varchar(50),
                    cost_center_code varchar(30), description varchar(500), is_active boolean not null,
                    created_at timestamp not null, updated_at timestamp not null
                )
                """,
                "create unique index ix_org_departments_code on org_departments(code)",
                """
                create table hr_employees (
                    id serial primary key, user_id integer not null references auth_users(id), employee_no varchar(30) not null,
                    department_id integer not null references org_departments(id), position_title varchar(80) not null,
                    hire_date date not null, employment_status varchar(20) not null,
                    created_at timestamp not null, updated_at timestamp not null
                )
                """,
                """
                create table hr_personnel_histories (
                    id serial primary key, employee_id integer not null references hr_employees(id),
                    history_type varchar(30) not null, source_table varchar(50) not null, source_id integer not null,
                    effective_date date not null, field_name varchar(60), before_value varchar(200), after_value varchar(200),
                    description varchar(500), created_by integer, created_at timestamp not null
                )
                """,
                """
                create table org_mapping_type_items (
                    id serial primary key, type_code varchar(50) not null, item_code varchar(50) not null,
                    name varchar(100) not null, effective_from date not null, effective_to date,
                    erp_employee_code varchar(50), cost_center_type varchar(50), remark varchar(500),
                    sort_order integer not null default 0, is_active boolean not null default true,
                    created_by integer, updated_by integer, created_at timestamptz not null default now(),
                    updated_at timestamptz not null default now(),
                    constraint fk_org_mapping_type_items_created_by foreign key (created_by) references auth_users(id) on delete set null,
                    constraint fk_org_mapping_type_items_updated_by foreign key (updated_by) references auth_users(id) on delete set null,
                    constraint uq_org_mapping_type_items_id_type unique (id, type_code),
                    constraint ck_org_mapping_type_items_date_order check (effective_to is null or effective_to >= effective_from),
                    constraint ex_org_mapping_type_items_period exclude using gist (
                        type_code with =, item_code with =,
                        daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&)
                )
                """,
                "create index ix_org_mapping_type_items_type_item_from on org_mapping_type_items(type_code, item_code, effective_from)",
                """
                create table org_mapping_assignments (
                    id serial primary key, department_id integer not null, type_code varchar(50) not null,
                    item_id integer not null, effective_from date not null, effective_to date,
                    created_by integer, updated_by integer, created_at timestamptz not null default now(),
                    updated_at timestamptz not null default now(),
                    constraint fk_org_mapping_assignments_department foreign key (department_id) references org_departments(id) on delete restrict,
                    constraint fk_org_mapping_assignments_created_by foreign key (created_by) references auth_users(id) on delete set null,
                    constraint fk_org_mapping_assignments_updated_by foreign key (updated_by) references auth_users(id) on delete set null,
                    constraint fk_org_mapping_assignments_item_type foreign key (item_id, type_code) references org_mapping_type_items(id, type_code) on delete restrict,
                    constraint ck_org_mapping_assignments_date_order check (effective_to is null or effective_to >= effective_from),
                    constraint ex_org_mapping_assignments_period exclude using gist (
                        department_id with =, type_code with =,
                        daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&)
                )
                """,
                "create index ix_org_mapping_assignments_department_type_from on org_mapping_assignments(department_id, type_code, effective_from)",
                "create index ix_org_mapping_assignments_item_id on org_mapping_assignments(item_id)",
                """
                create table org_dept_change_histories (
                    id serial primary key, department_id integer not null references org_departments(id),
                    changed_by integer references auth_users(id), field_name varchar(60) not null,
                    before_value varchar(500), after_value varchar(500), change_reason varchar(300), changed_at timestamp not null
                )
                """,
                "create index ix_org_dept_change_histories_changed_at on org_dept_change_histories(changed_at)",
                "create index ix_org_dept_change_histories_department_id on org_dept_change_histories(department_id)",
                "create index ix_org_dept_change_histories_dept_changed on org_dept_change_histories(department_id, changed_at)",
                """
                create table org_restructure_plans (
                    id serial primary key, title varchar(200) not null, description varchar(1000), planned_date date,
                    status varchar(20) not null, applied_at timestamp, applied_by integer references auth_users(id),
                    created_by integer not null references auth_users(id), created_at timestamp not null, updated_at timestamp not null,
                    constraint ck_org_restructure_plans_status check (status in ('draft', 'reviewing', 'applied', 'cancelled'))
                )
                """,
                "create index ix_org_restructure_plans_status_created on org_restructure_plans(status, created_at)",
                """
                create table org_restructure_plan_items (
                    id serial primary key, plan_id integer not null references org_restructure_plans(id),
                    action_type varchar(20) not null, target_dept_id integer references org_departments(id),
                    new_parent_id integer references org_departments(id), new_name varchar(100), new_code varchar(30),
                    new_organization_type varchar(50), new_cost_center_code varchar(30), sort_order integer not null,
                    item_status varchar(20) not null, memo varchar(500), applied_at timestamp,
                    created_at timestamp not null, updated_at timestamp not null,
                    constraint ck_org_restructure_plan_items_action check (action_type in ('move', 'rename', 'create', 'deactivate', 'reactivate')),
                    constraint ck_org_restructure_plan_items_status check (item_status in ('pending', 'applied', 'skipped'))
                )
                """,
                "create index ix_org_restructure_plan_items_plan on org_restructure_plan_items(plan_id, sort_order)",
                "create index ix_org_restructure_plan_items_plan_id on org_restructure_plan_items(plan_id)"
        );
    }

    private record MutationOutcome(boolean success, String detail) {
    }

    private record ApplyOutcome(boolean applied, String detail, List<String> messages) {
    }
}
