package com.vibehr.menu;

import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
interface MenuProjectionMapper {

    @Select("""
            with recursive visible_menu_ids as (
                select m.id, m.parent_id
                from app_menus m
                join app_menu_roles mr on mr.menu_id = m.id
                join auth_user_roles ur on ur.role_id = mr.role_id
                where ur.user_id = #{userId} and m.is_active = true
                union
                select parent.id, parent.parent_id
                from app_menus parent
                join visible_menu_ids child on child.parent_id = parent.id
                where parent.is_active = true
            )
            select distinct m.id, m.code, m.name, m.parent_id as parentId, m.path, m.icon, m.sort_order as sortOrder,
                            m.is_active as active, m.created_at as createdAt, m.updated_at as updatedAt
            from app_menus m
            join visible_menu_ids visible on visible.id = m.id
            order by m.sort_order, m.id
            """)
    List<MenuProjectionRow> findActiveMenusForUser(int userId);

    @Select("""
            select exists(
                select 1 from app_menu_roles mr
                join auth_user_roles ur on ur.role_id = mr.role_id
                where ur.user_id = #{userId} and mr.menu_id = #{menuId}
            )
            """)
    boolean hasDirectMenuAccess(int userId, int menuId);

    @Select("""
            select a.action_code as actionCode, a.enabled_default as enabledDefault,
                   exists(select 1 from app_role_menu_actions override
                          join auth_user_roles ur on ur.role_id = override.role_id
                          where override.menu_id = a.menu_id and override.action_code = a.action_code
                            and ur.user_id = #{userId} and override.allowed = true) as allowedOverride,
                   exists(select 1 from app_role_menu_actions override
                          join auth_user_roles ur on ur.role_id = override.role_id
                          where override.menu_id = a.menu_id and override.action_code = a.action_code
                            and ur.user_id = #{userId}) as hasOverride
            from app_menu_actions a where a.menu_id = #{menuId}
            """)
    List<MenuActionProjectionRow> findActionProjection(int userId, int menuId);
}

class MenuProjectionRow {
    private Integer id; private String code; private String name; private Integer parentId; private String path; private String icon;
    private int sortOrder; private boolean active; private LocalDateTime createdAt; private LocalDateTime updatedAt;
    public Integer getId() { return id; } public void setId(Integer id) { this.id = id; }
    public String getCode() { return code; } public void setCode(String code) { this.code = code; }
    public String getName() { return name; } public void setName(String name) { this.name = name; }
    public Integer getParentId() { return parentId; } public void setParentId(Integer parentId) { this.parentId = parentId; }
    public String getPath() { return path; } public void setPath(String path) { this.path = path; }
    public String getIcon() { return icon; } public void setIcon(String icon) { this.icon = icon; }
    public int getSortOrder() { return sortOrder; } public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public boolean isActive() { return active; } public void setActive(boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; } public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; } public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}

class MenuActionProjectionRow {
    private String actionCode; private boolean enabledDefault; private boolean allowedOverride; private boolean hasOverride;
    public String getActionCode() { return actionCode; } public void setActionCode(String actionCode) { this.actionCode = actionCode; }
    public boolean isEnabledDefault() { return enabledDefault; } public void setEnabledDefault(boolean enabledDefault) { this.enabledDefault = enabledDefault; }
    public boolean isAllowedOverride() { return allowedOverride; } public void setAllowedOverride(boolean allowedOverride) { this.allowedOverride = allowedOverride; }
    public boolean isHasOverride() { return hasOverride; } public void setHasOverride(boolean hasOverride) { this.hasOverride = hasOverride; }
}
