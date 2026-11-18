mod appointment_codes;
mod appointments;
mod basic;
mod employees;
mod forms;
mod recruit;
#[cfg(test)]
mod regression;
mod retirement;
mod schema;
mod severance;

use crate::{ApiError, AppState, security::CurrentUser};
use axum::{Json, Router, http::StatusCode};
use serde_json::Value;

type Reply = Result<Json<Value>, ApiError>;

async fn require_role(
    pool: &sqlx::PgPool,
    actor: &CurrentUser,
    roles: &[&str],
) -> Result<(), ApiError> {
    // HrAuthorization re-reads role grants at the business boundary.
    let permitted: bool = sqlx::query_scalar(
        "SELECT EXISTS(
        SELECT 1 FROM auth_user_roles ur JOIN auth_roles r ON r.id=ur.role_id
        WHERE ur.user_id=$1 AND r.code=ANY($2::text[]))",
    )
    .bind(actor.id)
    .bind(roles)
    .fetch_one(pool)
    .await?;
    if permitted {
        Ok(())
    } else {
        Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "Not enough permissions.",
        ))
    }
}

async fn hr_role(pool: &sqlx::PgPool, actor: &CurrentUser) -> Result<(), ApiError> {
    require_role(pool, actor, &["admin", "hr_manager"]).await
}

pub fn routes() -> Router<AppState> {
    employees::routes()
        .merge(basic::routes())
        .merge(recruit::routes())
        .merge(appointment_codes::routes())
        .merge(appointments::routes())
        .merge(retirement::routes())
        .merge(severance::routes())
}
