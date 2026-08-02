package com.vibehr.platform.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.dao.DataAccessException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class BffAssertionAuthenticationFilter extends OncePerRequestFilter {

    private final BffAssertionVerifier verifier;
    private final BffAssertionReplayStore replayStore;
    private final FastApiSecurityErrorHandler errors;
    private final Clock clock;

    BffAssertionAuthenticationFilter(
            BffAssertionVerifier verifier,
            BffAssertionReplayStore replayStore,
            FastApiSecurityErrorHandler errors,
            Clock clock
    ) {
        this.verifier = verifier;
        this.replayStore = replayStore;
        this.errors = errors;
        this.clock = clock;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = requestPath(request);
        return !("POST".equals(request.getMethod())
                && ("/api/v1/auth/login".equals(path) || "/api/v1/auth/social/exchange".equals(path)));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            BffAssertionVerifier.VerifiedAssertion assertion = verifier.verify(
                    request.getHeader(BffAssertionVerifier.HEADER_NAME),
                    request.getMethod(),
                    requestPath(request)
            );
            BffAssertionRequestBody.CachedRequest cachedRequest = BffAssertionRequestBody.cache(request);
            assertion.principal().requireRequestBodyDigest(cachedRequest.digest());
            replayStore.consume(assertion.principal(), assertion.expiresAt(), clock.instant());
            var authentication = new UsernamePasswordAuthenticationToken(
                    assertion.principal(),
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_BFF_SERVICE"))
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);
            filterChain.doFilter(cachedRequest.request(), response);
        } catch (DataAccessException exception) {
            SecurityContextHolder.clearContext();
            errors.write(response, HttpStatus.SERVICE_UNAVAILABLE, "Authentication service unavailable.");
        } catch (InvalidBffAssertionException | IOException exception) {
            SecurityContextHolder.clearContext();
            errors.write(response, HttpStatus.UNAUTHORIZED, "Invalid BFF assertion.");
        }
    }

    private static String requestPath(HttpServletRequest request) {
        String contextPath = request.getContextPath();
        String requestUri = request.getRequestURI();
        return contextPath.isEmpty() ? requestUri : requestUri.substring(contextPath.length());
    }
}
