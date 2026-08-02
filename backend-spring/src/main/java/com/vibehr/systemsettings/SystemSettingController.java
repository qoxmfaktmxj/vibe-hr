package com.vibehr.systemsettings;

import com.vibehr.auth.CurrentUser;
import com.vibehr.menu.MenuPermissionService;
import com.vibehr.systemsettings.AuthSessionPolicyService.AuthSessionPolicy;
import com.vibehr.systemsettings.AuthSessionPolicyService.AuthSessionPolicyUpdate;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/system-settings")
@Validated
@Profile("!test")
public class SystemSettingController {

    private final AuthSessionPolicyService service;
    private final MenuPermissionService permissions;

    SystemSettingController(AuthSessionPolicyService service, MenuPermissionService permissions) {
        this.service = service;
        this.permissions = permissions;
    }

    @GetMapping("/auth-session")
    AuthSessionPolicyResponse get(@AuthenticationPrincipal CurrentUser currentUser) {
        permissions.requireAdmin(currentUser);
        return new AuthSessionPolicyResponse(service.get());
    }

    @PutMapping("/auth-session")
    AuthSessionPolicyResponse update(@AuthenticationPrincipal CurrentUser currentUser, @Valid @RequestBody AuthSessionPolicyPayload payload) {
        permissions.requireAdmin(currentUser);
        return new AuthSessionPolicyResponse(service.update(payload.toUpdate(), currentUser.id()));
    }

    record AuthSessionPolicyResponse(AuthSessionPolicy policy) { }
    record AuthSessionPolicyPayload(
            @Min(5) @Max(1440) int accessTtlMin,
            @Min(1) @Max(720) int refreshThresholdMin,
            Boolean rememberEnabled,
            @Min(60) @Max(43_200) int rememberTtlMin,
            Boolean showCountdown,
            @Size(max = 255) String reason
    ) { AuthSessionPolicyUpdate toUpdate() { return new AuthSessionPolicyUpdate(accessTtlMin, refreshThresholdMin, rememberEnabled == null || rememberEnabled, rememberTtlMin, showCountdown == null || showCountdown, reason); } }
}
