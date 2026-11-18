mod config;
mod detail;
mod workflow;
use crate::{
    ApiError, AppState,
    input::{
        self, Body, Validate, Violation,
        params::{NumericPath as Path, Pagination},
    },
    security::CurrentUser,
    welfare::gate,
};
use axum::{
    Extension, Json, Router,
    extract::{Query, State},
    http::StatusCode,
    routing::{get, post},
};
use chrono::{NaiveDate, NaiveDateTime, SecondsFormat, Utc};
use serde::Deserialize;
use serde_json::{Map, Value, json};
use sqlx::PgConnection;

pub fn router() -> Router<AppState> {
    Router::new().nest(
        "/api/v1/hri",
        Router::new()
            .route("/form-types", get(config::forms))
            .route("/form-types/batch", post(config::save_forms))
            .route("/approval-templates", get(config::templates))
            .route("/approval-templates/batch", post(config::save_templates))
            .route("/requests/draft", post(workflow::draft))
            .route("/requests/submit", post(workflow::create_submit))
            .route("/requests/{request_id}/submit", post(workflow::submit))
            .route("/requests/{request_id}/withdraw", post(workflow::withdraw))
            .route("/requests/{request_id}/approve", post(workflow::approve))
            .route("/requests/{request_id}/reject", post(workflow::reject))
            .route(
                "/requests/{request_id}/receive-complete",
                post(workflow::receive_complete),
            )
            .route(
                "/requests/{request_id}/receive-reject",
                post(workflow::receive_reject),
            )
            .route("/requests/my", get(my_requests))
            .route("/requests/{request_id}", get(my_detail))
            .route("/tasks/my-approvals", get(approval_tasks))
            .route("/tasks/my-receives", get(receive_tasks)),
    )
}
const STAFF: &[&str] = &["employee", "hr_manager", "admin"];
const MANAGERS: &[&str] = &["hr_manager", "admin"];
type Reply = Result<Json<Value>, ApiError>;
fn bad(message: impl Into<String>) -> ApiError {
    ApiError::new(StatusCode::BAD_REQUEST, message)
}
fn conflict(message: impl Into<String>) -> ApiError {
    ApiError::new(StatusCode::CONFLICT, message)
}
fn missing() -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, "Request not found.")
}
fn form_missing() -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, "Form type not found.")
}
fn today() -> NaiveDate {
    (Utc::now() + chrono::Duration::hours(9)).date_naive()
}
fn editable(status: &str) -> bool {
    matches!(status, "DRAFT" | "APPROVAL_REJECTED" | "RECEIVE_REJECTED")
}

