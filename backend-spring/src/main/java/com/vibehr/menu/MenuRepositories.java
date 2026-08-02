package com.vibehr.menu;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface MenuRepository extends JpaRepository<AppMenu, Integer> {
    Optional<AppMenu> findByCode(String code);
    Optional<AppMenu> findByCodeAndActiveTrue(String code);
    Optional<AppMenu> findByPathAndActiveTrue(String path);
    boolean existsByParentId(Integer parentId);
    List<AppMenu> findAllByOrderBySortOrderAscIdAsc();
}

interface MenuRoleRepository extends JpaRepository<AppMenuRole, MenuRoleId> {
    List<AppMenuRole> findByMenuId(Integer menuId);
    List<AppMenuRole> findByRoleIdIn(Collection<Integer> roleIds);
    List<AppMenuRole> findByRoleId(Integer roleId);
    @Modifying void deleteByMenuId(Integer menuId);
    @Modifying void deleteByRoleId(Integer roleId);
    @Modifying @Query("delete from AppMenuRole link where link.roleId in :roleIds") void deleteByRoleIdIn(Collection<Integer> roleIds);
}

interface MenuActionRepository extends JpaRepository<AppMenuAction, Integer> {
    List<AppMenuAction> findByMenuId(Integer menuId);
}

interface RoleMenuActionRepository extends JpaRepository<AppRoleMenuAction, Integer> {
    List<AppRoleMenuAction> findByRoleIdIn(Collection<Integer> roleIds);
    @Modifying void deleteByRoleIdIn(Collection<Integer> roleIds);
}
