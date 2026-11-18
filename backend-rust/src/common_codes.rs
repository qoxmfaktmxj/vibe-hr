use crate::input::params::{NumericPath, Pagination, query_bool};
use crate::{
    ApiError, AppState,
    input::{self, Body, Validate, Violation},
    menu,
    security::CurrentUser,
};
use axum::{
    Extension, Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, put},
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{PgConnection, PgPool};

type Reply = Result<Json<Value>, ApiError>;
const MENU: &str = "/settings/common-codes";

fn id(value: i64, field: &str) -> Result<i32, ApiError> {
    value.try_into().map_err(|_| {
        ApiError::new(
            StatusCode::BAD_REQUEST,
            format!("{field} is outside the supported INTEGER range."),
        )
    })
}

async fn authorize(pool: &PgPool, user: &CurrentUser, action: &str) -> Result<(), ApiError> {
    user.require_admin()?;
    menu::require_action(pool, user.id, None, Some(MENU), action).await
}

#[derive(Deserialize, Default)]
struct Filters {
    #[serde(flatten)]
    pagination: Pagination,
    all: Option<String>,
    code: Option<String>,
    name: Option<String>,
}

async fn active(State(s): State<AppState>, Path(code): Path<String>) -> Reply {
    let code = code.trim().to_uppercase();
    let mut tx = s.pool.begin().await?;
    let group: i32 = sqlx::query_scalar("SELECT id FROM app_code_groups WHERE code=$1")
        .bind(&code)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(missing_group)?;
    let options:Vec<Value>=sqlx::query_scalar("SELECT jsonb_build_object('code',code,'name',name) FROM app_codes WHERE group_id=$1 AND is_active ORDER BY sort_order,id")
        .bind(group).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"group_code":code,"options":options})))
}
fn missing_group() -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, "Code group not found.")
}
fn missing_code() -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, "Code not found.")
}

async fn check_group(conn: &mut PgConnection, group: i32) -> Result<(), ApiError> {
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM app_code_groups WHERE id=$1)")
            .bind(group)
            .fetch_one(conn)
            .await?;
    if exists { Ok(()) } else { Err(missing_group()) }
}

async fn list(pool: &PgPool, user: &CurrentUser, filters: Filters, group: Option<i64>) -> Reply {
    let method = if group.is_some() { "codes" } else { "groups" };
    let (page, limit) = filters.pagination.with_limits(method, 100, 1000)?;
    let all = filters
        .all
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| query_bool("all", s))
        .transpose()?
        .unwrap_or(false);
    authorize(pool, user, "query").await?;
    let code = filters.code.as_deref().unwrap_or("").trim();
    let name = filters.name.as_deref().unwrap_or("").trim();
    let mut tx = pool.begin().await?;
    let clause_group = "WITH filtered AS (SELECT * FROM app_code_groups WHERE lower(code) LIKE lower('%'||$1||'%') AND lower(name) LIKE lower('%'||$2||'%')), paged AS (SELECT * FROM filtered ORDER BY sort_order,id LIMIT $3 OFFSET $4) SELECT (SELECT count(*) FROM filtered),COALESCE(jsonb_agg(to_jsonb(paged) ORDER BY sort_order,id),'[]') FROM paged";
    let clause_item = "WITH filtered AS (SELECT * FROM app_codes WHERE group_id=$5 AND lower(code) LIKE lower('%'||$1||'%') AND lower(name) LIKE lower('%'||$2||'%')), paged AS (SELECT * FROM filtered ORDER BY sort_order,id LIMIT $3 OFFSET $4) SELECT (SELECT count(*) FROM filtered),COALESCE(jsonb_agg(to_jsonb(paged) ORDER BY sort_order,id),'[]') FROM paged";
    let mut query = sqlx::query_as(if group.is_some() {
        clause_item
    } else {
        clause_group
    })
    .bind(code)
    .bind(name)
    .bind((!all).then_some(i64::from(limit)))
    .bind(if all {
        0
    } else {
        i64::from(page - 1) * i64::from(limit)
    });
    if let Some(group) = group {
        let group = id(group, "group_id")?;
        check_group(&mut tx, group).await?;
        query = query.bind(group);
    }
    let (count, rows): (i64, Value) = query.fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(
        json!({(if group.is_some() {"codes"}else{"groups"}):rows,"total_count":count,"page":(!all).then_some(page),"limit":(!all).then_some(limit)}),
    ))
}

