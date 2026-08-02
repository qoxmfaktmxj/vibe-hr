package com.vibehr.hr;

import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.SelectProvider;

/** PostgreSQL grid projection: joins and optional filters stay explicit without creating cross-domain JPA references. */
@Mapper
interface HrGridMapper {
    @SelectProvider(type = Sql.class, method = "employees")
    List<Map<String, Object>> employeeRows(@Param("employeeNo") String employeeNo, @Param("name") String name,
            @Param("department") String department, @Param("employmentStatus") String employmentStatus,
            @Param("active") Boolean active, @Param("offset") Integer offset, @Param("limit") Integer limit);

    @SelectProvider(type = Sql.class, method = "employeeCount")
    long employeeCount(@Param("employeeNo") String employeeNo, @Param("name") String name,
            @Param("department") String department, @Param("employmentStatus") String employmentStatus,
            @Param("active") Boolean active);

    final class Sql {
        public static String employees(Map<String, Object> values) { return select(values, false); }
        public static String employeeCount(Map<String, Object> values) { return select(values, true); }
        private static String select(Map<String, Object> values, boolean count) {
            StringBuilder sql = new StringBuilder(count ? "select count(*)" : "select e.id, e.employee_no, u.login_id, u.display_name, u.email, e.department_id, d.name as department_name, e.position_title, e.hire_date, e.employment_status, u.is_active");
            sql.append(" from hr_employees e join auth_users u on u.id=e.user_id join org_departments d on d.id=e.department_id where 1=1");
            if (values.get("employeeNo") != null) sql.append(" and lower(e.employee_no) like concat('%',lower(#{employeeNo}),'%')");
            if (values.get("name") != null) sql.append(" and lower(u.display_name) like concat('%',lower(#{name}),'%')");
            if (values.get("department") != null) sql.append(" and lower(d.name) like concat('%',lower(#{department}),'%')");
            if (values.get("employmentStatus") != null) sql.append(" and e.employment_status=#{employmentStatus}");
            if (values.get("active") != null) sql.append(" and u.is_active=#{active}");
            if (!count) { sql.append(" order by e.id"); if (values.get("offset") != null) sql.append(" offset #{offset} limit #{limit}"); }
            return sql.toString();
        }
    }
}
