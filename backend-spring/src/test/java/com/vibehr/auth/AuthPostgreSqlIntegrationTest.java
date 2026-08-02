package com.vibehr.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vibehr.testsupport.TestSecrets;

import com.vibehr.hr.HrSocialOnboardingWriter;
import com.vibehr.systemsettings.AuthSessionPolicyService;
import com.vibehr.systemsettings.AuthSessionPolicyService.AuthSessionPolicy;
import jakarta.persistence.Column;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Table;
import java.sql.DriverManager;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
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
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Tag("integration")
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(
        classes = AuthPostgreSqlIntegrationTest.TestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = { "spring.jpa.hibernate.ddl-auto=none", "spring.flyway.enabled=false" })
class AuthPostgreSqlIntegrationTest {

    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
            .withDatabaseName("vibehr_foundation")
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
    @EntityScan(basePackages = { "com.vibehr.auth", "com.vibehr.hr" })
    @EnableJpaRepositories(basePackageClasses = AuthUserRepository.class)
    @MapperScan(basePackageClasses = AuthReferenceMapper.class, annotationClass = Mapper.class)
    static class TestApplication {
        @Bean
        Clock clock() {
            return Clock.fixed(Instant.parse("2026-08-02T00:00:00Z"), ZoneOffset.UTC);
        }

        @Bean
        HrSocialOnboardingWriter socialOnboardingWriter(EntityManager entityManager, Clock clock) {
            return new HrSocialOnboardingWriter(entityManager, clock);
        }
    }

    private final JdbcTemplate jdbc;
    private final EntityManager entityManager;
    private final PlatformTransactionManager transactionManager;
    private final AuthUserRepository users;
    private final AuthRoleRepository roles;
    private final AuthUserRoleRepository userRoles;
    private final AuthReferenceMapper references;
    private final HrSocialOnboardingWriter socialOnboarding;
    private final Clock clock;

    @Autowired
    AuthPostgreSqlIntegrationTest(JdbcTemplate jdbc, EntityManager entityManager,
            PlatformTransactionManager transactionManager, AuthUserRepository users, AuthRoleRepository roles,
            AuthUserRoleRepository userRoles, AuthReferenceMapper references,
            HrSocialOnboardingWriter socialOnboarding, Clock clock) {
        this.jdbc = jdbc;
        this.entityManager = entityManager;
        this.transactionManager = transactionManager;
        this.users = users;
        this.roles = roles;
        this.userRoles = userRoles;
        this.references = references;
        this.socialOnboarding = socialOnboarding;
        this.clock = clock;
    }

    @BeforeEach
    void resetData() {
        jdbc.execute("truncate table auth_user_roles, hr_employee_basic_profiles, hr_employees, auth_roles, org_departments, org_corporations, auth_users restart identity cascade");
        jdbc.update("insert into auth_roles(code, name, created_at) values ('employee', 'Employee', ?)", java.sql.Timestamp.from(clock.instant()));
        jdbc.update("insert into org_corporations(enter_cd, company_code, corporation_name, company_logo_url, is_active) values ('VIBE', 'VIBE', 'Vibe HR', 'logo.svg', true)");
        jdbc.update("insert into org_departments(is_active) values (true)");
    }

    @Test
    void socialOnboardingUsesJpaGeneratedUserIdAndCreatesEmployeeAndBasicProfile() throws Exception {
        assertThat(AuthUser.class.getAnnotation(Table.class).name()).isEqualTo("auth_users");
        assertThat(AuthUser.class.getDeclaredField("active").getAnnotation(Column.class).name()).isEqualTo("is_active");
        assertThat(AuthReferenceMapper.class.getDeclaredMethods())
                .noneMatch(method -> method.isAnnotationPresent(Insert.class));
        assertThat(references.activeCorporations())
                .containsExactly(new AuthReferenceMapper.CorporationProjection("VIBE", "VIBE", "Vibe HR", "logo.svg"));
        assertThat(references.firstActiveDepartmentId()).isOne();

        AuthSessionPolicyService policies = mock(AuthSessionPolicyService.class);
        when(policies.get()).thenReturn(new AuthSessionPolicy(120, 60, true, 43_200, true));
        AuthService service = new AuthService(users, roles, userRoles, references, socialOnboarding, entityManager,
                new Pbkdf2PasswordVerifier(), new Pbkdf2PasswordHasher(),
                new JwtTokenIssuer(new AuthProperties(TestSecrets.configured("vibehr.auth.secret"), "HS256", "vibehr", 120), clock),
                policies, clock);
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);

        AuthService.LoginResponse first = transaction.execute(status -> service.socialExchange(
                new AuthService.SocialExchangeRequest("google", "subject-42", "social@example.test", "Social User")));
        AuthService.LoginResponse repeat = transaction.execute(status -> service.socialExchange(
                new AuthService.SocialExchangeRequest("google", "subject-42", "social@example.test", "Changed Name")));

