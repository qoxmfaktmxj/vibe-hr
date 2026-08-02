package com.vibehr.platform.security;

import com.vibehr.auth.AuthProperties;
import com.vibehr.platform.config.CorsProperties;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration(proxyBeanMethods = false)
@EnableWebSecurity
@EnableScheduling
public class SecurityConfiguration {

    @Bean
    SmartInitializingSingleton validateDistinctRuntimeSecrets(
            ObjectProvider<AuthProperties> authProperties,
            BffAssertionProperties bffAssertionProperties
    ) {
        return () -> {
            AuthProperties auth = authProperties.getIfAvailable();
            if (auth != null && !SecretPolicy.areDistinct(auth.secret(), bffAssertionProperties.secret())) {
                throw new IllegalStateException("AUTH_TOKEN_SECRET and VIBEHR_BFF_ASSERTION_SECRET must be distinct 256-bit hexadecimal values.");
            }
        };
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            FastApiSecurityErrorHandler errors,
            ObjectProvider<JwtAuthenticationFilter> jwtAuthenticationFilter,
            BffAssertionVerifier bffAssertionVerifier,
            BffAssertionReplayStore bffAssertionReplayStore,
            java.time.Clock clock
    ) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/health", "/api/v1/health", "/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc", "/swagger-ui/**", "/webjars/**").permitAll()
                        .requestMatchers("/api/v1/auth/enter-cds").permitAll()
                        .requestMatchers("/api/v1/auth/login", "/api/v1/auth/social/exchange").hasAuthority("ROLE_BFF_SERVICE")
                        .requestMatchers("/api/v1/codes/groups/by-code/*/active").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(errors)
                        .accessDeniedHandler(errors))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable);
        JwtAuthenticationFilter filter = jwtAuthenticationFilter.getIfAvailable();
        if (filter != null) {
            http.addFilterBefore(filter, org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class);
        }
        BffAssertionAuthenticationFilter bffFilter = new BffAssertionAuthenticationFilter(
                bffAssertionVerifier,
                bffAssertionReplayStore,
                errors,
                clock
        );
        if (filter != null) {
            http.addFilterAfter(bffFilter, JwtAuthenticationFilter.class);
        } else {
            http.addFilterBefore(bffFilter, org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class);
        }
        return http.build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(CorsProperties corsProperties) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(corsProperties.origins());
        configuration.setAllowCredentials(true);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
