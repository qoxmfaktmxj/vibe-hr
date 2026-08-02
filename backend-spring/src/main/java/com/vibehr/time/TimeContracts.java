package com.vibehr.time;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

record TimAttendanceCodeItem(Integer id, String code, String name, String category, String unit,
        boolean isRequestable, Double minDays, Double maxDays, boolean deductAnnual, boolean isActive,
        int sortOrder, String description, Instant createdAt, Instant updatedAt) { }

record TimAttendanceCodeListResponse(List<TimAttendanceCodeItem> items, int totalCount) { }

record TimAttendanceCodeBatchItem(Integer id, @NotBlank @Size(max = 20) String code,
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Pattern(regexp = "leave|work|special") String category,
        @Pattern(regexp = "day|am|pm|hour") String unit, Boolean isRequestable,
        Double minDays, Double maxDays, Boolean deductAnnual, Boolean isActive, Integer sortOrder,
        @Size(max = 200) String description) {
    TimAttendanceCodeBatchItem { unit = unit == null ? "day" : unit; isRequestable = isRequestable == null ? true : isRequestable;
        deductAnnual = deductAnnual == null ? false : deductAnnual; isActive = isActive == null ? true : isActive; sortOrder = sortOrder == null ? 0 : sortOrder; }
}

record TimAttendanceCodeBatchRequest(@NotNull List<@Valid TimAttendanceCodeBatchItem> items, List<@Positive Integer> deleteIds) { }
record TimAttendanceCodeBatchResponse(List<TimAttendanceCodeItem> items, int totalCount, int insertedCount, int updatedCount, int deletedCount) { }

record TimWorkScheduleCodeItem(Integer id, String code, String name, String workStart, String workEnd,
        int breakMinutes, boolean isOvernight, double workHours, boolean isActive, int sortOrder,
        String description, Instant createdAt, Instant updatedAt) { }

record TimWorkScheduleCodeListResponse(List<TimWorkScheduleCodeItem> items, int totalCount) { }

record TimWorkScheduleCodeBatchItem(Integer id, @NotBlank @Size(max = 20) String code,
        @NotBlank @Size(max = 100) String name, @NotBlank @Pattern(regexp = "\\d{2}:\\d{2}") String workStart,
        @NotBlank @Pattern(regexp = "\\d{2}:\\d{2}") String workEnd, @Min(0) Integer breakMinutes,
        Boolean isOvernight, @DecimalMin(value = "0.01") Double workHours, Boolean isActive, Integer sortOrder,
        @Size(max = 200) String description) {
    TimWorkScheduleCodeBatchItem { breakMinutes = breakMinutes == null ? 60 : breakMinutes; isOvernight = isOvernight == null ? false : isOvernight;
        workHours = workHours == null ? 8.0 : workHours; isActive = isActive == null ? true : isActive; sortOrder = sortOrder == null ? 0 : sortOrder; }
}

record TimWorkScheduleCodeBatchRequest(@NotNull List<@Valid TimWorkScheduleCodeBatchItem> items, List<@Positive Integer> deleteIds) { }
record TimWorkScheduleCodeBatchResponse(List<TimWorkScheduleCodeItem> items, int totalCount, int insertedCount, int updatedCount, int deletedCount) { }

record TimHolidayItem(Integer id, LocalDate holidayDate, String name, String holidayType, boolean isActive,
        Instant createdAt, Instant updatedAt) { }
record TimHolidayListResponse(List<TimHolidayItem> items, int totalCount, int year) { }
record TimHolidayBatchItem(Integer id, @NotNull LocalDate holidayDate, @NotBlank @Size(max = 100) String name,
        @Pattern(regexp = "legal|company|substitute") String holidayType, Boolean isActive) {
    TimHolidayBatchItem { holidayType = holidayType == null ? "legal" : holidayType; isActive = isActive == null ? true : isActive; }
}
record TimHolidayBatchRequest(@NotNull List<@Valid TimHolidayBatchItem> items, List<@Positive Integer> deleteIds) { }
record TimHolidayBatchResponse(List<TimHolidayItem> items, int totalCount, int year, int insertedCount, int updatedCount, int deletedCount) { }
record TimHolidayCopyYearRequest(@Min(2000) @Max(2100) int yearFrom, @Min(2000) @Max(2100) int yearTo) { }
record TimHolidayCopyYearResponse(int copiedCount, int yearTo) { }