#[derive(Deserialize)]
struct Payload<const CREATE: bool, const ITEM: bool> {
    code: Option<String>,
    name: Option<String>,
    description: Option<String>,
    is_active: Option<bool>,
    sort_order: Option<i32>,
    extra_value1: Option<String>,
    extra_value2: Option<String>,
}

impl<const CREATE: bool, const ITEM: bool> Validate for Payload<CREATE, ITEM> {
    fn validate(&self) -> Vec<Violation> {
        let min = usize::from(!CREATE);
        let mut errors: Vec<_> = [
            input::size("code", self.code.as_deref(), min, 30),
            input::size("name", self.name.as_deref(), min, 100),
        ]
        .into_iter()
        .flatten()
        .collect();
        if CREATE {
            errors.extend(input::not_blank("code", self.code.as_deref()));
            errors.extend(input::not_blank("name", self.name.as_deref()));
        }
        if ITEM {
            errors.extend(input::size(
                "extra_value1",
                self.extra_value1.as_deref(),
                0,
                200,
            ));
            errors.extend(input::size(
                "extra_value2",
                self.extra_value2.as_deref(),
                0,
                200,
            ));
        }
        errors
    }
}

async fn save<const CREATE: bool, const ITEM: bool>(
    pool: &PgPool,
    user: &CurrentUser,
    p: Payload<CREATE, ITEM>,
    group: Option<i64>,
    target: Option<i64>,
) -> Reply {
    authorize(pool, user, "save").await?;
    let mut tx = pool.begin().await?;
    let group = group.map(|g| id(g, "group_id")).transpose()?;
    let target = target
        .map(|v| id(v, if ITEM { "code_id" } else { "group_id" }))
        .transpose()?;
    if ITEM && CREATE {
        check_group(&mut tx, group.expect("item group")).await?;
    }
    if let Some(target) = target {
        if ITEM {
            let exists: bool = sqlx::query_scalar(
                "SELECT EXISTS (SELECT 1 FROM app_codes WHERE id=$1 AND group_id=$2)",
            )
            .bind(target)
            .bind(group)
            .fetch_one(&mut *tx)
            .await?;
            if !exists {
                return Err(missing_code());
            }
        } else {
            check_group(&mut tx, target).await?;
        }
    }
    let code = p.code.as_deref().map(|s| s.trim().to_uppercase());
    let name = p.name.as_deref().map(str::trim);
    if let Some(ref code) = code {
        let duplicate: bool = if ITEM {
            sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM app_codes WHERE code=$1 AND id IS DISTINCT FROM $2 AND group_id=$3)").bind(code).bind(target).bind(group).fetch_one(&mut *tx).await?
        } else {
            sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM app_code_groups WHERE code=$1 AND id IS DISTINCT FROM $2)").bind(code).bind(target).fetch_one(&mut *tx).await?
        };
        if duplicate {
            return Err(ApiError::new(
                StatusCode::CONFLICT,
                if ITEM {
                    "code already exists in group."
                } else {
                    "group code already exists."
                },
            ));
        }
    }
    let statement = match (CREATE, ITEM) {
        (true, false) => {
            "INSERT INTO app_code_groups AS r (code,name,description,is_active,sort_order,created_at,updated_at) VALUES ($1,$2,$3,coalesce($4,true),coalesce($5,0),statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC') RETURNING to_jsonb(r)"
        }
        (false, false) => {
            "UPDATE app_code_groups AS r SET code=coalesce($1,code),name=coalesce($2,name),description=coalesce($3,description),is_active=coalesce($4,is_active),sort_order=coalesce($5,sort_order),updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$6 RETURNING to_jsonb(r)"
        }
        (true, true) => {
            "INSERT INTO app_codes AS r (code,name,description,is_active,sort_order,group_id,extra_value1,extra_value2,created_at,updated_at) VALUES ($1,$2,$3,coalesce($4,true),coalesce($5,0),$6,$7,$8,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC') RETURNING to_jsonb(r)"
        }
        (false, true) => {
            "UPDATE app_codes AS r SET code=coalesce($1,code),name=coalesce($2,name),description=coalesce($3,description),is_active=coalesce($4,is_active),sort_order=coalesce($5,sort_order),extra_value1=coalesce($7,extra_value1),extra_value2=coalesce($8,extra_value2),updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE group_id=$6 AND id=$9 RETURNING to_jsonb(r)"
        }
    };
    let mut query = sqlx::query_scalar(statement)
        .bind(code)
        .bind(name)
        .bind(p.description)
        .bind(p.is_active)
        .bind(p.sort_order);
    if ITEM {
        query = query.bind(group).bind(p.extra_value1).bind(p.extra_value2);
    }
    if !CREATE {
        query = query.bind(target);
    }
    let row: Value = query.fetch_optional(&mut *tx).await?.ok_or_else(if ITEM {
        missing_code
    } else {
        missing_group
    })?;
    tx.commit().await?;
    Ok(Json(json!({(if ITEM {"code"}else{"group"}):row})))
}

