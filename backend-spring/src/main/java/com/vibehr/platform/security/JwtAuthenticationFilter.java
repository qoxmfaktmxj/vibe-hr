package com.vibehr.platform.security;

import com.vibehr.auth.ActiveUserLookup;
import com.vibehr.auth.CurrentUser;
import com.vibehr.auth.InvalidJwtException;
import com.vibehr.auth.JwtClaims;
import com.vibehr.auth.JwtTokenVerifier;
import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.ids.IntegerId;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.context.annotation.Profile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Profile("!test")
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenVerifier verifier;
    private final ActiveUserLookup users;
    private final FastApiSecurityErrorHandler errors;

    JwtAuthenticationFilter(JwtTokenVerifier verifier, ActiveUserLookup users, FastApiSecurityErrorHandler errors) {
        this.verifier = verifier;
        this.users = users;
        this.errors = errors;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }
        try {
            JwtClaims claims = verifier.verify(authorization.substring("Bearer ".length()));
            CurrentUser user = users.find(tokenUserId(claims.subject()));
            if (user == null) {
                throw new InvalidJwtException("JWT user is inactive or absent.");
            }
            var authorities = user.roles().stream().map(role -> new SimpleGrantedAuthority("ROLE_" + role)).toList();
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(user, null, authorities);
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
            filterChain.doFilter(request, response);
        } catch (InvalidJwtException | NumberFormatException exception) {
            SecurityContextHolder.clearContext();
            errors.write(response, HttpStatus.UNAUTHORIZED, "Invalid access token.");
        }
    }

    private static int tokenUserId(String subject) {
        try {
            return IntegerId.required(Long.parseLong(subject), "user_id");
        } catch (NumberFormatException | ApiException exception) {
            throw new InvalidJwtException("JWT subject is outside the supported user id range.", exception);
        }
    }
}
