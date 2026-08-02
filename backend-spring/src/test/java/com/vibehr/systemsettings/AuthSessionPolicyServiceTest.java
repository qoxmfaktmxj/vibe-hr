package com.vibehr.systemsettings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vibehr.platform.error.ApiException;
import java.time.Clock;
import java.util.List;
import org.junit.jupiter.api.Test;

class AuthSessionPolicyServiceTest {

    private final SystemSettingRepository settings = mock(SystemSettingRepository.class);
    private final SystemSettingHistoryRepository history = mock(SystemSettingHistoryRepository.class);
    private final AuthSessionPolicyService service = new AuthSessionPolicyService(settings, history, Clock.systemUTC());

    @Test
    void returnsPythonDefaultsWhenSettingsAreNotBootstrapped() {
        when(settings.findByKeyIn(org.mockito.ArgumentMatchers.any())).thenReturn(List.of());

        AuthSessionPolicyService.AuthSessionPolicy policy = service.get();

        assertThat(policy.accessTtlMin()).isEqualTo(120);
        assertThat(policy.refreshThresholdMin()).isEqualTo(60);
        assertThat(policy.rememberEnabled()).isTrue();
    }

    @Test
    void rejectsRefreshThresholdLargerThanAccessTtl() {
        assertThatThrownBy(() -> service.update(new AuthSessionPolicyService.AuthSessionPolicyUpdate(30, 31, true, 60, true, null), 1L))
                .isInstanceOf(ApiException.class)
                .hasMessage("refresh_threshold_min cannot be greater than access_ttl_min");
    }
}
