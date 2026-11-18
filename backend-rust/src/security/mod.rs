mod assertion;
mod auth;
mod limiter;
mod password;
mod replay;
#[cfg(test)]
mod tests;
mod token;

pub use assertion::BffPrincipal;
pub use auth::auth_routes;
pub use password::{hash_password, password_matches};
pub use replay::start_replay_cleanup;

use axum::{
    Json,
    body::{Body, to_bytes},
    extract::{OriginalUri, Request, State},
    http::{Method, StatusCode, header::AUTHORIZATION},
    middleware::Next,
    response::{IntoResponse, Response},
};
use ring::hmac;
use serde::Serialize;
use serde_json::json;
use sqlx::PgPool;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone)]
pub struct SecurityState {
    pool: PgPool,
    access_key: hmac::Key,
    assertion_key: hmac::Key,
    issuer: String,
    max_ttl_seconds: i64,
    limiter: Arc<Mutex<limiter::LoginLimiter>>,
}

fn valid_secret(secret: &str) -> bool {
    secret.len() == 64
        && secret.bytes().all(|b| b.is_ascii_hexdigit())
        && secret.bytes().any(|b| b != secret.as_bytes()[0])
}

fn epoch_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

impl SecurityState {
    pub fn new(
        pool: PgPool,
        access_secret: String,
        assertion_secret: String,
        issuer: String,
        max_ttl_seconds: i64,
    ) -> Result<Self, &'static str> {
        if !valid_secret(&access_secret)
            || !valid_secret(&assertion_secret)
            || access_secret == assertion_secret
        {
            return Err("Distinct 64-character hexadecimal secrets are required");
        }
        if issuer.trim().is_empty() || !(10..=120).contains(&max_ttl_seconds) {
            return Err("Invalid token issuer or BFF assertion maximum lifetime");
        }
        Ok(Self {
            pool,
            access_key: hmac::Key::new(hmac::HMAC_SHA256, access_secret.as_bytes()),
            assertion_key: hmac::Key::new(hmac::HMAC_SHA256, assertion_secret.as_bytes()),
            issuer,
            max_ttl_seconds,
            limiter: Arc::default(),
        })
    }

    pub fn issue_token(&self, user_id: i32, ttl_minutes: i32) -> (String, i64) {
        #[derive(Serialize)]
        struct Claims<'a> {
            sub: String,
            iat: i64,
            exp: i64,
            iss: &'a str,
        }
        let iat = epoch_seconds();
        let exp = iat + i64::from(ttl_minutes) * 60;
        let claims = Claims {
            sub: user_id.to_string(),
            iat,
            exp,
            iss: &self.issuer,
        };
        let payload = serde_json::to_vec(&claims).expect("token claims are JSON primitives");
        (
            token::sign(
                br#"{"alg":"HS256","typ":"JWT"}"#,
                &payload,
                &self.access_key,
            ),
            exp,
        )
    }

    pub fn check_login(
        &self,
        principal: &BffPrincipal,
        enter_cd: &str,
        login_id: &str,
    ) -> Result<(), SecurityError> {
        let binding = principal.require_login_binding(enter_cd, login_id)?;
        self.limiter
            .lock()
            .map_err(|_| SecurityError::Unavailable)?
            .check(
                &principal.client_id,
                binding,
                &principal.source_hash,
                epoch_seconds(),
                10_000,
            )
            .map_err(SecurityError::TooManyAttempts)
    }
}

#[derive(Clone, Debug)]
pub struct CurrentUser {
    pub id: i32,
    pub roles: Vec<String>,
}

