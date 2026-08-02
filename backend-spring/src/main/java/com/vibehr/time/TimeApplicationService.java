package com.vibehr.time;

import com.vibehr.platform.error.ApiException;
import com.vibehr.payroll.PayrollEntities.VariableInput;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
class TimeApplicationService {
    private final EntityManager entityManager;
    private final TimeGridMapper gridMapper;
    private final TimePayrollGateway payrollGateway;
    private final Clock clock;

    TimeApplicationService(EntityManager entityManager, TimeGridMapper gridMapper, TimePayrollGateway payrollGateway, Clock clock) {
        this.entityManager = entityManager;
        this.gridMapper = gridMapper;
        this.payrollGateway = payrollGateway;
        this.clock = clock;
    }

    @Transactional
    TimAttendanceCodeListResponse attendanceCodes() {
        List<TimAttendanceCodeItem> items = entityManager.createQuery("from TimAttendanceCode order by is_active desc, sort_order, id", TimAttendanceCode.class)
                .getResultList().stream().map(this::attendanceCodeItem).toList();
        return new TimAttendanceCodeListResponse(items, items.size());
    }

    @Transactional
    TimAttendanceCodeBatchResponse saveAttendanceCodes(TimAttendanceCodeBatchRequest request) {
        int inserted = 0;
        int updated = 0;
        int deleted = deleteEntities(request.deleteIds(), TimAttendanceCode.class);
        for (TimAttendanceCodeBatchItem input : request.items()) {
            TimAttendanceCode row = input.id() == null ? null : entityManager.find(TimAttendanceCode.class, input.id(), LockModeType.PESSIMISTIC_WRITE);
            if (input.id() != null && row == null) throw ApiException.notFound("근태 코드를 찾을 수 없습니다.");
            if (row == null) { row = new TimAttendanceCode(); row.created_at = now(); inserted++; } else updated++;
            row.code = input.code().trim(); row.name = input.name().trim(); row.category = input.category(); row.unit = input.unit();
            row.is_requestable = input.isRequestable(); row.min_days = input.minDays(); row.max_days = input.maxDays();
            row.deduct_annual = input.deductAnnual(); row.is_active = input.isActive(); row.sort_order = input.sortOrder();
            row.description = input.description(); row.updated_at = now();
            if (row.id == null) entityManager.persist(row);
        }
        entityManager.flush();
        TimAttendanceCodeListResponse result = attendanceCodes();
        return new TimAttendanceCodeBatchResponse(result.items(), result.totalCount(), inserted, updated, deleted);
    }

    @Transactional
    TimWorkScheduleCodeListResponse workScheduleCodes() {
        List<TimWorkScheduleCodeItem> items = entityManager.createQuery("from TimWorkScheduleCode order by is_active desc, sort_order, id", TimWorkScheduleCode.class)
                .getResultList().stream().map(this::workScheduleCodeItem).toList();
        return new TimWorkScheduleCodeListResponse(items, items.size());
    }

    @Transactional
    TimWorkScheduleCodeBatchResponse saveWorkScheduleCodes(TimWorkScheduleCodeBatchRequest request) {
        int inserted = 0;
        int updated = 0;
        int deleted = deleteEntities(request.deleteIds(), TimWorkScheduleCode.class);
        for (TimWorkScheduleCodeBatchItem input : request.items()) {
            TimWorkScheduleCode row = input.id() == null ? null : entityManager.find(TimWorkScheduleCode.class, input.id(), LockModeType.PESSIMISTIC_WRITE);
            if (input.id() != null && row == null) throw ApiException.notFound("근무 코드를 찾을 수 없습니다.");
            if (row == null) { row = new TimWorkScheduleCode(); row.created_at = now(); inserted++; } else updated++;
            row.code = input.code().trim(); row.name = input.name().trim(); row.work_start = input.workStart(); row.work_end = input.workEnd();
            row.break_minutes = input.breakMinutes(); row.is_overnight = input.isOvernight(); row.work_hours = input.workHours();
            row.is_active = input.isActive(); row.sort_order = input.sortOrder(); row.description = input.description(); row.updated_at = now();
            if (row.id == null) entityManager.persist(row);
        }
        entityManager.flush();
        TimWorkScheduleCodeListResponse result = workScheduleCodes();
        return new TimWorkScheduleCodeBatchResponse(result.items(), result.totalCount(), inserted, updated, deleted);
    }

    @Transactional
    TimHolidayListResponse holidays(int year) {
        List<TimHolidayItem> items = entityManager.createQuery("from TimHoliday where year(holiday_date) = :year order by holiday_date", TimHoliday.class)
                .setParameter("year", year).getResultList().stream().map(this::holidayItem).toList();
        return new TimHolidayListResponse(items, items.size(), year);
    }

    @Transactional
    TimHolidayBatchResponse saveHolidays(TimHolidayBatchRequest request, int year) {
        int inserted = 0;
        int updated = 0;
        int deleted = deleteEntities(request.deleteIds(), TimHoliday.class);
        for (TimHolidayBatchItem input : request.items()) {
            if (input.holidayDate().getYear() != year) throw ApiException.badRequest("휴일 연도가 요청 연도와 일치해야 합니다.");
            TimHoliday row = input.id() == null ? null : entityManager.find(TimHoliday.class, input.id(), LockModeType.PESSIMISTIC_WRITE);
            if (input.id() != null && row == null) throw ApiException.notFound("휴일을 찾을 수 없습니다.");
            if (row == null) { row = new TimHoliday(); row.created_at = now(); inserted++; } else updated++;
            row.holiday_date = input.holidayDate(); row.name = input.name().trim(); row.holiday_type = input.holidayType();
            row.is_active = input.isActive(); row.updated_at = now();
            if (row.id == null) entityManager.persist(row);
        }
        entityManager.flush();
        TimHolidayListResponse result = holidays(year);
        return new TimHolidayBatchResponse(result.items(), result.totalCount(), year, inserted, updated, deleted);
    }

    @Transactional
    TimHolidayCopyYearResponse copyHolidays(TimHolidayCopyYearRequest request) {
        if (request.yearFrom() == request.yearTo()) throw ApiException.badRequest("복사 원본과 대상 연도는 달라야 합니다.");
        List<TimHoliday> source = entityManager.createQuery("from TimHoliday where year(holiday_date) = :year and is_active = true", TimHoliday.class)
                .setParameter("year", request.yearFrom()).getResultList();
        int copied = 0;
        for (TimHoliday holiday : source) {
            LocalDate targetDate = holiday.holiday_date.withYear(request.yearTo());
            boolean exists = !entityManager.createQuery("from TimHoliday where holiday_date = :date", TimHoliday.class)
                    .setParameter("date", targetDate).setMaxResults(1).getResultList().isEmpty();
            if (!exists) {
                TimHoliday target = new TimHoliday();
                target.holiday_date = targetDate; target.name = holiday.name; target.holiday_type = holiday.holiday_type;
                target.is_active = holiday.is_active; target.created_at = now(); target.updated_at = target.created_at;
                entityManager.persist(target); copied++;
            }
        }
        return new TimHolidayCopyYearResponse(copied, request.yearTo());
    }