record TimSchedulePatternItem(Integer id, String code, String name) { }
record TimSchedulePatternListResponse(List<TimSchedulePatternItem> items, int totalCount) { }

record TimDepartmentScheduleAssignmentItem(Integer id, int departmentId, String departmentCode, String departmentName,
        String organizationType, String costCenterCode, int employeeCount, int patternId, String patternCode,
        String patternName, LocalDate effectiveFrom, LocalDate effectiveTo, int priority, boolean isActive) { }
record TimDepartmentScheduleAssignmentListResponse(List<TimDepartmentScheduleAssignmentItem> items, int totalCount) { }
record TimDepartmentScheduleAssignmentUpsertRequest(Integer id, @Positive int departmentId, @Positive int patternId,
        @NotNull LocalDate effectiveFrom, LocalDate effectiveTo, Integer priority, Boolean isActive) {
    TimDepartmentScheduleAssignmentUpsertRequest { priority = priority == null ? 100 : priority; isActive = isActive == null ? true : isActive; }
}
record TimDepartmentScheduleAssignmentBatchRequest(@NotNull List<@Valid TimDepartmentScheduleAssignmentUpsertRequest> items,
        List<@Positive Integer> deleteIds) { }
record TimDepartmentScheduleAssignmentBatchResponse(List<TimDepartmentScheduleAssignmentItem> items, int totalCount,
        int insertedCount, int updatedCount, int deletedCount) { }

record TimEmployeeScheduleExceptionItem(Integer id, int employeeId, String employeeNo, String employeeName,
        Integer departmentId, String departmentCode, String departmentName, int patternId, String patternCode,
        String patternName, LocalDate effectiveFrom, LocalDate effectiveTo, String reason, int priority, boolean isActive) { }
record TimEmployeeScheduleExceptionListResponse(List<TimEmployeeScheduleExceptionItem> items, int totalCount) { }
record TimEmployeeScheduleExceptionUpsertRequest(Integer id, @Positive int employeeId, @Positive int patternId,
        @NotNull LocalDate effectiveFrom, LocalDate effectiveTo, @Size(max = 255) String reason, Integer priority,
        Boolean isActive) {
    TimEmployeeScheduleExceptionUpsertRequest { priority = priority == null ? 1000 : priority; isActive = isActive == null ? true : isActive; }
}
record TimEmployeeScheduleExceptionBatchRequest(@NotNull List<@Valid TimEmployeeScheduleExceptionUpsertRequest> items,
        List<@Positive Integer> deleteIds) { }
record TimEmployeeScheduleExceptionBatchResponse(List<TimEmployeeScheduleExceptionItem> items, int totalCount,
        int insertedCount, int updatedCount, int deletedCount) { }

record TimScheduleGenerateRequest(@Pattern(regexp = "all|department|employee") String target,
        Integer departmentId, List<@Positive Integer> employeeIds, @NotNull LocalDate dateFrom, @NotNull LocalDate dateTo,
        @Pattern(regexp = "create_if_missing|overwrite") String mode) {
    TimScheduleGenerateRequest { target = target == null ? "all" : target; mode = mode == null ? "create_if_missing" : mode; }
}
record TimScheduleGenerateResponse(int createdCount, int updatedCount, int skippedCount, String versionTag) { }
record TimScheduleTodayItem(int employeeId, LocalDate workDate, String dayType, String scheduleSource,
        String patternCode, String patternName, String workStart, String workEnd, int breakMinutes, int expectedMinutes,
        boolean isHoliday, String holidayName, Instant generatedAt) { }
record TimScheduleTodayResponse(TimScheduleTodayItem item) { }

record TimAttendanceDailyItem(Integer id, int employeeId, String employeeNo, String employeeName, int departmentId,
        String departmentName, LocalDate workDate, Instant checkInAt, Instant checkOutAt, Integer workedMinutes,
        String attendanceStatus, int actualMinutes, int regularMinutes, int overtimeMinutes, int nightMinutes,
        int holidayWorkMinutes, int holidayOvertimeMinutes, int holidayNightMinutes, boolean isHolidayWork) { }
