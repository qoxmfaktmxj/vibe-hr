mod approvals;
mod batch;
pub mod calculation;
mod export;
mod pdf;
#[cfg(test)]
mod postgres_test;
mod read;
mod runs;
mod snapshots;
mod voucher;

use crate::input::params::NumericPath as Path;
use crate::{ApiError, AppState, security::CurrentUser};
use axum::{
    Extension, Json, Router,
    extract::{Query, State},
    http::StatusCode,
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::PgPool;

type Reply = Result<Json<Value>, ApiError>;

#[derive(Deserialize, Default)]
struct Filter {
    year_month: Option<String>,
    status: Option<String>,
}

impl Filter {
    fn nonblank(value: Option<&str>) -> Option<&str> {
        value.filter(|v| !v.trim().is_empty())
    }
}

fn require_role(user: &CurrentUser, allow_hr: bool) -> Result<(), ApiError> {
    if user.has_role("payroll_mgr")
        || user.has_role("admin")
        || (allow_hr && user.has_role("hr_manager"))
    {
        Ok(())
    } else {
        Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "Not enough permissions.",
        ))
    }
}

async fn require_menu(
    pool: &PgPool,
    user: &CurrentUser,
    code: &str,
    action: &str,
) -> Result<(), ApiError> {
    require_role(user, false)?;
    let menu: i32 = sqlx::query_scalar("SELECT id FROM app_menus WHERE code=$1 AND is_active")
        .bind(code)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Menu not found."))?;
    let (access, allowed): (bool, bool) = sqlx::query_as(
        "SELECT EXISTS (SELECT 1 FROM app_menu_roles mr JOIN auth_user_roles ur USING(role_id)
                          WHERE mr.menu_id=$1 AND ur.user_id=$2),
               COALESCE((SELECT bool_or(o.allowed) FROM app_role_menu_actions o JOIN auth_user_roles ur USING(role_id)
                          WHERE o.menu_id=$1 AND ur.user_id=$2 AND o.action_code=$3),
                        (SELECT a.enabled_default FROM app_menu_actions a WHERE a.menu_id=$1 AND a.action_code=$3),
                        NOT EXISTS (SELECT 1 FROM app_menu_actions WHERE menu_id=$1))"
    ).bind(menu).bind(user.id).bind(action).fetch_one(pool).await?;
    if !access {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Access denied."));
    }
    if !allowed {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Action not allowed."));
    }
    Ok(())
}

fn list(items: Vec<Value>) -> Value {
    json!({"total_count": items.len(), "items": items})
}

pub fn router() -> Router<AppState> {
    let mut routes = Router::new()
        .route("/runs", get(read::runs).post(runs::create))
        .route("/runs/{run_id}/calculate", post(runs::calculate))
        .route("/runs/{run_id}/recalculate", post(runs::calculate))
        .route("/runs/{run_id}/snapshot-backfill", post(runs::refresh))
        .route("/runs/{run_id}/close", post(runs::close))
        .route("/runs/{run_id}/mark-paid", post(approvals::mark_paid))
        .route("/runs/{run_id}/employees", get(read::employees))
        .route(
            "/runs/{run_id}/employees/{run_employee_id}",
            get(read::employee_detail),
        )
        .route("/my/payslips", get(read::payslips))
        .route("/my/payslips/{run_id}", get(read::payslip))
        .route("/my/payslips/{run_id}/pdf", get(pdf::own))
        .route(
            "/runs/{run_id}/employees/{employee_id}/pdf",
            get(pdf::admin),
        )
        .route("/vouchers", get(read::vouchers))
        .route("/vouchers/generate", post(voucher::generate))
        .route("/vouchers/generate-disbursement", post(voucher::disburse))
        .route("/vouchers/mapping-gaps", get(voucher::gaps))
        .route("/vouchers/{voucher_id}", get(read::voucher_detail))
        .route("/vouchers/{voucher_id}/export", get(export::voucher))
        .route("/vouchers/{voucher_id}/confirm", post(approvals::confirm))
        .route("/vouchers/{voucher_id}/cancel", post(approvals::cancel))
        .route("/variable-inputs", get(read::variable_inputs));
    for screen in read::GRIDS {
        routes =
            routes.route(
                screen.path,
                get(
                    move |State(state): State<AppState>,
                          Extension(user): Extension<CurrentUser>| async move {
                        if let Some(menu) = screen.menu {
                            require_menu(&state.pool, &user, menu, "query").await?;
                        } else {
                            require_role(&user, screen.path == "/severance-item-rules")?;
                        }
                        let rows: Vec<Value> = sqlx::query_scalar(screen.sql)
                            .fetch_all(&state.pool)
                            .await?;
                        Ok::<_, ApiError>(Json(list(rows)))
                    },
                ),
            );
    }
    Router::new().nest("/api/v1/pay", routes.merge(batch::routes()))
}
