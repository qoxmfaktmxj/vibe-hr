package com.vibehr.systemsettings;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "app_system_setting_history")
class AppSystemSettingHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Integer id;
    @Column(name = "setting_id") private Integer settingId;
    @Column(nullable = false, length = 120) private String key;
    @Column(name = "old_value_text") private String oldValueText;
    @Column(name = "new_value_text", nullable = false) private String newValueText;
    @Column(name = "changed_by") private Integer changedBy;
    @Column(length = 255) private String reason;
    @Column(name = "changed_at", nullable = false) private LocalDateTime changedAt;
    protected AppSystemSettingHistory() { }
    AppSystemSettingHistory(Integer settingId, String key, String oldValueText, String newValueText, Integer changedBy, String reason, LocalDateTime changedAt) {
        this.settingId = settingId; this.key = key; this.oldValueText = oldValueText; this.newValueText = newValueText; this.changedBy = changedBy; this.reason = reason; this.changedAt = changedAt;
    }
}
