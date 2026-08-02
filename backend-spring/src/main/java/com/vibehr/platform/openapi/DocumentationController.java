package com.vibehr.platform.openapi;

import io.swagger.v3.oas.annotations.Hidden;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

/** Preserves FastAPI documentation URLs without loading executable code from a third party origin. */
@Controller
@Hidden
public class DocumentationController {

    private static final String CSP_BASE = "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; "
            + "connect-src 'self'; img-src 'self' data:; ";
    private static final String INTERACTIVE_DOCUMENTATION_CSP = CSP_BASE
            + "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";
    private static final String REDOC_CSP = CSP_BASE + "script-src 'self'; style-src 'self' 'unsafe-inline'";
    private static final String REDOC_WEBJAR = "/webjars/redoc/2.5.1/redoc.standalone.js";

    @RequestMapping(path = "/docs", method = {RequestMethod.GET, RequestMethod.HEAD}, produces = MediaType.TEXT_HTML_VALUE)
    ResponseEntity<String> docs() {
        return html("""
                <!doctype html>
                <html><head><title>Vibe-HR API - Swagger UI</title>
                <link rel="stylesheet" href="/swagger-ui/swagger-ui.css"></head>
                <body><div id="swagger-ui"></div>
                <script src="/swagger-ui/swagger-ui-bundle.js"></script>
                <script>window.ui = SwaggerUIBundle({url: '/openapi.json', dom_id: '#swagger-ui', oauth2RedirectUrl: '/docs/oauth2-redirect'});</script>
                </body></html>
                """, INTERACTIVE_DOCUMENTATION_CSP);
    }

    @RequestMapping(path = "/docs/oauth2-redirect", method = {RequestMethod.GET, RequestMethod.HEAD}, produces = MediaType.TEXT_HTML_VALUE)
    ResponseEntity<String> oauth2Redirect() {
        return html("""
                <!doctype html>
                <html><head><title>Vibe-HR OAuth2 Redirect</title></head>
                <body><script>
                window.opener?.postMessage({type: 'oauth2-redirect', url: window.location.href}, window.location.origin);
                </script></body></html>
                """, INTERACTIVE_DOCUMENTATION_CSP);
    }

    @RequestMapping(path = "/redoc", method = {RequestMethod.GET, RequestMethod.HEAD}, produces = MediaType.TEXT_HTML_VALUE)
    ResponseEntity<String> redoc() {
        return html("""
                <!doctype html>
                <html><head><title>Vibe-HR API - ReDoc</title></head>
                <body><redoc spec-url="/openapi.json"></redoc>
                <script src="%s"></script></body></html>
                """.formatted(REDOC_WEBJAR), REDOC_CSP);
    }

    private ResponseEntity<String> html(String body, String contentSecurityPolicy) {
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .cacheControl(CacheControl.noStore())
                .header("Content-Security-Policy", contentSecurityPolicy)
                .body(body);
    }
}
