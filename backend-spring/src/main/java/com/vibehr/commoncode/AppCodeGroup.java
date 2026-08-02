package com.vibehr.commoncode;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "app_code_groups")
class AppCodeGroup {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Integer id;
    @Column(nullable = false, length = 30) private String code;
    @Column(nullable = false, length = 100) private String name;
    private String description;
    @Column(name = "is_active", nullable = false) private boolean active;
    @Column(name = "sort_order", nullable = false) private int sortOrder;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private LocalDateTime updatedAt;
    protected AppCodeGroup() { }
    AppCodeGroup(String code, String name, String description, boolean active, int sortOrder, LocalDateTime now) {
        this.code = code; this.name = name; this.description = description; this.active = active; this.sortOrder = sortOrder; this.createdAt = now; this.updatedAt = now;
    }
    Integer getId() { return id; } String getCode() { return code; } String getName() { return name; } String getDescription() { return description; }
    boolean isActive() { return active; } int getSortOrder() { return sortOrder; } LocalDateTime getCreatedAt() { return createdAt; } LocalDateTime getUpdatedAt() { return updatedAt; }
    void update(String code, String name, String description, Boolean active, Integer sortOrder, LocalDateTime now) {
        if (code != null) this.code = code.strip().toUpperCase(java.util.Locale.ROOT);
        if (name != null) this.name = name.strip();
        if (description != null) this.description = description;
        if (active != null) this.active = active;
        if (sortOrder != null) this.sortOrder = sortOrder;
        this.updatedAt = now;
    }
}
