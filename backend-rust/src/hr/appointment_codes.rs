use super::{
    Reply,
    forms::{AppointmentCodeCreate, AppointmentCodeUpdate},
    hr_role,
};
use crate::{ApiError, AppState, input::Body, security::CurrentUser};
use axum::{
    Extension, Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, put},
};
use serde_json::{Value, json};
use sqlx::PgConnection;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/hr/appointment-codes", get(list).post(create))
        .route(
            "/api/v1/hr/appointment-codes/{code_id}",
            put(update).delete(remove),
        )
}
fn missing() -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, "Appointment code not found.")
}
async fn group(conn: &mut PgConnection) -> Result<i32, ApiError> {
    if let Some(value) =
        sqlx::query_scalar("SELECT id FROM app_code_groups WHERE code='HR_APPOINTMENT_CODE'")
            .fetch_optional(&mut *conn)
            .await?
    {
        return Ok(value);
    }
    sqlx::query("INSERT INTO app_code_groups(code,name,description,is_active,sort_order,created_at,updated_at)
        VALUES('HR_APPOINTMENT_CODE','발령코드','발령처리용 코드 그룹',true,150,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC') ON CONFLICT(code) DO NOTHING")
        .execute(&mut *conn).await?;
    Ok(
        sqlx::query_scalar("SELECT id FROM app_code_groups WHERE code='HR_APPOINTMENT_CODE'")
            .fetch_one(conn)
            .await?,
    )
}
pub(super) async fn valid(conn: &mut PgConnection, id: Option<i32>) -> Result<(), ApiError> {
    if let Some(id)=id && !sqlx::query_scalar::<_,bool>("SELECT EXISTS(SELECT 1 FROM app_codes c JOIN app_code_groups g ON g.id=c.group_id WHERE c.id=$1 AND g.code='HR_APPOINTMENT_CODE')")
        .bind(id).fetch_one(conn).await?{return Err(ApiError::new(StatusCode::BAD_REQUEST,"Invalid appointment code."));}
    Ok(())
}
async fn rows(
    conn: &mut PgConnection,
    group: i32,
    id: Option<i32>,
) -> Result<Vec<Value>, ApiError> {
    // Native JDBC TIMESTAMP projections serialize as local date-time (no UTC suffix).
    Ok(sqlx::query_scalar("SELECT to_jsonb(x) FROM (SELECT id,code,name,description,is_active,sort_order,extra_value1 mapping_key,extra_value2 mapping_value,created_at,updated_at
        FROM app_codes WHERE group_id=$1 AND ($2::int IS NULL OR id=$2) ORDER BY sort_order,id) x").bind(group).bind(id).fetch_all(conn).await?)
}
async fn list(State(s): State<AppState>, Extension(u): Extension<CurrentUser>) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let g = group(&mut tx).await?;
    let items = rows(&mut tx, g, None).await?;
    tx.commit().await?;
    Ok(Json(json!({"items":items})))
}
async fn save(conn: &mut PgConnection, id: Option<i32>, p: Value) -> Result<Value, ApiError> {
    let g = group(conn).await?;
    let current = if let Some(id) = id {
        rows(conn, g, Some(id)).await?.pop().ok_or_else(missing)?
    } else {
        json!({})
    };
    let code = p["code"]
        .as_str()
        .map(|s| s.trim().to_uppercase())
        .or_else(|| current["code"].as_str().map(str::to_owned))
        .unwrap_or_default();
    if sqlx::query_scalar::<_,bool>("SELECT EXISTS(SELECT 1 FROM app_codes WHERE group_id=$1 AND code=$2 AND id IS DISTINCT FROM $3)").bind(g).bind(&code).bind(id).fetch_one(&mut *conn).await?{
        return Err(ApiError::new(StatusCode::CONFLICT,"appointment code already exists."));
    }
    let id=match id{
        None=>sqlx::query_scalar("INSERT INTO app_codes(group_id,code,name,description,is_active,sort_order,extra_value1,extra_value2,created_at,updated_at)
            SELECT $1,$2,btrim($3->>'name'),$3->>'description',($3->>'is_active')::boolean,($3->>'sort_order')::int,$3->>'mapping_key',$3->>'mapping_value',
                   statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC' RETURNING id").bind(g).bind(code).bind(p).fetch_one(&mut *conn).await?,
        Some(id)=>{
            sqlx::query("UPDATE app_codes SET code=$2,name=coalesce(btrim($3->>'name'),name),description=coalesce($3->>'description',description),
                is_active=coalesce(($3->>'is_active')::boolean,is_active),sort_order=coalesce(($3->>'sort_order')::int,sort_order),
                extra_value1=coalesce($3->>'mapping_key',extra_value1),extra_value2=coalesce($3->>'mapping_value',extra_value2),updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
                .bind(id).bind(code).bind(p).execute(&mut *conn).await?;id
        }
    };
    rows(conn, g, Some(id)).await?.pop().ok_or_else(missing)
}
async fn create(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(AppointmentCodeCreate(p)): Body<AppointmentCodeCreate>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let item = save(&mut tx, None, p).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({"item":item}))))
}
async fn update(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
    Body(AppointmentCodeUpdate(p)): Body<AppointmentCodeUpdate>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let item = save(&mut tx, Some(id), p).await?;
    tx.commit().await?;
    Ok(Json(json!({"item":item})))
}
async fn remove(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Result<StatusCode, ApiError> {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let g = group(&mut tx).await?;
    if sqlx::query("DELETE FROM app_codes WHERE id=$1 AND group_id=$2")
        .bind(id)
        .bind(g)
        .execute(&mut *tx)
        .await?
        .rows_affected()
        == 0
    {
        return Err(missing());
    }
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}
