package com.vibehr.time;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.doAnswer;
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
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TimeLeaveAttendanceTest {
    @Test
    void unpaidApprovalFreezesMonthlyScheduledMinutesAndOnlyLinksWorkingDays() {
        Fixture fixture = new Fixture("unpaid", "2026-12-31", "2027-01-04");
        fixture.schedule("2026-12-31", true, false, 360);
        fixture.schedule("2027-01-01", false, false, 480);

        fixture.approve();

        assertThat(fixture.leave.payroll_minutes_snapshot).isEqualTo(Map.of("2026-12", 360, "2027-01", 480));
        assertThat(fixture.attendance).extracting(row -> row.work_date)
                .containsExactly(date("2026-12-31"), date("2027-01-04"));
        assertThat(fixture.attendance).allSatisfy(row -> {
            assertThat(row.attendance_status).isEqualTo("leave");
            assertThat(row.approved_leave_request_id).isEqualTo(22);
            assertThat(row.leave_generated).isTrue();
        });
    }

    @Test
    void zeroWorkingDayUnpaidApprovalStoresAnEmptySnapshotRatherThanLegacyNull() {
        Fixture fixture = new Fixture("unpaid", "2026-08-08", "2026-08-09");

        fixture.approve();

        assertThat(fixture.leave.payroll_minutes_snapshot).isEmpty();
        assertThat(fixture.attendance).isEmpty();
    }

    @Test
    void fullDayApprovalRejectsExistingPunchesBeforeChangingAnnualBalances() {
        Fixture fixture = new Fixture("annual", "2026-08-03", "2026-08-03");
        TimAttendanceDaily row = fixture.attendance("remote");
        row.check_in_at = Instant.parse("2026-08-03T00:00:00Z");

        assertThatThrownBy(fixture::approve).isInstanceOf(ApiException.class)
                .satisfies(error -> assertThat(((ApiException) error).status().value()).isEqualTo(409));

        assertThat(fixture.annual.used_days).isZero();
        assertThat(fixture.annual.remaining_days).isEqualTo(10);
        assertThat(fixture.leave.request_status).isEqualTo("pending");
        assertThat(row.attendance_status).isEqualTo("remote");
        assertThat(row.approved_leave_request_id).isNull();
    }

    @Test
    void cancellationRestoresAnExistingStatusEvenAfterTheScheduleChanges() {
        Fixture fixture = new Fixture("sick", "2026-08-03", "2026-08-03");
        TimAttendanceDaily row = fixture.attendance("remote");
        fixture.approve();
        assertThat(row.attendance_status).isEqualTo("leave");
        assertThat(fixture.service.attendanceDetail(row.id).approvedLeaveType()).isEqualTo("sick");
        fixture.schedule("2026-08-03", false, true, 0);

        fixture.cancel();

        assertThat(fixture.attendance).containsExactly(row);
        assertThat(row.attendance_status).isEqualTo("remote");
        assertThat(row.approved_leave_request_id).isNull();
        assertThat(row.leave_base_status).isNull();
    }

    @Test
    void halfDayRetainsWorkedMinutesAndCancellationKeepsTheLatestCorrection() {
        Fixture fixture = new Fixture("half_day", "2026-08-03", "2026-08-03");
        TimAttendanceDaily row = fixture.attendance("present");
        row.check_in_at = Instant.parse("2026-08-03T00:00:00Z");
        row.check_out_at = Instant.parse("2026-08-03T05:00:00Z");
        fixture.approve();
        assertThat(row.attendance_status).isEqualTo("present");
        assertThat(row.actual_minutes).isEqualTo(240);
        assertThat(row.overtime_minutes).isZero();
        assertThat(fixture.leave.payroll_minutes_snapshot).isNull();
        assertThat(fixture.service.attendanceDetail(row.id).approvedLeaveType()).isEqualTo("half_day");

        fixture.service.correctAttendance(row.id, 7, new TimAttendanceCorrectRequest("remote", "교정",
                row.check_in_at, row.check_out_at));
        fixture.cancel();

        assertThat(row.attendance_status).isEqualTo("remote");
        assertThat(row.actual_minutes).isEqualTo(240);
        assertThat(row.approved_leave_request_id).isNull();
        assertThat(fixture.annual.remaining_days).isEqualTo(10);
    }

    @Test
    void emptyGeneratedAttendanceIsRemovedOnCancellation() {
        Fixture fixture = new Fixture("unpaid", "2026-08-03", "2026-08-03");
        fixture.approve();
        assertThat(fixture.attendance).hasSize(1);

        fixture.cancel();

        assertThat(fixture.attendance).isEmpty();
    }

    @Test
    void employeeNonworkingScheduleRejectsHalfDayBeforeAnnualCharge() {
        Fixture fixture = new Fixture("half_day", "2026-08-03", "2026-08-03");
        fixture.schedule("2026-08-03", false, false, 0);

        assertThatThrownBy(fixture::approve).isInstanceOf(ApiException.class);

        assertThat(fixture.annual.remaining_days).isEqualTo(10);
        assertThat(fixture.attendance).isEmpty();
    }

    @Test
    void activeFullDayLeaveRejectsPunchesAndConflictingCorrections() {
        Fixture fixture = new Fixture("unpaid", "2026-08-03", "2026-08-03");
        fixture.approve();
        TimAttendanceDaily row = fixture.attendance.getFirst();

        assertThatThrownBy(() -> fixture.service.checkIn(11)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> fixture.service.checkOut(11)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> fixture.service.correctAttendance(row.id, 7,
                new TimAttendanceCorrectRequest("present", "교정", null, null))).isInstanceOf(ApiException.class);

        assertThat(row.check_in_at).isNull();
        assertThat(row.attendance_status).isEqualTo("leave");
        assertThat(fixture.correctionCount).isZero();
    }

    @Test
    void halfDayCheckInUpdatesTheUnderlyingStatusAndSurvivesCancellation() {
        Fixture fixture = new Fixture("half_day", "2026-08-03", "2026-08-03");
        fixture.approve();
        TimAttendanceDaily row = fixture.attendance.getFirst();

        assertThat(fixture.service.checkIn(11).approvedLeaveType()).isEqualTo("half_day");
        fixture.cancel();

        assertThat(fixture.attendance).containsExactly(row);
        assertThat(row.check_in_at).isEqualTo(Instant.parse("2026-08-03T00:00:00Z"));
        assertThat(row.attendance_status).isEqualTo("present");
    }

    @Test
    void generatedRowWithCorrectionHistoryIsRetainedEvenWithoutPunches() {
        Fixture fixture = new Fixture("half_day", "2026-08-03", "2026-08-03");
        fixture.approve();
        TimAttendanceDaily row = fixture.attendance.getFirst();
        fixture.service.correctAttendance(row.id, 7, new TimAttendanceCorrectRequest("remote", "교정", null, null));

        fixture.cancel();

        assertThat(fixture.attendance).containsExactly(row);
        assertThat(row.attendance_status).isEqualTo("remote");
        assertThat(row.approved_leave_request_id).isNull();
    }

    @Test
    void finalizedPayrollBlocksBothNewApprovalAndCancellationWithoutChangingTheSource() {
        Fixture fixture = new Fixture("unpaid", "2026-08-03", "2026-08-03");
        fixture.finalizedPayroll = List.of(44);
        assertThatThrownBy(fixture::approve).isInstanceOf(ApiException.class);
        assertThat(fixture.leave.request_status).isEqualTo("pending");
        assertThat(fixture.leave.payroll_minutes_snapshot).isNull();
        assertThat(fixture.attendance).isEmpty();
        fixture.finalizedPayroll = List.of();
        fixture.approve();
        fixture.finalizedPayroll = List.of(44);

        assertThatThrownBy(fixture::cancel).isInstanceOf(ApiException.class);

        assertThat(fixture.leave.request_status).isEqualTo("approved");
        assertThat(fixture.attendance).hasSize(1);
        assertThat(fixture.leave.payroll_minutes_snapshot).containsEntry("2026-08", 480);
    }

    @Test
    void crossMonthApprovalLocksMonthsInOrderBeforeAttendanceKeys() {
        Fixture fixture = new Fixture("unpaid", "2026-12-31", "2027-01-01");

        fixture.approve();

        assertThat(fixture.locks).startsWith("tim:month-close:2026:12", "tim:month-close:2027:1", "tim:attendance:11:2026-12-31");
    }

    private static LocalDate date(String value) { return LocalDate.parse(value); }

    private static final class Fixture {
        private final EntityManager entityManager = mock(EntityManager.class);
        private final TimeApplicationService service = new TimeApplicationService(entityManager, mock(TimeGridMapper.class),
                mock(TimePayrollGateway.class), Clock.fixed(Instant.parse("2026-08-03T00:00:00Z"), ZoneOffset.UTC));
        private final TimLeaveRequest leave = new TimLeaveRequest();
        private final TimAnnualLeave annual = new TimAnnualLeave();
        private final List<TimAttendanceDaily> attendance = new ArrayList<>();
        private final Map<LocalDate, TimEmployeeDailySchedule> schedules = new HashMap<>();
        private final List<String> locks = new ArrayList<>();
        private List<Integer> finalizedPayroll = List.of();
        private long correctionCount;

        @SuppressWarnings("unchecked")
        private Fixture(String type, String start, String end) {
            leave.id = 22; leave.employee_id = 11; leave.leave_type = type;
            leave.start_date = date(start); leave.end_date = date(end); leave.request_status = "pending";
            annual.year = leave.start_date.getYear(); annual.remaining_days = 10;
            Query nativeQuery = mock(Query.class, RETURNS_SELF);
            when(nativeQuery.getResultList()).thenAnswer(ignored -> finalizedPayroll);
            when(nativeQuery.setParameter(eq("key"), any())).thenAnswer(parameter -> { locks.add(parameter.getArgument(1)); return nativeQuery; });
            when(entityManager.createNativeQuery(anyString())).thenReturn(nativeQuery);
            Query employee = mock(Query.class, RETURNS_SELF);
            when(entityManager.createNativeQuery(contains("from hr_employees"))).thenReturn(employee);
            when(employee.getResultList()).thenReturn(List.<Object[]>of(new Object[]{"E-11", "Kim", 3, "PEOPLE", "People", java.sql.Date.valueOf("2020-01-01")}));
            when(entityManager.find(eq(TimLeaveRequest.class), anyInt())).thenReturn(leave);
            when(entityManager.find(eq(TimLeaveRequest.class), anyInt(), eq(LockModeType.PESSIMISTIC_WRITE))).thenReturn(leave);
            when(entityManager.find(eq(TimAttendanceDaily.class), anyInt())).thenAnswer(invocation ->
                    attendance.stream().filter(row -> row.id.equals(invocation.getArgument(1))).findFirst().orElse(null));
            when(entityManager.find(eq(TimAttendanceDaily.class), anyInt(), eq(LockModeType.PESSIMISTIC_WRITE))).thenAnswer(invocation ->
                    attendance.stream().filter(row -> row.id.equals(invocation.getArgument(1))).findFirst().orElse(null));
            TypedQuery<TimMonthClose> month = mock(TypedQuery.class, RETURNS_SELF);
            when(entityManager.createQuery(anyString(), eq(TimMonthClose.class))).thenReturn(month);
            when(month.getResultList()).thenReturn(List.of());
            TypedQuery<TimHoliday> holiday = mock(TypedQuery.class, RETURNS_SELF);
            when(entityManager.createQuery(anyString(), eq(TimHoliday.class))).thenReturn(holiday);
            when(holiday.getResultList()).thenReturn(List.of());
            TypedQuery<TimAnnualLeave> annualQuery = mock(TypedQuery.class, RETURNS_SELF);
            when(entityManager.createQuery(anyString(), eq(TimAnnualLeave.class))).thenReturn(annualQuery);
            when(annualQuery.getResultList()).thenReturn(List.of(annual));
            when(entityManager.createQuery(anyString(), eq(TimEmployeeDailySchedule.class))).thenAnswer(invocation -> {
                TypedQuery<TimEmployeeDailySchedule> query = mock(TypedQuery.class, RETURNS_SELF);
                LocalDate[] day = new LocalDate[1];
                when(query.setParameter(eq("workDate"), any())).thenAnswer(parameter -> { day[0] = parameter.getArgument(1); return query; });
                when(query.getResultList()).thenAnswer(ignored -> schedules.containsKey(day[0]) ? List.of(schedules.get(day[0])) : List.of());
                return query;
            });
            when(entityManager.createQuery(anyString(), eq(TimAttendanceDaily.class))).thenAnswer(invocation -> {
                TypedQuery<TimAttendanceDaily> query = mock(TypedQuery.class, RETURNS_SELF);
                Map<String, Object> parameters = new HashMap<>();
                when(query.setParameter(anyString(), any())).thenAnswer(parameter -> { parameters.put(parameter.getArgument(0), parameter.getArgument(1)); return query; });
                when(query.getResultList()).thenAnswer(ignored -> attendance.stream()
                        .filter(row -> !parameters.containsKey("workDate") || row.work_date.equals(parameters.get("workDate")))
                        .filter(row -> !parameters.containsKey("requestId") || parameters.get("requestId").equals(row.approved_leave_request_id)).toList());
                return query;
            });
            TypedQuery<Long> count = mock(TypedQuery.class, RETURNS_SELF);
            when(entityManager.createQuery(anyString(), eq(Long.class))).thenReturn(count);
            when(count.getSingleResult()).thenAnswer(ignored -> correctionCount);
            doAnswer(invocation -> {
                if (invocation.getArgument(0) instanceof TimAttendanceDaily row) { row.id = 101 + attendance.size(); attendance.add(row); }
                if (invocation.getArgument(0) instanceof TimAttendanceCorrection) correctionCount++;
                return null;
            }).when(entityManager).persist(any());
            doAnswer(invocation -> { attendance.remove(invocation.getArgument(0)); return null; }).when(entityManager).remove(any());
        }

        private void schedule(String day, boolean workday, boolean holiday, int minutes) {
            TimEmployeeDailySchedule row = new TimEmployeeDailySchedule();
            row.work_date = date(day); row.is_workday = workday; row.is_holiday = holiday; row.expected_minutes = minutes;
            row.break_minutes = 60; schedules.put(row.work_date, row);
        }

        private TimAttendanceDaily attendance(String status) {
            TimAttendanceDaily row = new TimAttendanceDaily();
            row.id = 101; row.employee_id = 11; row.work_date = leave.start_date; row.attendance_status = status;
            attendance.add(row); return row;
        }

        private void approve() { service.decideLeave(22, 7, true, new TimLeaveDecisionRequest(null)); }
        private void cancel() { service.cancelLeave(22, 11, new TimLeaveDecisionRequest(null)); }
    }
}
