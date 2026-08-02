package com.vibehr.dashboard;

import java.time.LocalDate;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** One read-only projection prevents dashboard counters from claiming foreign JPA tables. */
@Mapper
interface DashboardProjectionMapper {
    @Select("""
            select
                (select count(*) from hr_employees) as totalEmployees,
                (select count(*) from org_departments) as totalDepartments,
                (select count(*) from tim_attendance_daily where work_date = #{workDate} and attendance_status = 'present') as attendancePresent,
                (select count(*) from tim_attendance_daily where work_date = #{workDate} and attendance_status = 'late') as attendanceLate,
                (select count(*) from tim_attendance_daily where work_date = #{workDate} and attendance_status = 'absent') as attendanceAbsent,
                (select count(*) from tim_leave_requests where request_status = 'pending') as pendingLeaveRequests
            """)
    DashboardProjection summary(@Param("workDate") LocalDate workDate);

    record DashboardProjection(long totalEmployees, long totalDepartments, long attendancePresent,
                               long attendanceLate, long attendanceAbsent, long pendingLeaveRequests) {
    }
}