async fn delete_group(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    NumericPath(g): NumericPath<i64>,
) -> Result<StatusCode, ApiError> {
    authorize(&s.pool, &user, "save").await?;
    if sqlx::query("DELETE FROM app_code_groups WHERE id=$1")
        .bind(id(g, "group_id")?)
        .execute(&s.pool)
        .await?
        .rows_affected()
        == 0
    {
        return Err(missing_group());
    }
    Ok(StatusCode::NO_CONTENT)
}
async fn delete_item(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    NumericPath((g, c)): NumericPath<(i64, i64)>,
) -> Result<StatusCode, ApiError> {
    authorize(&s.pool, &user, "save").await?;
    if sqlx::query("DELETE FROM app_codes WHERE group_id=$1 AND id=$2")
        .bind(id(g, "group_id")?)
        .bind(id(c, "code_id")?)
        .execute(&s.pool)
        .await?
        .rows_affected()
        == 0
    {
        return Err(missing_code());
    }
    Ok(StatusCode::NO_CONTENT)
}
async fn groups(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(f): Query<Filters>,
) -> Reply {
    list(&s.pool, &u, f, None).await
}
async fn items(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    NumericPath(g): NumericPath<i64>,
    Query(f): Query<Filters>,
) -> Reply {
    list(&s.pool, &u, f, Some(g)).await
}
async fn create_group(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(p): Body<Payload<true, false>>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    Ok((StatusCode::CREATED, save(&s.pool, &u, p, None, None).await?))
}
async fn update_group(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    NumericPath(g): NumericPath<i64>,
    Body(p): Body<Payload<false, false>>,
) -> Reply {
    save(&s.pool, &u, p, None, Some(g)).await
}
async fn create_item(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    NumericPath(g): NumericPath<i64>,
    Body(p): Body<Payload<true, true>>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    Ok((
        StatusCode::CREATED,
        save(&s.pool, &u, p, Some(g), None).await?,
    ))
}
async fn update_item(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    NumericPath((g, c)): NumericPath<(i64, i64)>,
    Body(p): Body<Payload<false, true>>,
) -> Reply {
    save(&s.pool, &u, p, Some(g), Some(c)).await
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/codes/groups/by-code/{groupCode}/active",
            get(active),
        )
        .route("/api/v1/codes/groups", get(groups).post(create_group))
        .route(
            "/api/v1/codes/groups/{groupId}",
            put(update_group).delete(delete_group),
        )
        .route(
            "/api/v1/codes/groups/{groupId}/items",
            get(items).post(create_item),
        )
        .route(
            "/api/v1/codes/groups/{groupId}/items/{codeId}",
            put(update_item).delete(delete_item),
        )
}