    @Transactional
    TimSchedulePatternListResponse schedulePatterns() {
        List<TimSchedulePatternItem> items = entityManager.createQuery("from TimSchedulePattern where is_active = true order by id", TimSchedulePattern.class)
                .getResultList().stream().map(pattern -> new TimSchedulePatternItem(pattern.id, pattern.code, pattern.name)).toList();
        return new TimSchedulePatternListResponse(items, items.size());
    }

    @Transactional
    TimDepartmentScheduleAssignmentListResponse departmentAssignments(Integer departmentId) {
        String jpql = "from TimDepartmentScheduleAssignment" + (departmentId == null ? "" : " where department_id = :departmentId")
                + " order by is_active desc, priority desc, department_id, effective_from desc, id desc";
        var query = entityManager.createQuery(jpql, TimDepartmentScheduleAssignment.class);
        if (departmentId != null) query.setParameter("departmentId", departmentId);
        List<TimDepartmentScheduleAssignmentItem> items = query.getResultList().stream().map(this::departmentAssignmentItem).toList();
        return new TimDepartmentScheduleAssignmentListResponse(items, items.size());
    }

    @Transactional
    TimDepartmentScheduleAssignmentBatchResponse saveDepartmentAssignments(TimDepartmentScheduleAssignmentBatchRequest request) {
        int inserted = 0;
        int updated = 0;
        int deleted = deleteEntities(request.deleteIds(), TimDepartmentScheduleAssignment.class);
        for (TimDepartmentScheduleAssignmentUpsertRequest input : request.items()) {
            validateRange(input.effectiveFrom(), input.effectiveTo());
            TimDepartmentScheduleAssignment row = input.id() == null ? null
                    : entityManager.find(TimDepartmentScheduleAssignment.class, input.id(), LockModeType.PESSIMISTIC_WRITE);
            if (input.id() != null && row == null) throw ApiException.notFound("부서 근무 배정을 찾을 수 없습니다.");
            if (row == null) { row = new TimDepartmentScheduleAssignment(); row.created_at = now(); inserted++; } else updated++;
            row.department_id = input.departmentId(); row.pattern_id = input.patternId(); row.effective_from = input.effectiveFrom();
            row.effective_to = input.effectiveTo(); row.priority = input.priority(); row.is_active = input.isActive(); row.updated_at = now();
            if (row.id == null) entityManager.persist(row);
        }
        entityManager.flush();
        TimDepartmentScheduleAssignmentListResponse result = departmentAssignments(null);
        return new TimDepartmentScheduleAssignmentBatchResponse(result.items(), result.totalCount(), inserted, updated, deleted);
    }

    @Transactional
    TimEmployeeScheduleExceptionListResponse employeeExceptions(Integer employeeId) {
        String jpql = "from TimEmployeeScheduleException" + (employeeId == null ? "" : " where employee_id = :employeeId")
                + " order by effective_from desc, id desc";
        var query = entityManager.createQuery(jpql, TimEmployeeScheduleException.class);
        if (employeeId != null) query.setParameter("employeeId", employeeId);
        List<TimEmployeeScheduleExceptionItem> items = query.getResultList().stream().map(this::employeeExceptionItem).toList();
        return new TimEmployeeScheduleExceptionListResponse(items, items.size());
    }

    @Transactional
    TimEmployeeScheduleExceptionBatchResponse saveEmployeeExceptions(TimEmployeeScheduleExceptionBatchRequest request) {
        int inserted = 0;
        int updated = 0;
        int deleted = deleteEntities(request.deleteIds(), TimEmployeeScheduleException.class);
        for (TimEmployeeScheduleExceptionUpsertRequest input : request.items()) {
            validateRange(input.effectiveFrom(), input.effectiveTo());
            TimEmployeeScheduleException row = input.id() == null ? null
                    : entityManager.find(TimEmployeeScheduleException.class, input.id(), LockModeType.PESSIMISTIC_WRITE);
            if (input.id() != null && row == null) throw ApiException.notFound("사원 근무 예외를 찾을 수 없습니다.");
            if (row == null) { row = new TimEmployeeScheduleException(); row.created_at = now(); inserted++; } else updated++;
            row.employee_id = input.employeeId(); row.pattern_id = input.patternId(); row.effective_from = input.effectiveFrom();
            row.effective_to = input.effectiveTo(); row.reason = input.reason(); row.priority = input.priority(); row.is_active = input.isActive(); row.updated_at = now();
            if (row.id == null) entityManager.persist(row);
        }
        entityManager.flush();
        TimEmployeeScheduleExceptionListResponse result = employeeExceptions(null);
        return new TimEmployeeScheduleExceptionBatchResponse(result.items(), result.totalCount(), inserted, updated, deleted);
    }

    @Transactional
    TimScheduleGenerateResponse generateSchedules(TimScheduleGenerateRequest request) {
        validateRange(request.dateFrom(), request.dateTo());
        if ("department".equals(request.target()) && request.departmentId() == null) throw ApiException.badRequest("부서 대상을 지정해야 합니다.");
        if ("employee".equals(request.target()) && (request.employeeIds() == null || request.employeeIds().isEmpty())) throw ApiException.badRequest("사원 대상을 지정해야 합니다.");
        advisoryLock("tim:schedule:" + request.dateFrom() + ':' + request.dateTo());
        List<EmployeeReference> employees = employees(request);
        List<TimHoliday> holidays = entityManager.createQuery("from TimHoliday where holiday_date between :from and :to and is_active = true", TimHoliday.class)
                .setParameter("from", request.dateFrom()).setParameter("to", request.dateTo()).getResultList();
        int created = 0;
        int updated = 0;
        int skipped = 0;
        String versionTag = "gen-" + now().toEpochMilli();
        for (LocalDate day = request.dateFrom(); !day.isAfter(request.dateTo()); day = day.plusDays(1)) {
            LocalDate scheduleDate = day;
            TimHoliday holiday = holidays.stream().filter(value -> value.holiday_date.equals(scheduleDate)).findFirst().orElse(null);
            for (EmployeeReference employee : employees) {
                TimEmployeeDailySchedule existing = dailySchedule(employee.id(), day);
                if (existing != null && !"overwrite".equals(request.mode())) { skipped++; continue; }
                AssignmentResolution assignment = assignmentFor(employee, day);
                TimSchedulePatternDay patternDay = assignment.patternId() == null ? null : patternDay(assignment.patternId(), day.getDayOfWeek().getValue() - 1);
                boolean workday = patternDay == null ? day.getDayOfWeek().getValue() < 6 : patternDay.is_workday;
                if (holiday != null) workday = false;
                TimEmployeeDailySchedule target = existing == null ? new TimEmployeeDailySchedule() : existing;
                target.employee_id = employee.id(); target.work_date = day; target.schedule_source = assignment.source(); target.pattern_id = assignment.patternId();
                target.is_holiday = holiday != null; target.holiday_name = holiday == null ? null : holiday.name; target.is_workday = workday;
                String start = patternDay == null ? (workday ? "09:00" : null) : patternDay.start_time;
                String end = patternDay == null ? (workday ? "18:00" : null) : patternDay.end_time;
                target.planned_start_at = TimeFormula.scheduledLocalDateTime(day, start); target.planned_end_at = TimeFormula.scheduledLocalDateTime(day, end);
                target.break_minutes = patternDay == null ? 60 : patternDay.break_minutes;
                target.expected_minutes = patternDay == null ? (workday ? 480 : 0) : patternDay.expected_minutes;
                target.is_overnight = patternDay != null && patternDay.is_overnight; target.generated_at = now(); target.version_tag = versionTag;
                if (existing == null) { entityManager.persist(target); created++; } else updated++;
            }
        }
        return new TimScheduleGenerateResponse(created, updated, skipped, versionTag);
    }

