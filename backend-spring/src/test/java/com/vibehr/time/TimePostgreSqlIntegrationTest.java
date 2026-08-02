package com.vibehr.time;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vibehr.payroll.PayrollEntities;
import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
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
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Tag("integration")
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(
        classes = TimePostgreSqlIntegrationTest.TestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.jpa.hibernate.ddl-auto=validate",
                "spring.jpa.properties.hibernate.jdbc.time_zone=UTC",
                "spring.flyway.enabled=true",
                "spring.jpa.open-in-view=false"
        })
class TimePostgreSqlIntegrationTest {
    private static final int EMPLOYEE_ID = 900001;
    private static final int USER_ID = 900001;
    private static final int DEPARTMENT_ID = 900001;
    private static final MutableClock CLOCK = new MutableClock(Instant.parse("2026-08-01T15:01:00Z"));

    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
            .withDatabaseName("vibehr_time_test").withUsername("vibehr").withPassword("vibehr");

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EntityScan(basePackageClasses = {TimAttendanceDaily.class, PayrollEntities.class})
    @MapperScan(basePackageClasses = TimeGridMapper.class)
    static class TestApplication {
        @Bean
        Clock clock() {
            return CLOCK;
        }

        @Bean
        TimeApplicationService timeApplicationService(EntityManager entityManager, TimeGridMapper gridMapper,
                TimePayrollGateway payrollGateway, Clock clock) {
            return new TimeApplicationService(entityManager, gridMapper, payrollGateway, clock);
        }
    }

    private final JdbcTemplate jdbc;
    private final TimeApplicationService service;
    private final EntityManager entityManager;

    @Autowired
    TimePostgreSqlIntegrationTest(JdbcTemplate jdbc, TimeApplicationService service, EntityManager entityManager) {
        this.jdbc = jdbc;
        this.service = service;
        this.entityManager = entityManager;
    }

    @BeforeEach
    void resetData() {
        dropFailureTrigger();
        jdbc.update("delete from pay_variable_inputs where employee_id=?", EMPLOYEE_ID);
        jdbc.update("delete from pay_employee_profiles where employee_id=?", EMPLOYEE_ID);
        jdbc.update("delete from tim_attendance_corrections where corrected_by_employee_id=? or attendance_id in (select id from tim_attendance_daily where employee_id=?)", EMPLOYEE_ID, EMPLOYEE_ID);
        jdbc.update("delete from tim_attendance_daily where employee_id=?", EMPLOYEE_ID);
        jdbc.update("delete from tim_employee_daily_schedules where employee_id=?", EMPLOYEE_ID);
        jdbc.update("delete from tim_month_closes where year=2026 and month=8");
        jdbc.update("delete from hr_employees where id=?", EMPLOYEE_ID);
        jdbc.update("delete from auth_users where id=?", USER_ID);
        jdbc.update("delete from org_departments where id=?", DEPARTMENT_ID);

        Timestamp now = timestamp(CLOCK.instant());
        jdbc.update("""
                insert into auth_users(id,login_id,email,password_hash,display_name,is_active,created_at,updated_at)
                values (?,?,?,?,?,?,?,?)
                """, USER_ID, "tim-flyway-user", "tim-flyway@example.test", "not-used", "근태 관리자", true, now, now);
        jdbc.update("""
                insert into org_departments(id,code,name,organization_type,cost_center_code,is_active,created_at,updated_at)
                values (?,?,?,?,?,?,?,?)
                """, DEPARTMENT_ID, "TIM-FLYWAY", "근태 검증 조직", "headquarters", "CC-TIM", true, now, now);
        jdbc.update("""
                insert into hr_employees(id,user_id,employee_no,department_id,position_title,hire_date,employment_status,created_at,updated_at)
                values (?,?,?,?,?,?,?,?,?)
                """, EMPLOYEE_ID, USER_ID, "TIM-FLYWAY-001", DEPARTMENT_ID, "Engineer", LocalDate.of(2020, 1, 1), "active", now, now);
        CLOCK.set(Instant.parse("2026-08-01T15:01:00Z"));
    }

