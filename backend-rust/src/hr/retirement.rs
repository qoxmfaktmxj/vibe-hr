use super::{
    Reply,
    basic::instant_fields,
    employees::{int, lock_employee},
    forms::{ChecklistCreate, ChecklistUpdate, RetireCancel, RetireCaseCreate, RetireItemUpdate},
    hr_role, severance,
};
use crate::{
    ApiError, AppState,
    input::{Body, Violation},
    security::CurrentUser,
};
use axum::{
    Extension, Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post, put},
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::PgConnection;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/hr/retire/checklist",
            get(list_checks).post(new_check),
        )
        .route(
            "/api/v1/hr/retire/checklist/{checklist_item_id}",
            put(edit_check),
        )
        .route("/api/v1/hr/retire/cases", get(list_cases).post(create))
        .route("/api/v1/hr/retire/cases/{case_id}", get(detail))
        .route(
            "/api/v1/hr/retire/cases/{case_id}/items/{case_item_id}",
            put(edit),
        )
        .route("/api/v1/hr/retire/cases/{case_id}/confirm", post(confirm))
        .route("/api/v1/hr/retire/cases/{case_id}/cancel", post(cancel))
}
fn bad(msg: &str) -> ApiError {
    ApiError::new(StatusCode::BAD_REQUEST, msg)
}
fn missing(msg: &str) -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, msg)
}
fn conflict(msg: &str) -> ApiError {
    ApiError::new(StatusCode::CONFLICT, msg)
}