    @Transactional
    TimScheduleTodayResponse myScheduleToday(int employeeId) { return new TimScheduleTodayResponse(scheduleToday(employeeId, today())); }

    @Transactional
    TimAttendanceDailyListResponse attendanceDaily(LocalDate startDate, LocalDate endDate, Integer employeeId, String status, int page, int limit) {
        validateRange(startDate, endDate);
        int total = gridMapper.countAttendance(startDate, endDate, employeeId, status);
        List<TimAttendanceDailyItem> items = gridMapper.listAttendance(startDate, endDate, employeeId, status, limit, (page - 1) * limit)
                .stream().map(this::attendanceItem).toList();
        return new TimAttendanceDailyListResponse(items, total, page, limit, (int) Math.ceil(total / (double) limit));
    }

    @Transactional
    TimAttendanceTodayResponse attendanceToday(int employeeId) {
        TimAttendanceDaily row = attendance(employeeId, today(), LockModeType.NONE);
        return new TimAttendanceTodayResponse(row == null ? null : attendanceItem(row));
    }

    @Transactional
    TimTodayScheduleResponse attendanceTodaySchedule(int employeeId) {
        TimScheduleTodayItem schedule = scheduleToday(employeeId, today());
        TimAttendanceDaily row = attendance(employeeId, today(), LockModeType.NONE);
        TimAttendanceDailyItem item = row == null ? null : attendanceItem(row);
        boolean late = item != null && item.checkInAt() != null && schedule.workStart() != null
                && item.checkInAt().isAfter(TimeFormula.scheduledInstant(today(), schedule.workStart()));
        int overtime = item != null && item.checkOutAt() != null && schedule.workEnd() != null
                ? Math.max(0, (int) java.time.Duration.between(TimeFormula.scheduledInstant(today(), schedule.workEnd()), item.checkOutAt()).toMinutes()) : 0;
        return new TimTodayScheduleResponse(new TimTodayScheduleItem(schedule.workDate(), schedule.dayType(), schedule.patternCode(), schedule.patternName(),
                schedule.workStart(), schedule.workEnd(), schedule.breakMinutes(), schedule.expectedMinutes() / 60.0, schedule.isHoliday(), schedule.holidayName()),
                item, new TimTodayDerivedItem(late, overtime, item != null && item.checkInAt() != null && !"workday".equals(schedule.dayType())));
    }

    @Transactional
    TimAttendanceDailyItem attendanceDetail(int attendanceId) {
        TimAttendanceDaily row = entityManager.find(TimAttendanceDaily.class, attendanceId);
        if (row == null) throw ApiException.notFound("근태 기록을 찾을 수 없습니다.");
        return attendanceItem(row);
    }

    @Transactional
    TimAttendanceDailyItem checkIn(int employeeId) {
        LocalDate workDate = today();
        Instant current = now();
        advisoryLock("tim:attendance:" + employeeId + ':' + workDate);
        TimEmployeeDailySchedule schedule = dailySchedule(employeeId, workDate);
        Instant plannedStart = schedule == null ? null : TimeFormula.normalizeNaivePlannedKst(schedule.planned_start_at);
        boolean late = plannedStart != null && current.isAfter(plannedStart);
        TimAttendanceDaily row = attendance(employeeId, workDate, LockModeType.PESSIMISTIC_WRITE);
        boolean created = row == null;
        if (row == null) {
            row = new TimAttendanceDaily(); row.employee_id = employeeId; row.work_date = workDate;
            row.created_at = current;
        } else if (row.check_in_at != null) {
            throw ApiException.conflict("오늘 이미 출근 처리되었습니다.");
        }
        row.check_in_at = current; row.attendance_status = late ? "late" : "present"; row.updated_at = current;
        calculate(row);
        if (created) entityManager.persist(row);
        entityManager.flush();
        return attendanceItem(row);
    }

    @Transactional
    TimAttendanceDailyItem checkOut(int employeeId) {
        LocalDate workDate = today();
        Instant current = now();
        advisoryLock("tim:attendance:" + employeeId + ':' + workDate);
        TimAttendanceDaily row = attendance(employeeId, workDate, LockModeType.PESSIMISTIC_WRITE);
        if (row == null || row.check_in_at == null) throw ApiException.badRequest("출근 기록이 없어 퇴근 처리할 수 없습니다.");
        if (row.check_out_at != null) throw ApiException.conflict("오늘 이미 퇴근 처리되었습니다.");
        row.check_out_at = current; row.updated_at = current; calculate(row);
        entityManager.flush();
        return attendanceItem(row);
    }

    @Transactional
    TimAttendanceDailyItem correctAttendance(int attendanceId, int actorEmployeeId, TimAttendanceCorrectRequest request) {
        TimAttendanceDaily row = entityManager.find(TimAttendanceDaily.class, attendanceId, LockModeType.PESSIMISTIC_WRITE);
        if (row == null) throw ApiException.notFound("근태 기록을 찾을 수 없습니다.");
        assertMonthOpen(row.work_date.getYear(), row.work_date.getMonthValue());
        TimAttendanceCorrection correction = new TimAttendanceCorrection();
        correction.attendance_id = attendanceId; correction.corrected_by_employee_id = actorEmployeeId; correction.old_status = row.attendance_status;
        correction.new_status = request.newStatus(); correction.old_check_in_at = row.check_in_at; correction.new_check_in_at = request.newCheckInAt();
        correction.old_check_out_at = row.check_out_at; correction.new_check_out_at = request.newCheckOutAt(); correction.reason = request.reason(); correction.corrected_at = now();
        entityManager.persist(correction);
        row.attendance_status = request.newStatus(); row.check_in_at = request.newCheckInAt(); row.check_out_at = request.newCheckOutAt(); row.updated_at = now();
        calculate(row);
        return attendanceItem(row);
    }

