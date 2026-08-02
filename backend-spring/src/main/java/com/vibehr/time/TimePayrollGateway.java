package com.vibehr.time;

import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
interface TimePayrollGateway {
    @Select("""
            select a.employee_id as employeeId,
                   coalesce(sum(a.overtime_minutes), 0) as overtimeMinutes,
                   coalesce(sum(a.night_minutes), 0) as nightMinutes,
                   coalesce(sum(a.holiday_work_minutes), 0) as holidayWorkMinutes,
                   coalesce(sum(a.holiday_overtime_minutes), 0) as holidayOvertimeMinutes,
                   coalesce(sum(a.holiday_night_minutes), 0) as holidayNightMinutes,
                   profile.base_salary as baseSalary
              from tim_attendance_daily a
              join lateral (
                    select p.base_salary
                      from pay_employee_profiles p
                     where p.employee_id = a.employee_id
                       and p.is_active = true
                       and p.effective_from <= #{lastDay}
                     order by p.effective_from desc
                     limit 1
              ) profile on profile.base_salary > 0
             where a.work_date between #{firstDay} and #{lastDay}
             group by a.employee_id, profile.base_salary
             order by a.employee_id
            """)
    List<TimePayWorkAggregate> monthlyPayWork(@Param("firstDay") LocalDate firstDay, @Param("lastDay") LocalDate lastDay);
}

record TimePayWorkAggregate(int employeeId, int overtimeMinutes, int nightMinutes, int holidayWorkMinutes,
        int holidayOvertimeMinutes, int holidayNightMinutes, double baseSalary) { }