        assertThat(first.user().id()).isPositive();
        assertThat(repeat.user().id()).isEqualTo(first.user().id());
        assertThat(first.user().roles()).containsExactly("employee");
        assertThat(jdbc.queryForObject("select count(*) from auth_users where email='social@example.test'", Integer.class)).isOne();
        assertThat(jdbc.queryForObject("select count(*) from hr_employees where user_id=?", Integer.class, first.user().id())).isOne();
        assertThat(jdbc.queryForObject("select employee_no from hr_employees where user_id=?", String.class, first.user().id()))
                .isEqualTo("EMP-000001");
        assertThat(jdbc.queryForObject("""
                select count(*) from hr_employee_basic_profiles p
                 join hr_employees e on e.id=p.employee_id
                where e.user_id=?
                """, Integer.class, first.user().id())).isOne();
        assertThat(jdbc.queryForObject("select count(*) from auth_user_roles where user_id=?", Integer.class, first.user().id())).isOne();
    }

    @Test
    void concurrentSocialOnboardingKeepsOneGeneratedUserEmployeeAndBasicProfile() throws Exception {
        AuthService service = service();
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<AuthService.LoginResponse> first = executor.submit(() -> socialExchangeAfter(start, service, transaction));
            Future<AuthService.LoginResponse> second = executor.submit(() -> socialExchangeAfter(start, service, transaction));
            start.countDown();

            List<AuthService.LoginResponse> responses = List.of(first.get(), second.get());
            assertThat(responses).extracting(response -> response.user().id()).containsOnly(responses.getFirst().user().id());
        }
        assertThat(jdbc.queryForObject("select count(*) from auth_users where email='concurrent@example.test'", Integer.class)).isOne();
        assertThat(jdbc.queryForObject("select count(*) from hr_employees", Integer.class)).isOne();
        assertThat(jdbc.queryForObject("select count(*) from hr_employee_basic_profiles", Integer.class)).isOne();
        assertThat(jdbc.queryForObject("select count(*) from auth_user_roles", Integer.class)).isOne();
    }

    private AuthService.LoginResponse socialExchangeAfter(CountDownLatch start, AuthService service, TransactionTemplate transaction) throws Exception {
        start.await();
        return transaction.execute(status -> service.socialExchange(
                new AuthService.SocialExchangeRequest("google", "concurrent-subject", "concurrent@example.test", "Concurrent User")));
    }

    private AuthService service() {
        AuthSessionPolicyService policies = mock(AuthSessionPolicyService.class);
        when(policies.get()).thenReturn(new AuthSessionPolicy(120, 60, true, 43_200, true));
        return new AuthService(users, roles, userRoles, references, socialOnboarding, entityManager,
                new Pbkdf2PasswordVerifier(), new Pbkdf2PasswordHasher(),
                new JwtTokenIssuer(new AuthProperties(TestSecrets.configured("vibehr.auth.secret"), "HS256", "vibehr", 120), clock),
                policies, clock);
    }

    private static synchronized void ensureSchema() {
        if (schemaInitialized) {
            return;
        }
        POSTGRES.start();
        try (var connection = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var statement = connection.createStatement()) {
            statement.execute("create table auth_users (id serial primary key, login_id varchar(50) not null unique, email varchar(320) not null unique, password_hash text not null, display_name varchar(100) not null, is_active boolean not null, last_login_at timestamp, created_at timestamp not null, updated_at timestamp not null)");
            statement.execute("create table auth_roles (id serial primary key, code varchar(40) not null unique, name varchar(60) not null, created_at timestamp not null)");
            statement.execute("create table auth_user_roles (user_id integer not null references auth_users(id), role_id integer not null references auth_roles(id), assigned_at timestamp not null, primary key (user_id, role_id))");
            statement.execute("create table org_corporations (id serial primary key, enter_cd varchar(20) not null, company_code varchar(20) not null, corporation_name varchar(120) not null, company_logo_url varchar(500), is_active boolean not null)");
            statement.execute("create table org_departments (id serial primary key, is_active boolean not null)");
            statement.execute("create table hr_employees (id serial primary key, user_id integer not null unique references auth_users(id), employee_no varchar(30) not null unique, department_id integer not null references org_departments(id), position_title varchar(80) not null, hire_date date not null, employment_status varchar(20) not null, created_at timestamp not null, updated_at timestamp not null)");
            statement.execute("create table hr_employee_basic_profiles (id serial primary key, employee_id integer not null unique references hr_employees(id), gender varchar(20), resident_no_masked varchar(30), birth_date date, retire_date date, blood_type varchar(10), marital_status varchar(20), mbti varchar(10), probation_end_date date, job_family varchar(80), job_role varchar(80), grade varchar(40), created_at timestamp not null, updated_at timestamp not null)");
            schemaInitialized = true;
        } catch (Exception exception) {
            throw new IllegalStateException("Could not initialize the disposable auth schema.", exception);
        }
    }
}
