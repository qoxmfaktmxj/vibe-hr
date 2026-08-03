package com.vibehr.time;

import com.vibehr.menu.MenuPermissionService;
import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1")
class TimeController {
    private final TimeApplicationService service;
    private final TimeAuthorization authorization;
    private final MenuPermissionService menuPermissions;

    TimeController(TimeApplicationService service, TimeAuthorization authorization, MenuPermissionService menuPermissions) {
        this.service = service;
        this.authorization = authorization;
        this.menuPermissions = menuPermissions;
    }

    @GetMapping("/tim/attendance-codes")
    TimAttendanceCodeListResponse attendanceCodes(Authentication authentication) {
        requireMenuAction(authorization.requireAnyRole(authentication, "hr_manager", "admin"), "/tim/codes", "query");
        return service.attendanceCodes();
    }

    @PostMapping("/tim/attendance-codes/batch")
    TimAttendanceCodeBatchResponse saveAttendanceCodes(Authentication authentication, @Valid @RequestBody TimAttendanceCodeBatchRequest request) {
        requireMenuAction(authorization.requireAnyRole(authentication, "hr_manager", "admin"), "/tim/codes", "save");
        return service.saveAttendanceCodes(request);
    }

    @GetMapping("/tim/work-schedules")
    TimWorkScheduleCodeListResponse workScheduleCodes(Authentication authentication) {
        requireMenuAction(authorization.requireAnyRole(authentication, "hr_manager", "admin"), "/tim/work-codes", "query");
        return service.workScheduleCodes();
    }

    @PostMapping("/tim/work-schedules/batch")
    TimWorkScheduleCodeBatchResponse saveWorkScheduleCodes(Authentication authentication, @Valid @RequestBody TimWorkScheduleCodeBatchRequest request) {
        requireMenuAction(authorization.requireAnyRole(authentication, "hr_manager", "admin"), "/tim/work-codes", "save");
        return service.saveWorkScheduleCodes(request);
    }

    @GetMapping("/tim/holidays")
    TimHolidayListResponse holidays(Authentication authentication, @RequestParam(required = false) @Min(2000) @Max(2100) Integer year) {
        requireMenuActionByCode(authorization.requireAnyRole(authentication, "hr_manager", "admin"), "tim.holidays", "query");
        return service.holidays(year == null ? currentYear() : year);
    }

    @PostMapping("/tim/holidays/batch")
    TimHolidayBatchResponse saveHolidays(Authentication authentication, @Valid @RequestBody TimHolidayBatchRequest request,
            @RequestParam(required = false) @Min(2000) @Max(2100) Integer year) {
        requireMenuActionByCode(authorization.requireAnyRole(authentication, "hr_manager", "admin"), "tim.holidays", "save");
        return service.saveHolidays(request, year == null ? currentYear() : year);
    }

    @PostMapping("/tim/holidays/copy-year")
    TimHolidayCopyYearResponse copyHolidays(Authentication authentication, @Valid @RequestBody TimHolidayCopyYearRequest request) {
        requireMenuActionByCode(authorization.requireAnyRole(authentication, "hr_manager", "admin"), "tim.holidays", "save");
        return service.copyHolidays(request);
    }

    @GetMapping("/tim/schedules/patterns")
    TimSchedulePatternListResponse schedulePatterns(Authentication authentication) {
        requireMenuAction(authorization.requireAnyRole(authentication, "hr_manager", "admin"), "/tim/work-codes", "query");
        return service.schedulePatterns();
    }

    @GetMapping("/tim/schedules/departments")
    TimDepartmentScheduleAssignmentListResponse departmentAssignments(Authentication authentication,
            @RequestParam(required = false) Integer departmentId) {
        requireMenuAction(authorization.requireAnyRole(authentication, "hr_manager", "admin"), "/tim/work-codes", "query");
        return service.departmentAssignments(departmentId);
    }

    @PostMapping("/tim/schedules/departments/batch")
    TimDepartmentScheduleAssignmentBatchResponse saveDepartmentAssignments(Authentication authentication,
            @Valid @RequestBody TimDepartmentScheduleAssignmentBatchRequest request) {
        requireMenuAction(authorization.requireAnyRole(authentication, "hr_manager", "admin"), "/tim/work-codes", "save");
        return service.saveDepartmentAssignments(request);
    }

    @GetMapping("/tim/schedules/exceptions/employees")
    TimEmployeeScheduleExceptionListResponse employeeExceptions(Authentication authentication,
            @RequestParam(required = false) Integer employeeId) {
        requireMenuAction(authorization.requireAnyRole(authentication, "hr_manager", "admin"), "/tim/work-codes", "query");
        return service.employeeExceptions(employeeId);
    }

