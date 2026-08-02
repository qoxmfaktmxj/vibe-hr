package com.vibehr.systemsettings;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface SystemSettingRepository extends JpaRepository<AppSystemSetting, Integer> {
    List<AppSystemSetting> findByKeyIn(Collection<String> keys);
    Optional<AppSystemSetting> findByKey(String key);
}

interface SystemSettingHistoryRepository extends JpaRepository<AppSystemSettingHistory, Integer> {
}
