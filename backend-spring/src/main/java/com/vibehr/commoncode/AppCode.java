package com.vibehr.commoncode;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "app_codes")
class AppCode {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Integer id;
    @Column(name = "group_id", nullable = false) private Integer groupId;
    @Column(nullable = false, length = 30) private String code;
    @Column(nullable = false, length = 100) private String name;
    private String description;
    @Column(name = "is_active", nullable = false) private boolean active;
    @Column(name = "sort_order", nullable = false) private int sortOrder;
    @Column(name = "extra_value1", length = 200) private String extraValue1;
    @Column(name = "extra_value2", length = 200) private String extraValue2;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private LocalDateTime updatedAt;
    protected AppCode() { }
    AppCode(Integer groupId, String code, String name, String description, boolean active, int sortOrder, String extraValue1, String extraValue2, LocalDateTime now) {
        this.groupId = groupId; this.code = code; this.name = name; this.description = description; this.active = active; this.sortOrder = sortOrder;
        this.extraValue1 = extraValue1; this.extraValue2 = extraValue2; this.createdAt = now; this.updatedAt = now;
    }
    Integer getId() { return id; } Integer getGroupId() { return groupId; } String getCode() { return code; } String getName() { return name; }
    String getDescription() { return description; } boolean isActive() { return active; } int getSortOrder() { return sortOrder; }
    String getExtraValue1() { return extraValue1; } String getExtraValue2() { return extraValue2; } LocalDateTime getCreatedAt() { return createdAt; } LocalDateTime getUpdatedAt() { return updatedAt; }
    void update(String code, String name, String description, Boolean active, Integer sortOrder, String extraValue1, String extraValue2, LocalDateTime now) {
        if (code != null) this.code = code.strip().toUpperCase(java.util.Locale.ROOT);
        if (name != null) this.name = name.strip();
        if (description != null) this.description = description;
        if (active != null) this.active = active;
        if (sortOrder != null) this.sortOrder = sortOrder;
        if (extraValue1 != null) this.extraValue1 = extraValue1;
        if (extraValue2 != null) this.extraValue2 = extraValue2;
        this.updatedAt = now;
    }
}
