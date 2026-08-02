package com.vibehr.auth;

import com.vibehr.auth.AuthService.CorporationResponse;
import com.vibehr.auth.AuthService.ImpersonationCandidateResponse;
import com.vibehr.auth.AuthService.LoginRequest;
import com.vibehr.auth.AuthService.LoginResponse;
import com.vibehr.auth.AuthService.LoginUserResponse;
import com.vibehr.auth.AuthService.SocialExchangeRequest;
import com.vibehr.platform.security.BffAssertionPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Validated
public class AuthController {

    private final AuthService service;
    private final LoginRateLimiter rateLimiter;

    AuthController(AuthService service, LoginRateLimiter rateLimiter) {
        this.service = service;
        this.rateLimiter = rateLimiter;
    }

    @GetMapping("/enter-cds")
    LoginCorporationListResponse enterCds() {
        List<CorporationResponse> corporations = service.corporations();
        return new LoginCorporationListResponse(corporations, corporations.size());
    }

    @PostMapping("/login")
    LoginResponse login(@Valid @RequestBody LoginPayload payload, @AuthenticationPrincipal BffAssertionPrincipal bffAssertion) {
        requireBffAssertion(bffAssertion);
        bffAssertion.requireLoginBinding(payload.enterCd(), payload.loginId());
        rateLimiter.check(bffAssertion.clientId(), bffAssertion.requestBinding(), bffAssertion.sourceHash());
        return service.login(new LoginRequest(payload.enterCd(), payload.loginId(), payload.password()));
    }

    @GetMapping("/me")
    LoginUserResponse me(@AuthenticationPrincipal CurrentUser currentUser) {
        return service.me(currentUser);
    }

    @PostMapping("/refresh")
    LoginResponse refresh(@AuthenticationPrincipal CurrentUser currentUser) {
        return service.refresh(currentUser);
    }

    @GetMapping("/impersonation/users")
    ImpersonationCandidateListResponse impersonationUsers(
            @AuthenticationPrincipal CurrentUser currentUser,
            @RequestParam(defaultValue = "") @Size(max = 100) String query,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit
    ) {
        requireAdmin(currentUser);
        return new ImpersonationCandidateListResponse(service.impersonationCandidates(currentUser, query, limit));
    }

    @PostMapping("/impersonation/login")
    LoginResponse impersonationLogin(
            @AuthenticationPrincipal CurrentUser currentUser,
            @Valid @RequestBody ImpersonationLoginPayload payload
    ) {
        requireAdmin(currentUser);
        return service.impersonate(payload.userId());
    }

    @PostMapping("/social/exchange")
    LoginResponse socialExchange(
            @Valid @RequestBody SocialExchangePayload payload,
            @AuthenticationPrincipal BffAssertionPrincipal bffAssertion
    ) {
        requireBffAssertion(bffAssertion);
        bffAssertion.requireSocialBinding(payload.provider(), payload.providerUserId(), payload.email(), payload.displayName());
        return service.socialExchange(new SocialExchangeRequest(payload.provider(), payload.providerUserId(), payload.email(), payload.displayName()));
    }

    private static void requireAdmin(CurrentUser currentUser) {
        if (currentUser == null || !currentUser.hasRole("admin")) {
            throw com.vibehr.platform.error.ApiException.forbidden("접근 권한이 없습니다.");
        }
    }

    private static void requireBffAssertion(BffAssertionPrincipal bffAssertion) {
        if (bffAssertion == null) {
            throw com.vibehr.platform.error.ApiException.unauthorized("Invalid BFF assertion.");
        }
    }

    record LoginCorporationListResponse(List<CorporationResponse> corporations, int totalCount) { }
    record ImpersonationCandidateListResponse(List<ImpersonationCandidateResponse> users) { }
    record LoginPayload(
            @NotBlank @Size(max = 20) String enterCd,
            @NotBlank @Size(min = 2, max = 50) String loginId,
            @NotBlank @Size(min = 4, max = 128) String password
    ) { }
    record ImpersonationLoginPayload(@Min(1) long userId) { }
    record SocialExchangePayload(
            @NotBlank @Size(min = 2, max = 20) String provider,
            @NotBlank @Size(max = 100) String providerUserId,
            @NotBlank @Size(min = 3, max = 320) String email,
            @NotBlank @Size(max = 100) String displayName
    ) { }
}
