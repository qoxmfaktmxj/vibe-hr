package com.vibehr.time;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vibehr.auth.CurrentUser;
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
import java.util.TimeZone;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionSynchronizationManager;
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
    private static final int USER_ID = 900002;
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
        jdbc.update("delete from pay_payroll_run_targets where employee_id=?", EMPLOYEE_ID);
        jdbc.update("delete from pay_payroll_runs where run_name='time-finalized-guard'");
        jdbc.update("delete from pay_variable_inputs where employee_id=?", EMPLOYEE_ID);
        jdbc.update("delete from pay_employee_profiles where employee_id=?", EMPLOYEE_ID);
        jdbc.update("delete from tim_attendance_corrections where corrected_by_employee_id=? or attendance_id in (select id from tim_attendance_daily where employee_id=?)", EMPLOYEE_ID, EMPLOYEE_ID);
        jdbc.update("delete from tim_attendance_daily where employee_id=?", EMPLOYEE_ID);
        jdbc.update("delete from tim_employee_daily_schedules where employee_id=?", EMPLOYEE_ID);
        jdbc.update("delete from tim_leave_requests where employee_id=?", EMPLOYEE_ID);
        jdbc.update("delete from tim_annual_leaves where employee_id=?", EMPLOYEE_ID);
        jdbc.update("delete from tim_holidays where name='leave snapshot test'");
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
    void canonicalFlywayV1ThroughV7AndHibernateValidationProvideTheActualTimSchema() {
        assertThat(jdbc.queryForList("select version from flyway_schema_history where success order by installed_rank", String.class))
                .containsExactly("1", "2", "3", "4", "5", "6", "7");
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
    void employeeAuthorizationResolvesOnlyTheLinkedEmployeeWithoutAnOuterTransaction() {
        int otherUserId = USER_ID + 10;
        int otherEmployeeId = EMPLOYEE_ID + 10;
        Timestamp now = timestamp(CLOCK.instant());
        jdbc.update("""
                insert into auth_users(id,login_id,email,password_hash,display_name,is_active,created_at,updated_at)
                values (?,?,?,?,?,?,?,?)
                """, otherUserId, "tim-other-user", "tim-other@example.test", "not-used", "Other employee", true, now, now);
        jdbc.update("""
                insert into hr_employees(id,user_id,employee_no,department_id,position_title,hire_date,employment_status,created_at,updated_at)
                values (?,?,?,?,?,?,?,?,?)
                """, otherEmployeeId, otherUserId, "TIM-OTHER-001", DEPARTMENT_ID, "Engineer", LocalDate.of(2020, 1, 1), "active", now, now);
        try {
            TimeAuthorization authorization = new TimeAuthorization(entityManager);
            var authentication = new TestingAuthenticationToken(new CurrentUser(USER_ID, Set.of("employee")), null, "ROLE_employee");

            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            assertThat(authorization.employeeIdForUser(USER_ID)).isEqualTo(EMPLOYEE_ID);
            assertThat(authorization.employeeIdForUser(otherUserId)).isEqualTo(otherEmployeeId);
            authorization.requireSelfOrManager(authentication, null);
            authorization.requireSelfOrManager(authentication, EMPLOYEE_ID);
            assertApiError(() -> authorization.requireSelfOrManager(authentication, otherEmployeeId), 403, "권한이 없습니다.");
            assertApiError(() -> authorization.employeeIdForUser(USER_ID + 20), 404, "사원 프로필을 찾을 수 없습니다.");
            assertApiError(() -> authorization.userId(null), 401, "인증이 필요합니다.");
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
        } finally {
            jdbc.update("delete from hr_employees where id=?", otherEmployeeId);
            jdbc.update("delete from auth_users where id=?", otherUserId);
        }
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

    @ParameterizedTest
    @ValueSource(strings = {"UTC", "Asia/Seoul"})
    void generatedScheduleRoundTripsUtcStorageAndKstBusinessTimeInEitherJvmZone(String jvmZone) {
        TimeZone previous = TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone(jvmZone));
            LocalDate workDate = LocalDate.of(2026, 8, 3);
            CLOCK.set(Instant.parse("2026-08-03T00:01:00Z"));

            TimScheduleGenerateResponse generated = service.generateSchedules(new TimScheduleGenerateRequest(
                    "department", DEPARTMENT_ID, null, workDate, workDate, "create_if_missing"));

            assertThat(generated.createdCount()).isOne();
            assertThat(jdbc.queryForObject("""
                    select planned_start_at::text from tim_employee_daily_schedules where employee_id=? and work_date=?
                    """, String.class, EMPLOYEE_ID, workDate)).startsWith("2026-08-03 00:00:00");
            assertThat(jdbc.queryForObject("""
                    select planned_end_at::text from tim_employee_daily_schedules where employee_id=? and work_date=?
                    """, String.class, EMPLOYEE_ID, workDate)).startsWith("2026-08-03 09:00:00");
            TimScheduleTodayItem schedule = service.myScheduleToday(EMPLOYEE_ID).item();
            assertThat(schedule.workStart()).isEqualTo("09:00");
            assertThat(schedule.workEnd()).isEqualTo("18:00");
            assertThat(service.checkIn(EMPLOYEE_ID).attendanceStatus()).isEqualTo("late");
        } finally {
            TimeZone.setDefault(previous);
        }
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
    void halfDayApprovalPersistsHalfADayAndCancellationRestoresItExactlyOnce() {
        insertAnnualLeave(2026, 2, 0);
        TimLeaveRequestItem created = service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("half_day",
                LocalDate.of(2026, 8, 3), LocalDate.of(2026, 8, 3), "진료"));

        assertThat(created.leaveDays()).isEqualTo(0.5);
        assertThat(service.decideLeave(created.id(), EMPLOYEE_ID, true, new TimLeaveDecisionRequest(null)).deductionDays()).isEqualTo(0.5);
        assertAnnualLeave(2026, 1.5, 0.5);
        assertThat(jdbc.queryForObject("select (annual_charge_breakdown->>'2026')::double precision from tim_leave_requests where id=?",
                Double.class, created.id())).isEqualTo(0.5);

        service.cancelLeave(created.id(), EMPLOYEE_ID, new TimLeaveDecisionRequest(null));

        assertAnnualLeave(2026, 2, 0);
        assertApiError(() -> service.cancelLeave(created.id(), EMPLOYEE_ID, new TimLeaveDecisionRequest(null)), 409,
                "취소할 수 없는 휴가 상태입니다.");
        assertAnnualLeave(2026, 2, 0);
    }

    @Test
    void crossYearApprovalAndCancellationUseThePersistedPerYearSnapshotAfterHolidayChanges() {
        insertAnnualLeave(2026, 4, 0);
        insertAnnualLeave(2027, 5, 0);
        TimLeaveRequestItem created = service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("annual",
                LocalDate.of(2026, 12, 31), LocalDate.of(2027, 1, 4), "연말 휴가"));

        assertThat(service.decideLeave(created.id(), EMPLOYEE_ID, true, new TimLeaveDecisionRequest(null)).deductionDays()).isEqualTo(3);
        assertAnnualLeave(2026, 3, 1);
        assertAnnualLeave(2027, 3, 2);
        jdbc.update("""
                insert into tim_holidays(holiday_date,name,holiday_type,is_active,created_at,updated_at)
                values (date '2027-01-04','leave snapshot test','company',true,?,?)
                """, timestamp(CLOCK.instant()), timestamp(CLOCK.instant()));

        TimLeaveRequestItem listed = service.leaveRequests(EMPLOYEE_ID, "approved", false, 1, 20).items().getFirst();
        assertThat(listed.deductionDays()).isEqualTo(3);
        TimLeaveRequestItem cancelled = service.cancelLeave(created.id(), EMPLOYEE_ID, new TimLeaveDecisionRequest(null));

        assertThat(cancelled.deductionDays()).isEqualTo(3);
        assertAnnualLeave(2026, 4, 0);
        assertAnnualLeave(2027, 5, 0);
    }

    @Test
    void insufficientSecondYearBalanceRollsBackApprovalAndLeavesEveryBalanceUntouched() {
        insertAnnualLeave(2026, 10, 0);
        insertAnnualLeave(2027, 5, 0);
        TimLeaveRequestItem created = service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("annual",
                LocalDate.of(2026, 12, 31), LocalDate.of(2027, 1, 4), "연말 휴가"));
        jdbc.update("update tim_annual_leaves set remaining_days=1 where employee_id=? and year=2027", EMPLOYEE_ID);

        assertApiError(() -> service.decideLeave(created.id(), EMPLOYEE_ID, true, new TimLeaveDecisionRequest(null)), 400,
                "연차 잔여일수가 부족합니다.");

        assertAnnualLeave(2026, 10, 0);
        assertAnnualLeave(2027, 1, 0);
        assertThat(jdbc.queryForObject("select request_status from tim_leave_requests where id=?", String.class, created.id())).isEqualTo("pending");
        assertThat(jdbc.queryForObject("select annual_charge_breakdown is null from tim_leave_requests where id=?", Boolean.class, created.id())).isTrue();
        service.cancelLeave(created.id(), EMPLOYEE_ID, new TimLeaveDecisionRequest(null));
        assertApiError(() -> service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("annual",
                LocalDate.of(2026, 12, 31), LocalDate.of(2027, 1, 4), "연말 휴가")), 400, "연차 잔여일수가 부족합니다.");
    }

    @Test
    void legacyNullSnapshotCancellationPreservesOldStartYearAnnualAndZeroHalfDayAccounting() {
        insertAnnualLeave(2026, 7, 3);
        insertAnnualLeave(2027, 5, 0);
        int annualRequest = insertLegacyApprovedLeave("annual", LocalDate.of(2026, 12, 31), LocalDate.of(2027, 1, 4));
        int halfDayRequest = insertLegacyApprovedLeave("half_day", LocalDate.of(2026, 8, 3), LocalDate.of(2026, 8, 3));

        service.cancelLeave(annualRequest, EMPLOYEE_ID, new TimLeaveDecisionRequest(null));
        service.cancelLeave(halfDayRequest, EMPLOYEE_ID, new TimLeaveDecisionRequest(null));

        assertAnnualLeave(2026, 10, 0);
        assertAnnualLeave(2027, 5, 0);
    }

    @Test
    void concurrentHalfDayDecisionsAndCancellationsCannotDoubleDebitOrCredit() throws Exception {
        insertAnnualLeave(2026, 2, 0);
        TimLeaveRequestItem created = service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("half_day",
                LocalDate.of(2026, 8, 3), LocalDate.of(2026, 8, 3), "진료"));
        try (var executor = Executors.newFixedThreadPool(2)) {
            CountDownLatch approve = new CountDownLatch(1);
            Future<Object> first = executor.submit(() -> leaveActionAfter(approve,
                    () -> service.decideLeave(created.id(), EMPLOYEE_ID, true, new TimLeaveDecisionRequest(null))));
            Future<Object> second = executor.submit(() -> leaveActionAfter(approve,
                    () -> service.decideLeave(created.id(), EMPLOYEE_ID, true, new TimLeaveDecisionRequest(null))));
            approve.countDown();
            assertLeaveActionResults(List.of(first.get(), second.get()), 400);
            assertAnnualLeave(2026, 1.5, 0.5);

            CountDownLatch cancel = new CountDownLatch(1);
            first = executor.submit(() -> leaveActionAfter(cancel,
                    () -> service.cancelLeave(created.id(), EMPLOYEE_ID, new TimLeaveDecisionRequest(null))));
            second = executor.submit(() -> leaveActionAfter(cancel,
                    () -> service.cancelLeave(created.id(), EMPLOYEE_ID, new TimLeaveDecisionRequest(null))));
            cancel.countDown();
            assertLeaveActionResults(List.of(first.get(), second.get()), 409);
        }
        assertAnnualLeave(2026, 2, 0);
    }

    @Test
    void concurrentOverlappingRequestsWithDifferentStartYearsCreateOnlyOnePendingLeave() throws Exception {
        insertAnnualLeave(2026, 10, 0);
        insertAnnualLeave(2027, 10, 0);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<Object> first = executor.submit(() -> leaveActionAfter(start,
                    () -> service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("annual",
                            LocalDate.of(2026, 12, 31), LocalDate.of(2027, 1, 4), "연말 휴가"))));
            Future<Object> second = executor.submit(() -> leaveActionAfter(start,
                    () -> service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("annual",
                            LocalDate.of(2027, 1, 4), LocalDate.of(2027, 1, 5), "연초 휴가"))));
            start.countDown();
            assertLeaveActionResults(List.of(first.get(), second.get()), 409);
        }
        assertThat(jdbc.queryForObject("select count(*) from tim_leave_requests where employee_id=? and request_status='pending'",
                Integer.class, EMPLOYEE_ID)).isOne();
        assertAnnualLeave(2026, 10, 0);
        assertAnnualLeave(2027, 10, 0);
    }

    @Test
    void unpaidApprovalAppearsInAttendanceAndReportsAndCancellationRemovesOnlyItsGeneratedRow() {
        LocalDate day = LocalDate.of(2026, 8, 3);
        TimLeaveRequestItem leave = service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("unpaid", day, day, "무급 휴가"));

        service.decideLeave(leave.id(), EMPLOYEE_ID, true, new TimLeaveDecisionRequest(null));

        TimAttendanceDailyItem attendance = service.attendanceDaily(day, day, EMPLOYEE_ID, "leave", 1, 50).items().getFirst();
        assertThat(attendance.attendanceStatus()).isEqualTo("leave");
        assertThat(attendance.approvedLeaveType()).isEqualTo("unpaid");
        assertThat(attendance.checkInAt()).isNull();
        assertThat(jdbc.queryForObject("select (payroll_minutes_snapshot->>'2026-08')::integer from tim_leave_requests where id=?",
                Integer.class, leave.id())).isEqualTo(480);
        assertThat(service.report(day, day).statusCounts().leave()).isOne();
        CLOCK.set(Instant.parse("2026-08-03T00:00:00Z"));
        assertThat(service.attendanceToday(EMPLOYEE_ID).item().approvedLeaveType()).isEqualTo("unpaid");
        assertThatThrownBy(() -> service.checkIn(EMPLOYEE_ID)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.correctAttendance(attendance.id(), EMPLOYEE_ID,
                new TimAttendanceCorrectRequest("present", "교정", null, null))).isInstanceOf(ApiException.class);

        service.cancelLeave(leave.id(), EMPLOYEE_ID, new TimLeaveDecisionRequest(null));

        assertThat(service.attendanceDaily(day, day, EMPLOYEE_ID, null, 1, 50).totalCount()).isZero();
        assertThat(service.report(day, day).statusCounts().leave()).isZero();
        assertThat(jdbc.queryForObject("select request_status from tim_leave_requests where id=?", String.class, leave.id())).isEqualTo("cancelled");
    }

    @Test
    void paidHalfDayKeepsRealWorkIsIncludedInLeaveFilterAndClosesAsHalfADay() {
        LocalDate day = LocalDate.of(2026, 8, 3);
        Instant checkIn = Instant.parse("2026-08-03T00:00:00Z");
        Instant checkOut = Instant.parse("2026-08-03T05:00:00Z");
        insertAttendance(day, checkIn, checkOut);
        insertAnnualLeave(2026, 2, 0);
        TimLeaveRequestItem leave = service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("half_day", day, day, "오전 반차"));

        service.decideLeave(leave.id(), EMPLOYEE_ID, true, new TimLeaveDecisionRequest(null));

        TimAttendanceDailyItem attendance = service.attendanceDaily(day, day, EMPLOYEE_ID, "leave", 1, 50).items().getFirst();
        assertThat(attendance.attendanceStatus()).isEqualTo("present");
        assertThat(attendance.approvedLeaveType()).isEqualTo("half_day");
        assertThat(attendance.checkInAt()).isEqualTo(checkIn);
        assertThat(attendance.checkOutAt()).isEqualTo(checkOut);
        assertThat(attendance.actualMinutes()).isEqualTo(240);
        assertThat(attendance.overtimeMinutes()).isZero();
        assertThat(service.report(day, day).statusCounts().present()).isOne();
        assertThat(service.report(day, day).statusCounts().leave()).isOne();
        assertThat(service.closeMonth(new TimMonthCloseRequest(2026, 8, "half-day close"), USER_ID).item().leaveDays()).isEqualTo(0.5);
        assertThat(jdbc.queryForObject("select leave_days from tim_month_closes where year=2026 and month=8", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select half_day_count from tim_month_closes where year=2026 and month=8", Integer.class)).isOne();

        service.reopenMonth(2026, 8, USER_ID);
        service.correctAttendance(attendance.id(), EMPLOYEE_ID, new TimAttendanceCorrectRequest("remote", "재택 교정", checkIn, checkOut));
        service.cancelLeave(leave.id(), EMPLOYEE_ID, new TimLeaveDecisionRequest(null));

        TimAttendanceDailyItem restored = service.attendanceDetail(attendance.id());
        assertThat(restored.attendanceStatus()).isEqualTo("remote");
        assertThat(restored.approvedLeaveType()).isNull();
        assertThat(restored.actualMinutes()).isEqualTo(240);
        assertAnnualLeave(2026, 2, 0);
    }

    @Test
    void aLaterPunchConflictRollsBackEveryAttendanceLinkAndAnnualCharge() {
        insertAnnualLeave(2026, 5, 0);
        insertAttendance(LocalDate.of(2026, 8, 4), Instant.parse("2026-08-04T00:00:00Z"), Instant.parse("2026-08-04T09:00:00Z"));
        TimLeaveRequestItem leave = service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("annual",
                LocalDate.of(2026, 8, 3), LocalDate.of(2026, 8, 4), "연차"));

        assertThatThrownBy(() -> service.decideLeave(leave.id(), EMPLOYEE_ID, true, new TimLeaveDecisionRequest(null)))
                .isInstanceOf(ApiException.class).satisfies(error -> assertThat(((ApiException) error).status().value()).isEqualTo(409));

        assertAnnualLeave(2026, 5, 0);
        assertThat(jdbc.queryForObject("select count(*) from tim_attendance_daily where employee_id=? and approved_leave_request_id is not null", Integer.class, EMPLOYEE_ID)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from tim_attendance_daily where employee_id=?", Integer.class, EMPLOYEE_ID)).isOne();
        assertThat(jdbc.queryForObject("select request_status from tim_leave_requests where id=?", String.class, leave.id())).isEqualTo("pending");
    }

    @Test
    void unpaidMinutesUseGeneratedWorkdaysAndRemainFrozenAcrossCalendarChanges() {
        LocalDate first = LocalDate.of(2026, 12, 31);
        LocalDate holiday = LocalDate.of(2027, 1, 1);
        insertSchedule(first, first.atTime(9, 0), first.atTime(16, 0), false, true);
        jdbc.update("update tim_employee_daily_schedules set expected_minutes=360 where employee_id=? and work_date=?", EMPLOYEE_ID, first);
        insertSchedule(holiday, holiday.atTime(9, 0), holiday.atTime(18, 0), true, false);
        TimLeaveRequestItem leave = service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("unpaid", first, LocalDate.of(2027, 1, 4), "연말 휴가"));

        service.decideLeave(leave.id(), EMPLOYEE_ID, true, new TimLeaveDecisionRequest(null));

        assertThat(jdbc.queryForObject("select payroll_minutes_snapshot = cast(? as jsonb) from tim_leave_requests where id=?", Boolean.class,
                "{\"2026-12\":360,\"2027-01\":480}", leave.id())).isTrue();
        assertThat(service.attendanceDaily(first, LocalDate.of(2027, 1, 4), EMPLOYEE_ID, "leave", 1, 50).totalCount()).isEqualTo(2);
        jdbc.update("update tim_employee_daily_schedules set is_workday=false, expected_minutes=0 where employee_id=?", EMPLOYEE_ID);

        service.cancelLeave(leave.id(), EMPLOYEE_ID, new TimLeaveDecisionRequest(null));

        assertThat(jdbc.queryForObject("select count(*) from tim_attendance_daily where employee_id=?", Integer.class, EMPLOYEE_ID)).isZero();
        assertThat(jdbc.queryForObject("select (payroll_minutes_snapshot->>'2026-12')::integer from tim_leave_requests where id=?", Integer.class, leave.id())).isEqualTo(360);
    }

    @Test
    void scheduledWorkingSaturdayUnpaidLeaveShowsOneDayInApprovalAndList() {
        LocalDate saturday = LocalDate.of(2026, 8, 8);
        insertSchedule(saturday, saturday.atTime(9, 0), saturday.atTime(18, 0), false, true);
        TimLeaveRequestItem created = service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("unpaid", saturday, saturday, "토요일 근무 휴가"));

        TimLeaveRequestItem approved = service.decideLeave(created.id(), EMPLOYEE_ID, true, new TimLeaveDecisionRequest(null));

        assertThat(approved.leaveDays()).isEqualTo(1);
        assertThat(approved.deductionDays()).isEqualTo(1);
        assertThat(service.leaveRequests(EMPLOYEE_ID, "approved", false, 1, 50).items().getFirst().leaveDays()).isEqualTo(1);
        assertThat(service.attendanceDaily(saturday, saturday, EMPLOYEE_ID, "leave", 1, 50).totalCount()).isOne();
        assertThat(jdbc.queryForObject("select (payroll_minutes_snapshot->>'2026-08')::integer from tim_leave_requests where id=?", Integer.class, created.id())).isEqualTo(480);
    }

    @Test
    void approvedZeroWorkdayUnpaidSnapshotShowsZeroDaysInApprovalAndList() {
        LocalDate day = LocalDate.of(2026, 8, 3);
        insertSchedule(day, day.atTime(9, 0), day.atTime(18, 0), false, false);
        TimLeaveRequestItem created = service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("unpaid", day, day, "비근무일"));

        TimLeaveRequestItem approved = service.decideLeave(created.id(), EMPLOYEE_ID, true, new TimLeaveDecisionRequest(null));

        assertThat(approved.leaveDays()).isZero();
        assertThat(service.leaveRequests(EMPLOYEE_ID, "approved", false, 1, 50).items().getFirst().leaveDays()).isZero();
        assertThat(jdbc.queryForObject("select payroll_minutes_snapshot = '{}'::jsonb from tim_leave_requests where id=?", Boolean.class, created.id())).isTrue();
        assertThat(service.attendanceDaily(day, day, EMPLOYEE_ID, "leave", 1, 50).totalCount()).isZero();
    }

    @Test
    void correctedGeneratedHalfDayRetainsItsHistoryAndUnderlyingStatusOnCancellation() {
        LocalDate day = LocalDate.of(2026, 8, 3);
        insertAnnualLeave(2026, 1, 0);
        TimLeaveRequestItem leave = service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("half_day", day, day, "반차"));
        service.decideLeave(leave.id(), EMPLOYEE_ID, true, new TimLeaveDecisionRequest(null));
        int attendanceId = service.attendanceDaily(day, day, EMPLOYEE_ID, null, 1, 50).items().getFirst().id();
        service.correctAttendance(attendanceId, EMPLOYEE_ID, new TimAttendanceCorrectRequest("remote", "재택 교정", null, null));

        service.cancelLeave(leave.id(), EMPLOYEE_ID, new TimLeaveDecisionRequest(null));

        assertThat(service.attendanceDetail(attendanceId).attendanceStatus()).isEqualTo("remote");
        assertThat(service.corrections(attendanceId).totalCount()).isOne();
        assertThat(jdbc.queryForObject("select approved_leave_request_id is null and not leave_generated from tim_attendance_daily where id=?", Boolean.class, attendanceId)).isTrue();
    }

    @Test
    void finalizedPayrollStillBlocksApprovalAndCancellationAfterTimeMonthReopens() {
        LocalDate day = LocalDate.of(2026, 8, 3);
        TimLeaveRequestItem approved = service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("unpaid", day, day, "무급"));
        service.decideLeave(approved.id(), EMPLOYEE_ID, true, new TimLeaveDecisionRequest(null));
        service.closeMonth(new TimMonthCloseRequest(2026, 8, "before payroll"), USER_ID);
        service.reopenMonth(2026, 8, USER_ID);
        Integer codeId = jdbc.queryForObject("select id from pay_payroll_codes order by id limit 1", Integer.class);
        Integer runId = jdbc.queryForObject("""
                insert into pay_payroll_runs(year_month,payroll_code_id,run_name,status,total_employees,total_gross,total_deductions,total_net,created_at,updated_at)
                values ('2026-08',?,'time-finalized-guard','paid',1,0,0,0,?,?) returning id
                """, Integer.class, codeId, timestamp(CLOCK.instant()), timestamp(CLOCK.instant()));
        jdbc.update("""
                insert into pay_payroll_run_targets(run_id,employee_id,event_count,review_required,snapshot_json,created_at,updated_at)
                values (?,?,0,false,'{}'::json,?,?)
                """, runId, EMPLOYEE_ID, timestamp(CLOCK.instant()), timestamp(CLOCK.instant()));
        TimLeaveRequestItem pending = service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("unpaid", day.plusDays(1), day.plusDays(1), "대기"));

        assertThatThrownBy(() -> service.cancelLeave(approved.id(), EMPLOYEE_ID, new TimLeaveDecisionRequest(null)))
                .isInstanceOf(ApiException.class).satisfies(error -> assertThat(((ApiException) error).status().value()).isEqualTo(409));
        assertThatThrownBy(() -> service.decideLeave(pending.id(), EMPLOYEE_ID, true, new TimLeaveDecisionRequest(null)))
                .isInstanceOf(ApiException.class).satisfies(error -> assertThat(((ApiException) error).status().value()).isEqualTo(409));

        assertThat(jdbc.queryForObject("select request_status from tim_leave_requests where id=?", String.class, approved.id())).isEqualTo("approved");
        assertThat(jdbc.queryForObject("select request_status from tim_leave_requests where id=?", String.class, pending.id())).isEqualTo("pending");
        assertThat(jdbc.queryForObject("select status from pay_payroll_runs where id=?", String.class, runId)).isEqualTo("paid");
        assertThat(service.attendanceDaily(day, day.plusDays(1), EMPLOYEE_ID, "leave", 1, 50).totalCount()).isOne();
    }

    @Test
    void approvalAndMonthCloseSerializeToOneConsistentAttendanceSnapshot() throws Exception {
        LocalDate day = LocalDate.of(2026, 8, 3);
        TimLeaveRequestItem leave = service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("unpaid", day, day, "무급"));
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<Object> approval = executor.submit(() -> leaveActionAfter(start,
                    () -> service.decideLeave(leave.id(), EMPLOYEE_ID, true, new TimLeaveDecisionRequest(null))));
            Future<Object> close = executor.submit(() -> closeAfter(start));
            start.countDown();
            Object result = approval.get(20, TimeUnit.SECONDS);
            assertThat(close.get(20, TimeUnit.SECONDS)).isInstanceOf(TimMonthCloseActionResponse.class);
            if (result instanceof ApiException error) {
                assertThat(error.status().value()).isEqualTo(423);
                assertThat(jdbc.queryForObject("select request_status from tim_leave_requests where id=?", String.class, leave.id())).isEqualTo("pending");
                assertThat(jdbc.queryForObject("select leave_days from tim_month_closes where year=2026 and month=8", Integer.class)).isZero();
            } else {
                assertThat(result).isInstanceOf(TimLeaveRequestItem.class);
                assertThat(jdbc.queryForObject("select leave_days from tim_month_closes where year=2026 and month=8", Integer.class)).isOne();
            }
        }
    }

    @Test
    void cancellationAndMonthCloseCannotFreezeCancelledLeaveAttendance() throws Exception {
        LocalDate day = LocalDate.of(2026, 8, 3);
        TimLeaveRequestItem leave = service.createLeave(EMPLOYEE_ID, new TimLeaveRequestCreateRequest("unpaid", day, day, "무급"));
        service.decideLeave(leave.id(), EMPLOYEE_ID, true, new TimLeaveDecisionRequest(null));
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<Object> cancellation = executor.submit(() -> leaveActionAfter(start,
                    () -> service.cancelLeave(leave.id(), EMPLOYEE_ID, new TimLeaveDecisionRequest(null))));
            Future<Object> close = executor.submit(() -> closeAfter(start));
            start.countDown();
            Object result = cancellation.get(20, TimeUnit.SECONDS);
            assertThat(close.get(20, TimeUnit.SECONDS)).isInstanceOf(TimMonthCloseActionResponse.class);
            if (result instanceof ApiException error) {
                assertThat(error.status().value()).isEqualTo(423);
                assertThat(jdbc.queryForObject("select request_status from tim_leave_requests where id=?", String.class, leave.id())).isEqualTo("approved");
                assertThat(jdbc.queryForObject("select leave_days from tim_month_closes where year=2026 and month=8", Integer.class)).isOne();
            } else {
                assertThat(result).isInstanceOf(TimLeaveRequestItem.class);
                assertThat(jdbc.queryForObject("select request_status from tim_leave_requests where id=?", String.class, leave.id())).isEqualTo("cancelled");
                assertThat(jdbc.queryForObject("select leave_days from tim_month_closes where year=2026 and month=8", Integer.class)).isZero();
                assertThat(jdbc.queryForObject("select count(*) from tim_attendance_daily where employee_id=?", Integer.class, EMPLOYEE_ID)).isZero();
            }
        }
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

    @Test
    void monthCloseUsesTheLatestProfileOverlappingTheMonthRatherThanANewerExpiredProfile() {
        seedAugustPayWork();
        Integer payrollCodeId = jdbc.queryForObject("select id from pay_payroll_codes order by id limit 1", Integer.class);
        jdbc.update("""
                insert into pay_employee_profiles
                       (employee_id,payroll_code_id,base_salary,pay_type_code,payment_day_type,holiday_adjustment,
                        effective_from,effective_to,is_active,created_at,updated_at)
                values (?,?,4180000,'regular','fixed_day','previous_business_day',
                        date '2025-01-01',date '2026-07-31',true,?,?)
                """, EMPLOYEE_ID, payrollCodeId, timestamp(CLOCK.instant()), timestamp(CLOCK.instant()));

        service.closeMonth(new TimMonthCloseRequest(2026, 8, "profile period"), USER_ID);

        assertPayInputs(List.of(
                new PayInputRow("HDN", 160000), new PayInputRow("HDO", 60000), new PayInputRow("HDW", 240000),
                new PayInputRow("NGT", 40000), new PayInputRow("OTX", 15000)));
    }

    @Test
    void monthCloseDoesNotGeneratePayInputsForProfilesEndingBeforeTheMonth() {
        seedAugustPayWork();
        jdbc.update("update pay_employee_profiles set effective_to=date '2026-07-31' where employee_id=?", EMPLOYEE_ID);

        service.closeMonth(new TimMonthCloseRequest(2026, 8, "expired profile"), USER_ID);

        assertPayInputs(List.of());
    }

    @Test
    void recloseClearsPreviouslyGeneratedAmountsWhenNoProfileStillOverlapsTheMonth() {
        seedAugustPayWork();
        service.closeMonth(new TimMonthCloseRequest(2026, 8, "initial close"), USER_ID);
        service.reopenMonth(2026, 8, USER_ID);
        jdbc.update("update pay_employee_profiles set effective_to=date '2026-07-31' where employee_id=?", EMPLOYEE_ID);

        service.closeMonth(new TimMonthCloseRequest(2026, 8, "expired profile reclose"), USER_ID);

        assertPayInputs(List.of(new PayInputRow("HDN", 0), new PayInputRow("HDO", 0), new PayInputRow("HDW", 0),
                new PayInputRow("NGT", 0), new PayInputRow("OTX", 0)));
    }

    @Test
    void profileEndingOnTheFirstDayOfTheMonthStillMatchesPayrollPeriodSelection() {
        seedAugustPayWork();
        jdbc.update("update pay_employee_profiles set effective_to=date '2026-08-01' where employee_id=?", EMPLOYEE_ID);

        service.closeMonth(new TimMonthCloseRequest(2026, 8, "inclusive profile boundary"), USER_ID);

        assertPayInputs(List.of(
                new PayInputRow("HDN", 160000), new PayInputRow("HDO", 60000), new PayInputRow("HDW", 240000),
                new PayInputRow("NGT", 40000), new PayInputRow("OTX", 15000)));
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

    private void insertAnnualLeave(int year, double remaining, double used) {
        jdbc.update("""
                insert into tim_annual_leaves(employee_id,year,granted_days,used_days,carried_over_days,remaining_days,grant_type,created_at,updated_at)
                values (?,?,?,?,0,?,'test',?,?)
                """, EMPLOYEE_ID, year, remaining + used, used, remaining, timestamp(CLOCK.instant()), timestamp(CLOCK.instant()));
    }

    private int insertLegacyApprovedLeave(String type, LocalDate start, LocalDate end) {
        return jdbc.queryForObject("""
                insert into tim_leave_requests(employee_id,leave_type,start_date,end_date,reason,request_status,created_at,updated_at)
                values (?,?,?,?, 'legacy request','approved',?,?) returning id
                """, Integer.class, EMPLOYEE_ID, type, start, end, timestamp(CLOCK.instant()), timestamp(CLOCK.instant()));
    }

    private void assertAnnualLeave(int year, double remaining, double used) {
        assertThat(jdbc.queryForObject("select remaining_days from tim_annual_leaves where employee_id=? and year=?",
                Double.class, EMPLOYEE_ID, year)).isEqualTo(remaining);
        assertThat(jdbc.queryForObject("select used_days from tim_annual_leaves where employee_id=? and year=?",
                Double.class, EMPLOYEE_ID, year)).isEqualTo(used);
    }

    private Object leaveActionAfter(CountDownLatch start, Supplier<TimLeaveRequestItem> action) throws Exception {
        start.await();
        try {
            return action.get();
        } catch (ApiException error) {
            return error;
        }
    }

    private void assertLeaveActionResults(List<Object> results, int conflictStatus) {
        assertThat(results.stream().filter(TimLeaveRequestItem.class::isInstance)).hasSize(1);
        assertThat(results.stream().filter(ApiException.class::isInstance).map(ApiException.class::cast)
                .map(error -> error.status().value())).containsExactly(conflictStatus);
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
