package com.vibehr.commoncode;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface CodeGroupRepository extends JpaRepository<AppCodeGroup, Integer> {
    Optional<AppCodeGroup> findByCode(String code);
    @Query("select codeGroup from AppCodeGroup codeGroup where (:code is null or lower(codeGroup.code) like lower(concat('%', :code, '%'))) and (:name is null or lower(codeGroup.name) like lower(concat('%', :name, '%'))) order by codeGroup.sortOrder, codeGroup.id")
    List<AppCodeGroup> findFiltered(String code, String name, Pageable pageable);
    @Query("select count(codeGroup) from AppCodeGroup codeGroup where (:code is null or lower(codeGroup.code) like lower(concat('%', :code, '%'))) and (:name is null or lower(codeGroup.name) like lower(concat('%', :name, '%')))")
    long countFiltered(String code, String name);
}

interface CodeRepository extends JpaRepository<AppCode, Integer> {
    Optional<AppCode> findByGroupIdAndCode(Integer groupId, String code);
    @Query("select code from AppCode code where code.groupId = :groupId and (:code is null or lower(code.code) like lower(concat('%', :code, '%'))) and (:name is null or lower(code.name) like lower(concat('%', :name, '%'))) order by code.sortOrder, code.id")
    List<AppCode> findFiltered(Integer groupId, String code, String name, Pageable pageable);
    @Query("select count(code) from AppCode code where code.groupId = :groupId and (:code is null or lower(code.code) like lower(concat('%', :code, '%'))) and (:name is null or lower(code.name) like lower(concat('%', :name, '%')))")
    long countFiltered(Integer groupId, String code, String name);
    List<AppCode> findByGroupIdAndActiveTrueOrderBySortOrderAscIdAsc(Integer groupId);
}
