package com.vibehr.organization;

import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** Read-only projections for tables owned by HR, auth, and common-code packages. */
@Mapper
interface OrganizationReferenceReadMapper {
    @Select("select count(*) from hr_employees where department_id = #{departmentId}")
    long employeeCountForDepartment(@Param("departmentId") int departmentId);

    @Select("select department_id as departmentId, count(*) as employeeCount from hr_employees group by department_id")
    List<DepartmentEmployeeCount> employeeCountsByDepartment();

    @Select("select id from hr_employees where hire_date <= #{referenceDate} order by employee_no, id")
    List<Long> employeeIdsHiredOnOrBefore(@Param("referenceDate") LocalDate referenceDate);

    @Select("""
            <script>
            select e.id, e.employee_no as employeeNo, u.display_name as displayName,
                   e.department_id as departmentId, e.position_title as positionTitle,
                   e.employment_status as employmentStatus
              from hr_employees e join auth_users u on u.id = e.user_id
             where e.id in
             <foreach collection='employeeIds' item='employeeId' open='(' separator=',' close=')'>#{employeeId}</foreach>
             order by e.employee_no, e.id
            </script>
            """)
    List<EmployeeSnapshotReference> employeesWithUsers(@Param("employeeIds") List<Long> employeeIds);

    @Select("""
            <script>
            select employee_id as employeeId, effective_date as effectiveDate, field_name as fieldName,
                   before_value as beforeValue
              from hr_personnel_histories
             where employee_id in
             <foreach collection='employeeIds' item='employeeId' open='(' separator=',' close=')'>#{employeeId}</foreach>
               and effective_date &gt; #{referenceDate}
               and field_name in ('department_id', 'employment_status')
             order by employee_id, effective_date desc, id desc
            </script>
            """)
    List<PersonnelHistoryReference> personnelHistoriesAfter(@Param("employeeIds") List<Long> employeeIds,
            @Param("referenceDate") LocalDate referenceDate);

    @Select("select id from app_code_groups where code = #{code} and is_active = true limit 1")
    Integer activeCodeGroupId(@Param("code") String code);

    @Select("select code, name from app_codes where group_id = #{groupId} and is_active = true order by sort_order, id")
    List<CodeReference> activeCodes(@Param("groupId") int groupId);

    @Select("select display_name from auth_users where id = #{userId}")
    String userDisplayName(@Param("userId") int userId);

    record DepartmentEmployeeCount(int departmentId, long employeeCount) {
    }

    record EmployeeSnapshotReference(long id, String employeeNo, String displayName, long departmentId,
                                     String positionTitle, String employmentStatus) {
    }

    record PersonnelHistoryReference(long employeeId, LocalDate effectiveDate, String fieldName, String beforeValue) {
    }

    record CodeReference(String code, String name) {
    }
}