    @Transactional
    TimAttendanceCorrectionListResponse corrections(int attendanceId) {
        List<TimAttendanceCorrectionItem> corrections = entityManager.createQuery("from TimAttendanceCorrection where attendance_id = :id order by corrected_at desc, id desc", TimAttendanceCorrection.class)
                .setParameter("id", attendanceId).getResultList().stream().map(this::correctionItem).toList();
        return new TimAttendanceCorrectionListResponse(corrections, corrections.size());
    }

    @Transactional
    TimAnnualLeaveResponse annualLeave(int employeeId, int year) { return new TimAnnualLeaveResponse(annualLeaveItem(getOrCreateAnnualLeave(employeeId, year))); }

    @Transactional
    TimAnnualLeaveResponse adjustAnnualLeave(TimAnnualLeaveAdjustRequest request) {
        TimAnnualLeave leave = getOrCreateAnnualLeave(request.employeeId(), request.year());
        entityManager.lock(leave, LockModeType.PESSIMISTIC_WRITE);
        leave.granted_days += request.adjustmentDays(); leave.remaining_days += request.adjustmentDays(); leave.grant_type = "adjustment";
        leave.note = request.reason(); leave.updated_at = now();
        return new TimAnnualLeaveResponse(annualLeaveItem(leave));
    }

    @Transactional
    TimAnnualLeaveListResponse annualLeaves(int year, Integer departmentId, String keyword, int page, int limit) {
        List<TimAnnualLeaveItem> all = gridMapper.annualLeaves(year, departmentId, keyword).stream().map(this::annualLeaveItem).toList();
        return new TimAnnualLeaveListResponse(page(all, page, limit), all.size(), page, limit);
    }

    @Transactional
    TimLeaveRequestItem createLeave(int employeeId, TimLeaveRequestCreateRequest request) {
        validateRange(request.startDate(), request.endDate());
        assertOpenMonths(request.startDate(), request.endDate());
        advisoryLock("tim:leave:" + employeeId + ':' + request.startDate().getYear());
        boolean overlap = !entityManager.createQuery("from TimLeaveRequest where employee_id = :employeeId and request_status in ('pending', 'approved') and start_date <= :end and end_date >= :start", TimLeaveRequest.class)
                .setParameter("employeeId", employeeId).setParameter("start", request.startDate()).setParameter("end", request.endDate()).setMaxResults(1).getResultList().isEmpty();
        if (overlap) throw ApiException.conflict("중복 기간 휴가 요청이 존재합니다.");
        double days = workingDays(request.startDate(), request.endDate());
        if ("annual".equals(request.leaveType()) && getOrCreateAnnualLeave(employeeId, request.startDate().getYear()).remaining_days < days) {
            throw ApiException.badRequest("연차 잔여일수가 부족합니다.");
        }
        TimLeaveRequest row = new TimLeaveRequest(); row.employee_id = employeeId; row.leave_type = request.leaveType(); row.start_date = request.startDate();
        row.end_date = request.endDate(); row.reason = request.reason(); row.request_status = "pending"; row.created_at = now(); row.updated_at = row.created_at;
        entityManager.persist(row); entityManager.flush();
        return leaveRequestItem(leaveRow(row.id));
    }

    @Transactional
    TimLeaveRequestListResponse leaveRequests(Integer employeeId, String status, boolean pendingOnly, int page, int limit) {
        List<TimLeaveRequestItem> all = gridMapper.leaveRequests(employeeId, status, pendingOnly).stream().map(this::leaveRequestItem).toList();
        return new TimLeaveRequestListResponse(page(all, page, limit), all.size(), page, limit);
    }

    @Transactional
    TimLeaveRequestItem decideLeave(int requestId, int approverEmployeeId, boolean approve, TimLeaveDecisionRequest request) {
        TimLeaveRequest row = entityManager.find(TimLeaveRequest.class, requestId, LockModeType.PESSIMISTIC_WRITE);
        if (row == null) throw ApiException.notFound("휴가 요청을 찾을 수 없습니다.");
        assertOpenMonths(row.start_date, row.end_date);
        if (!"pending".equals(row.request_status)) throw ApiException.badRequest("대기 상태의 요청만 처리할 수 있습니다.");
        row.request_status = approve ? "approved" : "rejected"; row.approver_employee_id = approverEmployeeId; row.approved_at = now();
        row.decided_by = approverEmployeeId; row.decided_at = now(); row.decision_comment = request.reason(); row.updated_at = now();
        if (approve && "annual".equals(row.leave_type)) {
            TimAnnualLeave annual = getOrCreateAnnualLeave(row.employee_id, row.start_date.getYear()); entityManager.lock(annual, LockModeType.PESSIMISTIC_WRITE);
            double days = workingDays(row.start_date, row.end_date);
            if (annual.remaining_days < days) throw ApiException.badRequest("연차 잔여일수가 부족합니다.");
            annual.used_days += days; annual.remaining_days -= days; annual.updated_at = now();
        }
        entityManager.flush();
        return leaveRequestItem(leaveRow(row.id));
    }

    @Transactional
    TimLeaveRequestItem cancelLeave(int requestId, int actorEmployeeId, TimLeaveDecisionRequest request) {
        TimLeaveRequest row = entityManager.find(TimLeaveRequest.class, requestId, LockModeType.PESSIMISTIC_WRITE);
        if (row == null) throw ApiException.notFound("휴가 요청을 찾을 수 없습니다.");
        if (row.employee_id != actorEmployeeId) throw ApiException.forbidden("본인 휴가 요청만 취소할 수 있습니다.");
        assertOpenMonths(row.start_date, row.end_date);
        if ("cancelled".equals(row.request_status) || "rejected".equals(row.request_status)) throw ApiException.conflict("취소할 수 없는 휴가 상태입니다.");
        if ("approved".equals(row.request_status) && "annual".equals(row.leave_type)) {
            TimAnnualLeave annual = getOrCreateAnnualLeave(row.employee_id, row.start_date.getYear()); entityManager.lock(annual, LockModeType.PESSIMISTIC_WRITE);
            double days = workingDays(row.start_date, row.end_date); annual.used_days -= days; annual.remaining_days += days; annual.updated_at = now();
        }
        row.request_status = "cancelled"; row.decision_comment = request.reason(); row.decided_by = actorEmployeeId; row.decided_at = now(); row.updated_at = now();
        entityManager.flush();
        return leaveRequestItem(leaveRow(row.id));
    }

