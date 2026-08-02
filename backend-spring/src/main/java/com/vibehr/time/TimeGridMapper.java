package com.vibehr.time;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
interface TimeGridMapper {
    @Select("""
            <script>
            select a.id, a.employee_id as employeeId, e.employee_no as employeeNo, u.display_name as employeeName,
                   e.department_id as departmentId, d.name as departmentName, a.work_date as workDate,
                   a.check_in_at as checkInAt, a.check_out_at as checkOutAt, a.attendance_status as attendanceStatus,
                   a.actual_minutes as actualMinutes, a.regular_minutes as regularMinutes, a.overtime_minutes as overtimeMinutes,
                   a.night_minutes as nightMinutes, a.holiday_work_minutes as holidayWorkMinutes,
                   a.holiday_overtime_minutes as holidayOvertimeMinutes, a.holiday_night_minutes as holidayNightMinutes,
                   a.is_holiday_work as holidayWork
              from tim_attendance_daily a
              join hr_employees e on e.id = a.employee_id
              join auth_users u on u.id = e.user_id
              join org_departments d on d.id = e.department_id
             where a.work_date between #{startDate} and #{endDate}
              <if test='employeeId != null'> and a.employee_id = #{employeeId}</if>
              <if test='status != null and status != ""'> and a.attendance_status = #{status}</if>
             order by a.work_date desc, a.id desc
             limit #{limit} offset #{offset}
            </script>
            """)
    List<AttendanceGridRow> listAttendance(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate,
            @Param("employeeId") Integer employeeId, @Param("status") String status, @Param("limit") int limit, @Param("offset") int offset);

    @Select("""
            <script>
            select count(*) from tim_attendance_daily a
             where a.work_date between #{startDate} and #{endDate}
              <if test='employeeId != null'> and a.employee_id = #{employeeId}</if>
              <if test='status != null and status != ""'> and a.attendance_status = #{status}</if>
            </script>
            """)
    int countAttendance(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate,
            @Param("employeeId") Integer employeeId, @Param("status") String status);

    @Select("""
            select count(*) as total,
              coalesce(sum(case when attendance_status = 'present' then 1 else 0 end), 0) as present,
              coalesce(sum(case when attendance_status = 'late' then 1 else 0 end), 0) as late,
              coalesce(sum(case when attendance_status = 'absent' then 1 else 0 end), 0) as absent,
              coalesce(sum(case when attendance_status = 'leave' then 1 else 0 end), 0) as leaveCount,
              coalesce(sum(case when attendance_status = 'remote' then 1 else 0 end), 0) as remote
            from tim_attendance_daily where work_date between #{startDate} and #{endDate}
            """)
    AttendanceStatusAggregate attendanceStatus(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Select("""
            select e.department_id as departmentId, d.name as departmentName, count(*) as attendanceCount,
              round(100.0 * sum(case when a.attendance_status = 'present' then 1 else 0 end) / nullif(count(*), 0), 2) as presentRate,
              round(100.0 * sum(case when a.attendance_status = 'late' then 1 else 0 end) / nullif(count(*), 0), 2) as lateRate,
              round(100.0 * sum(case when a.attendance_status = 'absent' then 1 else 0 end) / nullif(count(*), 0), 2) as absentRate
            from tim_attendance_daily a join hr_employees e on e.id = a.employee_id join org_departments d on d.id = e.department_id
            where a.work_date between #{startDate} and #{endDate}
            group by e.department_id, d.name order by attendanceCount desc, departmentId
            """)
    List<DepartmentReportRow> departmentSummary(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Select("""
            select leave_type as leaveType, count(*) as requestCount,
              coalesce(sum(case when request_status = 'approved' then 1 else 0 end), 0) as approvedCount,
              coalesce(sum(case when request_status = 'pending' then 1 else 0 end), 0) as pendingCount
            from tim_leave_requests where start_date &lt;= #{endDate} and end_date &gt;= #{startDate}
            group by leave_type order by leave_type
            """)
    List<LeaveTypeReportRow> leaveTypeSummary(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Select("""
            <script>
            select l.id, l.employee_id as employeeId, e.employee_no as employeeNo, u.display_name as employeeName,
                   d.name as departmentName, l.year, l.granted_days as grantedDays, l.used_days as usedDays,
                   l.carried_over_days as carriedOverDays, l.remaining_days as remainingDays, l.grant_type as grantType, l.note
              from tim_annual_leaves l join hr_employees e on e.id = l.employee_id
              join auth_users u on u.id = e.user_id join org_departments d on d.id = e.department_id
             where l.year = #{year}
              <if test='departmentId != null'> and e.department_id = #{departmentId}</if>
             <if test='keyword != null and keyword != ""'> and (e.employee_no ilike concat('%', #{keyword}, '%') or u.display_name ilike concat('%', #{keyword}, '%'))</if>
             order by e.employee_no
            </script>
            """)
    List<AnnualLeaveGridRow> annualLeaves(@Param("year") int year, @Param("departmentId") Integer departmentId, @Param("keyword") String keyword);

    @Select("""
            <script>
            select r.id, r.employee_id as employeeId, e.employee_no as employeeNo, u.display_name as employeeName,
                   d.name as departmentName, r.leave_type as leaveType, r.start_date as startDate, r.end_date as endDate,
                   r.reason, r.request_status as requestStatus, r.approver_employee_id as approverEmployeeId,
                   r.approved_at as approvedAt, r.decision_comment as decisionComment, r.decided_by as decidedBy,
                   r.decided_at as decidedAt, r.created_at as createdAt
              from tim_leave_requests r join hr_employees e on e.id = r.employee_id
              join auth_users u on u.id = e.user_id join org_departments d on d.id = e.department_id
             where 1 = 1
              <if test='employeeId != null'> and r.employee_id = #{employeeId}</if>
              <if test='status != null and status != ""'> and r.request_status = #{status}</if>
              <if test='pendingOnly'> and r.request_status = 'pending'</if>
             order by r.created_at desc, r.id desc
            </script>
            """)
    List<LeaveRequestGridRow> leaveRequests(@Param("employeeId") Integer employeeId, @Param("status") String status,
            @Param("pendingOnly") boolean pendingOnly);
}

record AttendanceGridRow(Integer id, int employeeId, String employeeNo, String employeeName, int departmentId,
        String departmentName, LocalDate workDate, Instant checkInAt, Instant checkOutAt, String attendanceStatus,
        int actualMinutes, int regularMinutes, int overtimeMinutes, int nightMinutes, int holidayWorkMinutes,
        int holidayOvertimeMinutes, int holidayNightMinutes, boolean holidayWork) { }
record AttendanceStatusAggregate(int total, int present, int late, int absent, int leaveCount, int remote) { }
record DepartmentReportRow(int departmentId, String departmentName, int attendanceCount, double presentRate, double lateRate, double absentRate) { }
record LeaveTypeReportRow(String leaveType, int requestCount, int approvedCount, int pendingCount) { }
record AnnualLeaveGridRow(Integer id, int employeeId, String employeeNo, String employeeName, String departmentName,
        int year, double grantedDays, double usedDays, double carriedOverDays, double remainingDays, String grantType, String note) { }
record LeaveRequestGridRow(Integer id, int employeeId, String employeeNo, String employeeName, String departmentName,
        String leaveType, LocalDate startDate, LocalDate endDate, String reason, String requestStatus,
        Integer approverEmployeeId, Instant approvedAt, String decisionComment, Integer decidedBy, Instant decidedAt, Instant createdAt) { }
