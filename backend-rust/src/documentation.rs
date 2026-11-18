use crate::AppState;
use axum::{
    Router,
    http::{HeaderValue, header},
    response::{IntoResponse, Response},
    routing::get,
};

const DOCS_CSP: &str = concat!(
    "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; connect-src 'self'; img-src 'self' data:; ",
    "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
);
const REDOC_CSP: &str = concat!(
    "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; connect-src 'self'; img-src 'self' data:; ",
    "script-src 'self'; style-src 'self' 'unsafe-inline'"
);

fn html(page: &'static str, policy: &'static str) -> Response {
    let mut response = page.into_response();
    let headers = response.headers_mut();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/html;charset=UTF-8"),
    );
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(policy),
    );
    response
}

pub(crate) fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/swagger-ui/swagger-ui-bundle.js.LICENSE.txt",
            get(|| async {
                include_str!("../resources/swagger-ui/swagger-ui-bundle.js.LICENSE.txt")
            }),
        )
        .route(
            "/webjars/redoc/2.5.1/redoc.standalone.js.LICENSE.txt",
            get(|| async { include_str!("../resources/redoc/redoc.standalone.js.LICENSE.txt") }),
        )
        .route(
            "/openapi.json",
            get(|| async {
                (
                    [(header::CONTENT_TYPE, "application/json")],
                    include_str!("../resources/openapi.json"),
                )
            }),
        )
        .route(
            "/docs",
            get(|| async { html(include_str!("../resources/docs.html"), DOCS_CSP) }),
        )
        .route(
            "/docs/oauth2-redirect",
            get(|| async { html(include_str!("../resources/oauth2-redirect.html"), DOCS_CSP) }),
        )
        .route(
            "/redoc",
            get(|| async { html(include_str!("../resources/redoc.html"), REDOC_CSP) }),
        )
        .route(
            "/swagger-ui/swagger-ui.css",
            get(|| async {
                (
                    [(header::CONTENT_TYPE, "text/css")],
                    include_bytes!("../resources/swagger-ui/swagger-ui.css").as_slice(),
                )
            }),
        )
        .route(
            "/swagger-ui/swagger-ui-bundle.js",
            get(|| async {
                (
                    [(header::CONTENT_TYPE, "text/javascript")],
                    include_bytes!("../resources/swagger-ui/swagger-ui-bundle.js").as_slice(),
                )
            }),
        )
        .route(
            "/webjars/redoc/2.5.1/redoc.standalone.js",
            get(|| async {
                (
                    [(header::CONTENT_TYPE, "text/javascript")],
                    include_bytes!("../resources/redoc/redoc.standalone.js").as_slice(),
                )
            }),
        )
}
