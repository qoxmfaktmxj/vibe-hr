package com.vibehr.time;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class TimeAttendanceMutationTest {
    private static final Instant KST_AFTER_MIDNIGHT = Instant.parse("2026-08-01T15:01:00Z");

    @Test
    void checkInNormalizesNaivePlannedKstAndMarksLateAcrossTheUtcDateBoundary() {
        Fixture fixture = fixture(KST_AFTER_MIDNIGHT);
        TimEmployeeDailySchedule schedule = schedule(LocalDateTime.of(2026, 8, 2, 0, 0));
        fixture.scheduleRows(List.of(schedule));
        fixture.attendanceRows(List.of());

        TimAttendanceDailyItem actual = fixture.service.checkIn(11);

        assertThat(actual.workDate()).isEqualTo(LocalDate.of(2026, 8, 2));
        assertThat(actual.checkInAt()).isEqualTo(KST_AFTER_MIDNIGHT);
        assertThat(actual.attendanceStatus()).isEqualTo("late");
    }

    @Test
    void duplicateCheckInReturnsTheFastApiConflictAndKoreanDetail() {
        Fixture fixture = fixture(KST_AFTER_MIDNIGHT);
        fixture.scheduleRows(List.of(schedule(LocalDateTime.of(2026, 8, 2, 9, 0))));
        TimAttendanceDaily row = attendance(KST_AFTER_MIDNIGHT, null);
        fixture.attendanceRows(List.of(row));

        assertApiError(() -> fixture.service.checkIn(11), 409, "오늘 이미 출근 처리되었습니다.");
    }

    @Test
    void checkOutWithoutCheckInReturnsTheFastApiBadRequestAndKoreanDetail() {
        Fixture fixture = fixture(KST_AFTER_MIDNIGHT);
        fixture.attendanceRows(List.of());

        assertApiError(() -> fixture.service.checkOut(11), 400, "출근 기록이 없어 퇴근 처리할 수 없습니다.");
    }

    @Test
    void duplicateCheckOutReturnsTheFastApiConflictAndKoreanDetail() {
        Fixture fixture = fixture(KST_AFTER_MIDNIGHT);
        TimAttendanceDaily row = attendance(Instant.parse("2026-08-01T00:00:00Z"), Instant.parse("2026-08-01T09:00:00Z"));
        fixture.attendanceRows(List.of(row));

        assertApiError(() -> fixture.service.checkOut(11), 409, "오늘 이미 퇴근 처리되었습니다.");
    }

    private void assertApiError(org.assertj.core.api.ThrowableAssert.ThrowingCallable action, int status, String detail) {
        assertThatThrownBy(action).isInstanceOf(ApiException.class).satisfies(error -> {
            ApiException exception = (ApiException) error;
            assertThat(exception.status().value()).isEqualTo(status);
            assertThat(exception.detail()).isEqualTo(detail);
        });
    }

    private Fixture fixture(Instant current) {
        EntityManager entityManager = mock(EntityManager.class);
        TimeGridMapper gridMapper = mock(TimeGridMapper.class);
        TimePayrollGateway payrollGateway = mock(TimePayrollGateway.class);
        Query advisory = mock(Query.class);
        Query employee = mock(Query.class);
        @SuppressWarnings("unchecked") TypedQuery<TimMonthClose> month = mock(TypedQuery.class);
        when(entityManager.createNativeQuery(org.mockito.ArgumentMatchers.contains("pg_advisory_xact_lock"))).thenReturn(advisory);
        when(advisory.setParameter(anyString(), any())).thenReturn(advisory);
        when(advisory.getSingleResult()).thenReturn(null);
        when(entityManager.createNativeQuery(org.mockito.ArgumentMatchers.contains("from hr_employees"))).thenReturn(employee);
        when(employee.setParameter(anyString(), any())).thenReturn(employee);
        when(employee.getResultList()).thenReturn(List.<Object[]>of(new Object[]{"E-11", "Kim", 3, "PEOPLE", "People", java.sql.Date.valueOf("2020-01-01")}));
        when(entityManager.createQuery(anyString(), org.mockito.ArgumentMatchers.eq(TimMonthClose.class))).thenReturn(month);
        when(month.setParameter(anyString(), any())).thenReturn(month);
        when(month.setLockMode(LockModeType.NONE)).thenReturn(month);
        when(month.setMaxResults(1)).thenReturn(month);
        when(month.getResultList()).thenReturn(List.of());
        TimeApplicationService service = new TimeApplicationService(entityManager, gridMapper, payrollGateway,
                Clock.fixed(current, ZoneOffset.UTC));
        return new Fixture(entityManager, service);
    }

    private TimEmployeeDailySchedule schedule(LocalDateTime plannedStart) {
        TimEmployeeDailySchedule schedule = new TimEmployeeDailySchedule();
        schedule.employee_id = 11;
        schedule.work_date = LocalDate.of(2026, 8, 2);
        schedule.planned_start_at = plannedStart;
        schedule.break_minutes = 60;
        schedule.expected_minutes = 480;
        schedule.is_workday = true;
        return schedule;
    }

    private TimAttendanceDaily attendance(Instant checkIn, Instant checkOut) {
        TimAttendanceDaily row = new TimAttendanceDaily();
        row.id = 1;
        row.employee_id = 11;
        row.work_date = LocalDate.of(2026, 8, 2);
        row.check_in_at = checkIn;
        row.check_out_at = checkOut;
        row.attendance_status = "present";
        return row;
    }

    private static final class Fixture {
        private final EntityManager entityManager;
        private final TimeApplicationService service;

        private Fixture(EntityManager entityManager, TimeApplicationService service) {
            this.entityManager = entityManager;
            this.service = service;
        }

        void scheduleRows(List<TimEmployeeDailySchedule> rows) {
            @SuppressWarnings("unchecked") TypedQuery<TimEmployeeDailySchedule> query = mock(TypedQuery.class);
            when(entityManager.createQuery(anyString(), org.mockito.ArgumentMatchers.eq(TimEmployeeDailySchedule.class))).thenReturn(query);
            when(query.setParameter(anyString(), any())).thenReturn(query);
            when(query.setMaxResults(1)).thenReturn(query);
            when(query.getResultList()).thenReturn(rows);
        }

        void attendanceRows(List<TimAttendanceDaily> rows) {
            @SuppressWarnings("unchecked") TypedQuery<TimAttendanceDaily> query = mock(TypedQuery.class);
            when(entityManager.createQuery(anyString(), org.mockito.ArgumentMatchers.eq(TimAttendanceDaily.class))).thenReturn(query);
            when(query.setParameter(anyString(), any())).thenReturn(query);
            when(query.setLockMode(LockModeType.PESSIMISTIC_WRITE)).thenReturn(query);
            when(query.setMaxResults(1)).thenReturn(query);
            when(query.getResultList()).thenReturn(rows);
        }
    }
}