fn instants(v: &mut Value) -> Result<(), ApiError> {
    for key in [
        "created_at",
        "updated_at",
        "submitted_at",
        "completed_at",
        "requested_at",
        "acted_at",
    ] {
        if let Some(field) = v.get_mut(key)
            && let Some(s) = field.as_str()
        {
            let t = NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f").map_err(|_| {
                ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
            })?;
            *field = json!(t.and_utc().to_rfc3339_opts(SecondsFormat::AutoSi, true));
        }
    }
    Ok(())
}
fn content(v: &str) -> Value {
    serde_json::from_str::<Map<String, Value>>(v)
        .map(Value::Object)
        .unwrap_or_else(|_| json!({}))
}
macro_rules! request_projection{
    ($where:literal)=>{concat!("SELECT to_jsonb(data) FROM (SELECT r.id,r.request_no,r.form_type_id,f.form_name_ko AS form_name,
            r.requester_id,r.title,r.status_code,r.current_step_order,s.actor_name AS current_actor_name,r.submitted_at,r.completed_at,r.created_at,r.updated_at,r.content_json
            FROM hri_request_masters r LEFT JOIN hri_form_types f ON f.id=r.form_type_id LEFT JOIN hri_request_step_snapshots s
              ON s.request_id=r.id AND s.step_order=r.current_step_order ",$where,") data")};
}
fn request_value(mut value: Value) -> Result<Value, ApiError> {
    value["content_json"] = content(value["content_json"].as_str().unwrap_or(""));
    instants(&mut value)?;
    Ok(value)
}
async fn request_item(conn: &mut PgConnection, id: i32) -> Result<Value, ApiError> {
    let raw: Value = sqlx::query_scalar(request_projection!("WHERE r.id=$1"))
        .bind(id)
        .fetch_one(conn)
        .await?;
    request_value(raw)
}
async fn my_requests(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Pagination>,
) -> Reply {
    let (page, limit) = q.parse("myRequests")?;
    gate(&s.pool, &u, STAFF).await?;
    let values: Vec<Value> = sqlx::query_scalar(request_projection!(
        "WHERE r.requester_id=$1 ORDER BY r.created_at DESC,r.id DESC"
    ))
    .bind(u.id)
    .fetch_all(&s.pool)
    .await?;
    let count = values.len();
    let rows = values
        .into_iter()
        .skip((i64::from(page - 1) * i64::from(limit)) as usize)
        .take(limit as usize)
        .map(request_value)
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Json(
        json!({"items":rows,"total_count":count,"page":page,"limit":limit}),
    ))
}
async fn my_detail(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    gate(&s.pool, &u, STAFF).await?;
    let mut tx = s.pool.begin().await?;
    let raw: Value = sqlx::query_scalar(request_projection!("WHERE r.id=$1 AND r.requester_id=$2"))
        .bind(id)
        .bind(u.id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(missing)?;
    let mut row = request_value(raw)?;
    let code: Option<String> =
        sqlx::query_scalar("SELECT form_code FROM hri_form_types WHERE id=$1")
            .bind(row["form_type_id"].as_i64().unwrap() as i32)
            .fetch_optional(&mut *tx)
            .await?;
    let mut steps:Vec<Value>=sqlx::query_scalar("SELECT to_jsonb(s) FROM (SELECT id,step_order,step_type,actor_name,action_status,acted_at,comment FROM hri_request_step_snapshots
        WHERE request_id=$1 ORDER BY step_order,id) s").bind(id).fetch_all(&mut *tx).await?;
    for step in &mut steps {
        instants(step)?;
    }
    let detailed = if row["status_code"] == "DRAFT" {
        None
    } else {
        detail::read(&mut tx, code.as_deref().unwrap_or(""), id).await?
    };
    row["detail_data"] = detailed.unwrap_or_else(|| row["content_json"].clone());
    row["form_code"] = json!(code);
    row["steps"] = json!(steps);
    tx.commit().await?;
    Ok(Json(json!({"request":row})))
}
async fn tasks(s: &AppState, u: &CurrentUser, q: &Pagination, receive: bool) -> Reply {
    let (kind, status, method) = if receive {
        ("RECEIVE", "RECEIVE_IN_PROGRESS", "myReceiveTasks")
    } else {
        ("APPROVAL", "APPROVAL_IN_PROGRESS", "myApprovalTasks")
    };
    let (page, limit) = q.parse(method)?;
    gate(&s.pool, u, STAFF).await?;
    let values:Vec<Value>=sqlx::query_scalar("SELECT to_jsonb(data) FROM (SELECT r.id AS request_id,r.request_no,r.title,r.status_code,
        s.step_order,s.step_type,r.requester_id,r.created_at AS requested_at,f.form_name_ko AS form_name
        FROM hri_request_step_snapshots s JOIN hri_request_masters r ON r.id=s.request_id AND s.step_order=r.current_step_order
        LEFT JOIN hri_form_types f ON f.id=r.form_type_id WHERE s.actor_user_id=$1 AND s.step_type=$2 AND r.status_code=$3
        AND s.action_status='WAITING' ORDER BY r.created_at DESC,s.step_order) data")
        .bind(u.id).bind(kind).bind(status).fetch_all(&s.pool).await?;
    let count = values.len();
    let mut rows: Vec<_> = values
        .into_iter()
        .skip((i64::from(page - 1) * i64::from(limit)) as usize)
        .take(limit as usize)
        .collect();
    for row in &mut rows {
        instants(row)?;
    }
    Ok(Json(
        json!({"items":rows,"total_count":count,"page":page,"limit":limit}),
    ))
}
async fn approval_tasks(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Pagination>,
) -> Reply {
    tasks(&s, &u, &q, false).await
}
async fn receive_tasks(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Pagination>,
) -> Reply {
    tasks(&s, &u, &q, true).await
}