    @AfterEach
    void removeFailureTrigger() {
        dropFailureTrigger();
    }

    @Test
    void canonicalFlywayV1ThroughV5AndHibernateValidationProvideTheActualTimSchema() {
        assertThat(jdbc.queryForList("select version from flyway_schema_history where success order by installed_rank", String.class))
                .containsExactly("1", "2", "3", "4", "5");
        assertThat(Set.copyOf(jdbc.queryForList("""
                select table_name from information_schema.tables
                 where table_schema='public' and table_name like 'tim_%'
                """, String.class))).containsAll(ownedTables());
        assertThat(jdbc.queryForObject("""
                select data_type from information_schema.columns
                 where table_schema='public' and table_name='tim_attendance_daily' and column_name='check_in_at'
                """, String.class)).isEqualTo("timestamp without time zone");
        assertThat(jdbc.queryForObject("""
                select data_type from information_schema.columns
                 where table_schema='public' and table_name='tim_employee_daily_schedules' and column_name='planned_start_at'
                """, String.class)).isEqualTo("timestamp without time zone");
    }

    @Test
    void servicePersistsUtcInstantInCanonicalTimestampColumnReloadsItAndUsesKstForLateClassification() {
        CLOCK.set(Instant.parse("2026-08-01T15:01:00Z"));
        LocalDate workDate = LocalDate.of(2026, 8, 2);
        // The FastAPI schedule generator persists a KST midnight plan as 15:00 UTC the preceding day.
        insertSchedule(workDate, LocalDateTime.of(2026, 8, 1, 15, 0), LocalDateTime.of(2026, 8, 1, 23, 0), false, true);
        assertThat(jdbc.queryForObject("""
                select planned_start_at::text from tim_employee_daily_schedules where employee_id=? and work_date=?
                """, String.class, EMPLOYEE_ID, workDate)).startsWith("2026-08-01 15:00:00");
        TimEmployeeDailySchedule persistedSchedule = entityManager.createQuery("""
                from TimEmployeeDailySchedule where employee_id=:employeeId and work_date=:workDate
                """, TimEmployeeDailySchedule.class)
                .setParameter("employeeId", EMPLOYEE_ID).setParameter("workDate", workDate).getSingleResult();
        assertThat(persistedSchedule.planned_start_at).isEqualTo(LocalDateTime.of(2026, 8, 2, 0, 0));
        assertThat(TimeFormula.normalizeNaivePlannedKst(persistedSchedule.planned_start_at))
                .isEqualTo(Instant.parse("2026-08-01T15:00:00Z"));

        TimAttendanceDailyItem checkIn = service.checkIn(EMPLOYEE_ID);

        assertThat(checkIn.workDate()).isEqualTo(workDate);
        assertThat(checkIn.checkInAt()).isEqualTo(Instant.parse("2026-08-01T15:01:00Z"));
        assertThat(checkIn.attendanceStatus()).isEqualTo("late");
        assertThat(jdbc.queryForObject("""
                select check_in_at::text from tim_attendance_daily where employee_id=? and work_date=?
                """, String.class, EMPLOYEE_ID, workDate)).startsWith("2026-08-01 15:01:00");

        TimAttendanceDailyItem reloaded = service.attendanceToday(EMPLOYEE_ID).item();
        assertThat(reloaded.checkInAt()).isEqualTo(Instant.parse("2026-08-01T15:01:00Z"));
        assertThat(reloaded.attendanceStatus()).isEqualTo("late");
    }

    @Test
    void closedMonthDoesNotReplaceTheLegacyCheckInAndCheckOutContractsWith423() {
        insertClosedMonth();

        assertApiError(() -> service.checkOut(EMPLOYEE_ID), 400, "출근 기록이 없어 퇴근 처리할 수 없습니다.");
        assertThat(service.checkIn(EMPLOYEE_ID).attendanceStatus()).isEqualTo("present");
        assertApiError(() -> service.checkIn(EMPLOYEE_ID), 409, "오늘 이미 출근 처리되었습니다.");
        assertThat(jdbc.queryForObject("select count(*) from tim_attendance_daily where employee_id=?", Integer.class, EMPLOYEE_ID)).isOne();
    }

