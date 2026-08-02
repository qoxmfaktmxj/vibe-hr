package com.vibehr.auth;

import com.vibehr.hr.HrSocialOnboardingWriter;
import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.ids.IntegerId;
import com.vibehr.systemsettings.AuthSessionPolicyService;
import com.vibehr.systemsettings.AuthSessionPolicyService.AuthSessionPolicy;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.PageRequest;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("!test")
public class AuthService {

    private final AuthUserRepository users;
    private final AuthRoleRepository roles;
    private final AuthUserRoleRepository userRoles;
    private final AuthReferenceMapper references;
    private final HrSocialOnboardingWriter socialOnboarding;
    private final EntityManager entityManager;
    private final Pbkdf2PasswordVerifier passwordVerifier;
    private final Pbkdf2PasswordHasher passwordHasher;
    private final JwtTokenIssuer tokenIssuer;
    private final AuthSessionPolicyService policies;
    private final Clock clock;

    AuthService(
            AuthUserRepository users,
            AuthRoleRepository roles,
            AuthUserRoleRepository userRoles,
            AuthReferenceMapper references,
            HrSocialOnboardingWriter socialOnboarding,
            EntityManager entityManager,
            Pbkdf2PasswordVerifier passwordVerifier,
            Pbkdf2PasswordHasher passwordHasher,
            JwtTokenIssuer tokenIssuer,
            AuthSessionPolicyService policies,
            Clock clock
    ) {
        this.users = users;
        this.roles = roles;
        this.userRoles = userRoles;
        this.references = references;
        this.socialOnboarding = socialOnboarding;
        this.entityManager = entityManager;
        this.passwordVerifier = passwordVerifier;
        this.passwordHasher = passwordHasher;
        this.tokenIssuer = tokenIssuer;
        this.policies = policies;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<CorporationResponse> corporations() {
        return references.activeCorporations().stream()
                .map(row -> new CorporationResponse(row.enterCd(), row.companyCode(), row.corporationName(), row.companyLogoUrl()))
                .toList();
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        String enterCd = request.enterCd().strip().toUpperCase(Locale.ROOT);
        if (!references.hasActiveCorporation(enterCd)) {
            throw invalidLogin();
        }
        AuthUser user = users.findByLoginId(request.loginId()).filter(AuthUser::isActive).orElseThrow(this::invalidLogin);
        if (!passwordVerifier.matches(request.password(), user.getPasswordHash())) {
            throw invalidLogin();
        }
        return buildLoginResponse(user);
    }

    @Transactional(readOnly = true)
    public LoginUserResponse me(CurrentUser currentUser) {
        AuthUser user = users.findById(IntegerId.required(currentUser.id(), "user_id")).filter(AuthUser::isActive)
                .orElseThrow(() -> ApiException.unauthorized("Invalid access token."));
        return toLoginUser(user);
    }

    @Transactional
    public LoginResponse refresh(CurrentUser currentUser) {
        AuthUser user = users.findById(IntegerId.required(currentUser.id(), "user_id")).filter(AuthUser::isActive)
                .orElseThrow(() -> ApiException.unauthorized("Invalid access token."));
        return buildLoginResponse(user);
    }

    @Transactional(readOnly = true)
    public List<ImpersonationCandidateResponse> impersonationCandidates(CurrentUser currentUser, String query, int limit) {
        return users.findActiveCandidates(IntegerId.required(currentUser.id(), "user_id"), query.strip(), PageRequest.of(0, limit)).stream()
                .map(user -> new ImpersonationCandidateResponse(user.getId(), user.getLoginId(), user.getDisplayName()))
                .toList();
    }

    @Transactional
    public LoginResponse impersonate(long targetUserId) {
        AuthUser target = users.findById(IntegerId.required(targetUserId, "target_user_id")).filter(AuthUser::isActive)
                .orElseThrow(() -> ApiException.notFound("전환 대상 사용자를 찾을 수 없습니다."));
        return buildLoginResponse(target);
    }

    @Transactional
    public LoginResponse socialExchange(SocialExchangeRequest request) {
        String email = request.email().strip().toLowerCase(Locale.ROOT);
        if (email.isEmpty()) {
            throw ApiException.badRequest("이메일 정보가 필요합니다.");
        }
        lockSocialIdentity(request, email);
        AuthUser user = users.findByEmail(email).orElseGet(() -> createSocialUser(request, email));
        if (!user.isActive()) {
            throw ApiException.badRequest("비활성화된 계정입니다.");
        }
        ensureEmployeeRole(user.getId());
        ensureEmployee(user.getId());
        return buildLoginResponse(user);
    }

    private AuthUser createSocialUser(SocialExchangeRequest request, String email) {
        String base = (request.provider() + "-" + request.providerUserId()).toLowerCase(Locale.ROOT);
        base = base.substring(0, Math.min(base.length(), 50));
        String loginId = base;
        for (int sequence = 1; users.findByLoginId(loginId).isPresent(); sequence++) {
            String suffix = "-" + sequence;
            loginId = base.substring(0, Math.max(1, 50 - suffix.length())) + suffix;
        }
        LocalDateTime now = now();
        return users.saveAndFlush(new AuthUser(
                loginId,
                email,
                passwordHasher.hash("social-" + request.provider() + "-" + request.providerUserId()),
                request.displayName().strip().isEmpty() ? "User" : request.displayName().strip(),
                now
        ));
    }

    private void ensureEmployeeRole(Integer userId) {
        roles.findByCode("employee").ifPresent(role -> {
            AuthUserRoleId key = new AuthUserRoleId(userId, role.getId());
            if (!userRoles.existsById(key)) {
                userRoles.save(new AuthUserRole(userId, role.getId(), now()));
            }
        });
    }

    private void ensureEmployee(Integer userId) {
        Integer departmentId = references.firstActiveDepartmentId();
        if (departmentId == null) {
            throw ApiException.badRequest("활성 부서를 찾을 수 없습니다.");
        }
        socialOnboarding.ensureEmployee(userId, departmentId);
    }

    private LoginResponse buildLoginResponse(AuthUser user) {
        AuthSessionPolicy policy = policies.get();
        LocalDateTime now = now();
        user.setLastLoginAt(now);
        user.setUpdatedAt(now);
        JwtTokenIssuer.IssuedToken token = tokenIssuer.issue(user.getId(), policy.accessTtlMin());
        long nowEpoch = clock.instant().getEpochSecond();
        return new LoginResponse(
                token.value(),
                "bearer",
                toLoginUser(user),
                token.expiresAt(),
                Math.max(0, token.expiresAt() - nowEpoch),
                policy.accessTtlMin(),
                policy.refreshThresholdMin(),
                policy.rememberEnabled(),
                policy.rememberTtlMin(),
                policy.showCountdown()
        );
    }

    private LoginUserResponse toLoginUser(AuthUser user) {
        return new LoginUserResponse(user.getId(), user.getEmail(), user.getDisplayName(), roles.findCodesByUserId(user.getId()));
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    private void lockSocialIdentity(SocialExchangeRequest request, String email) {
        List<String> keys = new ArrayList<>(List.of(
                "auth:social:email:" + email,
                "auth:social:provider:" + request.provider().strip().toLowerCase(Locale.ROOT)
                        + ':' + request.providerUserId().strip()
        ));
        keys.sort(String::compareTo);
        keys.forEach(this::advisoryLock);
    }

    private void advisoryLock(String key) {
        entityManager.createNativeQuery("select pg_advisory_xact_lock(hashtextextended(cast(:key as text), 0))")
                .setParameter("key", key)
                .getSingleResult();
    }

    private ApiException invalidLogin() {
        return ApiException.unauthorized("아이디 또는 비밀번호가 올바르지 않습니다.");
    }

    public record LoginRequest(String enterCd, String loginId, String password) {
    }

    public record LoginUserResponse(long id, String email, String displayName, List<String> roles) {
    }

    public record LoginResponse(
            String accessToken,
            String tokenType,
            LoginUserResponse user,
            long expiresAt,
            long expiresInSec,
            int accessTtlMin,
            int refreshThresholdMin,
            boolean rememberEnabled,
            int rememberTtlMin,
            boolean showCountdown
    ) {
    }

    public record CorporationResponse(String enterCd, String companyCode, String corporationName, String companyLogoUrl) {
    }

    public record ImpersonationCandidateResponse(long id, String loginId, String displayName) {
    }

    public record SocialExchangeRequest(String provider, String providerUserId, String email, String displayName) {
    }
}
