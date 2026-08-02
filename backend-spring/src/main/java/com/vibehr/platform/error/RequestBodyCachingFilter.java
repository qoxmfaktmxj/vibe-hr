package com.vibehr.platform.error;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;

@Component
public class RequestBodyCachingFilter extends OncePerRequestFilter {

    public static final String CACHED_REQUEST_ATTRIBUTE = RequestBodyCachingFilter.class.getName() + ".request";
    private static final int MAX_CACHED_BODY_BYTES = 1024 * 1024;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        ContentCachingRequestWrapper cachedRequest = new ContentCachingRequestWrapper(request, MAX_CACHED_BODY_BYTES);
        request.setAttribute(CACHED_REQUEST_ATTRIBUTE, cachedRequest);
        filterChain.doFilter(cachedRequest, response);
    }
}