    @Transactional
    TimMonthCloseListResponse monthCloses(int year) {
        List<TimMonthClose> rows = entityManager.createQuery("from TimMonthClose where year = :year order by month", TimMonthClose.class).setParameter("year", year).getResultList();
        List<TimMonthCloseItem> items = new ArrayList<>();
        for (int month = 1; month <= 12; month++) {
            int targetMonth = month;
            TimMonthClose found = rows.stream().filter(row -> row.month == targetMonth).findFirst().orElse(null);
            items.add(found == null ? virtualOpen(year, month) : monthCloseItem(found));
        }
        return new TimMonthCloseListResponse(items, year, 12);
    }

    @Transactional
    TimMonthCloseActionResponse closeMonth(TimMonthCloseRequest request, int userId) {
        advisoryLock("tim:month-close:" + request.year() + ':' + request.month());
        TimMonthClose row = monthClose(request.year(), request.month(), LockModeType.PESSIMISTIC_WRITE);
        if (row != null && "closed".equals(row.close_status)) throw ApiException.conflict(request.year() + "년 " + request.month() + "월은 이미 마감 상태입니다.");
        calculateMonth(request.year(), request.month());
        MonthTotals totals = totals(request.year(), request.month());
        boolean created = row == null;
        if (row == null) { row = new TimMonthClose(); row.year = request.year(); row.month = request.month(); row.created_at = now(); }
        row.close_status = "closed"; row.employee_count = totals.employeeCount(); row.present_days = totals.presentDays(); row.late_days = totals.lateDays();
        row.absent_days = totals.absentDays(); row.leave_days = totals.leaveDays(); row.total_overtime_minutes = totals.overtimeMinutes();
        row.total_night_minutes = totals.nightMinutes(); row.total_holiday_work_minutes = totals.holidayWorkMinutes();
        row.total_holiday_overtime_minutes = totals.holidayOvertimeMinutes(); row.total_holiday_night_minutes = totals.holidayNightMinutes();
        row.closed_by = userId; row.closed_at = now(); row.note = request.note(); row.updated_at = now();
        if (created) entityManager.persist(row);
        entityManager.flush();
        generatePayVariableInputs(request.year(), request.month());
        return new TimMonthCloseActionResponse(monthCloseItem(row));
    }

    @Transactional
    TimMonthCloseActionResponse reopenMonth(int year, int month, int userId) {
        advisoryLock("tim:month-close:" + year + ':' + month);
        TimMonthClose row = monthClose(year, month, LockModeType.PESSIMISTIC_WRITE);
        if (row == null || "open".equals(row.close_status)) throw ApiException.conflict(year + "년 " + month + "월은 마감 상태가 아닙니다.");
        row.close_status = "open"; row.reopened_by = userId; row.reopened_at = now(); row.updated_at = now();
        return new TimMonthCloseActionResponse(monthCloseItem(row));
    }

    @Transactional
    TimReportSummaryResponse report(LocalDate startDate, LocalDate endDate) {
        validateRange(startDate, endDate);
        AttendanceStatusAggregate status = gridMapper.attendanceStatus(startDate, endDate);
        List<TimDepartmentSummaryItem> departments = gridMapper.departmentSummary(startDate, endDate).stream()
                .map(row -> new TimDepartmentSummaryItem(row.departmentId(), row.departmentName(), row.attendanceCount(), row.presentRate(), row.lateRate(), row.absentRate())).toList();
        List<TimLeaveTypeSummaryItem> leaveTypes = gridMapper.leaveTypeSummary(startDate, endDate).stream()
                .map(row -> new TimLeaveTypeSummaryItem(row.leaveType(), row.requestCount(), row.approvedCount(), row.pendingCount())).toList();
        return new TimReportSummaryResponse(startDate.toString(), endDate.toString(), status.total(), leaveTypes.stream().mapToInt(TimLeaveTypeSummaryItem::requestCount).sum(),
                new TimStatusCount(status.present(), status.late(), status.absent(), status.leaveCount(), status.remote()), departments, leaveTypes);
    }

    private TimAttendanceCodeItem attendanceCodeItem(TimAttendanceCode row) { return new TimAttendanceCodeItem(row.id, row.code, row.name, row.category, row.unit, row.is_requestable, row.min_days, row.max_days, row.deduct_annual, row.is_active, row.sort_order, row.description, row.created_at, row.updated_at); }
    private TimWorkScheduleCodeItem workScheduleCodeItem(TimWorkScheduleCode row) { return new TimWorkScheduleCodeItem(row.id, row.code, row.name, row.work_start, row.work_end, row.break_minutes, row.is_overnight, row.work_hours, row.is_active, row.sort_order, row.description, row.created_at, row.updated_at); }
    private TimHolidayItem holidayItem(TimHoliday row) { return new TimHolidayItem(row.id, row.holiday_date, row.name, row.holiday_type, row.is_active, row.created_at, row.updated_at); }
    private TimAttendanceDailyItem attendanceItem(AttendanceGridRow row) { return new TimAttendanceDailyItem(row.id(), row.employeeId(), row.employeeNo(), row.employeeName(), row.departmentId(), row.departmentName(), row.workDate(), row.checkInAt(), row.checkOutAt(), workedMinutes(row.checkInAt(), row.checkOutAt()), row.attendanceStatus(), row.actualMinutes(), row.regularMinutes(), row.overtimeMinutes(), row.nightMinutes(), row.holidayWorkMinutes(), row.holidayOvertimeMinutes(), row.holidayNightMinutes(), row.holidayWork()); }
    private TimAttendanceDailyItem attendanceItem(TimAttendanceDaily row) { EmployeeDetail employee = employeeDetail(row.employee_id); return new TimAttendanceDailyItem(row.id, row.employee_id, employee.employeeNo(), employee.name(), employee.departmentId(), employee.departmentName(), row.work_date, row.check_in_at, row.check_out_at, workedMinutes(row.check_in_at, row.check_out_at), row.attendance_status, row.actual_minutes, row.regular_minutes, row.overtime_minutes, row.night_minutes, row.holiday_work_minutes, row.holiday_overtime_minutes, row.holiday_night_minutes, row.is_holiday_work); }
    private TimAttendanceCorrectionItem correctionItem(TimAttendanceCorrection row) { return new TimAttendanceCorrectionItem(row.id, row.attendance_id, row.corrected_by_employee_id, row.old_status, row.new_status, row.old_check_in_at, row.new_check_in_at, row.old_check_out_at, row.new_check_out_at, row.reason, row.corrected_at); }
    private TimAnnualLeaveItem annualLeaveItem(TimAnnualLeave row) { EmployeeDetail employee = employeeDetail(row.employee_id); return new TimAnnualLeaveItem(row.id, row.employee_id, employee.employeeNo(), employee.name(), employee.departmentName(), row.year, row.granted_days, row.used_days, row.carried_over_days, row.remaining_days, row.grant_type, row.note); }
    private TimAnnualLeaveItem annualLeaveItem(AnnualLeaveGridRow row) { return new TimAnnualLeaveItem(row.id(), row.employeeId(), row.employeeNo(), row.employeeName(), row.departmentName(), row.year(), row.grantedDays(), row.usedDays(), row.carriedOverDays(), row.remainingDays(), row.grantType(), row.note()); }
    private TimLeaveRequestItem leaveRequestItem(LeaveRequestGridRow row) { double calendar = java.time.temporal.ChronoUnit.DAYS.between(row.startDate(), row.endDate()) + 1; double deduction = workingDays(row.startDate(), row.endDate()); return new TimLeaveRequestItem(row.id(), row.employeeId(), row.employeeNo(), row.employeeName(), row.departmentName(), row.leaveType(), row.startDate(), row.endDate(), calendar, deduction, deduction, row.reason(), row.requestStatus(), row.approverEmployeeId(), row.approvedAt(), row.decisionComment(), row.decidedBy(), row.decidedAt(), row.createdAt()); }
    private TimLeaveRequestItem leaveRequestItem(TimLeaveRequest row) { EmployeeDetail employee = employeeDetail(row.employee_id); double calendar = java.time.temporal.ChronoUnit.DAYS.between(row.start_date, row.end_date) + 1; double deduction = workingDays(row.start_date, row.end_date); return new TimLeaveRequestItem(row.id, row.employee_id, employee.employeeNo(), employee.name(), employee.departmentName(), row.leave_type, row.start_date, row.end_date, calendar, deduction, deduction, row.reason, row.request_status, row.approver_employee_id, row.approved_at, row.decision_comment, row.decided_by, row.decided_at, row.created_at); }

