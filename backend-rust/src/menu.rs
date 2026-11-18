mod admin;
use axum::{
    Extension, Json, Router,
    extract::{Query, State},
    http::StatusCode,
    routing::get,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::PgPool;
use std::collections::{BTreeMap, HashMap};

use crate::{ApiError, AppState, security::CurrentUser};

const ACTIONS: [&str; 7] = [
    "query",
    "create",
    "copy",
    "template_download",
    "upload",
    "save",
    "download",
];

#[derive(Default, Deserialize)]
pub struct MenuFilter {
    #[serde(rename = "menuCode")]
    pub code: Option<String>,
    pub path: Option<String>,
}

#[derive(Serialize)]
struct Action {
    action_code: &'static str,
    allowed: bool,
}

async fn actions(
    pool: &PgPool,
    user_id: i32,
    code: Option<&str>,
    path: Option<&str>,
) -> Result<Vec<Action>, ApiError> {
    let mut tx = pool.begin().await?;
    let menu: Option<i32> = if let Some(code) = code.filter(|s| !s.is_empty()) {
        sqlx::query_scalar("SELECT id FROM app_menus WHERE is_active AND code=$1")
            .bind(code)
            .fetch_optional(&mut *tx)
            .await?
    } else if let Some(path) = path.filter(|s| !s.is_empty()) {
        sqlx::query_scalar("SELECT id FROM app_menus WHERE is_active AND path=$1")
            .bind(path)
            .fetch_optional(&mut *tx)
            .await?
    } else {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "menu_code or path is required.",
        ));
    };
    let menu = menu.ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Menu not found."))?;
    let access: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM app_menu_roles mr JOIN auth_user_roles ur USING(role_id)
         WHERE mr.menu_id=$1 AND ur.user_id=$2)",
    )
    .bind(menu)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;
    if !access {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Access denied."));
    }
    let rows: Vec<(String,bool)> = sqlx::query_as(
        "SELECT a.action_code, COALESCE((
           SELECT bool_or(o.allowed) FROM app_role_menu_actions o JOIN auth_user_roles ur USING(role_id)
           WHERE o.menu_id=a.menu_id AND o.action_code=a.action_code AND ur.user_id=$2
         ),a.enabled_default) FROM app_menu_actions a WHERE a.menu_id=$1",
    ).bind(menu).bind(user_id).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    let configured: HashMap<_, _> = rows.into_iter().collect();
    Ok(ACTIONS
        .into_iter()
        .map(|action_code| Action {
            action_code,
            allowed: configured
                .get(action_code)
                .copied()
                .unwrap_or(configured.is_empty()),
        })
        .collect())
}

pub async fn require_action(
    pool: &PgPool,
    user_id: i32,
    code: Option<&str>,
    path: Option<&str>,
    action: &str,
) -> Result<(), ApiError> {
    if actions(pool, user_id, code, path)
        .await?
        .iter()
        .any(|item| item.action_code == action && item.allowed)
    {
        Ok(())
    } else {
        Err(ApiError::new(StatusCode::FORBIDDEN, "Action not allowed."))
    }
}

async fn current(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Query(query): Query<MenuFilter>,
) -> Result<Json<Value>, ApiError> {
    let items = actions(
        &state.pool,
        user.id,
        query.code.as_deref(),
        query.path.as_deref(),
    )
    .await?;
    let allowed: Vec<_> = items
        .iter()
        .filter(|a| a.allowed)
        .map(|a| a.action_code)
        .collect();
    Ok(Json(
        json!({"menu_code":query.code.unwrap_or_default(),"path":query.path,"allowed_actions":allowed,"actions":items}),
    ))
}

#[derive(sqlx::FromRow)]
struct MenuRow {
    id: i32,
    parent_id: Option<i32>,
    item: Value,
}

fn tree(rows: Vec<MenuRow>) -> Vec<Value> {
    fn children(
        parent: Option<i32>,
        groups: &mut BTreeMap<Option<i32>, Vec<MenuRow>>,
    ) -> Vec<Value> {
        groups
            .remove(&parent)
            .unwrap_or_default()
            .into_iter()
            .map(|mut row| {
                row.item["children"] = Value::Array(children(Some(row.id), groups));
                row.item
            })
            .collect()
    }
    let mut groups = BTreeMap::new();
    for row in rows {
        groups
            .entry(row.parent_id)
            .or_insert_with(Vec::new)
            .push(row);
    }
    children(None, &mut groups)
}

async fn visible_tree(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
) -> Result<Json<Value>, ApiError> {
    let rows = sqlx::query_as(
        "WITH RECURSIVE visible AS (
           SELECT m.id,m.parent_id FROM app_menus m JOIN app_menu_roles mr ON mr.menu_id=m.id JOIN auth_user_roles ur USING(role_id)
           WHERE ur.user_id=$1 AND m.is_active
           UNION SELECT p.id,p.parent_id FROM app_menus p JOIN visible v ON v.parent_id=p.id WHERE p.is_active
         ) SELECT m.id,m.parent_id,jsonb_build_object('id',m.id,'code',m.code,'name',m.name,'path',m.path,
           'icon',m.icon,'sort_order',m.sort_order) AS item FROM app_menus m JOIN visible v ON m.id=v.id ORDER BY m.sort_order,m.id",
    ).bind(user.id).fetch_all(&state.pool).await?;
    Ok(Json(json!({"menus":tree(rows)})))
}

async fn admin_tree(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
) -> Result<Json<Value>, ApiError> {
    user.require_admin()?;
    let rows = sqlx::query_as(
        "SELECT id,parent_id,to_jsonb(m) AS item FROM app_menus m ORDER BY sort_order,id",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(json!({"menus":tree(rows)})))
}

async fn roles(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
) -> Result<Json<Value>, ApiError> {
    user.require_admin()?;
    let roles: Vec<Value> = sqlx::query_scalar(
        "SELECT jsonb_build_object('id',id,'name',name,'code',code) FROM auth_roles ORDER BY id",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(json!({"roles":roles})))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .merge(admin::routes())
        .route("/api/v1/menus/tree", get(visible_tree))
        .route("/api/v1/menus/actions/current", get(current))
        .route("/api/v1/menus/admin/tree", get(admin_tree))
        .route("/api/v1/menus/admin/roles", get(roles))
}
