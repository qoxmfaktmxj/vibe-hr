package com.vibehr.auth;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** Explicit cross-domain reads used by the authentication workflow. */
@Mapper
interface AuthReferenceMapper {
    @Select("select enter_cd as enterCd, company_code as companyCode, corporation_name as corporationName, company_logo_url as companyLogoUrl from org_corporations where is_active = true order by corporation_name, id")
    List<CorporationProjection> activeCorporations();

    @Select("select exists(select 1 from org_corporations where enter_cd = #{enterCd} and is_active = true)")
    boolean hasActiveCorporation(@Param("enterCd") String enterCd);

    @Select("select id from org_departments where is_active = true order by id limit 1")
    Integer firstActiveDepartmentId();

    @Select("select exists(select 1 from hr_employees where user_id = #{userId})")
    boolean hasEmployeeForUser(@Param("userId") int userId);

    @Select("select exists(select 1 from hr_employees where employee_no = #{employeeNo})")
    boolean hasEmployeeNumber(@Param("employeeNo") String employeeNo);

    record CorporationProjection(String enterCd, String companyCode, String corporationName, String companyLogoUrl) {
    }
}