record TimAttendanceDailyListResponse(List<TimAttendanceDailyItem> items, int totalCount, int page, int limit, int totalPages) { }
record TimAttendanceTodayResponse(TimAttendanceDailyItem item) { }
record TimCheckInOutRequest(Integer employeeId) { }
record TimTodayScheduleItem(LocalDate workDate, String dayType, String scheduleCode, String scheduleName,
        String workStart, String workEnd, int breakMinutes, double workHours, boolean isHoliday, String holidayName) { }
record TimTodayDerivedItem(boolean isLate, int overtimeMinutes, boolean isWeekendWork) { }
record TimTodayScheduleResponse(TimTodayScheduleItem schedule, TimAttendanceDailyItem attendance, TimTodayDerivedItem derived) { }
record TimAttendanceCorrectRequest(@NotBlank @Pattern(regexp = "present|late|absent|leave|remote") String newStatus,
        @NotBlank @Size(max = 500) String reason, Instant newCheckInAt, Instant newCheckOutAt) { }
record TimAttendanceCorrectionItem(Integer id, int attendanceId, int correctedByEmployeeId, String oldStatus,
        String newStatus, Instant oldCheckInAt, Instant newCheckInAt, Instant oldCheckOutAt, Instant newCheckOutAt,
        String reason, Instant correctedAt) { }
record TimAttendanceCorrectionListResponse(List<TimAttendanceCorrectionItem> corrections, int totalCount) { }

record TimAnnualLeaveItem(Integer id, int employeeId, String employeeNo, String employeeName, String departmentName,
        int year, double grantedDays, double usedDays, double carriedOverDays, double remainingDays, String grantType,
        String note) { }
record TimAnnualLeaveResponse(TimAnnualLeaveItem item) { }
record TimAnnualLeaveListResponse(List<TimAnnualLeaveItem> items, int totalCount, int page, int limit) { }
record TimAnnualLeaveAdjustRequest(@Positive int employeeId, @Min(2000) @Max(2100) int year, double adjustmentDays,
        @NotBlank @Size(max = 500) String reason) { }
record TimLeaveRequestItem(Integer id, int employeeId, String employeeNo, String employeeName, String departmentName,
        String leaveType, LocalDate startDate, LocalDate endDate, double calendarDays, double deductionDays,
        double leaveDays, String reason, String requestStatus, Integer approverEmployeeId, Instant approvedAt,
        String decisionComment, Integer decidedBy, Instant decidedAt, Instant createdAt) { }
record TimLeaveRequestListResponse(List<TimLeaveRequestItem> items, int totalCount, int page, int limit) { }
record TimLeaveRequestCreateRequest(@NotBlank @Pattern(regexp = "annual|sick|half_day|unpaid|other") String leaveType,
        @NotNull LocalDate startDate, @NotNull LocalDate endDate, @NotBlank @Size(max = 500) String reason) { }
record TimLeaveDecisionRequest(@Size(max = 500) String reason) { }

record TimMonthCloseItem(Integer id, int year, int month, String closeStatus, int employeeCount, int presentDays,
        int absentDays, int lateDays, int leaveDays, int totalOvertimeMinutes, int totalNightMinutes,
        int totalHolidayWorkMinutes, int totalHolidayOvertimeMinutes, int totalHolidayNightMinutes, Integer closedBy,
        String closedByName, Instant closedAt, Integer reopenedBy, String reopenedByName, Instant reopenedAt, String note,
        Instant createdAt, Instant updatedAt) { }
record TimMonthCloseListResponse(List<TimMonthCloseItem> items, int year, int totalCount) { }
record TimMonthCloseRequest(@Min(2000) @Max(2100) int year, @Min(1) @Max(12) int month, @Size(max = 500) String note) { }
record TimMonthCloseActionResponse(TimMonthCloseItem item) { }

record TimStatusCount(int present, int late, int absent, int leave, int remote) { }
record TimDepartmentSummaryItem(int departmentId, String departmentName, int attendanceCount, double presentRate,
        double lateRate, double absentRate) { }
record TimLeaveTypeSummaryItem(String leaveType, int requestCount, int approvedCount, int pendingCount) { }
record TimReportSummaryResponse(String startDate, String endDate, int totalAttendanceRecords, int totalLeaveRequests,
        TimStatusCount statusCounts, List<TimDepartmentSummaryItem> departmentSummaries,
        List<TimLeaveTypeSummaryItem> leaveTypeSummaries) { }
