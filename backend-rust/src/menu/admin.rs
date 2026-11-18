use super::{ACTIONS, MenuRow, tree};
use crate::input::params::NumericPath as Path;
use crate::{
    ApiError, AppState,
    input::{Body, Validate, Violation, not_blank, size},
    security::CurrentUser,
};
use axum::{
    Extension, Json, Router,
    extract::State,
    http::StatusCode,
    routing::{get, post, put},
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::PgConnection;
use std::collections::{HashMap, HashSet};

type Reply = Result<Json<Value>, ApiError>;
fn error(status: StatusCode, msg: &str) -> ApiError {
    ApiError::new(status, msg)
}
fn int(value: i64, name: &str) -> Result<i32, ApiError> {
    i32::try_from(value).map_err(|_| {
        ApiError::new(
            StatusCode::BAD_REQUEST,
            format!("{name} is outside the supported INTEGER range."),
        )
    })
}
async fn exists(conn: &mut PgConnection, id: i32, role: bool) -> Result<bool, ApiError> {
    let sql = if role {
        "SELECT EXISTS(SELECT 1 FROM auth_roles WHERE id=$1)"
    } else {
        "SELECT EXISTS(SELECT 1 FROM app_menus WHERE id=$1)"
    };
    Ok(sqlx::query_scalar(sql).bind(id).fetch_one(conn).await?)
}
async fn required(conn: &mut PgConnection, id: i32, role: bool) -> Result<(), ApiError> {
    if exists(conn, id, role).await? {
        Ok(())
    } else {
        Err(error(
            StatusCode::NOT_FOUND,
            if role {
                "역할을 찾을 수 없습니다."
            } else {
                "메뉴를 찾을 수 없습니다."
            },
        ))
    }
}
async fn validate_parent(
    conn: &mut PgConnection,
    parent: Option<i32>,
    target: Option<i32>,
) -> Result<(), ApiError> {
    if let Some(parent) = parent {
        if Some(parent) == target {
            return Err(error(
                StatusCode::BAD_REQUEST,
                "자기 자신을 부모로 지정할 수 없습니다.",
            ));
        }
        if !exists(conn, parent, false).await? {
            return Err(error(
                StatusCode::BAD_REQUEST,
                "유효하지 않은 부모 메뉴입니다.",
            ));
        }
    }
    Ok(())
}
#[derive(Deserialize)]
struct Menu<const NEW: bool> {
    code: Option<String>,
    name: Option<String>,
    parent_id: Option<i64>,
    path: Option<String>,
    icon: Option<String>,
    sort_order: Option<i32>,
    is_active: Option<bool>,
}
impl<const NEW: bool> Validate for Menu<NEW> {
    fn validate(&self) -> Vec<Violation> {
        let mut violations: Vec<_> = [
            size("name", self.name.as_deref(), usize::from(!NEW), 100),
            size("path", self.path.as_deref(), 0, 200),
            size("icon", self.icon.as_deref(), 0, 60),
        ]
        .into_iter()
        .flatten()
        .collect();
        if NEW {
            violations.extend(not_blank("code", self.code.as_deref()));
            violations.extend(not_blank("name", self.name.as_deref()));
            violations.extend(size("code", self.code.as_deref(), 0, 60));
        }
        violations
    }
}
#[derive(Deserialize)]
struct NewMenu {
    sort_order: i32,
    #[serde(flatten)]
    menu: Menu<true>,
}
impl Validate for NewMenu {
    fn validate(&self) -> Vec<Violation> {
        self.menu.validate()
    }
}
async fn create_menu(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Body(NewMenu {
        sort_order,
        menu: p,
    }): Body<NewMenu>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    user.require_admin()?;
    let mut tx = s.pool.begin().await?;
    let code = p.code.as_deref().unwrap_or_default().trim();
    let duplicate: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM app_menus WHERE code=$1)")
            .bind(code)
            .fetch_one(&mut *tx)
            .await?;
    if duplicate {
        return Err(error(
            StatusCode::CONFLICT,
            "이미 존재하는 메뉴 코드입니다.",
        ));
    }
    let parent = p.parent_id.map(|p| int(p, "parent_id")).transpose()?;
    validate_parent(&mut tx, parent, None).await?;
    let row:Value=sqlx::query_scalar("INSERT INTO app_menus AS m(code,name,parent_id,path,icon,sort_order,is_active,created_at,updated_at)
        VALUES($1,$2,$3,nullif($4,''),nullif($5,''),$6,$7,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC') RETURNING to_jsonb(m)||jsonb_build_object('children','[]'::jsonb)")
        .bind(code).bind(p.name.as_deref().unwrap_or_default().trim()).bind(parent).bind(p.path).bind(p.icon).bind(sort_order).bind(p.is_active.unwrap_or(true)).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({"menu":row}))))
}
async fn update_menu(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<i64>,
    Body(p): Body<Menu<false>>,
) -> Reply {
    user.require_admin()?;
    let id = int(id, "menu_id")?;
    let mut tx = s.pool.begin().await?;
    required(&mut tx, id, false).await?;
    let parent = p.parent_id.map(|p| int(p, "parent_id")).transpose()?;
    validate_parent(&mut tx, parent, Some(id)).await?;
    let row:Value=sqlx::query_scalar("UPDATE app_menus AS m SET name=coalesce($2,name),parent_id=$3,path=nullif(coalesce($4,path),''),icon=nullif(coalesce($5,icon),''),
       sort_order=coalesce($6,sort_order),is_active=coalesce($7,is_active),updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1 RETURNING to_jsonb(m)||jsonb_build_object('children','[]'::jsonb)")
        .bind(id).bind(p.name.as_deref().map(str::trim)).bind(parent).bind(p.path).bind(p.icon).bind(p.sort_order).bind(p.is_active).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"menu":row})))
}
async fn remove_menu(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    user.require_admin()?;
    let id = int(id, "menu_id")?;
    let mut tx = s.pool.begin().await?;
    required(&mut tx, id, false).await?;
    let children: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM app_menus WHERE parent_id=$1)")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;
    if children {
        return Err(error(
            StatusCode::CONFLICT,
            "하위 메뉴가 있어 삭제할 수 없습니다. 하위 메뉴를 먼저 정리해 주세요.",
        ));
    }
    sqlx::query("DELETE FROM app_menu_roles WHERE menu_id=$1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM app_menus WHERE id=$1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct Role<const NEW: bool> {
    code: Option<String>,
    name: Option<String>,
}
impl<const NEW: bool> Validate for Role<NEW> {
    fn validate(&self) -> Vec<Violation> {
        let mut v: Vec<_> = [
            not_blank("name", self.name.as_deref()),
            size("name", self.name.as_deref(), 0, 60),
        ]
        .into_iter()
        .flatten()
        .collect();
        if NEW {
            v.extend(not_blank("code", self.code.as_deref()));
            v.extend(size("code", self.code.as_deref(), 0, 40));
        }
        v
    }
}
async fn create_role(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Body(p): Body<Role<true>>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    user.require_admin()?;
    let mut tx = s.pool.begin().await?;
    let code = p.code.as_deref().unwrap_or_default().trim();
    let duplicate: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM auth_roles WHERE code=$1)")
            .bind(code)
            .fetch_one(&mut *tx)
            .await?;
    if duplicate {
        return Err(error(
            StatusCode::CONFLICT,
            "이미 존재하는 역할 코드입니다.",
        ));
    }
    let row:Value=sqlx::query_scalar("INSERT INTO auth_roles AS r(code,name,created_at) VALUES ($1,$2,statement_timestamp() AT TIME ZONE 'UTC') RETURNING to_jsonb(r)-'created_at'")
        .bind(code).bind(p.name.as_deref().unwrap_or_default().trim()).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({"role":row}))))
}
async fn update_role(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<i64>,
    Body(p): Body<Role<false>>,
) -> Reply {
    user.require_admin()?;
    let row: Value = sqlx::query_scalar(
        "UPDATE auth_roles AS r SET name=$2 WHERE id=$1 RETURNING to_jsonb(r)-'created_at'",
    )
    .bind(int(id, "role_id")?)
    .bind(p.name.as_deref().unwrap_or_default().trim())
    .fetch_optional(&s.pool)
    .await?
    .ok_or_else(|| error(StatusCode::NOT_FOUND, "역할을 찾을 수 없습니다."))?;
    Ok(Json(json!({"role":row})))
}
async fn remove_role(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    user.require_admin()?;
    let id = int(id, "role_id")?;
    let mut tx = s.pool.begin().await?;
    required(&mut tx, id, true).await?;
    let assigned: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM auth_user_roles WHERE role_id=$1)")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;
    if assigned {
        return Err(error(
            StatusCode::CONFLICT,
            "사용자에 연결된 역할은 삭제할 수 없습니다.",
        ));
    }
    sqlx::query("DELETE FROM app_menu_roles WHERE role_id=$1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM auth_roles WHERE id=$1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct Links {
    role_ids: Option<Vec<i64>>,
    menu_ids: Option<Vec<i64>>,
}
async fn lock_replacement(conn: &mut PgConnection, actions: bool) -> Result<(), ApiError> {
    // A replace may target one role, one menu, a matrix or the entire action table.
    // Lock before the delete/insert pair so concurrent replacements of even an empty
    // selection have one serial outcome. Normal permission reads remain available.
    let sql = if actions {
        "LOCK TABLE app_role_menu_actions IN SHARE ROW EXCLUSIVE MODE"
    } else {
        "LOCK TABLE app_menu_roles IN SHARE ROW EXCLUSIVE MODE"
    };
    sqlx::query(sql).execute(conn).await?;
    Ok(())
}
impl Validate for Links {
    fn validate(&self) -> Vec<Violation> {
        vec![]
    }
}
async fn read_links(conn: &mut PgConnection, id: i32, role: bool) -> Result<Value, ApiError> {
    if role {
        let rows:Vec<MenuRow>=sqlx::query_as("WITH RECURSIVE ancestry AS (
           SELECT m.id,m.parent_id FROM app_menus m JOIN app_menu_roles l ON l.menu_id=m.id WHERE l.role_id=$1
           UNION SELECT p.id,p.parent_id FROM app_menus p JOIN ancestry c ON c.parent_id=p.id)
           SELECT m.id,m.parent_id,to_jsonb(m) AS item FROM app_menus m JOIN ancestry a ON a.id=m.id ORDER BY m.sort_order,m.id")
            .bind(id).fetch_all(conn).await?;
        Ok(json!({"role_id":id,"menus":tree(rows)}))
    } else {
        let roles:Vec<Value>=sqlx::query_scalar("SELECT to_jsonb(r)-'created_at' FROM auth_roles r JOIN app_menu_roles l ON l.role_id=r.id WHERE l.menu_id=$1 ORDER BY r.id").bind(id).fetch_all(conn).await?;
        Ok(json!({"menu_id":id,"roles":roles}))
    }
}
async fn unknown(conn: &mut PgConnection, ids: &[i32], roles: bool) -> Result<Vec<i32>, ApiError> {
    let sql = if roles {
        "SELECT id FROM auth_roles WHERE id=ANY($1)"
    } else {
        "SELECT id FROM app_menus WHERE id=ANY($1)"
    };
    let valid: HashSet<i32> = sqlx::query_scalar(sql)
        .bind(ids)
        .fetch_all(conn)
        .await?
        .into_iter()
        .collect();
    Ok(ids.iter().filter(|i| !valid.contains(i)).copied().collect())
}
async fn links(
    s: AppState,
    user: CurrentUser,
    external: i64,
    role: bool,
    replacement: Option<Vec<i64>>,
) -> Reply {
    user.require_admin()?;
    let id = int(external, if role { "role_id" } else { "menu_id" })?;
    let mut tx = s.pool.begin().await?;
    required(&mut tx, id, role).await?;
    if let Some(ids) = replacement {
        lock_replacement(&mut tx, false).await?;
        let mut ids: Vec<i32> = ids
            .into_iter()
            .map(|v| int(v, if role { "menu_id" } else { "role_id" }))
            .collect::<Result<_, _>>()?;
        if role {
            ids.sort_unstable();
            ids.dedup();
        }
        let missing = unknown(&mut tx, &ids, !role).await?;
        if !missing.is_empty() {
            return Err(ApiError::new(
                StatusCode::BAD_REQUEST,
                format!(
                    "유효하지 않은 {}: {missing:?}",
                    if role { "menu_id" } else { "role_id" }
                ),
            ));
        }
        let del = if role {
            "DELETE FROM app_menu_roles WHERE role_id=$1"
        } else {
            "DELETE FROM app_menu_roles WHERE menu_id=$1"
        };
        let ins = if role {
            "INSERT INTO app_menu_roles(role_id,menu_id) SELECT $1,unnest($2::int[])"
        } else {
            "INSERT INTO app_menu_roles(menu_id,role_id) SELECT $1,unnest($2::int[])"
        };
        ids.sort_unstable();
        ids.dedup();
        sqlx::query(del).bind(id).execute(&mut *tx).await?;
        sqlx::query(ins)
            .bind(id)
            .bind(ids)
            .execute(&mut *tx)
            .await?;
    }
    let result = read_links(&mut tx, id, role).await?;
    tx.commit().await?;
    Ok(Json(result))
}

