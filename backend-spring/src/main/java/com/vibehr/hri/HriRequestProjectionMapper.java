package com.vibehr.hri;

import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** Read-only scalar projections across HRI, HR, organization, and authentication boundaries. */
@Mapper
interface HriRequestProjectionMapper {
    @Select("select e.id, e.employee_no, e.department_id, u.display_name, u.login_id from hr_employees e join auth_users u on u.id = e.user_id where e.user_id = #{userId} limit 1")
    Map<String, Object> employeeForUser(@Param("userId") int userId);

    @Select("select u.id, u.display_name, u.login_id from auth_users u where u.id = #{userId} limit 1")
    Map<String, Object> user(@Param("userId") int userId);

    @Select("select name from org_departments where id = #{departmentId} limit 1")
    String departmentName(@Param("departmentId") int departmentId);
}