    @Test
    void monthCloseCreatesFivePayInputsAndReopenRecloseUpdatesWithoutDuplicates() {
        seedAugustPayWork();

        TimMonthCloseItem closed = service.closeMonth(new TimMonthCloseRequest(2026, 8, "August close"), USER_ID).item();

        assertThat(closed.closeStatus()).isEqualTo("closed");
        assertThat(closed.totalOvertimeMinutes()).isEqualTo(60);
        assertThat(closed.totalNightMinutes()).isEqualTo(480);
        assertThat(closed.totalHolidayWorkMinutes()).isEqualTo(960);
        assertThat(closed.totalHolidayOvertimeMinutes()).isEqualTo(180);
        assertThat(closed.totalHolidayNightMinutes()).isEqualTo(480);
        assertPayInputs(List.of(
                new PayInputRow("HDN", 160000), new PayInputRow("HDO", 60000), new PayInputRow("HDW", 240000),
                new PayInputRow("NGT", 40000), new PayInputRow("OTX", 15000)));
        Timestamp initialOtxUpdatedAt = jdbc.queryForObject("""
                select updated_at from pay_variable_inputs
                 where year_month='2026-08' and employee_id=? and item_code='OTX'
                """, Timestamp.class, EMPLOYEE_ID);
        assertApiError(() -> service.closeMonth(new TimMonthCloseRequest(2026, 8, null), USER_ID), 409,
                "2026년 8월은 이미 마감 상태입니다.");

        assertThat(service.reopenMonth(2026, 8, USER_ID).item().closeStatus()).isEqualTo("open");
        CLOCK.set(CLOCK.instant().plusSeconds(60));
        jdbc.update("update tim_attendance_daily set check_out_at=? where employee_id=? and work_date=date '2026-08-03'",
                timestamp(Instant.parse("2026-08-03T23:00:00Z")), EMPLOYEE_ID);
        service.closeMonth(new TimMonthCloseRequest(2026, 8, "reclose"), USER_ID);

        assertThat(jdbc.queryForObject("select count(*) from pay_variable_inputs where year_month='2026-08' and employee_id=?",
                Integer.class, EMPLOYEE_ID)).isEqualTo(5);
        assertThat(jdbc.queryForObject("""
                select amount from pay_variable_inputs
                 where year_month='2026-08' and employee_id=? and item_code='OTX'
                """, Double.class, EMPLOYEE_ID)).isEqualTo(30000d);
        assertThat(jdbc.queryForObject("""
                select updated_at from pay_variable_inputs
                 where year_month='2026-08' and employee_id=? and item_code='OTX'
                """, Timestamp.class, EMPLOYEE_ID)).isAfter(initialOtxUpdatedAt);

        assertThat(service.reopenMonth(2026, 8, USER_ID).item().closeStatus()).isEqualTo("open");
        jdbc.update("update tim_attendance_daily set check_out_at=? where employee_id=? and work_date=date '2026-08-03'",
                timestamp(Instant.parse("2026-08-03T20:00:00Z")), EMPLOYEE_ID);
        service.closeMonth(new TimMonthCloseRequest(2026, 8, "zero overtime reclose"), USER_ID);

        assertThat(jdbc.queryForObject("""
                select amount from pay_variable_inputs
                 where year_month='2026-08' and employee_id=? and item_code='OTX'
                """, Double.class, EMPLOYEE_ID)).isZero();
    }