#[derive(Deserialize)]
struct Matrix<T> {
    mappings: Option<Vec<T>>,
}
impl<T> Validate for Matrix<T> {
    fn validate(&self) -> Vec<Violation> {
        vec![]
    }
}
#[derive(Deserialize)]
struct RoleMenus {
    role_id: i64,
    menu_ids: Vec<i64>,
}
#[derive(Deserialize)]
struct Grant {
    role_id: i64,
    menu_id: i64,
    action_code: String,
    allowed: bool,
}
async fn matrix(conn: &mut PgConnection, role_ids: &[i32]) -> Result<Vec<Value>, ApiError> {
    Ok(sqlx::query_scalar("SELECT jsonb_build_object('role_id',r.id,'menu_ids',ARRAY(SELECT mr.menu_id FROM app_menu_roles mr WHERE mr.role_id=r.id ORDER BY mr.menu_id)) FROM unnest($1::int[]) WITH ORDINALITY AS r(id,seq) ORDER BY r.seq").bind(role_ids).fetch_all(conn).await?)
}
async fn get_matrix(State(s): State<AppState>, Extension(u): Extension<CurrentUser>) -> Reply {
    u.require_admin()?;
    let mut tx = s.pool.begin().await?;
    let ids: Vec<i32> = sqlx::query_scalar("SELECT id FROM auth_roles ORDER BY id")
        .fetch_all(&mut *tx)
        .await?;
    let data = matrix(&mut tx, &ids).await?;
    tx.commit().await?;
    Ok(Json(json!({"mappings":data})))
}
async fn put_matrix(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(p): Body<Matrix<RoleMenus>>,
) -> Reply {
    u.require_admin()?;
    let mut tx = s.pool.begin().await?;
    lock_replacement(&mut tx, false).await?;
    let mut ids = Vec::new();
    let mut values: HashMap<i32, Vec<i32>> = HashMap::new();
    for group in p.mappings.unwrap_or_default() {
        let id = int(group.role_id, "role_id")?;
        let menus = group
            .menu_ids
            .into_iter()
            .map(|v| int(v, "menu_id"))
            .collect::<Result<_, _>>()?;
        if values.insert(id, menus).is_none() {
            ids.push(id);
        }
    }
    let missing = unknown(&mut tx, &ids, true).await?;
    if !missing.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            format!("Invalid role_id: {missing:?}"),
        ));
    }
    for id in &ids {
        let menus = values.get_mut(id).expect("role collected");
        let missing = unknown(&mut tx, menus, false).await?;
        if !missing.is_empty() {
            return Err(ApiError::new(
                StatusCode::BAD_REQUEST,
                format!("role_id={id}, invalid menu_id: {missing:?}"),
            ));
        }
        menus.sort_unstable();
        menus.dedup();
        sqlx::query("DELETE FROM app_menu_roles WHERE role_id=$1")
            .bind(id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("INSERT INTO app_menu_roles(role_id,menu_id) SELECT $1,unnest($2::int[])")
            .bind(id)
            .bind(&*menus)
            .execute(&mut *tx)
            .await?;
    }
    let data = matrix(&mut tx, &ids).await?;
    tx.commit().await?;
    Ok(Json(json!({"mappings":data})))
}
async fn grants(conn: &mut PgConnection, ids: Option<&[i32]>) -> Result<Vec<Value>, ApiError> {
    Ok(sqlx::query_scalar("SELECT jsonb_build_object('role_id',role_id,'menu_id',menu_id,'action_code',action_code,'allowed',allowed) FROM app_role_menu_actions WHERE ($1::int[] IS NULL OR role_id=ANY($1)) ORDER BY id").bind(ids).fetch_all(conn).await?)
}
async fn get_grants(State(s): State<AppState>, Extension(u): Extension<CurrentUser>) -> Reply {
    u.require_admin()?;
    let mut conn = s.pool.acquire().await?;
    Ok(Json(json!({"mappings":grants(&mut conn,None).await?})))
}
async fn put_grants(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(p): Body<Matrix<Grant>>,
) -> Reply {
    u.require_admin()?;
    let mut tx = s.pool.begin().await?;
    lock_replacement(&mut tx, true).await?;
    let mut ids = Vec::new();
    let mut menus = Vec::new();
    let mut invalid = Vec::new();
    let mut order = Vec::new();
    let mut values = HashMap::new();
    for grant in p.mappings.unwrap_or_default() {
        let role = int(grant.role_id, "role_id")?;
        let menu = int(grant.menu_id, "menu_id")?;
        ids.push(role);
        menus.push(menu);
        if !ACTIONS.contains(&grant.action_code.as_str()) {
            invalid.push(grant.action_code.clone());
        }
        let key = (role, menu, grant.action_code);
        if values.insert(key.clone(), grant.allowed).is_none() {
            order.push(key);
        }
    }
    ids.sort_unstable();
    ids.dedup();
    menus.sort_unstable();
    menus.dedup();
    invalid.sort();
    invalid.dedup();
    let missing = unknown(&mut tx, &ids, true).await?;
    if !missing.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            format!("유효하지 않은 role_id: {missing:?}"),
        ));
    }
    let missing = unknown(&mut tx, &menus, false).await?;
    if !missing.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            format!("Invalid menu_id: {missing:?}"),
        ));
    }
    if !invalid.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            format!("Invalid action_code: [{}]", invalid.join(", ")),
        ));
    }
    if ids.is_empty() {
        sqlx::query("DELETE FROM app_role_menu_actions")
            .execute(&mut *tx)
            .await?;
    } else {
        sqlx::query("DELETE FROM app_role_menu_actions WHERE role_id=ANY($1)")
            .bind(&ids)
            .execute(&mut *tx)
            .await?;
    }
    for key in order {
        sqlx::query("INSERT INTO app_role_menu_actions(role_id,menu_id,action_code,allowed,created_at,updated_at) VALUES($1,$2,$3,$4,transaction_timestamp() AT TIME ZONE 'UTC',transaction_timestamp() AT TIME ZONE 'UTC')")
            .bind(key.0).bind(key.1).bind(&key.2).bind(values[&key]).execute(&mut *tx).await?;
    }
    let data = grants(&mut tx, Some(&ids)).await?;
    tx.commit().await?;
    Ok(Json(json!({"mappings":data})))
}

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/menus/admin", post(create_menu))
        .route(
            "/api/v1/menus/admin/{menuId}",
            put(update_menu).delete(remove_menu),
        )
        .route("/api/v1/menus/admin/roles", post(create_role))
        .route(
            "/api/v1/menus/admin/roles/{roleId}",
            put(update_role).delete(remove_role),
        )
        .route(
            "/api/v1/menus/admin/roles/permissions",
            get(get_matrix).put(put_matrix),
        )
        .route(
            "/api/v1/menus/admin/roles/action-permissions",
            get(get_grants).put(put_grants),
        )
        .route(
            "/api/v1/menus/admin/roles/{roleId}/menus",
            get(|State(s), Extension(u), Path(id)| links(s, u, id, true, None)).put(
                |State(s), Extension(u), Path(id), Body(p): Body<Links>| {
                    links(s, u, id, true, Some(p.menu_ids.unwrap_or_default()))
                },
            ),
        )
        .route(
            "/api/v1/menus/admin/{menuId}/roles",
            get(|State(s), Extension(u), Path(id)| links(s, u, id, false, None)).put(
                |State(s), Extension(u), Path(id), Body(p): Body<Links>| {
                    links(s, u, id, false, Some(p.role_ids.unwrap_or_default()))
                },
            ),
        )
}
