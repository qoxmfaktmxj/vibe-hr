package com.vibehr.systemsettings;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "app_system_settings")
class AppSystemSetting {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Integer id;
    @Column(nullable = false, length = 120) private String key;
    @Column(nullable = false, length = 50) private String category;
    @Column(name = "value_type", nullable = false, length = 20) private String valueType;
    @Column(name = "value_text", nullable = false) private String valueText;
    @Column(length = 255) private String description;
    @Column(name = "is_active", nullable = false) private boolean active;
    @Column(name = "updated_by") private Integer updatedBy;
    @Column(name = "updated_at", nullable = false) private LocalDateTime updatedAt;
    protected AppSystemSetting() { }
    AppSystemSetting(String key, String valueType, String valueText, String description, Integer updatedBy, LocalDateTime now) {
        this.key = key; this.category = "auth"; this.valueType = valueType; this.valueText = valueText; this.description = description;
        this.active = true; this.updatedBy = updatedBy; this.updatedAt = now;
    }
    Integer getId() { return id; } String getKey() { return key; } String getValueText() { return valueText; }
    void update(String valueType, String valueText, String description, Integer updatedBy, LocalDateTime now) {
        this.category = "auth"; this.valueType = valueType; this.valueText = valueText; this.description = description; this.updatedBy = updatedBy; this.updatedAt = now;
    }
}