    private TimDepartmentScheduleAssignmentItem departmentAssignmentItem(TimDepartmentScheduleAssignment row) { DepartmentDetail department = departmentDetail(row.department_id); TimSchedulePattern pattern = entityManager.find(TimSchedulePattern.class, row.pattern_id); return new TimDepartmentScheduleAssignmentItem(row.id, row.department_id, department.code(), department.name(), department.organizationType(), department.costCenterCode(), department.employeeCount(), row.pattern_id, pattern == null ? null : pattern.code, pattern == null ? null : pattern.name, row.effective_from, row.effective_to, row.priority, row.is_active); }
    private TimEmployeeScheduleExceptionItem employeeExceptionItem(TimEmployeeScheduleException row) { EmployeeDetail employee = employeeDetail(row.employee_id); TimSchedulePattern pattern = entityManager.find(TimSchedulePattern.class, row.pattern_id); return new TimEmployeeScheduleExceptionItem(row.id, row.employee_id, employee.employeeNo(), employee.name(), employee.departmentId(), employee.departmentCode(), employee.departmentName(), row.pattern_id, pattern == null ? null : pattern.code, pattern == null ? null : pattern.name, row.effective_from, row.effective_to, row.reason, row.priority, row.is_active); }

    private TimScheduleTodayItem scheduleToday(int employeeId, LocalDate day) {
        TimEmployeeDailySchedule row = dailySchedule(employeeId, day);
        TimSchedulePattern pattern = row == null || row.pattern_id == null ? null : entityManager.find(TimSchedulePattern.class, row.pattern_id);
        TimHoliday holiday = holiday(day);
        boolean holidayDay = row == null ? holiday != null : row.is_holiday;
        boolean workday = row == null ? day.getDayOfWeek().getValue() < 6 : row.is_workday;
        String dayType = holidayDay ? "holiday" : (workday ? "workday" : "weekend");
        TimWorkScheduleCode fallback = entityManager.createQuery("from TimWorkScheduleCode where is_active = true order by sort_order, id", TimWorkScheduleCode.class).setMaxResults(1).getResultList().stream().findFirst().orElse(null);
        return new TimScheduleTodayItem(employeeId, day, dayType, row == null ? "company_default" : row.schedule_source,
                pattern == null ? (fallback == null ? "WS00" : fallback.code) : pattern.code, pattern == null ? (fallback == null ? "기본근무" : fallback.name) : pattern.name,
                row == null || row.planned_start_at == null ? (fallback == null ? "09:00" : fallback.work_start) : row.planned_start_at.toLocalTime().toString().substring(0, 5),
                row == null || row.planned_end_at == null ? (fallback == null ? "18:00" : fallback.work_end) : row.planned_end_at.toLocalTime().toString().substring(0, 5),
                row == null ? (fallback == null ? 60 : fallback.break_minutes) : row.break_minutes, row == null ? (fallback == null ? 480 : (int) (fallback.work_hours * 60)) : row.expected_minutes,
                holidayDay, row == null ? (holiday == null ? null : holiday.name) : row.holiday_name, row == null ? null : row.generated_at);
    }

    private void calculate(TimAttendanceDaily row) {
        TimEmployeeDailySchedule schedule = dailySchedule(row.employee_id, row.work_date);
        TimeFormula.WorkMinutes values = TimeFormula.calculate(row.check_in_at, row.check_out_at, row.attendance_status,
                schedule == null ? 60 : schedule.break_minutes, schedule == null ? 480 : schedule.expected_minutes,
                schedule != null ? schedule.is_holiday : row.work_date.getDayOfWeek().getValue() >= 6,
                schedule == null ? row.work_date.getDayOfWeek().getValue() < 6 : schedule.is_workday);
        row.actual_minutes = values.actualMinutes(); row.regular_minutes = values.regularMinutes(); row.overtime_minutes = values.overtimeMinutes();
        row.night_minutes = values.nightMinutes(); row.holiday_work_minutes = values.holidayWorkMinutes(); row.holiday_overtime_minutes = values.holidayOvertimeMinutes();
        row.holiday_night_minutes = values.holidayNightMinutes(); row.is_holiday_work = values.holidayWork(); row.calculated_at = now();
    }

    private void calculateMonth(int year, int month) {
        YearMonth value = YearMonth.of(year, month); advisoryLock("tim:calculate:" + year + ':' + month);
        List<TimAttendanceDaily> rows = entityManager.createQuery("from TimAttendanceDaily where work_date between :start and :end", TimAttendanceDaily.class)
                .setParameter("start", value.atDay(1)).setParameter("end", value.atEndOfMonth()).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        for (TimAttendanceDaily row : rows) calculate(row);
    }

    private int generatePayVariableInputs(int year, int month) {
        YearMonth target = YearMonth.of(year, month);
        int count = 0;
        for (TimePayWorkAggregate row : payrollGateway.monthlyPayWork(target.atDay(1), target.atEndOfMonth())) {
            count += upsertPayItem(target, row.employeeId(), "OTX", row.overtimeMinutes(), 1.5, row.baseSalary());
            count += upsertPayItem(target, row.employeeId(), "NGT", row.nightMinutes(), 0.5, row.baseSalary());
            count += upsertPayItem(target, row.employeeId(), "HDW", row.holidayWorkMinutes(), 1.5, row.baseSalary());
            count += upsertPayItem(target, row.employeeId(), "HDO", row.holidayOvertimeMinutes(), 2.0, row.baseSalary());
            count += upsertPayItem(target, row.employeeId(), "HDN", row.holidayNightMinutes(), 2.0, row.baseSalary());
        }
        return count;
    }

