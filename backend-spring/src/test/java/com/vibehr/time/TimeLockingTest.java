package com.vibehr.time;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;
import java.time.Clock;
import java.util.List;
import org.junit.jupiter.api.Test;

class TimeLockingTest {
    @Test
    void repeatedMonthCloseTakesAdvisoryAndPessimisticLocksBeforeReturningLegacyConflict() {
        EntityManager entityManager = mock(EntityManager.class);
        TimeGridMapper gridMapper = mock(TimeGridMapper.class);
        TimePayrollGateway payrollGateway = mock(TimePayrollGateway.class);
        Query advisoryQuery = mock(Query.class);
        @SuppressWarnings("unchecked") TypedQuery<TimMonthClose> monthQuery = mock(TypedQuery.class);
        TimMonthClose closed = new TimMonthClose();
        closed.close_status = "closed";
        when(entityManager.createNativeQuery(anyString())).thenReturn(advisoryQuery);
        when(advisoryQuery.setParameter(anyString(), any())).thenReturn(advisoryQuery);
        when(advisoryQuery.getSingleResult()).thenReturn(null);
        when(entityManager.createQuery(anyString(), org.mockito.ArgumentMatchers.eq(TimMonthClose.class))).thenReturn(monthQuery);
        when(monthQuery.setParameter(anyString(), any())).thenReturn(monthQuery);
        when(monthQuery.setLockMode(LockModeType.PESSIMISTIC_WRITE)).thenReturn(monthQuery);
        when(monthQuery.setMaxResults(1)).thenReturn(monthQuery);
        when(monthQuery.getResultList()).thenReturn(List.of(closed));
        TimeApplicationService service = new TimeApplicationService(entityManager, gridMapper, payrollGateway, Clock.systemUTC());

        assertThatThrownBy(() -> service.closeMonth(new TimMonthCloseRequest(2026, 8, null), 9))
                .isInstanceOf(ApiException.class).extracting(error -> ((ApiException) error).status().value()).isEqualTo(409);
        verify(entityManager).createNativeQuery(org.mockito.ArgumentMatchers.contains("pg_advisory_xact_lock"));
        verify(monthQuery).setLockMode(LockModeType.PESSIMISTIC_WRITE);
    }

    @Test
    void approvingPendingNonAnnualLeaveLocksTheRequestAndRecordsTheDecisionActor() {
        EntityManager entityManager = mock(EntityManager.class);
        TimeGridMapper gridMapper = mock(TimeGridMapper.class);
        TimePayrollGateway payrollGateway = mock(TimePayrollGateway.class);
        @SuppressWarnings("unchecked") TypedQuery<TimMonthClose> monthQuery = mock(TypedQuery.class);
        @SuppressWarnings("unchecked") TypedQuery<TimHoliday> holidayQuery = mock(TypedQuery.class);
        Query employeeQuery = mock(Query.class);
        TimLeaveRequest leave = new TimLeaveRequest();
        leave.id = 22;
        leave.employee_id = 11;
        leave.leave_type = "sick";
        leave.start_date = java.time.LocalDate.of(2026, 8, 3);
        leave.end_date = java.time.LocalDate.of(2026, 8, 3);
        leave.reason = "진료";
        leave.request_status = "pending";
        leave.created_at = java.time.Instant.parse("2026-08-01T00:00:00Z");
        when(entityManager.find(TimLeaveRequest.class, 22, LockModeType.PESSIMISTIC_WRITE)).thenReturn(leave);
        when(entityManager.find(TimLeaveRequest.class, 22)).thenReturn(leave);
        when(entityManager.createQuery(anyString(), org.mockito.ArgumentMatchers.eq(TimMonthClose.class))).thenReturn(monthQuery);
        when(monthQuery.setParameter(anyString(), any())).thenReturn(monthQuery);
        when(monthQuery.setLockMode(LockModeType.NONE)).thenReturn(monthQuery);
        when(monthQuery.setMaxResults(1)).thenReturn(monthQuery);
        when(monthQuery.getResultList()).thenReturn(List.of());
        when(entityManager.createQuery(anyString(), org.mockito.ArgumentMatchers.eq(TimHoliday.class))).thenReturn(holidayQuery);
        when(holidayQuery.setParameter(anyString(), any())).thenReturn(holidayQuery);
        when(holidayQuery.setMaxResults(1)).thenReturn(holidayQuery);
        when(holidayQuery.getResultList()).thenReturn(List.of());
        when(entityManager.createNativeQuery(org.mockito.ArgumentMatchers.contains("from hr_employees"))).thenReturn(employeeQuery);
        when(employeeQuery.setParameter(anyString(), any())).thenReturn(employeeQuery);
        when(employeeQuery.getResultList()).thenReturn(List.<Object[]>of(new Object[]{"E-11", "Kim", 3, "PEOPLE", "People", java.sql.Date.valueOf("2020-01-01")}));
        TimeApplicationService service = new TimeApplicationService(entityManager, gridMapper, payrollGateway, Clock.systemUTC());

        TimLeaveRequestItem actual = service.decideLeave(22, 7, true, new TimLeaveDecisionRequest("approved"));

        assertThat(actual.requestStatus()).isEqualTo("approved");
        assertThat(actual.approverEmployeeId()).isEqualTo(7);
        assertThat(actual.decidedBy()).isEqualTo(7);
        verify(entityManager).find(TimLeaveRequest.class, 22, LockModeType.PESSIMISTIC_WRITE);
        verify(entityManager).flush();
    }
}
