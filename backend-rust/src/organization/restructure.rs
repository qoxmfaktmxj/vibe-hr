use super::directory::{creates_cycle, old_parent, patch_fields};
use super::*;
use crate::input::{Body, Validate, Violation, not_blank, size};
use serde::Deserialize;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/restructure/plans", get(plans).post(create_plan))
        .route(
            "/restructure/plans/{plan_id}",
            axum::routing::put(update_plan).delete(delete_plan),
        )
        .route("/restructure/plans/{plan_id}/apply", post(apply_plan))
        .route(
            "/restructure/plans/{plan_id}/items",
            get(items).post(create_item),
        )
        .route(
            "/restructure/plans/{plan_id}/items/{item_id}",
            axum::routing::put(update_item).delete(delete_item),
        )
}
macro_rules! plans { () => { "SELECT p.id,p.title,p.description,p.planned_date,p.status,p.applied_at,p.applied_by,p.created_by,p.created_at,p.updated_at,
 (SELECT count(*) FROM org_restructure_plan_items i WHERE i.plan_id=p.id) item_count FROM org_restructure_plans p" }; }
macro_rules! items { () => { "SELECT i.id,i.plan_id,i.action_type,i.target_dept_id,t.name target_dept_name,t.code target_dept_code,i.new_parent_id,p.name new_parent_name,
 i.new_name,i.new_code,i.new_organization_type,i.new_cost_center_code,i.sort_order,i.item_status,i.memo,i.applied_at,i.created_at,i.updated_at
 FROM org_restructure_plan_items i LEFT JOIN org_departments t ON t.id=i.target_dept_id LEFT JOIN org_departments p ON p.id=i.new_parent_id" }; }
const ACTIONS: &[&str] = &["move", "rename", "create", "deactivate", "reactivate"];
const PATTERN: &str = "must match \"^(move|rename|create|deactivate|reactivate)$\"";
async fn plan_status(conn: &mut PgConnection, id: i32, lock: bool) -> Result<String, ApiError> {
    let sql = if lock {
        "SELECT status FROM org_restructure_plans WHERE id=$1 FOR UPDATE"
    } else {
        "SELECT status FROM org_restructure_plans WHERE id=$1"
    };
    sqlx::query_scalar(sql)
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| missing("조직개편안을 찾을 수 없습니다."))
}
async fn editable(conn: &mut PgConnection, id: i32) -> Result<(), ApiError> {
    if matches!(
        plan_status(conn, id, true).await?.as_str(),
        "applied" | "cancelled"
    ) {
        return Err(conflict(
            "적용됐거나 취소된 개편안에는 항목을 추가/수정할 수 없습니다.",
        ));
    }
    Ok(())
}
async fn plan_row(conn: &mut PgConnection, id: i32) -> Result<Value, ApiError> {
    let sql = concat!("SELECT to_jsonb(r) FROM (", plans!(), " WHERE p.id=$1) r");
    Ok(timestamps(
        sqlx::query_scalar(sql).bind(id).fetch_one(conn).await?,
    ))
}
async fn item_row(conn: &mut PgConnection, id: i32) -> Result<Value, ApiError> {
    let sql = concat!("SELECT to_jsonb(r) FROM (", items!(), " WHERE i.id=$1) r");
    Ok(timestamps(
        sqlx::query_scalar(sql).bind(id).fetch_one(conn).await?,
    ))
}
async fn plans(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Params>,
) -> Reply {
    privileged(&u)?;
    let sql = concat!(
        "SELECT to_jsonb(r) FROM (",
        plans!(),
        " WHERE ($1::text IS NULL OR p.status=$1) ORDER BY p.created_at DESC) r"
    );
    let rows = sqlx::query_scalar(sql)
        .bind(q.get("status"))
        .fetch_all(&s.pool)
        .await?;
    let rows: Vec<_> = rows.into_iter().map(timestamps).collect();
    Ok(Json(json!({"items":rows,"total_count":rows.len()})))
}
#[derive(Default, Deserialize)]
struct PlanData {
    title: Option<String>,
    description: Option<String>,
    planned_date: Option<NaiveDate>,
    status: Option<String>,
}
impl Validate for PlanData {
    fn validate(&self) -> Vec<Violation> {
        [
            size("title", self.title.as_deref(), 0, 200),
            size("description", self.description.as_deref(), 0, 1000),
        ]
        .into_iter()
        .flatten()
        .collect()
    }
}
async fn create_plan(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(v): Body<PlanData>,
) -> Reply {
    if let Some(error) = not_blank("title", v.title.as_deref()) {
        return Err(ApiError::validation(vec![error]));
    }
    privileged(&u)?;
    let mut tx = s.pool.begin().await?;
    let id=sqlx::query_scalar("INSERT INTO org_restructure_plans(title,description,planned_date,status,created_by,created_at,updated_at) VALUES($1,$2,$3,'draft',$4,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC') RETURNING id")
        .bind(required(v.title.as_deref().unwrap_or_default())?).bind(v.description).bind(v.planned_date).bind(u.id).fetch_one(&mut *tx).await.map_err(|e|conflict_on_constraint(e,"Restructure plan conflict."))?;
    let plan = plan_row(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(plan))
}
async fn update_plan(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i64>,
    Body(v): Body<PlanData>,
) -> Reply {
    patch_fields(&[("title", &v.title, 200)])?;
    privileged(&u)?;
    let id = checked_id(id, "plan_id")?;
    let mut tx = s.pool.begin().await?;
    if matches!(
        plan_status(&mut tx, id, true).await?.as_str(),
        "applied" | "cancelled"
    ) {
        return Err(conflict(
            "이미 적용됐거나 취소된 개편안은 수정할 수 없습니다.",
        ));
    }
    let title = v.title.as_deref().map(required).transpose()?;
    if let Some(status) = v.status.as_deref()
        && !matches!(status, "draft" | "reviewing" | "cancelled")
    {
        return Err(bad(
            "상태는 draft/reviewing/cancelled만 직접 변경 가능합니다.",
        ));
    }
    sqlx::query("UPDATE org_restructure_plans SET title=coalesce($2,title),description=coalesce($3,description),planned_date=coalesce($4,planned_date),status=coalesce($5,status),updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
        .bind(id).bind(title).bind(v.description).bind(v.planned_date).bind(v.status).execute(&mut *tx).await.map_err(|e|conflict_on_constraint(e,"Restructure plan conflict."))?;
    let plan = plan_row(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(plan))
}
async fn delete_plan(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    privileged(&u)?;
    let id = checked_id(id, "plan_id")?;
    let mut tx = s.pool.begin().await?;
    if plan_status(&mut tx, id, true).await? == "applied" {
        return Err(conflict("이미 적용된 개편안은 삭제할 수 없습니다."));
    }
    sqlx::query("DELETE FROM org_restructure_plan_items WHERE plan_id=$1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM org_restructure_plans WHERE id=$1")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| conflict_on_constraint(e, "Restructure plan conflict."))?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn items(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i64>,
) -> Reply {
    privileged(&u)?;
    let id = checked_id(id, "plan_id")?;
    let mut tx = s.pool.begin().await?;
    plan_status(&mut tx, id, false).await?;
    let sql = concat!(
        "SELECT to_jsonb(r) FROM (",
        items!(),
        " WHERE i.plan_id=$1 ORDER BY i.sort_order,i.id) r"
    );
    let rows = sqlx::query_scalar(sql).bind(id).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    let rows: Vec<_> = rows.into_iter().map(timestamps).collect();
    Ok(Json(json!({"items":rows,"total_count":rows.len()})))
}
#[derive(Default, Deserialize)]
struct PlanItemData {
    action_type: Option<String>,
    target_dept_id: Option<i64>,
    new_parent_id: Option<i64>,
    new_name: Option<String>,
    new_code: Option<String>,
    new_organization_type: Option<String>,
    new_cost_center_code: Option<String>,
    sort_order: Option<i32>,
    memo: Option<String>,
}
impl Validate for PlanItemData {
    fn validate(&self) -> Vec<Violation> {
        let mut errors: Vec<_> = [
            ("new_name", &self.new_name, 100),
            ("new_code", &self.new_code, 30),
            ("new_organization_type", &self.new_organization_type, 50),
            ("new_cost_center_code", &self.new_cost_center_code, 30),
            ("memo", &self.memo, 500),
        ]
        .into_iter()
        .filter_map(|(k, v, m)| size(k, v.as_deref(), 0, m))
        .collect();
        if let Some(t) = self.action_type.as_deref()
            && !ACTIONS.contains(&t)
        {
            errors.push(Violation::field(
                "pattern",
                "action_type",
                PATTERN.into(),
                json!(t),
            ));
        }
        errors
    }
}
async fn create_item(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i64>,
    Body(v): Body<PlanItemData>,
) -> Reply {
    if let Some(error) = not_blank("action_type", v.action_type.as_deref()) {
        return Err(ApiError::validation(vec![error]));
    }
    privileged(&u)?;
    let id = checked_id(id, "plan_id")?;
    let mut tx = s.pool.begin().await?;
    editable(&mut tx, id).await?;
    let action = v.action_type.as_deref().unwrap_or_default();
    let target = v
        .target_dept_id
        .map(|v| checked_id(v, "target_dept_id"))
        .transpose()?;
    let parent = v
        .new_parent_id
        .map(|v| checked_id(v, "new_parent_id"))
        .transpose()?;
    if action != "create" {
        let target =
            target.ok_or_else(|| bad(&format!("{action} 액션은 target_dept_id가 필요합니다.")))?;
        if !sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT FROM org_departments WHERE id=$1)")
            .bind(target)
            .fetch_one(&mut *tx)
            .await?
        {
            return Err(missing("대상 부서를 찾을 수 없습니다."));
        }
    }
    if action == "move" && parent.is_none() {
        return Err(bad("move 액션은 new_parent_id가 필요합니다."));
    }
    if matches!(action, "rename" | "create") && v.new_name.as_deref().and_then(nullable).is_none() {
        return Err(bad(&format!("{action} 액션은 new_name이 필요합니다.")));
    }
    let item=sqlx::query_scalar("INSERT INTO org_restructure_plan_items (plan_id,action_type,target_dept_id,new_parent_id,new_name,new_code,new_organization_type,new_cost_center_code,sort_order,item_status,memo,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC') RETURNING id")
       .bind(id).bind(action).bind(target).bind(parent).bind(v.new_name).bind(v.new_code).bind(v.new_organization_type).bind(v.new_cost_center_code).bind(v.sort_order.unwrap_or_default()).bind(v.memo)
       .fetch_one(&mut *tx).await.map_err(|e|conflict_on_constraint(e,"Restructure plan item conflict."))?;
    let result = item_row(&mut tx, item).await?;
    tx.commit().await?;
    Ok(Json(result))
}
async fn locked_item(conn: &mut PgConnection, plan: i32, item: i32) -> Result<String, ApiError> {
    sqlx::query_scalar(
        "SELECT item_status FROM org_restructure_plan_items WHERE id=$1 AND plan_id=$2 FOR UPDATE",
    )
    .bind(item)
    .bind(plan)
    .fetch_optional(conn)
    .await?
    .ok_or_else(|| missing("항목을 찾을 수 없습니다."))
}
async fn update_item(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path((plan, item)): Path<(i64, i64)>,
    Body(v): Body<PlanItemData>,
) -> Reply {
    privileged(&u)?;
    let plan = checked_id(plan, "plan_id")?;
    let item = checked_id(item, "item_id")?;
    let mut tx = s.pool.begin().await?;
    editable(&mut tx, plan).await?;
    if locked_item(&mut tx, plan, item).await? == "applied" {
        return Err(conflict("이미 적용된 항목은 수정할 수 없습니다."));
    }
    sqlx::query("UPDATE org_restructure_plan_items SET action_type=coalesce($2,action_type),target_dept_id=coalesce($3,target_dept_id),new_parent_id=coalesce($4,new_parent_id),new_name=coalesce($5,new_name),new_code=coalesce($6,new_code),
      new_organization_type=coalesce($7,new_organization_type),new_cost_center_code=coalesce($8,new_cost_center_code),sort_order=coalesce($9,sort_order),memo=coalesce($10,memo),updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
      .bind(item).bind(v.action_type).bind(v.target_dept_id.map(|n|checked_id(n,"target_dept_id")).transpose()?).bind(v.new_parent_id.map(|n|checked_id(n,"new_parent_id")).transpose()?)
      .bind(v.new_name).bind(v.new_code).bind(v.new_organization_type).bind(v.new_cost_center_code).bind(v.sort_order).bind(v.memo)
      .execute(&mut *tx).await.map_err(|e|conflict_on_constraint(e,"Restructure plan item conflict."))?;
    let result = item_row(&mut tx, item).await?;
    tx.commit().await?;
    Ok(Json(result))
}
async fn delete_item(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path((plan, item)): Path<(i64, i64)>,
) -> Result<StatusCode, ApiError> {
    privileged(&u)?;
    let plan = checked_id(plan, "plan_id")?;
    let item = checked_id(item, "item_id")?;
    let mut tx = s.pool.begin().await?;
    editable(&mut tx, plan).await?;
    locked_item(&mut tx, plan, item).await?;
    sqlx::query("DELETE FROM org_restructure_plan_items WHERE id=$1")
        .bind(item)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}
#[derive(sqlx::FromRow)]
struct Change {
    id: i32,
    action_type: String,
    target_dept_id: Option<i32>,
    new_parent_id: Option<i32>,
    new_name: Option<String>,
    new_code: Option<String>,
    new_organization_type: Option<String>,
    new_cost_center_code: Option<String>,
}
enum ApplyFailure {
    Skip(String),
    Abort(ApiError),
}
impl From<sqlx::Error> for ApplyFailure {
    fn from(e: sqlx::Error) -> Self {
        Self::Abort(conflict_on_constraint(e, "Restructure apply conflict."))
    }
}
impl From<ApiError> for ApplyFailure {
    fn from(e: ApiError) -> Self {
        Self::Abort(e)
    }
}
async fn target(
    conn: &mut PgConnection,
    id: Option<i32>,
) -> Result<(i32, String, String, Option<i32>), ApplyFailure> {
    let id = id.ok_or_else(|| ApplyFailure::Skip("부서 ID가 없습니다.".into()))?;
    sqlx::query_as("SELECT id,code,name,parent_id FROM org_departments WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| ApplyFailure::Skip(format!("부서 id={id}를 찾을 수 없습니다.")))
}
async fn apply_one(
    conn: &mut PgConnection,
    plan: i32,
    user: i32,
    v: &Change,
    now: NaiveDateTime,
) -> Result<Option<String>, ApplyFailure> {
    let why = format!("조직개편 plan_id={plan}");
    let reason = Some(why.as_str());
    let name = || {
        v.new_name
            .as_deref()
            .and_then(nullable)
            .ok_or_else(|| ApplyFailure::Skip("A required value is blank.".into()))
    };
    match v.action_type.as_str() {
        "create" => {
            let code = v
                .new_code
                .as_deref()
                .and_then(nullable)
                .ok_or_else(|| ApplyFailure::Skip("create 액션에 new_code가 없습니다.".into()))?
                .to_uppercase();
            if sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT FROM org_departments WHERE code=$1)",
            )
            .bind(&code)
            .fetch_one(&mut *conn)
            .await?
            {
                return Err(ApplyFailure::Skip(format!(
                    "코드 '{code}'가 이미 존재합니다."
                )));
            }
            let name = name()?;
            let id=sqlx::query_scalar("INSERT INTO org_departments(code,name,parent_id,organization_type,cost_center_code,is_active,created_at,updated_at) VALUES($1,$2,$3,$4,$5,true,$6,$6) RETURNING id")
                .bind(&code).bind(name).bind(v.new_parent_id).bind(&v.new_organization_type).bind(&v.new_cost_center_code).bind(now).fetch_one(&mut *conn).await?;
            record_change(conn, id, user, "created", None, Some(&code), reason).await?;
            Ok(Some(format!("[CREATE] {name} ({code})")))
        }
        "move" => {
            let (id, _, name, old) = target(&mut *conn, v.target_dept_id).await?;
            let (parent, _, _, _) = target(&mut *conn, v.new_parent_id).await?;
            if id == parent {
                return Err(ApplyFailure::Skip(
                    "자기 자신을 상위 부서로 지정할 수 없습니다.".into(),
                ));
            }
            if creates_cycle(&mut *conn, id, Some(parent)).await? {
                return Err(ApplyFailure::Skip(
                    "순환 부서 구조를 만들 수 없습니다.".into(),
                ));
            }
            record_change(
                conn,
                id,
                user,
                "parent_id",
                Some(&old_parent(old)),
                Some(&parent.to_string()),
                reason,
            )
            .await?;
            sqlx::query("UPDATE org_departments SET parent_id=$2,updated_at=$3 WHERE id=$1")
                .bind(id)
                .bind(parent)
                .bind(now)
                .execute(&mut *conn)
                .await?;
            Ok(Some(format!("[MOVE] {name} → 상위부서 변경")))
        }
        "rename" => {
            let (id, old_code, old_name, _) = target(&mut *conn, v.target_dept_id).await?;
            let new_name = name()?;
            let new_code = v
                .new_code
                .as_deref()
                .and_then(nullable)
                .map(str::to_uppercase);
            if let Some(code) = new_code.as_deref() {
                record_change(conn, id, user, "code", Some(&old_code), Some(code), reason).await?;
            }
            record_change(
                conn,
                id,
                user,
                "name",
                Some(&old_name),
                Some(new_name),
                reason,
            )
            .await?;
            sqlx::query("UPDATE org_departments SET name=$2,code=coalesce($3,code),updated_at=$4 WHERE id=$1").bind(id).bind(new_name).bind(new_code).bind(now).execute(&mut *conn).await?;
            Ok(Some(format!("[RENAME] {old_name} → {new_name}")))
        }
        "deactivate" | "reactivate" => {
            let (id, _, name, _) = target(&mut *conn, v.target_dept_id).await?;
            let active = v.action_type == "reactivate";
            record_change(
                conn,
                id,
                user,
                "is_active",
                Some(super::directory::old_bool(!active)),
                Some(super::directory::old_bool(active)),
                reason,
            )
            .await?;
            sqlx::query("UPDATE org_departments SET is_active=$2,updated_at=$3 WHERE id=$1")
                .bind(id)
                .bind(active)
                .bind(now)
                .execute(&mut *conn)
                .await?;
            Ok(Some(format!("[{}] {name}", v.action_type.to_uppercase())))
        }
        _ => Ok(None),
    }
}
async fn apply_plan(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(plan): Path<i64>,
) -> Reply {
    privileged(&u)?;
    let plan = checked_id(plan, "plan_id")?;
    let mut tx = s.pool.begin().await?;
    match plan_status(&mut tx, plan, true).await?.as_str() {
        "applied" => return Err(conflict("이미 적용된 개편안입니다.")),
        "cancelled" => return Err(conflict("취소된 개편안은 적용할 수 없습니다.")),
        _ => (),
    }
    let changes:Vec<Change>=sqlx::query_as("SELECT id,action_type,target_dept_id,new_parent_id,new_name,new_code,new_organization_type,new_cost_center_code FROM org_restructure_plan_items WHERE plan_id=$1 AND item_status='pending' ORDER BY sort_order,id FOR UPDATE").bind(plan).fetch_all(&mut *tx).await?;
    let now = chrono::Utc::now().naive_utc();
    let mut messages = Vec::new();
    let mut applied = 0;
    let mut skipped = 0;
    for change in changes {
        let mut stamp = None;
        let status = match apply_one(&mut tx, plan, u.id, &change, now).await {
            Ok(message) => {
                messages.extend(message);
                applied += 1;
                stamp = Some(now);
                "applied"
            }
            Err(ApplyFailure::Skip(message)) => {
                skipped += 1;
                messages.push(format!(
                    "[SKIP] {} id={}: {message}",
                    change.action_type, change.id
                ));
                "skipped"
            }
            Err(ApplyFailure::Abort(error)) => return Err(error),
        };
        sqlx::query("UPDATE org_restructure_plan_items SET item_status=$2,applied_at=coalesce($3,applied_at) WHERE id=$1").bind(change.id).bind(status).bind(stamp).execute(&mut *tx).await?;
    }
    sqlx::query("UPDATE org_restructure_plans SET status='applied',applied_at=$2,applied_by=$3,updated_at=$2 WHERE id=$1").bind(plan).bind(now).bind(u.id).execute(&mut *tx).await.map_err(|e|conflict_on_constraint(e,"Restructure apply conflict."))?;
    tx.commit().await?;
    Ok(Json(
        json!({"plan_id":plan,"applied_count":applied,"skipped_count":skipped,"messages":messages}),
    ))
}
