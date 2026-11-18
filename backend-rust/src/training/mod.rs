mod generate;
#[cfg(test)]
mod postgres_test;
mod resources;
use crate::{
    ApiError, AppState,
    appraisal::{dates, role},
    input::{Body, Validate, Violation, params::NumericPath, size},
    security::CurrentUser,
};
use axum::{
    Extension, Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post, put},
};
use chrono::{Datelike, NaiveDate};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{PgConnection, PgPool};
type Reply = Result<Json<Value>, ApiError>;
pub fn routes() -> Router<AppState> {
    Router::new().nest(
        "/api/v1/tra",
        Router::new()
            .route("/generate/required-events", post(generate::events))
            .route("/generate/required-targets", post(generate::targets))
            .route("/generate/elearning-windows", post(generate::windows))
            .route("/cyber-results/apply", post(generate::cyber))
            .route("/my-applications", get(mine).post(create))
            .route("/applications-detail", get(applications))
            .route("/applications/{appId}/approve", post(approve))
            .route("/applications/{appId}/reject", post(reject))
            .route("/applications/{appId}/withdraw", put(withdraw))
            .route("/{resource}", get(resources::list))
            .route("/{resource}/batch", post(resources::batch)),
    )
}
fn missing(text: &str) -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, text)
}
fn conflict(text: &str) -> ApiError {
    ApiError::new(StatusCode::CONFLICT, text)
}
async fn lock(conn: &mut PgConnection, key: &str) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(key)
        .execute(conn)
        .await?;
    Ok(())
}
async fn number(conn: &mut PgConnection) -> Result<String, ApiError> {
    lock(conn, "tra:application-sequence").await?;
    let next: i32 = sqlx::query_scalar("SELECT coalesce(max(id),0)+1 FROM tra_applications")
        .fetch_one(conn)
        .await?;
    Ok(format!("TRA-{}-{next:06}", chrono::Local::now().year()))
}
async fn application_rows(
    conn: &mut PgConnection,
    employee: Option<i32>,
    id: Option<i32>,
) -> Result<Vec<Value>, ApiError> {
    let rows=sqlx::query_scalar("SELECT to_jsonb(r) FROM(SELECT a.id,a.application_no,a.employee_id,e.employee_no,u.display_name employee_name,d.name department_name,a.course_id,c.course_name,a.event_id,ev.event_name,
      a.in_out_type,a.status,a.year_plan_yn,a.survey_yn,a.edu_memo,a.note,a.created_at,a.updated_at FROM tra_applications a
      LEFT JOIN hr_employees e ON e.id=a.employee_id LEFT JOIN auth_users u ON u.id=e.user_id LEFT JOIN org_departments d ON d.id=e.department_id
      LEFT JOIN tra_courses c ON c.id=a.course_id LEFT JOIN tra_events ev ON ev.id=a.event_id WHERE ($1::int IS NULL OR a.employee_id=$1) AND ($2::int IS NULL OR a.id=$2) ORDER BY a.id DESC) r")
        .bind(employee).bind(id).fetch_all(conn).await?;
    Ok(rows
        .into_iter()
        .map(crate::appraisal::projection_dates)
        .collect())
}
async fn employee(conn: &mut PgConnection, user: i32) -> Result<Option<i32>, ApiError> {
    Ok(
        sqlx::query_scalar("SELECT id FROM hr_employees WHERE user_id=$1 LIMIT 1")
            .bind(user)
            .fetch_optional(conn)
            .await?,
    )
}
async fn mine(State(s): State<AppState>, Extension(u): Extension<CurrentUser>) -> Reply {
    role(&u, true)?;
    let mut tx = s.pool.begin().await?;
    let rows = if let Some(e) = employee(&mut tx, u.id).await? {
        application_rows(&mut tx, Some(e), None).await?
    } else {
        vec![]
    };
    tx.commit().await?;
    Ok(Json(json!({"items":rows,"total_count":rows.len()})))
}
async fn applications(State(s): State<AppState>, Extension(u): Extension<CurrentUser>) -> Reply {
    role(&u, false)?;
    let rows = application_rows(&mut *s.pool.acquire().await?, None, None).await?;
    Ok(Json(json!({"items":rows,"total_count":rows.len()})))
}
#[derive(Deserialize)]
struct Application {
    course_id: i32,
    event_id: Option<i32>,
    in_out_type: Option<String>,
    year_plan_yn: bool,
    edu_memo: Option<String>,
    note: Option<String>,
}
impl Validate for Application {
    fn validate(&self) -> Vec<Violation> {
        [
            size("edu_memo", self.edu_memo.as_deref(), 0, 2000),
            size("note", self.note.as_deref(), 0, 2000),
        ]
        .into_iter()
        .flatten()
        .collect()
    }
}
async fn create(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(v): Body<Application>,
) -> Reply {
    role(&u, true)?;
    let mut tx = s.pool.begin().await?;
    let emp = employee(&mut tx, u.id)
        .await?
        .ok_or_else(|| missing("Employee record not found."))?;
    let ty: String = sqlx::query_scalar("SELECT in_out_type FROM tra_courses WHERE id=$1")
        .bind(v.course_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| missing("Course not found."))?;
    let no = number(&mut tx).await?;
    let id=sqlx::query_scalar("INSERT INTO tra_applications(application_no,employee_id,course_id,event_id,in_out_type,year_plan_yn,edu_memo,note,survey_yn,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,false,'submitted',statement_timestamp(),statement_timestamp()) RETURNING id")
       .bind(no).bind(emp).bind(v.course_id).bind(v.event_id).bind(v.in_out_type.unwrap_or(ty)).bind(v.year_plan_yn).bind(v.edu_memo).bind(v.note).fetch_one(&mut *tx).await?;
    let row = application_rows(&mut tx, None, Some(id))
        .await?
        .pop()
        .ok_or_else(|| missing("Application not found."))?;
    tx.commit().await?;
    Ok(Json(json!({"item":row})))
}
#[derive(Deserialize)]
struct Rejection {
    reason: Option<String>,
}
impl Validate for Rejection {
    fn validate(&self) -> Vec<Violation> {
        size("reason", self.reason.as_deref(), 0, 2000)
            .into_iter()
            .collect()
    }
}
enum Decision {
    Approve,
    Reject(Option<String>),
    Withdraw,
}
async fn approve(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    NumericPath(id): NumericPath<i32>,
) -> Reply {
    decide(&s.pool, &u, id, Decision::Approve).await
}
async fn reject(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    NumericPath(id): NumericPath<i32>,
    Body(v): Body<Rejection>,
) -> Reply {
    decide(&s.pool, &u, id, Decision::Reject(v.reason)).await
}
async fn withdraw(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    NumericPath(id): NumericPath<i32>,
) -> Reply {
    decide(&s.pool, &u, id, Decision::Withdraw).await
}
async fn decide(pool: &PgPool, u: &CurrentUser, id: i32, decision: Decision) -> Reply {
    role(u, matches!(decision, Decision::Withdraw))?;
    let mut tx = pool.begin().await?;
    let (owner, old, note): (i32, String, Option<String>) = sqlx::query_as(
        "SELECT employee_id,status,note FROM tra_applications WHERE id=$1 FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| missing("Application not found."))?;
    let mut note = note;
    let new = match decision {
        Decision::Approve => {
            if old != "submitted" {
                return Err(conflict("Only submitted applications can be approved."));
            }
            "approved"
        }
        Decision::Reject(reason) => {
            if !matches!(old.as_str(), "submitted" | "draft") {
                return Err(conflict(
                    "Only submitted or draft applications can be rejected.",
                ));
            }
            if let Some(reason) = reason.filter(|v| !v.trim().is_empty()) {
                note = Some(format!(
                    "{}반려사유: {reason}",
                    note.map(|n| n + "\n").unwrap_or_default()
                ));
            }
            "rejected"
        }
        Decision::Withdraw => {
            if employee(&mut tx, u.id).await? != Some(owner) {
                return Err(ApiError::new(
                    StatusCode::FORBIDDEN,
                    "Cannot withdraw another employee's application.",
                ));
            }
            if !matches!(old.as_str(), "submitted" | "draft") {
                return Err(conflict(
                    "Only submitted or draft applications can be withdrawn.",
                ));
            }
            "canceled"
        }
    };
    sqlx::query("UPDATE tra_applications SET status=$2,note=$3,updated_at=statement_timestamp() WHERE id=$1").bind(id).bind(new).bind(note).execute(&mut *tx).await?;
    let row = application_rows(&mut tx, None, Some(id))
        .await?
        .pop()
        .ok_or_else(|| missing("Application not found."))?;
    tx.commit().await?;
    Ok(Json(json!({"item":row})))
}
