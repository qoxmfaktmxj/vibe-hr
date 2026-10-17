package com.vibehr.time;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class TimeLeaveAccountingTest {
    @Test
    void halfDayCreateApproveAndCancelUseHalfAnAnnualDay() {
        Fixture fixture = new Fixture();
        TimAnnualLeave annual = fixture.balance(2026, 2);

        TimLeaveRequestItem created = fixture.service.createLeave(11,
                new TimLeaveRequestCreateRequest("half_day", date("2026-08-03"), date("2026-08-03"), "진료"));

        assertThat(created.calendarDays()).isEqualTo(1);
        assertThat(created.leaveDays()).isEqualTo(0.5);
        assertThat(created.deductionDays()).isEqualTo(0.5);
        assertThat(annual.remaining_days).isEqualTo(2);
        TimLeaveRequestItem approved = fixture.service.decideLeave(created.id(), 7, true, new TimLeaveDecisionRequest("승인"));
        assertThat(approved.leaveDays()).isEqualTo(0.5);
        assertThat(annual.used_days).isEqualTo(0.5);
        assertThat(annual.remaining_days).isEqualTo(1.5);
        assertThat(fixture.leave.annual_charge_breakdown).containsExactlyEntriesOf(Map.of("2026", 0.5));

        TimLeaveRequestItem cancelled = fixture.service.cancelLeave(created.id(), 11, new TimLeaveDecisionRequest("취소"));

        assertThat(cancelled.requestStatus()).isEqualTo("cancelled");
        assertThat(annual.used_days).isZero();
        assertThat(annual.remaining_days).isEqualTo(2);
        assertApiError(() -> fixture.service.cancelLeave(created.id(), 11, new TimLeaveDecisionRequest(null)), 409);
        assertThat(annual.remaining_days).isEqualTo(2);
    }

    @Test
    void halfDayRejectsMultipleDatesWeekendsAndActiveHolidaysBeforePersisting() {
        Fixture fixture = new Fixture();
        assertApiError(() -> fixture.service.createLeave(11,
                new TimLeaveRequestCreateRequest("half_day", date("2026-08-03"), date("2026-08-04"), "진료")), 400);
        assertApiError(() -> fixture.service.createLeave(11,
                new TimLeaveRequestCreateRequest("half_day", date("2026-08-08"), date("2026-08-08"), "진료")), 400);
        fixture.holidays = List.of(new TimHoliday());
        assertApiError(() -> fixture.service.createLeave(11,
                new TimLeaveRequestCreateRequest("half_day", date("2026-08-03"), date("2026-08-03"), "진료")), 400);
        verify(fixture.entityManager, never()).persist(any());
    }

    @Test
    void halfDayRequiresHalfADayAvailableWhenCreatingAndApproving() {
        Fixture fixture = new Fixture();
        TimAnnualLeave annual = fixture.balance(2026, 0.25);
        assertApiError(() -> fixture.service.createLeave(11,
                new TimLeaveRequestCreateRequest("half_day", date("2026-08-03"), date("2026-08-03"), "진료")), 400);
        fixture.leave("half_day", "pending", "2026-08-03", "2026-08-03");

        assertApiError(() -> fixture.service.decideLeave(22, 7, true, new TimLeaveDecisionRequest(null)), 400);

        assertThat(fixture.leave.request_status).isEqualTo("pending");
        assertThat(annual.used_days).isZero();
        assertThat(annual.remaining_days).isEqualTo(0.25);
    }

    @Test
    void crossYearAnnualCreateApproveAndCancelChargeEachYearsWorkingDays() {
        Fixture fixture = new Fixture();
        TimAnnualLeave first = fixture.balance(2026, 4);
        TimAnnualLeave second = fixture.balance(2027, 5);

        TimLeaveRequestItem created = fixture.service.createLeave(11,
                new TimLeaveRequestCreateRequest("annual", date("2026-12-31"), date("2027-01-04"), "휴가"));

        assertThat(created.calendarDays()).isEqualTo(5);
        assertThat(created.leaveDays()).isEqualTo(3);
        assertThat(created.deductionDays()).isEqualTo(3);
        assertThat(first.remaining_days).isEqualTo(4);
        assertThat(second.remaining_days).isEqualTo(5);
        fixture.lockedYears.clear();

        fixture.service.decideLeave(created.id(), 7, true, new TimLeaveDecisionRequest(null));

        assertThat(fixture.lockedYears).containsExactly(2026, 2027);
        assertThat(first.used_days).isEqualTo(1);
        assertThat(first.remaining_days).isEqualTo(3);
        assertThat(second.used_days).isEqualTo(2);
        assertThat(second.remaining_days).isEqualTo(3);
        assertThat(fixture.leave.annual_charge_breakdown).containsOnlyKeys("2026", "2027")
                .containsEntry("2026", 1.0).containsEntry("2027", 2.0);
        fixture.lockedYears.clear();

        fixture.service.cancelLeave(created.id(), 11, new TimLeaveDecisionRequest(null));

        assertThat(fixture.lockedYears).containsExactly(2026, 2027);
        assertThat(first.used_days).isZero();
        assertThat(first.remaining_days).isEqualTo(4);
        assertThat(second.used_days).isZero();
        assertThat(second.remaining_days).isEqualTo(5);
    }

    @Test
    void insufficientSecondYearBalanceRejectsCreationAndApprovalWithoutPartialDeduction() {
        Fixture fixture = new Fixture();
        TimAnnualLeave first = fixture.balance(2026, 10);
        TimAnnualLeave second = fixture.balance(2027, 1);
        assertApiError(() -> fixture.service.createLeave(11,
                new TimLeaveRequestCreateRequest("annual", date("2026-12-31"), date("2027-01-04"), "휴가")), 400);
        verify(fixture.entityManager, never()).persist(any());
        fixture.leave("annual", "pending", "2026-12-31", "2027-01-04");

        assertApiError(() -> fixture.service.decideLeave(22, 7, true, new TimLeaveDecisionRequest(null)), 400);

        assertThat(fixture.leave.request_status).isEqualTo("pending");
        assertThat(first.used_days).isZero();
        assertThat(first.remaining_days).isEqualTo(10);
        assertThat(second.used_days).isZero();
        assertThat(second.remaining_days).isEqualTo(1);
    }

    @Test
    void leaveListMapsHalfDaysAsHalfADayAndKeepsOtherLeaveDaySemantics() {
        Fixture fixture = new Fixture();
        when(fixture.gridMapper.leaveRequests(11, null, false)).thenReturn(List.of(
                gridRow("half_day", "2026-08-03", "2026-08-03"),
                gridRow("sick", "2026-08-03", "2026-08-04")));

        List<TimLeaveRequestItem> items = fixture.service.leaveRequests(11, null, false, 1, 20).items();

        assertThat(items).extracting(TimLeaveRequestItem::leaveDays).containsExactly(0.5, 2.0);
        assertThat(items).extracting(TimLeaveRequestItem::deductionDays).containsExactly(0.5, 2.0);
    }

    @Test
    void rejectingOrCancellingPendingAnnualLeaveDoesNotChangeAnnualBalances() {
        Fixture fixture = new Fixture();
        TimAnnualLeave annual = fixture.balance(2026, 4);
        fixture.leave("annual", "pending", "2026-08-03", "2026-08-03");

        fixture.service.decideLeave(22, 7, false, new TimLeaveDecisionRequest(null));
        assertThat(fixture.leave.request_status).isEqualTo("rejected");
        fixture.leave("annual", "pending", "2026-08-04", "2026-08-04");
        fixture.service.cancelLeave(22, 11, new TimLeaveDecisionRequest(null));

        assertThat(annual.used_days).isZero();
        assertThat(annual.remaining_days).isEqualTo(4);
        assertThat(fixture.lockedYears).isEmpty();
    }

    @Test
    void cancellationRestoresStoredAnnualDeductionsAfterTheHolidayCalendarChanges() {
        Fixture fixture = new Fixture();
        TimAnnualLeave first = fixture.balance(2026, 4);
        TimAnnualLeave second = fixture.balance(2027, 5);
        fixture.leave("annual", "pending", "2026-12-31", "2027-01-04");
        fixture.service.decideLeave(22, 7, true, new TimLeaveDecisionRequest(null));
        fixture.holidays = List.of(new TimHoliday());

        TimLeaveRequestItem cancelled = fixture.service.cancelLeave(22, 11, new TimLeaveDecisionRequest(null));

        assertThat(cancelled.deductionDays()).isEqualTo(3);
        assertThat(first.used_days).isZero();
        assertThat(first.remaining_days).isEqualTo(4);
        assertThat(second.used_days).isZero();
        assertThat(second.remaining_days).isEqualTo(5);
    }

    @Test
    void legacyAnnualCancellationRestoresTheStartYearAndLegacyHalfDayDoesNotCreateACredit() {
        Fixture fixture = new Fixture();
        TimAnnualLeave first = fixture.balance(2026, 7);
        first.used_days = 3;
        TimAnnualLeave second = fixture.balance(2027, 5);
        fixture.leave("annual", "approved", "2026-12-31", "2027-01-04");

        fixture.service.cancelLeave(22, 11, new TimLeaveDecisionRequest(null));

        assertThat(first.used_days).isZero();
        assertThat(first.remaining_days).isEqualTo(10);
        assertThat(second.remaining_days).isEqualTo(5);
        assertThat(fixture.lockedYears).containsExactly(2026);
        fixture.lockedYears.clear();
        fixture.leave("half_day", "approved", "2026-08-03", "2026-08-03");

        fixture.service.cancelLeave(22, 11, new TimLeaveDecisionRequest(null));

        assertThat(first.used_days).isZero();
        assertThat(first.remaining_days).isEqualTo(10);
        assertThat(fixture.lockedYears).isEmpty();
    }

    @Test
    void leaveListUsesTheApprovedDeductionSnapshotAfterTheHolidayCalendarChanges() {
        Fixture fixture = new Fixture();
        fixture.holidays = List.of(new TimHoliday());
        LeaveRequestGridRow row = gridRow("annual", "2026-12-31", "2027-01-04");
        when(fixture.gridMapper.leaveRequests(11, null, false)).thenReturn(List.of(new LeaveRequestGridRow(
                row.id(), row.employeeId(), row.employeeNo(), row.employeeName(), row.departmentName(), row.leaveType(),
                row.startDate(), row.endDate(), row.reason(), "approved", 7, row.createdAt(), null, 7, row.createdAt(), row.createdAt(), 3.0)));

        TimLeaveRequestItem actual = fixture.service.leaveRequests(11, null, false, 1, 20).items().getFirst();

        assertThat(actual.leaveDays()).isEqualTo(3);
        assertThat(actual.deductionDays()).isEqualTo(3);
    }

    private static LocalDate date(String value) {
        return LocalDate.parse(value);
    }

    private static LeaveRequestGridRow gridRow(String type, String start, String end) {
        return new LeaveRequestGridRow(22, 11, "E-11", "Kim", "People", type, date(start), date(end), "휴가",
                "pending", null, null, null, null, null, Instant.parse("2026-08-01T00:00:00Z"), null);
    }

    private static void assertApiError(org.assertj.core.api.ThrowableAssert.ThrowingCallable action, int status) {
        assertThatThrownBy(action).isInstanceOf(ApiException.class)
                .satisfies(error -> assertThat(((ApiException) error).status().value()).isEqualTo(status));
    }

    private static final class Fixture {
        private final EntityManager entityManager = mock(EntityManager.class);
        private final TimeGridMapper gridMapper = mock(TimeGridMapper.class);
        private final TimeApplicationService service = new TimeApplicationService(entityManager, gridMapper,
                mock(TimePayrollGateway.class), Clock.fixed(Instant.parse("2026-08-01T00:00:00Z"), ZoneOffset.UTC));
        private final Map<Integer, TimAnnualLeave> balances = new HashMap<>();
        private final List<Integer> lockedYears = new ArrayList<>();
        private List<TimHoliday> holidays = List.of();
        private TimLeaveRequest leave;

        @SuppressWarnings("unchecked")
        private Fixture() {
            Query advisory = mock(Query.class, RETURNS_SELF);
            Query employee = mock(Query.class, RETURNS_SELF);
            Query finalized = mock(Query.class, RETURNS_SELF);
            TypedQuery<TimMonthClose> month = mock(TypedQuery.class, RETURNS_SELF);
            TypedQuery<TimHoliday> holiday = mock(TypedQuery.class, RETURNS_SELF);
            TypedQuery<TimEmployeeDailySchedule> schedule = mock(TypedQuery.class, RETURNS_SELF);
            TypedQuery<TimAttendanceDaily> attendance = mock(TypedQuery.class, RETURNS_SELF);
            TypedQuery<TimLeaveRequest> overlap = mock(TypedQuery.class, RETURNS_SELF);
            TypedQuery<TimAnnualLeave> annual = mock(TypedQuery.class, RETURNS_SELF);
            AtomicInteger year = new AtomicInteger();
            when(entityManager.createNativeQuery(contains("pg_advisory_xact_lock"))).thenReturn(advisory);
            when(entityManager.createNativeQuery(contains("from pay_payroll_runs"))).thenReturn(finalized);
            when(finalized.getResultList()).thenReturn(List.of());
            when(entityManager.createNativeQuery(contains("from hr_employees"))).thenReturn(employee);
            when(employee.getResultList()).thenReturn(List.<Object[]>of(new Object[]{"E-11", "Kim", 3, "PEOPLE", "People", java.sql.Date.valueOf("2020-01-01")}));
            when(entityManager.createQuery(anyString(), eq(TimMonthClose.class))).thenReturn(month);
            when(month.getResultList()).thenReturn(List.of());
            when(entityManager.createQuery(anyString(), eq(TimHoliday.class))).thenReturn(holiday);
            when(holiday.getResultList()).thenAnswer(invocation -> holidays);
            when(entityManager.createQuery(anyString(), eq(TimEmployeeDailySchedule.class))).thenReturn(schedule);
            when(schedule.getResultList()).thenReturn(List.of());
            when(entityManager.createQuery(anyString(), eq(TimAttendanceDaily.class))).thenReturn(attendance);
            when(attendance.getResultList()).thenReturn(List.of());
            when(entityManager.createQuery(anyString(), eq(TimLeaveRequest.class))).thenReturn(overlap);
            when(overlap.getResultList()).thenReturn(List.of());
            when(entityManager.createQuery(anyString(), eq(TimAnnualLeave.class))).thenReturn(annual);
            when(annual.setParameter(eq("year"), any())).thenAnswer(invocation -> {
                year.set(invocation.getArgument(1));
                return annual;
            });
            when(annual.getResultList()).thenAnswer(invocation -> {
                lockedYears.add(year.get());
                return balances.containsKey(year.get()) ? List.of(balances.get(year.get())) : List.of();
            });
            when(entityManager.find(eq(TimLeaveRequest.class), eq(22), eq(LockModeType.PESSIMISTIC_WRITE)))
                    .thenAnswer(invocation -> leave);
            when(entityManager.find(TimLeaveRequest.class, 22)).thenAnswer(invocation -> leave);
            doAnswer(invocation -> {
                if (invocation.getArgument(0) instanceof TimLeaveRequest row) {
                    row.id = 22;
                    leave = row;
                }
                return null;
            }).when(entityManager).persist(any());
        }

        private TimAnnualLeave balance(int year, double remaining) {
            TimAnnualLeave row = new TimAnnualLeave();
            row.employee_id = 11;
            row.year = year;
            row.granted_days = remaining;
            row.remaining_days = remaining;
            balances.put(year, row);
            return row;
        }

        private void leave(String type, String status, String start, String end) {
            leave = new TimLeaveRequest();
            leave.id = 22;
            leave.employee_id = 11;
            leave.leave_type = type;
            leave.request_status = status;
            leave.start_date = date(start);
            leave.end_date = date(end);
        }
    }
}