impl CurrentUser {
    pub fn has_role(&self, role: &str) -> bool {
        self.roles.iter().any(|r| r == role)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SecurityError {
    Unauthenticated,
    Forbidden,
    InvalidToken,
    InvalidAssertion,
    Unavailable,
    Database,
    TooManyAttempts(i64),
}

impl IntoResponse for SecurityError {
    fn into_response(self) -> Response {
        let (status, detail) = match self {
            Self::Unauthenticated => (StatusCode::UNAUTHORIZED, "Not authenticated."),
            Self::Forbidden => (StatusCode::FORBIDDEN, "Access denied."),
            Self::InvalidToken => (StatusCode::UNAUTHORIZED, "Invalid access token."),
            Self::InvalidAssertion => (StatusCode::UNAUTHORIZED, "Invalid BFF assertion."),
            Self::Unavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "Authentication service unavailable.",
            ),
            Self::Database => (StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error"),
            Self::TooManyAttempts(seconds) => {
                return (
                    StatusCode::TOO_MANY_REQUESTS,
                    [(axum::http::header::RETRY_AFTER, seconds.to_string())],
                    Json(json!({"detail":"Too many login attempts. Please try again later."})),
                )
                    .into_response();
            }
        };
        (status, Json(json!({"detail":detail}))).into_response()
    }
}

fn public_path(path: &str) -> bool {
    matches!(
        path,
        "/health"
            | "/api/v1/health"
            | "/actuator/health"
            | "/openapi.json"
            | "/docs"
            | "/docs/oauth2-redirect"
            | "/redoc"
            | "/api/v1/auth/enter-cds"
            | "/swagger-ui"
            | "/webjars"
    ) || ["/actuator/health/", "/swagger-ui/", "/webjars/"]
        .iter()
        .any(|prefix| path.starts_with(prefix))
        || path
            .strip_prefix("/api/v1/codes/groups/by-code/")
            .and_then(|s| s.strip_suffix("/active"))
            .is_some_and(|code| !code.is_empty() && !code.contains('/'))
}

pub async fn authenticate(
    State(state): State<SecurityState>,
    request: Request,
    next: Next,
) -> Response {
    match authenticate_request(&state, request, next).await {
        Ok(response) => response,
        Err(err) => {
            let mut response = err.into_response();
            response.headers_mut().insert(
                axum::http::header::CONTENT_TYPE,
                axum::http::HeaderValue::from_static("application/json;charset=ISO-8859-1"),
            );
            response
        }
    }
}

async fn authenticate_request(
    state: &SecurityState,
    mut request: Request,
    next: Next,
) -> Result<Response, SecurityError> {
    let path = request
        .extensions()
        .get::<OriginalUri>()
        .map(|uri| &uri.0)
        .unwrap_or(request.uri())
        .path()
        .to_owned();

    // Match Spring filter order: even public endpoints validate a supplied bearer.
    let authorization = request.headers().get(AUTHORIZATION);
    let token = authorization.and_then(|h| h.as_bytes().strip_prefix(b"Bearer "));
    let mut authenticated = false;
    if let Some(raw) = token {
        let token = std::str::from_utf8(raw).map_err(|_| SecurityError::InvalidToken)?;
        let id = token::access_subject(token, &state.access_key, &state.issuer, epoch_seconds())
            .ok_or(SecurityError::InvalidToken)?;
        let roles = sqlx::query_scalar::<_, Vec<String>>(
            "SELECT ARRAY(SELECT r.code::text FROM auth_roles r JOIN auth_user_roles ur ON ur.role_id = r.id
                          WHERE ur.user_id = u.id ORDER BY r.id)
             FROM auth_users u WHERE u.id = $1 AND u.is_active")
            .bind(id).fetch_optional(&state.pool).await.map_err(|_| SecurityError::Database)?
            .ok_or(SecurityError::InvalidToken)?;
        authenticated = true;
        request.extensions_mut().insert(CurrentUser { id, roles });
    }
    if matches!(
        path.as_str(),
        "/api/v1/auth/login" | "/api/v1/auth/social/exchange"
    ) {
        if request.method() != Method::POST {
            return Err(if authenticated {
                SecurityError::Forbidden
            } else {
                SecurityError::Unauthenticated
            });
        }
        let encoded = request
            .headers()
            .get("x-vibehr-bff-assertion")
            .and_then(|value| value.to_str().ok())
            .ok_or(SecurityError::InvalidAssertion)?;
        let principal = assertion::verify(
            encoded,
            &state.assertion_key,
            "POST",
            &path,
            state.max_ttl_seconds,
            epoch_seconds(),
        )
        .ok_or(SecurityError::InvalidAssertion)?;
        let (mut parts, body) = request.into_parts();
        let body = to_bytes(body, 64 * 1024)
            .await
            .map_err(|_| SecurityError::InvalidAssertion)?;
        if !principal.matches_body(&body) {
            return Err(SecurityError::InvalidAssertion);
        }
        replay::consume(&state.pool, &principal, epoch_seconds()).await?;
        parts.extensions.remove::<CurrentUser>();
        parts.extensions.insert(principal);
        request = Request::from_parts(parts, Body::from(body));
    } else if !authenticated && !public_path(&path) {
        return Err(SecurityError::Unauthenticated);
    }
    Ok(next.run(request).await)
}
