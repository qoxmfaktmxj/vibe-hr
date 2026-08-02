package com.vibehr.training;

import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** The only MyBatis use in this domain: a read-only cross-domain application projection. */
@Mapper
interface TrainingApplicationProjectionMapper {

    String BASE_PROJECTION = """
            select a.id, a.application_no, a.employee_id, e.employee_no, u.display_name as employee_name,
                   d.name as department_name, a.course_id, c.course_name, a.event_id, ev.event_name,
                   a.in_out_type, a.status, a.year_plan_yn, a.survey_yn, a.edu_memo, a.note,
                   a.created_at, a.updated_at
            from tra_applications a
            left join hr_employees e on e.id = a.employee_id
            left join auth_users u on u.id = e.user_id
            left join org_departments d on d.id = e.department_id
            left join tra_courses c on c.id = a.course_id
            left join tra_events ev on ev.id = a.event_id
            """;

    @Select(BASE_PROJECTION + " where a.employee_id = #{employeeId} order by a.id desc")
    List<Map<String, Object>> findByEmployeeId(@Param("employeeId") int employeeId);

    @Select(BASE_PROJECTION + " order by a.id desc")
    List<Map<String, Object>> findAll();

    @Select("select id, user_id, employee_no, department_id, employment_status from hr_employees where user_id = #{userId} limit 1")
    Map<String, Object> findEmployeeByUserId(@Param("userId") int userId);

    @Select("select id, user_id, employee_no, department_id, employment_status from hr_employees where employee_no = #{employeeNo} limit 1")
    Map<String, Object> findEmployeeByNumber(@Param("employeeNo") String employeeNo);

    @Select("select id, user_id, employee_no, department_id, employment_status from hr_employees where id = #{employeeId}")
    Map<String, Object> findEmployeeById(@Param("employeeId") int employeeId);

    @Select("select id, user_id, employee_no, department_id, employment_status from hr_employees where employment_status in ('active', 'leave') order by id")
    List<Map<String, Object>> findActiveEmployees();
}
