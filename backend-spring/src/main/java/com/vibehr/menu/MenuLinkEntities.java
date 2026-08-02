package com.vibehr.menu;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Objects;

class MenuRoleId implements Serializable {
    private Integer menuId;
    private Integer roleId;
    public MenuRoleId() { }
    MenuRoleId(Integer menuId, Integer roleId) { this.menuId = menuId; this.roleId = roleId; }
    @Override public boolean equals(Object other) { return other instanceof MenuRoleId that && Objects.equals(menuId, that.menuId) && Objects.equals(roleId, that.roleId); }
    @Override public int hashCode() { return Objects.hash(menuId, roleId); }
}

@Entity
@Table(name = "app_menu_roles")
@IdClass(MenuRoleId.class)
class AppMenuRole {
    @Id @Column(name = "menu_id") private Integer menuId;
    @Id @Column(name = "role_id") private Integer roleId;
    protected AppMenuRole() { }
    AppMenuRole(Integer menuId, Integer roleId) { this.menuId = menuId; this.roleId = roleId; }
    Integer getMenuId() { return menuId; }
    Integer getRoleId() { return roleId; }
}

@Entity
@Table(name = "app_menu_actions")
class AppMenuAction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Integer id;
    @Column(name = "menu_id", nullable = false) private Integer menuId;
    @Column(name = "action_code", nullable = false, length = 40) private String actionCode;
    @Column(name = "enabled_default", nullable = false) private boolean enabledDefault;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private LocalDateTime updatedAt;
    protected AppMenuAction() { }
    String getActionCode() { return actionCode; }
    boolean isEnabledDefault() { return enabledDefault; }
}

@Entity
@Table(name = "app_role_menu_actions")
class AppRoleMenuAction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Integer id;
    @Column(name = "role_id", nullable = false) private Integer roleId;
    @Column(name = "menu_id", nullable = false) private Integer menuId;
    @Column(name = "action_code", nullable = false, length = 40) private String actionCode;
    @Column(nullable = false) private boolean allowed;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private LocalDateTime updatedAt;
    protected AppRoleMenuAction() { }
    AppRoleMenuAction(Integer roleId, Integer menuId, String actionCode, boolean allowed, LocalDateTime now) {
        this.roleId = roleId; this.menuId = menuId; this.actionCode = actionCode; this.allowed = allowed; this.createdAt = now; this.updatedAt = now;
    }
    Integer getRoleId() { return roleId; }
    Integer getMenuId() { return menuId; }
    String getActionCode() { return actionCode; }
    boolean isAllowed() { return allowed; }
}
