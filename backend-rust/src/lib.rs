use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
};
use serde::Serialize;
use serde_json::json;
use sqlx::PgPool;

pub mod appraisal;
mod common_codes;
mod dashboard;
pub mod db;
mod documentation;
pub mod hr;
pub mod hri;
pub mod input;
pub mod management;
pub mod menu;
pub mod organization;
pub mod payroll;
pub mod platform;
pub mod security;
pub mod session_policy;
pub mod time;
pub mod training;
mod validation;
pub mod welfare;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub app_name: String,
    pub environment: String,
    pub security: security::SecurityState,
}

#[derive(Debug)]
pub struct ApiError(StatusCode, serde_json::Value);

impl ApiError {
    pub fn with_detail(status: StatusCode, detail: serde_json::Value) -> Self {
        Self(status, json!({"detail": detail}))
    }

    pub fn validation(mut violations: Vec<input::Violation>) -> Self {
        validation::localize(&mut violations);
        Self::with_detail(StatusCode::UNPROCESSABLE_ENTITY, json!(violations))
    }

    pub fn new(status: StatusCode, detail: impl Into<String>) -> Self {
        Self::with_detail(status, serde_json::Value::String(detail.into()))
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        if error
            .as_database_error()
            .and_then(|e| e.code())
            .is_some_and(|c| c.starts_with("23"))
        {
            return Self::new(StatusCode::CONFLICT, "Data integrity conflict.");
        }
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(self.1)).into_response()
    }
}

impl security::CurrentUser {
    pub fn require_admin(&self) -> Result<(), ApiError> {
        if self.has_role("admin") {
            Ok(())
        } else {
            Err(ApiError::new(
                StatusCode::FORBIDDEN,
                "접근 권한이 없습니다.",
            ))
        }
    }
}

pub fn router(state: AppState) -> Router {
    router_with_http_config(
        state,
        platform::HttpConfig::new("http://localhost:3000").expect("default origin"),
    )
}

pub fn router_with_http_config(state: AppState, config: platform::HttpConfig) -> Router {
    let application = Router::new()
        .route("/health", get(|| async { Json(json!({ "status": "ok" })) }))
        .route("/api/v1/health", get(api_health))
        .route("/api/v1/dashboard/summary", get(dashboard::summary))
        .route("/api/v1/auth/enter-cds", get(corporations))
        .merge(session_policy::routes())
        .merge(security::auth_routes())
        .merge(payroll::router())
        .merge(menu::routes())
        .merge(management::routes())
        .merge(hr::routes())
        .merge(hri::router())
        .merge(appraisal::routes())
        .merge(time::routes())
        .merge(training::routes())
        .merge(welfare::router())
        .merge(organization::routes())
        .merge(common_codes::routes())
        .merge(platform::probes(config.clone()))
        .merge(documentation::routes())
        .fallback(platform::not_found)
        .layer(axum::middleware::from_fn_with_state(
            state.security.clone(),
            security::authenticate,
        ))
        .with_state(state);
    // MethodRouter attaches Allow after dispatch. Apply HTTP negotiation and CORS
    // outside it so the wire response includes the supported methods.
    Router::new()
        .fallback_service(application)
        .layer(axum::middleware::from_fn_with_state(
            config,
            platform::http_layer,
        ))
}

async fn api_health(State(state): State<AppState>) -> Json<serde_json::Value> {
    let available = sqlx::query("SELECT 1").execute(&state.pool).await.is_ok();
    Json(json!({
        "status": if available { "ok" } else { "degraded" },
        "app": state.app_name,
        "environment": state.environment,
        "db": if available { "ok" } else { "error" },
    }))
}

#[derive(Serialize, sqlx::FromRow)]
struct Corporation {
    enter_cd: String,
    company_code: String,
    corporation_name: String,
    company_logo_url: Option<String>,
}

#[derive(Serialize)]
struct Corporations {
    corporations: Vec<Corporation>,
    total_count: usize,
}

async fn corporations(State(state): State<AppState>) -> Result<Json<Corporations>, ApiError> {
    let corporations = sqlx::query_as::<_, Corporation>(
        "SELECT enter_cd, company_code, corporation_name, company_logo_url
         FROM org_corporations WHERE is_active ORDER BY corporation_name, id",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(Corporations {
        total_count: corporations.len(),
        corporations,
    }))
}
