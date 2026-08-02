package com.vibehr.systemsettings;

import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.ids.IntegerId;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("!test")
public class AuthSessionPolicyService {

    private static final String ACCESS_TTL = "auth.session.access_ttl_min";
    private static final String REFRESH_THRESHOLD = "auth.session.refresh_threshold_min";
    private static final String REMEMBER_ENABLED = "auth.session.remember_enabled";
    private static final String REMEMBER_TTL = "auth.session.remember_ttl_min";
    private static final String SHOW_COUNTDOWN = "auth.session.show_countdown";

    private final SystemSettingRepository settings;
    private final SystemSettingHistoryRepository history;
    private final Clock clock;

    AuthSessionPolicyService(SystemSettingRepository settings, SystemSettingHistoryRepository history, Clock clock) {
        this.settings = settings;
        this.history = history;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AuthSessionPolicy get() {
        Map<String, AppSystemSetting> rows = settings.findByKeyIn(List.of(ACCESS_TTL, REFRESH_THRESHOLD, REMEMBER_ENABLED, REMEMBER_TTL, SHOW_COUNTDOWN))
                .stream().collect(Collectors.toMap(AppSystemSetting::getKey, Function.identity()));
        int access = integer(rows, ACCESS_TTL, 120);
        int threshold = Math.min(Math.max(1, integer(rows, REFRESH_THRESHOLD, 60)), access);
        return new AuthSessionPolicy(access, threshold, bool(rows, REMEMBER_ENABLED, true), integer(rows, REMEMBER_TTL, 43_200), bool(rows, SHOW_COUNTDOWN, true));
    }

    @Transactional
    public AuthSessionPolicy update(AuthSessionPolicyUpdate request, long changedBy) {
        if (request.refreshThresholdMin() > request.accessTtlMin()) {
            throw ApiException.badRequest("refresh_threshold_min cannot be greater than access_ttl_min");
        }
        upsert(ACCESS_TTL, "int", String.valueOf(request.accessTtlMin()), "Access JWT 만료시간(분)", changedBy, request.reason());
        upsert(REFRESH_THRESHOLD, "int", String.valueOf(request.refreshThresholdMin()), "갱신 임계치(분)", changedBy, request.reason());
        upsert(REMEMBER_ENABLED, "bool", String.valueOf(request.rememberEnabled()), "Remember me 허용 여부", changedBy, request.reason());
        upsert(REMEMBER_TTL, "int", String.valueOf(request.rememberTtlMin()), "Remember me 쿠키 만료(분)", changedBy, request.reason());
        upsert(SHOW_COUNTDOWN, "bool", String.valueOf(request.showCountdown()), "상단 세션 카운트다운 표시", changedBy, request.reason());
        return get();
    }

    private void upsert(String key, String valueType, String valueText, String description, long changedBy, String reason) {
        LocalDateTime now = LocalDateTime.now(clock);
        int actorId = IntegerId.required(changedBy, "changed_by");
        AppSystemSetting row = settings.findByKey(key).orElseGet(() -> new AppSystemSetting(key, valueType, valueText, description, actorId, now));
        String old = row.getId() == null ? null : row.getValueText();
        row.update(valueType, valueText, description, actorId, now);
        settings.saveAndFlush(row);
        history.save(new AppSystemSettingHistory(row.getId(), key, old, valueText, actorId, reason, now));
    }

    private static int integer(Map<String, AppSystemSetting> rows, String key, int defaultValue) {
        try { return rows.containsKey(key) ? Integer.parseInt(rows.get(key).getValueText()) : defaultValue; }
        catch (NumberFormatException ignored) { return defaultValue; }
    }
    private static boolean bool(Map<String, AppSystemSetting> rows, String key, boolean defaultValue) {
        if (!rows.containsKey(key)) return defaultValue;
        return switch (rows.get(key).getValueText().strip().toLowerCase(java.util.Locale.ROOT)) {
            case "1", "true", "y", "yes", "on" -> true;
            default -> false;
        };
    }

    public record AuthSessionPolicy(int accessTtlMin, int refreshThresholdMin, boolean rememberEnabled, int rememberTtlMin, boolean showCountdown) { }
    public record AuthSessionPolicyUpdate(int accessTtlMin, int refreshThresholdMin, boolean rememberEnabled, int rememberTtlMin, boolean showCountdown, String reason) { }
}