    @PostMapping("/tim/schedules/exceptions/employees/batch")
    TimEmployeeScheduleExceptionBatchResponse saveEmployeeExceptions(Authentication authentication,
            @Valid @RequestBody TimEmployeeScheduleExceptionBatchRequest request) {
        requireMenuAction(authorization.requireAnyRole(authentication, "hr_manager", "admin"), "/tim/work-codes", "save");
        return service.saveEmployeeExceptions(request);
    }

    @PostMapping("/tim/schedules/generate")
    TimScheduleGenerateResponse generateSchedules(Authentication authentication, @Valid @RequestBody TimScheduleGenerateRequest request) {
        requireMenuAction(authorization.requireAnyRole(authentication, "hr_manager", "admin"), "/tim/work-codes", "save");
        return service.generateSchedules(request);
    }

    @GetMapping("/tim/schedules/me/today")
    TimScheduleTodayResponse myScheduleToday(Authentication authentication) {
        int userId = authorization.userId(authentication);
        return service.myScheduleToday(authorization.employeeIdForUser(userId));
    }

    @GetMapping("/tim/attendance-daily")
    TimAttendanceDailyListResponse attendanceDaily(Authentication authentication, @RequestParam(name = "start_date") LocalDate startDate,
            @RequestParam(name = "end_date") LocalDate endDate, @RequestParam(name = "employee_id", required = false) Integer employeeId,
            @RequestParam(name = "status", required = false) String status, @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.attendanceDaily(startDate, endDate, employeeId, status, page, limit);
    }

    @GetMapping("/tim/attendance-daily/today")
    TimAttendanceTodayResponse attendanceToday(Authentication authentication, @RequestParam(required = false) Integer employeeId) {
        authorization.requireSelfOrManager(authentication, employeeId);
        int userId = authorization.userId(authentication);
        return service.attendanceToday(employeeId == null ? authorization.employeeIdForUser(userId) : employeeId);
    }

    @GetMapping("/tim/attendance-daily/today-schedule")
    TimTodayScheduleResponse attendanceTodaySchedule(Authentication authentication, @RequestParam(required = false) Integer employeeId) {
        authorization.requireSelfOrManager(authentication, employeeId);
        int userId = authorization.userId(authentication);
        return service.attendanceTodaySchedule(employeeId == null ? authorization.employeeIdForUser(userId) : employeeId);
    }