    private int upsertPayItem(YearMonth target, int employeeId, String itemCode, int minutes, double multiplier, double baseSalary) {
        double amount = minutes > 0 ? Math.rint((baseSalary / 209.0) * multiplier * (minutes / 60.0)) : 0;
        advisoryLock("tim:pay-variable:" + target + ':' + employeeId + ':' + itemCode);
        List<VariableInput> existing = entityManager.createQuery("""
                from VariableInput
                 where yearMonth = :yearMonth and employeeId = :employeeId and itemCode = :itemCode
                """, VariableInput.class)
                .setParameter("yearMonth", target.toString())
                .setParameter("employeeId", employeeId)
                .setParameter("itemCode", itemCode)
                .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                .setMaxResults(1)
                .getResultList();
        if (existing.isEmpty()) {
            if (amount <= 0) {
                return 0;
            }
            VariableInput created = new VariableInput();
            created.yearMonth = target.toString();
            created.employeeId = employeeId;
            created.itemCode = itemCode;
            created.direction = "earning";
            created.amount = amount;
            created.memo = "월마감 자동생성 (" + minutes + "분)";
            LocalDateTime timestamp = LocalDateTime.ofInstant(now(), ZoneOffset.UTC);
            created.createdAt = timestamp;
            created.updatedAt = timestamp;
            entityManager.persist(created);
            return 1;
        }
        VariableInput row = existing.getFirst();
        row.direction = "earning";
        row.amount = amount;
        row.memo = "월마감 자동생성 (" + minutes + "분)";
        row.updatedAt = LocalDateTime.ofInstant(now(), ZoneOffset.UTC);
        return 1;
    }

    private TimAnnualLeave getOrCreateAnnualLeave(int employeeId, int year) {
        advisoryLock("tim:annual-leave:" + employeeId + ':' + year);
        List<TimAnnualLeave> found = entityManager.createQuery("from TimAnnualLeave where employee_id = :employeeId and year = :year", TimAnnualLeave.class)
                .setParameter("employeeId", employeeId).setParameter("year", year).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        if (!found.isEmpty()) return found.getFirst();
        LocalDate hireDate = employeeDetail(employeeId).hireDate();
        double granted = defaultGrantedDays(hireDate, year);
        TimAnnualLeave row = new TimAnnualLeave(); row.employee_id = employeeId; row.year = year; row.granted_days = granted; row.used_days = 0;
        row.carried_over_days = 0; row.remaining_days = granted; row.grant_type = "auto"; row.created_at = now(); row.updated_at = row.created_at;
        entityManager.persist(row); entityManager.flush(); return row;
    }

