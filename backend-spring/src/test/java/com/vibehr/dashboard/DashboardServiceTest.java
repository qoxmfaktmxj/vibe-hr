package com.vibehr.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class DashboardServiceTest {

    @Test
    void countsStatusesForTheKoreanBusinessDate() {
        DashboardProjectionMapper projections = mock(DashboardProjectionMapper.class);
        Clock clock = Clock.fixed(Instant.parse("2026-08-01T16:00:00Z"), ZoneOffset.UTC);
        when(projections.summary(java.time.LocalDate.of(2026, 8, 2)))
                .thenReturn(new DashboardProjectionMapper.DashboardProjection(10, 3, 8, 1, 1, 2));

        DashboardService.DashboardSummary summary = new DashboardService(projections, clock).summary();

        assertThat(summary.totalEmployees()).isEqualTo(10L);
        assertThat(summary.attendancePresentToday()).isEqualTo(8L);
        assertThat(summary.pendingLeaveRequests()).isEqualTo(2L);
    }
}