    @GetMapping("/tim/attendance-daily/detail/{attendance_id}")
    TimAttendanceDailyItem attendanceDetail(Authentication authentication, @PathVariable("attendance_id") int attendanceId) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.attendanceDetail(attendanceId);
    }

    @PostMapping("/tim/attendance-daily/check-in")
    TimAttendanceDailyItem checkIn(Authentication authentication, @Valid @RequestBody TimCheckInOutRequest request) {
        authorization.requireSelfOrManager(authentication, request.employeeId());
        int userId = authorization.userId(authentication);
        return service.checkIn(request.employeeId() == null ? authorization.employeeIdForUser(userId) : request.employeeId());
    }

    @PostMapping("/tim/attendance-daily/check-out")
    TimAttendanceDailyItem checkOut(Authentication authentication, @Valid @RequestBody TimCheckInOutRequest request) {
        authorization.requireSelfOrManager(authentication, request.employeeId());
        int userId = authorization.userId(authentication);
        return service.checkOut(request.employeeId() == null ? authorization.employeeIdForUser(userId) : request.employeeId());
    }

    @PostMapping("/tim/attendance-daily/{attendance_id}/correct")
    TimAttendanceDailyItem correctAttendance(Authentication authentication, @PathVariable("attendance_id") int attendanceId,
            @Valid @RequestBody TimAttendanceCorrectRequest request) {
        int userId = authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.correctAttendance(attendanceId, authorization.employeeIdForUser(userId), request);
    }

    @GetMapping("/tim/attendance-daily/{attendance_id}/corrections")
    TimAttendanceCorrectionListResponse corrections(Authentication authentication, @PathVariable("attendance_id") int attendanceId) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.corrections(attendanceId);
    }

    @GetMapping("/tim/annual-leave/employee/{employee_id}")
    TimAnnualLeaveResponse annualLeave(Authentication authentication, @PathVariable("employee_id") int employeeId,
            @RequestParam(required = false) @Min(2000) @Max(2100) Integer year) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.annualLeave(employeeId, year == null ? currentYear() : year);
    }

    @GetMapping("/tim/annual-leave/my")
    TimAnnualLeaveResponse myAnnualLeave(Authentication authentication, @RequestParam(required = false) @Min(2000) @Max(2100) Integer year) {
        int userId = authorization.userId(authentication);
        return service.annualLeave(authorization.employeeIdForUser(userId), year == null ? currentYear() : year);
    }

    @PostMapping("/tim/annual-leave/adjust")
    TimAnnualLeaveResponse adjustAnnualLeave(Authentication authentication, @Valid @RequestBody TimAnnualLeaveAdjustRequest request) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.adjustAnnualLeave(request);
    }

    @GetMapping("/tim/annual-leave/list")
    TimAnnualLeaveListResponse annualLeaves(Authentication authentication, @RequestParam(required = false) @Min(2000) @Max(2100) Integer year,
            @RequestParam(required = false) Integer departmentId, @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") @Min(1) int page, @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.annualLeaves(year == null ? currentYear() : year, departmentId, keyword, page, limit);
    }

    @GetMapping("/tim/leave-requests")
    TimLeaveRequestListResponse leaveRequests(Authentication authentication, @RequestParam(name = "status", required = false) String status,
            @RequestParam(defaultValue = "false") boolean pendingOnly, @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.leaveRequests(null, status, pendingOnly, page, limit);
    }

    @GetMapping("/tim/leave-requests/my")
    TimLeaveRequestListResponse myLeaveRequests(Authentication authentication, @RequestParam(name = "status", required = false) String status,
            @RequestParam(defaultValue = "1") @Min(1) int page, @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit) {
        int userId = authorization.userId(authentication);
        return service.leaveRequests(authorization.employeeIdForUser(userId), status, false, page, limit);
    }

    @PostMapping("/tim/leave-requests")
    TimLeaveRequestItem createLeave(Authentication authentication, @Valid @RequestBody TimLeaveRequestCreateRequest request) {
        int userId = authorization.userId(authentication);
        return service.createLeave(authorization.employeeIdForUser(userId), request);
    }

    @PostMapping("/tim/leave-requests/{request_id}/approve")
    TimLeaveRequestItem approveLeave(Authentication authentication, @PathVariable("request_id") int requestId,
            @Valid @RequestBody TimLeaveDecisionRequest request) {
        int userId = authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.decideLeave(requestId, authorization.employeeIdForUser(userId), true, request);
    }

    @PostMapping("/tim/leave-requests/{request_id}/reject")
    TimLeaveRequestItem rejectLeave(Authentication authentication, @PathVariable("request_id") int requestId,
            @Valid @RequestBody TimLeaveDecisionRequest request) {
        int userId = authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.decideLeave(requestId, authorization.employeeIdForUser(userId), false, request);
    }

    @PostMapping("/tim/leave-requests/{request_id}/cancel")
    TimLeaveRequestItem cancelLeave(Authentication authentication, @PathVariable("request_id") int requestId,
            @Valid @RequestBody TimLeaveDecisionRequest request) {
        int userId = authorization.userId(authentication);
        return service.cancelLeave(requestId, authorization.employeeIdForUser(userId), request);
    }

    @GetMapping("/tim/month-close")
    TimMonthCloseListResponse monthCloses(Authentication authentication, @RequestParam(required = false) @Min(2000) @Max(2100) Integer year) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.monthCloses(year == null ? currentYear() : year);
    }

    @PostMapping("/tim/month-close")
    TimMonthCloseActionResponse closeMonth(Authentication authentication, @Valid @RequestBody TimMonthCloseRequest request) {
        int userId = authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.closeMonth(request, userId);
    }

    @PostMapping("/tim/month-close/{year}/{month}/reopen")
    TimMonthCloseActionResponse reopenMonth(Authentication authentication, @PathVariable int year, @PathVariable int month) {
        int userId = authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.reopenMonth(year, month, userId);
    }

    @GetMapping("/tim/reports/summary")
    TimReportSummaryResponse report(Authentication authentication, @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        LocalDate last = endDate == null ? LocalDate.now(TimeFormula.KST) : endDate;
        return service.report(startDate == null ? last.minusDays(30) : startDate, last);
    }

    private int currentYear() { return LocalDate.now(TimeFormula.KST).getYear(); }

    private void requireMenuAction(int userId, String path, String actionCode) {
        menuPermissions.requireMenuAction(userId, path, actionCode);
    }

    private void requireMenuActionByCode(int userId, String menuCode, String actionCode) {
        if (!menuPermissions.allowedActions(userId, menuCode, null).actions().getOrDefault(actionCode, false)) {
            throw ApiException.forbidden("Action not allowed.");
        }
    }
}