    private double defaultGrantedDays(LocalDate hireDate, int year) { return Period.between(hireDate, LocalDate.of(year, 12, 31)).getYears() < 1 ? 11.0 : 15.0; }
    private double workingDays(LocalDate start, LocalDate end) { double days = 0; for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) if (date.getDayOfWeek().getValue() < 6 && holiday(date) == null) days++; return days; }
    private TimLeaveRequest leaveRow(int id) { return entityManager.find(TimLeaveRequest.class, id); }
    private TimAttendanceDaily attendance(int employeeId, LocalDate workDate, LockModeType lock) { List<TimAttendanceDaily> rows = entityManager.createQuery("from TimAttendanceDaily where employee_id = :employeeId and work_date = :workDate", TimAttendanceDaily.class).setParameter("employeeId", employeeId).setParameter("workDate", workDate).setLockMode(lock).setMaxResults(1).getResultList(); return rows.isEmpty() ? null : rows.getFirst(); }
    private TimMonthClose monthClose(int year, int month, LockModeType lock) { List<TimMonthClose> rows = entityManager.createQuery("from TimMonthClose where year = :year and month = :month", TimMonthClose.class).setParameter("year", year).setParameter("month", month).setLockMode(lock).setMaxResults(1).getResultList(); return rows.isEmpty() ? null : rows.getFirst(); }
    private TimEmployeeDailySchedule dailySchedule(int employeeId, LocalDate workDate) { List<TimEmployeeDailySchedule> rows = entityManager.createQuery("from TimEmployeeDailySchedule where employee_id = :employeeId and work_date = :workDate", TimEmployeeDailySchedule.class).setParameter("employeeId", employeeId).setParameter("workDate", workDate).setMaxResults(1).getResultList(); return rows.isEmpty() ? null : rows.getFirst(); }
    private TimSchedulePatternDay patternDay(int patternId, int weekday) { List<TimSchedulePatternDay> rows = entityManager.createQuery("from TimSchedulePatternDay where pattern_id = :patternId and weekday = :weekday", TimSchedulePatternDay.class).setParameter("patternId", patternId).setParameter("weekday", weekday).setMaxResults(1).getResultList(); return rows.isEmpty() ? null : rows.getFirst(); }
    private TimHoliday holiday(LocalDate date) { List<TimHoliday> rows = entityManager.createQuery("from TimHoliday where holiday_date = :date and is_active = true", TimHoliday.class).setParameter("date", date).setMaxResults(1).getResultList(); return rows.isEmpty() ? null : rows.getFirst(); }
    private AssignmentResolution assignmentFor(EmployeeReference employee, LocalDate day) { List<TimEmployeeScheduleException> exceptions = entityManager.createQuery("from TimEmployeeScheduleException where employee_id = :employeeId and is_active = true and effective_from <= :day and (effective_to is null or effective_to >= :day) order by priority desc, effective_from desc, id desc", TimEmployeeScheduleException.class).setParameter("employeeId", employee.id()).setParameter("day", day).getResultList(); if (!exceptions.isEmpty()) return new AssignmentResolution(exceptions.getFirst().pattern_id, "employee_exception"); List<TimDepartmentScheduleAssignment> assignments = entityManager.createQuery("from TimDepartmentScheduleAssignment where department_id = :departmentId and is_active = true and effective_from <= :day and (effective_to is null or effective_to >= :day) order by priority desc, effective_from desc, id desc", TimDepartmentScheduleAssignment.class).setParameter("departmentId", employee.departmentId()).setParameter("day", day).getResultList(); if (!assignments.isEmpty()) return new AssignmentResolution(assignments.getFirst().pattern_id, "department_default"); List<TimSchedulePattern> defaults = entityManager.createQuery("from TimSchedulePattern where is_active = true order by id", TimSchedulePattern.class).setMaxResults(1).getResultList(); return new AssignmentResolution(defaults.isEmpty() ? null : defaults.getFirst().id, "company_default"); }
    private List<EmployeeReference> employees(TimScheduleGenerateRequest request) { String sql = "select id, department_id from hr_employees"; if ("department".equals(request.target())) sql += " where department_id = :departmentId"; if ("employee".equals(request.target())) sql += " where id = any(:employeeIds)"; var query = entityManager.createNativeQuery(sql); if (request.departmentId() != null) query.setParameter("departmentId", request.departmentId()); if (request.employeeIds() != null) query.setParameter("employeeIds", request.employeeIds().toArray(Integer[]::new)); @SuppressWarnings("unchecked") List<Object[]> rows = query.getResultList(); return rows.stream().map(row -> new EmployeeReference(((Number) row[0]).intValue(), ((Number) row[1]).intValue())).toList(); }
    private EmployeeDetail employeeDetail(int employeeId) { @SuppressWarnings("unchecked") List<Object[]> rows = entityManager.createNativeQuery("select e.employee_no, u.display_name, e.department_id, d.code, d.name, e.hire_date from hr_employees e join auth_users u on u.id = e.user_id join org_departments d on d.id = e.department_id where e.id = :id").setParameter("id", employeeId).getResultList(); if (rows.isEmpty()) throw ApiException.notFound("사원 프로필을 찾을 수 없습니다."); Object[] row = rows.getFirst(); LocalDate hireDate = row[5] instanceof LocalDate date ? date : ((java.sql.Date) row[5]).toLocalDate(); return new EmployeeDetail((String) row[0], (String) row[1], ((Number) row[2]).intValue(), (String) row[3], (String) row[4], hireDate); }
    private DepartmentDetail departmentDetail(int departmentId) { @SuppressWarnings("unchecked") List<Object[]> rows = entityManager.createNativeQuery("select d.code, d.name, d.organization_type, d.cost_center_code, count(e.id) from org_departments d left join hr_employees e on e.department_id = d.id where d.id = :id group by d.code, d.name, d.organization_type, d.cost_center_code").setParameter("id", departmentId).getResultList(); if (rows.isEmpty()) return new DepartmentDetail("DEPT-" + departmentId, "미확인 조직", null, null, 0); Object[] row = rows.getFirst(); return new DepartmentDetail((String) row[0], (String) row[1], (String) row[2], (String) row[3], ((Number) row[4]).intValue()); }
    private MonthTotals totals(int year, int month) { YearMonth value = YearMonth.of(year, month); List<TimAttendanceDaily> rows = entityManager.createQuery("from TimAttendanceDaily where work_date between :start and :end", TimAttendanceDaily.class).setParameter("start", value.atDay(1)).setParameter("end", value.atEndOfMonth()).getResultList(); List<Integer> employeeIds = rows.stream().map(row -> row.employee_id).distinct().toList(); return new MonthTotals(employeeIds.size(), sumStatus(rows, "present"), sumStatus(rows, "late"), sumStatus(rows, "absent"), sumStatus(rows, "leave"), rows.stream().mapToInt(row -> row.overtime_minutes).sum(), rows.stream().mapToInt(row -> row.night_minutes).sum(), rows.stream().mapToInt(row -> row.holiday_work_minutes).sum(), rows.stream().mapToInt(row -> row.holiday_overtime_minutes).sum(), rows.stream().mapToInt(row -> row.holiday_night_minutes).sum()); }
    private int sumStatus(List<TimAttendanceDaily> rows, String status) { return (int) rows.stream().filter(row -> status.equals(row.attendance_status)).count(); }
    private TimMonthCloseItem monthCloseItem(TimMonthClose row) { return new TimMonthCloseItem(row.id, row.year, row.month, row.close_status, row.employee_count, row.present_days, row.absent_days, row.late_days, row.leave_days, row.total_overtime_minutes, row.total_night_minutes, row.total_holiday_work_minutes, row.total_holiday_overtime_minutes, row.total_holiday_night_minutes, row.closed_by, displayName(row.closed_by), row.closed_at, row.reopened_by, displayName(row.reopened_by), row.reopened_at, row.note, row.created_at, row.updated_at); }
    private TimMonthCloseItem virtualOpen(int year, int month) { return new TimMonthCloseItem(null, year, month, "open", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, null, null, null, null, null); }
    private String displayName(Integer userId) { if (userId == null) return null; Object value = entityManager.createNativeQuery("select display_name from auth_users where id = :id").setParameter("id", userId).getResultStream().findFirst().orElse(null); return value == null ? null : value.toString(); }
    private void assertMonthOpen(int year, int month) { TimMonthClose row = monthClose(year, month, LockModeType.NONE); if (row != null && "closed".equals(row.close_status)) throw ApiException.locked(year + "년 " + month + "월은 마감된 기간입니다. 수정할 수 없습니다."); }
    private void assertOpenMonths(LocalDate start, LocalDate end) { for (YearMonth month = YearMonth.from(start); !month.isAfter(YearMonth.from(end)); month = month.plusMonths(1)) assertMonthOpen(month.getYear(), month.getMonthValue()); }
    private void advisoryLock(String key) { entityManager.createNativeQuery("select pg_advisory_xact_lock(hashtextextended(cast(:key as text), 0))").setParameter("key", key).getSingleResult(); }
    private int deleteEntities(List<Integer> ids, Class<?> type) { if (ids == null || ids.isEmpty()) return 0; int deleted = 0; for (Integer id : ids) { Object row = entityManager.find(type, id, LockModeType.PESSIMISTIC_WRITE); if (row != null) { entityManager.remove(row); deleted++; } } return deleted; }
    private void validateRange(LocalDate start, LocalDate end) { if (end != null && start.isAfter(end)) throw ApiException.badRequest("시작일은 종료일보다 늦을 수 없습니다."); }
    private Integer workedMinutes(Instant checkIn, Instant checkOut) { return checkIn == null || checkOut == null ? null : Math.max(0, (int) java.time.Duration.between(checkIn, checkOut).toMinutes()); }
    private <T> List<T> page(List<T> items, int page, int limit) { int start = Math.min((page - 1) * limit, items.size()); return new ArrayList<>(items.subList(start, Math.min(start + limit, items.size()))); }
    private Instant now() { return clock.instant(); }
    private LocalDate today() { return LocalDate.ofInstant(clock.instant(), TimeFormula.KST); }

    private record AssignmentResolution(Integer patternId, String source) { }
    private record EmployeeReference(int id, int departmentId) { }
    private record EmployeeDetail(String employeeNo, String name, int departmentId, String departmentCode, String departmentName, LocalDate hireDate) { }
    private record DepartmentDetail(String code, String name, String organizationType, String costCenterCode, int employeeCount) { }
    private record MonthTotals(int employeeCount, int presentDays, int lateDays, int absentDays, int leaveDays, int overtimeMinutes, int nightMinutes, int holidayWorkMinutes, int holidayOvertimeMinutes, int holidayNightMinutes) { }
}