#[derive(Default, Deserialize)]
pub(super) struct Page {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub status: Option<String>,
    pub year: Option<String>,
    pub include_inactive: Option<bool>,
}
impl Page {
    pub(super) fn window(&self, method: &str) -> Result<(i32, i32, i64), ApiError> {
        let page = self.page.unwrap_or(1);
        let limit = self.limit.unwrap_or(50);
        if page < 1 || !(1..=200).contains(&limit) {
            let bound = if page > 0 && limit > 200 {
                "less than or equal to 200"
            } else {
                "greater than or equal to 1"
            };
            let key = if page < 1 { "page" } else { "limit" };
            return Err(ApiError::validation(vec![Violation {
                kind: "validation_error",
                loc: vec![json!("request")],
                input: Value::Null,
                msg: format!("{method}.{key}: must be {bound}"),
            }]));
        }
        Ok((page, limit, i64::from(page - 1) * i64::from(limit)))
    }
}
async fn list_checks(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Page>,
) -> Reply {
    let (page, limit, offset) = q.window("checklist")?;
    hr_role(&s.pool, &u).await?;
    let (total,mut rows):(i64,Value)=sqlx::query_as("WITH src AS (SELECT * FROM hr_retire_checklist_items WHERE is_active OR $1),
       paged AS (SELECT * FROM src ORDER BY sort_order,id LIMIT $2 OFFSET $3)
       SELECT (SELECT count(*) FROM src),coalesce(jsonb_agg(to_jsonb(paged) ORDER BY sort_order,id),'[]') FROM paged").bind(q.include_inactive.unwrap_or(false)).bind(limit).bind(offset).fetch_one(&s.pool).await?;
    for row in rows.as_array_mut().unwrap() {
        instant_fields(row, &["created_at", "updated_at"]);
    }
    Ok(Json(
        json!({"items":rows,"total_count":total,"page":page,"limit":limit}),
    ))
}

async fn save_check(
    conn: &mut PgConnection,
    id: Option<i32>,
    p: &Value,
) -> Result<Value, ApiError> {
    let title = p["title"].as_str().map(str::trim);
    let mut row: Value = if let Some(id) = id {
        let exists = sqlx::query_scalar::<_, i32>(
            "SELECT id FROM hr_retire_checklist_items WHERE id=$1 FOR UPDATE",
        )
        .bind(id)
        .fetch_optional(&mut *conn)
        .await?;
        if exists.is_none() {
            return Err(missing("Checklist item not found."));
        }
        if title == Some("") {
            return Err(bad("Checklist title is required."));
        }
        sqlx::query_scalar("UPDATE hr_retire_checklist_items i SET title=coalesce($2,title),description=coalesce($3->>'description',description),
            is_required=coalesce(($3->>'is_required')::boolean,is_required),is_active=coalesce(($3->>'is_active')::boolean,is_active),sort_order=coalesce(($3->>'sort_order')::int,sort_order),
            updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1 RETURNING to_jsonb(i)").bind(id).bind(title).bind(p).fetch_one(conn).await?
    } else {
        let code = p["code"].as_str().unwrap_or("").trim().to_lowercase();
        if code.is_empty() {
            return Err(bad("Checklist code is required."));
        }
        if title.is_none_or(str::is_empty) {
            return Err(bad("Checklist title is required."));
        }
        sqlx::query_scalar("INSERT INTO hr_retire_checklist_items AS i(code,title,description,is_required,is_active,sort_order,created_at,updated_at)
             VALUES($1,$2,$3->>'description',($3->>'is_required')::boolean,($3->>'is_active')::boolean,($3->>'sort_order')::int,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC')
             ON CONFLICT(code) DO NOTHING RETURNING to_jsonb(i)").bind(code).bind(title).bind(p).fetch_optional(conn).await?.ok_or_else(||conflict("Checklist code already exists."))?
    };
    instant_fields(&mut row, &["created_at", "updated_at"]);
    Ok(row)
}
async fn new_check(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(ChecklistCreate(p)): Body<ChecklistCreate>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let row = save_check(&mut tx, None, &p).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}
async fn edit_check(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
    Body(ChecklistUpdate(p)): Body<ChecklistUpdate>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let row = save_check(&mut tx, Some(id), &p).await?;
    tx.commit().await?;
    Ok(Json(row))
}
async fn list_cases(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Page>,
) -> Reply {
    let (page, limit, offset) = q.window("retireCases")?;
    hr_role(&s.pool, &u).await?;
    let (total,mut rows):(i64,Value)=sqlx::query_as("WITH src AS (
        SELECT c.id,c.employee_id,e.employee_no,u.display_name employee_name,d.name department_name,e.position_title,c.retire_date,c.reason,c.status,c.created_at,c.confirmed_at,c.cancelled_at
        FROM hr_retire_cases c JOIN hr_employees e ON e.id=c.employee_id JOIN auth_users u ON u.id=e.user_id JOIN org_departments d ON d.id=e.department_id WHERE ($1::text IS NULL OR c.status=$1)
        ), paged AS (SELECT * FROM src ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3)
        SELECT (SELECT count(*) FROM src),coalesce(jsonb_agg(to_jsonb(paged) ORDER BY created_at DESC,id DESC),'[]') FROM paged").bind(q.status.filter(|s|!s.trim().is_empty())).bind(limit).bind(offset).fetch_one(&s.pool).await?;
    for row in rows.as_array_mut().unwrap() {
        instant_fields(row, &["created_at", "confirmed_at", "cancelled_at"]);
    }
    Ok(Json(
        json!({"items":rows,"total_count":total,"page":page,"limit":limit}),
    ))
}
async fn case_detail(conn: &mut PgConnection, id: i32) -> Result<Value, ApiError> {
    let mut c:Value=sqlx::query_scalar("SELECT to_jsonb(c)||jsonb_build_object('employee_no',e.employee_no,'employee_name',u.display_name,'department_name',d.name,'position_title',e.position_title)
         FROM hr_retire_cases c JOIN hr_employees e ON e.id=c.employee_id JOIN auth_users u ON u.id=e.user_id JOIN org_departments d ON d.id=e.department_id WHERE c.id=$1")
        .bind(id).fetch_optional(&mut *conn).await?.ok_or_else(||missing("Retire case not found."))?;
    let mut items:Vec<Value>=sqlx::query_scalar("SELECT to_jsonb(x) FROM (SELECT i.id,i.checklist_item_id,k.code checklist_code,k.title checklist_title,k.description checklist_description,
        i.is_required,i.is_checked,i.checked_by,i.checked_at,i.note FROM hr_retire_case_items i JOIN hr_retire_checklist_items k ON k.id=i.checklist_item_id WHERE i.case_id=$1 ORDER BY k.sort_order,i.id) x")
        .bind(id).fetch_all(&mut *conn).await?;
    let mut logs:Vec<Value>=sqlx::query_scalar("SELECT to_jsonb(l)-'case_id' FROM hr_retire_audit_logs l WHERE case_id=$1 ORDER BY created_at DESC,id DESC").bind(id).fetch_all(&mut *conn).await?;
    instant_fields(
        &mut c,
        &["confirmed_at", "cancelled_at", "created_at", "updated_at"],
    );
    for item in &mut items {
        instant_fields(item, &["checked_at"]);
    }
    for log in &mut logs {
        instant_fields(log, &["created_at"]);
    }
    c["checklist_items"] = json!(items);
    c["audit_logs"] = json!(logs);
    Ok(c)
}
async fn detail(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let c = case_detail(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(c))
}
async fn audit(
    conn: &mut PgConnection,
    id: i32,
    action: &str,
    actor: i32,
    detail: &str,
) -> Result<(), ApiError> {
    sqlx::query("INSERT INTO hr_retire_audit_logs(case_id,action_type,actor_user_id,detail,created_at) VALUES($1,$2,$3,$4,statement_timestamp() AT TIME ZONE 'UTC')")
        .bind(id).bind(action).bind(actor).bind(detail).execute(conn).await?;
    Ok(())
}
async fn lock_case(conn: &mut PgConnection, id: i32) -> Result<Value, ApiError> {
    sqlx::query_scalar("SELECT to_jsonb(c) FROM hr_retire_cases c WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| missing("Retire case not found."))
}
async fn create(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(RetireCaseCreate(p)): Body<RetireCaseCreate>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let emp = int(&p["employee_id"]).unwrap();
    lock_employee(&mut tx, emp).await?;
    let status: String =
        sqlx::query_scalar("SELECT employment_status FROM hr_employees WHERE id=$1")
            .bind(emp)
            .fetch_one(&mut *tx)
            .await?;
    if status == "resigned" {
        return Err(bad("Employee is already resigned."));
    }
    let id:i32=sqlx::query_scalar("INSERT INTO hr_retire_cases(employee_id,retire_date,reason,status,requested_by,created_at,updated_at)
        VALUES($1,($2->>'retire_date')::date,$2->>'reason','draft',$3,transaction_timestamp() AT TIME ZONE 'UTC',transaction_timestamp() AT TIME ZONE 'UTC') RETURNING id").bind(emp).bind(&p).bind(u.id).fetch_one(&mut *tx).await?;
    let n=sqlx::query("INSERT INTO hr_retire_case_items(case_id,checklist_item_id,is_required,is_checked,created_at,updated_at)
        SELECT $1,id,is_required,false,transaction_timestamp() AT TIME ZONE 'UTC',transaction_timestamp() AT TIME ZONE 'UTC' FROM hr_retire_checklist_items WHERE is_active ORDER BY sort_order,id").bind(id).execute(&mut *tx).await?.rows_affected();
    if n == 0 {
        return Err(bad("No active retire checklist items."));
    }
    audit(
        &mut tx,
        id,
        "create",
        u.id,
        &format!("retire_date={}", p["retire_date"].as_str().unwrap()),
    )
    .await?;
    let result = case_detail(&mut tx, id).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(result)))
}
async fn edit(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path((id, item)): Path<(i32, i32)>,
    Body(RetireItemUpdate(p)): Body<RetireItemUpdate>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let c = lock_case(&mut tx, id).await?;
    if c["status"] != "draft" {
        return Err(conflict("Only draft cases can be edited."));
    }
    let checked = p["is_checked"].as_bool().unwrap();
    let n=sqlx::query("UPDATE hr_retire_case_items SET is_checked=$3,note=$4,checked_by=CASE WHEN $3 THEN $5::int ELSE NULL END,
        checked_at=CASE WHEN $3 THEN transaction_timestamp() AT TIME ZONE 'UTC' ELSE NULL END,updated_at=transaction_timestamp() AT TIME ZONE 'UTC' WHERE id=$1 AND case_id=$2")
        .bind(item).bind(id).bind(checked).bind(p["note"].as_str()).bind(u.id).execute(&mut *tx).await?.rows_affected();
    if n == 0 {
        return Err(missing("Case checklist item not found."));
    }
    sqlx::query("UPDATE hr_retire_cases SET updated_at=transaction_timestamp() AT TIME ZONE 'UTC' WHERE id=$1").bind(id).execute(&mut *tx).await?;
    audit(
        &mut tx,
        id,
        if checked { "check" } else { "uncheck" },
        u.id,
        &format!("case_item_id={item}"),
    )
    .await?;
    let response = case_detail(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(response))
}

async fn record_status(
    conn: &mut PgConnection,
    c: &Value,
    actor: i32,
    before: &str,
    after: &str,
    reason: Option<&str>,
    is_confirm: bool,
) -> Result<(), ApiError> {
    let id = int(&c["id"]).unwrap();
    let emp = int(&c["employee_id"]).unwrap();
    let (action, title, comment, english) = if is_confirm {
        (
            "retire",
            "퇴직처리",
            "퇴직처리 확정",
            "Retire case confirmed.",
        )
    } else {
        (
            "retire_cancel",
            "퇴직처리 취소",
            "퇴직처리 취소",
            "Retire case cancelled.",
        )
    };
    sqlx::query("UPDATE hr_employees SET employment_status=$2,updated_at=transaction_timestamp() AT TIME ZONE 'UTC' WHERE id=$1").bind(emp).bind(after).execute(&mut *conn).await?;
    sqlx::query("INSERT INTO hr_employee_info_records(employee_id,category,record_date,title,type,value,note,created_at)
        VALUES($1,'appointment',($2->>'retire_date')::date,$3,$4,$5,$6,transaction_timestamp() AT TIME ZONE 'UTC')")
        .bind(emp).bind(c).bind(title).bind(action).bind(reason).bind(format!("{comment}(case_id={id})")).execute(&mut *conn).await?;
    sqlx::query("INSERT INTO hr_personnel_histories(employee_id,history_type,source_table,source_id,effective_date,field_name,before_value,after_value,description,created_by,created_at)
        VALUES($1,$2,'hr_retire_cases',$3,($4->>'retire_date')::date,'employment_status',$5,$6,$7,$8,transaction_timestamp() AT TIME ZONE 'UTC')")
        .bind(emp).bind(action).bind(id).bind(c).bind(before).bind(after).bind(english).bind(actor).execute(&mut *conn).await?;
    audit(
        conn,
        id,
        if is_confirm { "confirm" } else { "cancel" },
        actor,
        &format!("employment_status:{before}->{after}"),
    )
    .await
}

async fn confirm(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let c = lock_case(&mut tx, id).await?;
    if c["status"] != "draft" {
        return Err(conflict("Only draft cases can be confirmed."));
    }
    let pending:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM hr_retire_case_items WHERE case_id=$1 AND is_required AND NOT is_checked)").bind(id).fetch_one(&mut *tx).await?;
    if pending {
        return Err(bad("Required checklist items are not completed."));
    }
    let emp = int(&c["employee_id"]).unwrap();
    lock_employee(&mut tx, emp).await?;
    let (before,other):(String,bool)=sqlx::query_as("SELECT employment_status,EXISTS(SELECT 1 FROM hr_retire_cases WHERE employee_id=$1 AND status='confirmed' AND id<>$2) FROM hr_employees WHERE id=$1")
        .bind(emp).bind(id).fetch_one(&mut *tx).await?;
    if other {
        return Err(conflict(
            "Employee already has a confirmed retirement case.",
        ));
    }
    if before == "resigned" {
        return Err(conflict("Employee is already resigned."));
    }
    sqlx::query("UPDATE hr_retire_cases SET previous_employment_status=$2,status='confirmed',confirmed_by=$3,confirmed_at=transaction_timestamp() AT TIME ZONE 'UTC',
        updated_at=transaction_timestamp() AT TIME ZONE 'UTC' WHERE id=$1").bind(id).bind(&before).bind(u.id).execute(&mut *tx).await?;
    sqlx::query("WITH updated AS (UPDATE hr_employee_basic_profiles SET retire_date=($2->>'retire_date')::date,
        updated_at=transaction_timestamp() AT TIME ZONE 'UTC' WHERE employee_id=$1 RETURNING id)
        INSERT INTO hr_employee_basic_profiles(employee_id,retire_date,created_at,updated_at)
        SELECT $1,($2->>'retire_date')::date,transaction_timestamp() AT TIME ZONE 'UTC',transaction_timestamp() AT TIME ZONE 'UTC'
        WHERE NOT EXISTS(SELECT 1 FROM updated)").bind(emp).bind(&c).execute(&mut *tx).await?;
    record_status(
        &mut tx,
        &c,
        u.id,
        &before,
        "resigned",
        c["reason"].as_str(),
        true,
    )
    .await?;
    let result = case_detail(&mut tx, id).await?;
    tx.commit().await?;
    // The Spring listener runs synchronously AFTER_COMMIT in its own transaction.
    if let Err(error) = severance::create_draft(&s.pool, id).await {
        eprintln!(
            "Retirement case {id}: severance draft creation failed (status {})",
            error.0
        );
    }
    Ok(Json(result))
}

async fn cancel(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
    Body(RetireCancel(p)): Body<RetireCancel>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let c = lock_case(&mut tx, id).await?;
    if c["status"] != "confirmed" {
        return Err(conflict("Only confirmed cases can be cancelled."));
    }
    let emp = int(&c["employee_id"]).unwrap();
    lock_employee(&mut tx, emp).await?;
    let before: String =
        sqlx::query_scalar("SELECT employment_status FROM hr_employees WHERE id=$1")
            .bind(emp)
            .fetch_one(&mut *tx)
            .await?;
    let remaining:Option<chrono::NaiveDate>=sqlx::query_scalar("SELECT retire_date FROM hr_retire_cases WHERE employee_id=$1 AND id<>$2 AND status='confirmed' ORDER BY confirmed_at DESC,id DESC LIMIT 1")
        .bind(emp).bind(id).fetch_optional(&mut *tx).await?;
    let mut restore = if remaining.is_some() {
        "resigned".to_owned()
    } else {
        c["previous_employment_status"]
            .as_str()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or("active")
            .to_owned()
    };
    if remaining.is_none() && restore == "resigned" && !c["confirmed_at"].is_null() {
        let previous:Vec<(chrono::NaiveDateTime,Option<chrono::NaiveDateTime>,Option<String>)>=sqlx::query_as("SELECT confirmed_at,cancelled_at,previous_employment_status FROM hr_retire_cases
            WHERE employee_id=$1 AND id<>$2 AND confirmed_at<=($3->>'confirmed_at')::timestamp AND status IN ('confirmed','cancelled') ORDER BY confirmed_at DESC,id DESC")
            .bind(emp).bind(id).bind(&c).fetch_all(&mut *tx).await?;
        let mut start = c["confirmed_at"]
            .as_str()
            .and_then(|s| s.parse::<chrono::NaiveDateTime>().ok());
        for (confirmed, cancelled, old) in previous {
            if cancelled.zip(start).is_some_and(|(end, start)| end < start) {
                continue;
            }
            start = Some(confirmed);
            if let Some(old) = old.filter(|s| matches!(s.as_str(), "active" | "leave")) {
                restore = old;
                break;
            }
        }
    }
    let reason = p["cancel_reason"].as_str();
    sqlx::query("UPDATE hr_retire_cases SET status='cancelled',cancelled_by=$2,cancelled_at=transaction_timestamp() AT TIME ZONE 'UTC',cancel_reason=$3,updated_at=transaction_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
        .bind(id).bind(u.id).bind(reason).execute(&mut *tx).await?;
    sqlx::query("UPDATE hr_employee_basic_profiles SET retire_date=$2,updated_at=transaction_timestamp() AT TIME ZONE 'UTC' WHERE employee_id=$1").bind(emp).bind(remaining).execute(&mut *tx).await?;
    record_status(&mut tx, &c, u.id, &before, &restore, reason, false).await?;
    let result = case_detail(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(result))
}
