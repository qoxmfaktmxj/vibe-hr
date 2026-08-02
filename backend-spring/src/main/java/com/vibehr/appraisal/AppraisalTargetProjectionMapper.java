package com.vibehr.appraisal;

import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
interface AppraisalTargetProjectionMapper {

    String PROJECTION = """
            select t.id, t.appraisal_id, a.appraisal_name, t.employee_id, e.employee_no,
                   u.display_name as employee_name, d.name as department_name, t.score,
                   t.grade_code, t.evaluator_note, t.status, t.evaluated_at, t.created_at, t.updated_at
            from pap_appraisal_targets t
            left join \"PAP_APPRAISAL_MASTERS\" a on a.id = t.appraisal_id
            left join hr_employees e on e.id = t.employee_id
            left join auth_users u on u.id = e.user_id
            left join org_departments d on d.id = e.department_id
            """;

    @Select(PROJECTION + " order by t.id")
    List<Map<String, Object>> findAll();

    @Select(PROJECTION + " where t.appraisal_id = #{appraisalId} order by t.id")
    List<Map<String, Object>> findByAppraisalId(@Param("appraisalId") int appraisalId);
}
