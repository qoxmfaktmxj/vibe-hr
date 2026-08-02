package com.vibehr.menu;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "app_menus")
class AppMenu {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Integer id;
    @Column(nullable = false, length = 60) private String code;
    @Column(nullable = false, length = 100) private String name;
    @Column(name = "parent_id") private Integer parentId;
    @Column(length = 200) private String path;
    @Column(length = 60) private String icon;
    @Column(name = "sort_order", nullable = false) private int sortOrder;
    @Column(name = "is_active", nullable = false) private boolean active;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private LocalDateTime updatedAt;
    protected AppMenu() { }
    AppMenu(String code, String name, Integer parentId, String path, String icon, int sortOrder, boolean active, LocalDateTime now) {
        this.code = code; this.name = name; this.parentId = parentId; this.path = path; this.icon = icon;
        this.sortOrder = sortOrder; this.active = active; this.createdAt = now; this.updatedAt = now;
    }
    Integer getId() { return id; }
    String getCode() { return code; }
    String getName() { return name; }
    Integer getParentId() { return parentId; }
    String getPath() { return path; }
    String getIcon() { return icon; }
    int getSortOrder() { return sortOrder; }
    boolean isActive() { return active; }
    LocalDateTime getCreatedAt() { return createdAt; }
    LocalDateTime getUpdatedAt() { return updatedAt; }
    void update(String name, Integer parentId, String path, String icon, Integer sortOrder, Boolean active, LocalDateTime now) {
        if (name != null) this.name = name.strip();
        this.parentId = parentId;
        if (path != null) this.path = path.isEmpty() ? null : path;
        if (icon != null) this.icon = icon.isEmpty() ? null : icon;
        if (sortOrder != null) this.sortOrder = sortOrder;
        if (active != null) this.active = active;
        this.updatedAt = now;
    }
}
