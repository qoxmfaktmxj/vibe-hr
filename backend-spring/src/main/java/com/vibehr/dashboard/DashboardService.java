package com.vibehr.dashboard;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("!test")
public class DashboardService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");
    private final DashboardProjectionMapper projections;
    private final Clock clock;

    DashboardService(DashboardProjectionMapper projections, Clock clock) {
        this.projections = projections;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public DashboardSummary summary() {
        LocalDate today = LocalDate.now(clock.withZone(BUSINESS_ZONE));
        DashboardProjectionMapper.DashboardProjection counts = projections.summary(today);
        return new DashboardSummary(counts.totalEmployees(), counts.totalDepartments(), counts.attendancePresent(),
                counts.attendanceLate(), counts.attendanceAbsent(), counts.pendingLeaveRequests());
    }

    public record DashboardSummary(long totalEmployees, long totalDepartments, long attendancePresentToday, long attendanceLateToday, long attendanceAbsentToday, long pendingLeaveRequests) { }
}