    @Test
    void concurrentMonthCloseSerializesJpaPayInputCreationAndLeavesOneNaturalKeyRowPerItem() throws Exception {
        seedAugustPayWork();
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<Object> first = executor.submit(() -> closeAfter(start));
            Future<Object> second = executor.submit(() -> closeAfter(start));
            start.countDown();

            List<Object> results = List.of(first.get(), second.get());
            assertThat(results.stream().filter(TimMonthCloseActionResponse.class::isInstance)).hasSize(1);
            assertThat(results.stream().filter(ApiException.class::isInstance)
                    .map(ApiException.class::cast)
                    .map(error -> error.status().value())).containsExactly(409);
        }
        assertThat(jdbc.queryForObject("select count(*) from pay_variable_inputs where year_month='2026-08' and employee_id=?",
                Integer.class, EMPLOYEE_ID)).isEqualTo(5);
    }

    @Test
    void failedJpaPayUpsertRollsBackTheCloseAndEveryEarlierPayRow() {
        seedAugustPayWork();
        jdbc.execute("""
                create function vibehr_fail_tim_pay_upsert() returns trigger language plpgsql as $$
                begin
                    if new.item_code = 'NGT' then
                        raise exception 'forced TIM PAY gateway failure';
                    end if;
                    return new;
                end;
                $$
                """);
        jdbc.execute("""
                create trigger vibehr_fail_tim_pay_upsert
                before insert or update on pay_variable_inputs
                for each row execute function vibehr_fail_tim_pay_upsert()
                """);

        assertThatThrownBy(() -> service.closeMonth(new TimMonthCloseRequest(2026, 8, "rollback"), USER_ID))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("forced TIM PAY gateway failure");

        assertThat(jdbc.queryForObject("select count(*) from tim_month_closes where year=2026 and month=8", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from pay_variable_inputs where year_month='2026-08' and employee_id=?",
                Integer.class, EMPLOYEE_ID)).isZero();
    }

    private void seedAugustPayWork() {
        insertPayProfile();
        insertSchedule(LocalDate.of(2026, 8, 3), LocalDateTime.of(2026, 8, 3, 21, 0),
                LocalDateTime.of(2026, 8, 4, 7, 0), false, true);
        insertAttendance(LocalDate.of(2026, 8, 3), Instant.parse("2026-08-03T12:00:00Z"), Instant.parse("2026-08-03T22:00:00Z"));
        insertSchedule(LocalDate.of(2026, 8, 9), LocalDateTime.of(2026, 8, 9, 9, 0),
                LocalDateTime.of(2026, 8, 9, 20, 0), true, false);
        insertAttendance(LocalDate.of(2026, 8, 9), Instant.parse("2026-08-09T00:00:00Z"), Instant.parse("2026-08-09T11:00:00Z"));
        insertSchedule(LocalDate.of(2026, 8, 10), LocalDateTime.of(2026, 8, 10, 21, 0),
                LocalDateTime.of(2026, 8, 11, 7, 0), true, false);
        insertAttendance(LocalDate.of(2026, 8, 10), Instant.parse("2026-08-10T12:00:00Z"), Instant.parse("2026-08-10T22:00:00Z"));
    }

    private Object closeAfter(CountDownLatch start) {
        try {
            start.await();
            return service.closeMonth(new TimMonthCloseRequest(2026, 8, "concurrent close"), USER_ID);
        } catch (ApiException exception) {
            return exception;
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void insertPayProfile() {
        Integer payrollCodeId = jdbc.queryForObject("select id from pay_payroll_codes order by id limit 1", Integer.class);
        jdbc.update("""
                insert into pay_employee_profiles
                       (employee_id,payroll_code_id,base_salary,pay_type_code,payment_day_type,holiday_adjustment,
                        effective_from,is_active,created_at,updated_at)
                values (?,?,?,?,?,?,?,?,?,?)
                """, EMPLOYEE_ID, payrollCodeId, 2090000d, "regular", "fixed_day", "previous_business_day",
                LocalDate.of(2020, 1, 1), true, timestamp(CLOCK.instant()), timestamp(CLOCK.instant()));
    }

    private void insertClosedMonth() {
        Timestamp now = timestamp(CLOCK.instant());
        jdbc.update("""
                insert into tim_month_closes
                       (year,month,close_status,employee_count,present_days,absent_days,late_days,leave_days,
                        total_overtime_minutes,total_night_minutes,total_holiday_work_minutes,
                        total_holiday_overtime_minutes,total_holiday_night_minutes,closed_by,closed_at,created_at,updated_at)
                values (2026,8,'closed',0,0,0,0,0,0,0,0,0,0,?,?,?,?)
                """, USER_ID, now, now, now);
    }

    private void insertSchedule(LocalDate workDate, LocalDateTime plannedStart, LocalDateTime plannedEnd,
            boolean holiday, boolean workday) {
        jdbc.update("""
                insert into tim_employee_daily_schedules
                       (employee_id,work_date,schedule_source,is_holiday,is_workday,planned_start_at,planned_end_at,
                        break_minutes,expected_minutes,is_overnight,generated_at,version_tag)
                values (?,?,'company_default',?,?,?,?,60,480,false,?,'test')
                """, EMPLOYEE_ID, workDate, holiday, workday, Timestamp.valueOf(plannedStart), Timestamp.valueOf(plannedEnd),
                timestamp(CLOCK.instant()));
    }

    private void insertAttendance(LocalDate workDate, Instant checkIn, Instant checkOut) {
        jdbc.update("""
                insert into tim_attendance_daily
                       (employee_id,work_date,check_in_at,check_out_at,attendance_status,actual_minutes,regular_minutes,
                        overtime_minutes,night_minutes,holiday_work_minutes,holiday_overtime_minutes,holiday_night_minutes,
                        is_holiday_work,created_at,updated_at)
                values (?,?,?,?, 'present',0,0,0,0,0,0,0,false,?,?)
                """, EMPLOYEE_ID, workDate, timestamp(checkIn), timestamp(checkOut), timestamp(CLOCK.instant()), timestamp(CLOCK.instant()));
    }

    private void assertPayInputs(List<PayInputRow> expected) {
        List<PayInputRow> actual = jdbc.query("""
                select item_code,amount from pay_variable_inputs
                 where year_month='2026-08' and employee_id=? order by item_code
                """, (result, rowNum) -> new PayInputRow(result.getString(1), result.getDouble(2)), EMPLOYEE_ID);
        assertThat(actual).containsExactlyElementsOf(expected);
    }

    private void assertApiError(org.assertj.core.api.ThrowableAssert.ThrowingCallable action, int status, String detail) {
        assertThatThrownBy(action).isInstanceOf(ApiException.class).satisfies(error -> {
            ApiException exception = (ApiException) error;
            assertThat(exception.status().value()).isEqualTo(status);
            assertThat(exception.detail()).isEqualTo(detail);
        });
    }

    private void dropFailureTrigger() {
        jdbc.execute("drop trigger if exists vibehr_fail_tim_pay_upsert on pay_variable_inputs");
        jdbc.execute("drop function if exists vibehr_fail_tim_pay_upsert()");
    }

    private static Timestamp timestamp(Instant instant) {
        return Timestamp.valueOf(instant.atOffset(ZoneOffset.UTC).toLocalDateTime());
    }

    private static Set<String> ownedTables() {
        return Set.of("tim_attendance_codes", "tim_work_schedule_codes", "tim_holidays", "tim_schedule_patterns",
                "tim_schedule_pattern_days", "tim_department_schedule_assignments", "tim_employee_schedule_exceptions",
                "tim_employee_daily_schedules", "tim_attendance_daily", "tim_attendance_corrections",
                "tim_annual_leaves", "tim_leave_requests", "tim_month_closes");
    }

    private record PayInputRow(String itemCode, double amount) { }

    private static final class MutableClock extends Clock {
        private final AtomicReference<Instant> current;

        private MutableClock(Instant initial) {
            current = new AtomicReference<>(initial);
        }

        void set(Instant instant) {
            current.set(instant);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return current.get();
        }
    }
}
