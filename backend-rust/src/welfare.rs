use crate::{
    ApiError, AppState,
    input::{Body, Validate, Violation, not_blank, size},
    security::CurrentUser,
};
use axum::{
    Extension, Json, Router,
    extract::{Query, State},
    http::StatusCode,
    routing::{get, post, put},
};
use chrono::{NaiveDateTime, SecondsFormat, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{PgConnection, PgPool};

pub fn router() -> Router<AppState> {
    Router::new().nest(
        "/api/v1/wel",
        Router::new()
            .route("/benefit-types", get(types))
            .route("/benefit-types/batch", post(save_types))
            .route("/requests", get(requests).post(create))
            .route("/my-requests", get(own))
            .route("/requests/{req_id}/approve", post(approve))
            .route("/requests/{req_id}/reject", post(reject))
            .route("/requests/{req_id}/withdraw", put(withdraw)),
    )
}
type Reply = Result<Json<Value>, ApiError>;
const EMPLOYEES: &[&str] = &["employee", "hr_manager", "payroll_mgr", "admin"];
const MANAGERS: &[&str] = &["hr_manager", "payroll_mgr", "admin"];

pub(crate) async fn gate(
    pool: &PgPool,
    user: &CurrentUser,
    roles: &[&str],
) -> Result<(), ApiError> {
    let roles: Vec<_> = roles.iter().map(|r| (*r).to_string()).collect();
    let allowed: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM auth_user_roles ur JOIN auth_roles r ON r.id=ur.role_id
        WHERE ur.user_id=$1 AND r.code=ANY($2))",
    )
    .bind(user.id)
    .bind(roles)
    .fetch_one(pool)
    .await?;
    if allowed {
        Ok(())
    } else {
        Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "Not enough permissions.",
        ))
    }
}

use crate::input::params::{NumericPath as Path, Pagination};
fn item(mut value: Value) -> Result<Value, ApiError> {
    let fields = value.as_object_mut().expect("database row");
    fields.remove("employee_id");
    for key in ["created_at", "updated_at", "requested_at", "approved_at"] {
        if let Some(field) = fields.get_mut(key)
            && let Some(s) = field.as_str()
        {
            let instant =
                NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f").map_err(|_| {
                    ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                })?;
            *field = json!(
                instant
                    .and_utc()
                    .to_rfc3339_opts(SecondsFormat::AutoSi, true)
            );
        }
    }
    Ok(value)
}

async fn page(pool: &PgPool, types: bool, page: i32, limit: i32) -> Reply {
    // Return the total even for an empty last page, from the same statement snapshot.
    let sql = if types {
        "WITH selected AS MATERIALIZED (SELECT * FROM wel_benefit_types)
        SELECT (SELECT count(*) FROM selected),coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.sort_order,s.id)
        FROM (SELECT * FROM selected ORDER BY sort_order,id LIMIT $1 OFFSET $2) s),'[]')"
    } else {
        "WITH selected AS MATERIALIZED (SELECT * FROM wel_benefit_requests)
        SELECT (SELECT count(*) FROM selected),coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.requested_at DESC,s.id DESC)
        FROM (SELECT * FROM selected ORDER BY requested_at DESC,id DESC LIMIT $1 OFFSET $2) s),'[]')"
    };
    let (total, values): (i64, Value) = sqlx::query_as(sql)
        .bind(i64::from(limit))
        .bind(i64::from(page - 1) * i64::from(limit))
        .fetch_one(pool)
        .await?;
    let rows: Vec<_> = values
        .as_array()
        .unwrap()
        .iter()
        .cloned()
        .map(item)
        .collect::<Result<_, _>>()?;
    Ok(Json(
        json!({"items":rows,"total_count":total,"page":page,"limit":limit}),
    ))
}
async fn types(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Query(q): Query<Pagination>,
) -> Reply {
    let (page_no, limit) = q.parse("benefitTypes")?;
    gate(&s.pool, &user, EMPLOYEES).await?;
    page(&s.pool, true, page_no, limit).await
}
async fn requests(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Query(q): Query<Pagination>,
) -> Reply {
    let (page_no, limit) = q.parse("requests")?;
    gate(&s.pool, &user, MANAGERS).await?;
    page(&s.pool, false, page_no, limit).await
}

#[derive(Deserialize)]
struct TypeInput {
    id: Option<i32>,
    code: Option<String>,
    name: Option<String>,
    module_path: Option<String>,
    is_deduction: Option<bool>,
    pay_item_code: Option<String>,
    is_active: Option<bool>,
    sort_order: Option<i32>,
    #[serde(rename = "_status")]
    status: Option<String>,
}
#[derive(Deserialize)]
struct Batch {
    items: Option<Vec<TypeInput>>,
}
impl Validate for Batch {
    fn validate(&self) -> Vec<Violation> {
        let mut errors = vec![];
        for (i, row) in self.items.iter().flatten().enumerate() {
            for (key, v) in [
                ("code", &row.code),
                ("name", &row.name),
                ("module_path", &row.module_path),
            ] {
                if let Some(v) = not_blank(&format!("items[{i}].{key}"), v.as_deref()) {
                    errors.push(v);
                }
            }
            if let Some(v) = size(
                &format!("items[{i}].pay_item_code"),
                row.pay_item_code.as_deref(),
                0,
                60,
            ) {
                errors.push(v);
            }
        }
        errors
    }
}
async fn save_types(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Body(request): Body<Batch>,
) -> Reply {
    gate(&s.pool, &user, &["admin"]).await?;
    let mut tx = s.pool.begin().await?;
    let (mut created, mut updated, mut deleted) = (0, 0, 0);
    for row in request.items.into_iter().flatten() {
        let status = row.status.as_deref().unwrap_or("clean").to_lowercase();
        let id = if status == "added" {
            None
        } else {
            let Some(id) = row.id else {
                continue;
            };
            let found: Option<i32> =
                sqlx::query_scalar("SELECT id FROM wel_benefit_types WHERE id=$1 FOR UPDATE")
                    .bind(id)
                    .fetch_optional(&mut *tx)
                    .await?;
            let Some(found) = found else {
                continue;
            };
            Some(found)
        };
        let sql = match status.as_str() {
            "added" => {
                created += 1;
                "INSERT INTO wel_benefit_types(code,name,module_path,is_deduction,pay_item_code,is_active,sort_order,created_at,updated_at)
                  VALUES($1,$2,$3,$4,$5,$6,$7,timezone('UTC',statement_timestamp()),timezone('UTC',statement_timestamp()))"
            }
            "updated" => {
                updated += 1;
                "UPDATE wel_benefit_types SET code=$1,name=$2,module_path=$3,is_deduction=$4,pay_item_code=$5,
                  is_active=$6,sort_order=$7,updated_at=timezone('UTC',clock_timestamp()) WHERE id=$8"
            }
            "deleted" => {
                sqlx::query("DELETE FROM wel_benefit_types WHERE id=$1")
                    .bind(id)
                    .execute(&mut *tx)
                    .await?;
                deleted += 1;
                continue;
            }
            _ => continue,
        };
        let mut query = sqlx::query(sql)
            .bind(row.code)
            .bind(row.name)
            .bind(row.module_path)
            .bind(row.is_deduction.unwrap_or(false))
            .bind(row.pay_item_code)
            .bind(row.is_active.unwrap_or(true))
            .bind(row.sort_order.unwrap_or(0));
        if id.is_some() {
            query = query.bind(id);
        }
        query.execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(Json(
        json!({"created":created,"updated":updated,"deleted":deleted}),
    ))
}

#[derive(Deserialize)]
struct NewRequest {
    benefit_type_code: Option<String>,
    #[serde(default)]
    requested_amount: i32,
    description: Option<String>,
}
impl Validate for NewRequest {
    fn validate(&self) -> Vec<Violation> {
        [
            not_blank("benefit_type_code", self.benefit_type_code.as_deref()),
            size("description", self.description.as_deref(), 0, 500),
        ]
        .into_iter()
        .flatten()
        .collect()
    }
}
#[derive(Deserialize)]
struct Approval {
    #[serde(default)]
    approved_amount: i32,
    note: Option<String>,
}
impl Validate for Approval {
    fn validate(&self) -> Vec<Violation> {
        size("note", self.note.as_deref(), 0, 500)
            .into_iter()
            .collect()
    }
}
#[derive(Deserialize)]
struct Rejection {
    reason: Option<String>,
}
impl Validate for Rejection {
    fn validate(&self) -> Vec<Violation> {
        size("reason", self.reason.as_deref(), 0, 500)
            .into_iter()
            .collect()
    }
}

async fn create(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Body(request): Body<NewRequest>,
) -> Reply {
    gate(&s.pool, &user, EMPLOYEES).await?;
    let mut tx = s.pool.begin().await?;
    let benefit: String = sqlx::query_scalar(
        "SELECT name FROM wel_benefit_types WHERE is_active AND code=$1 LIMIT 1",
    )
    .bind(&request.benefit_type_code)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "복리후생 유형을 찾을 수 없습니다."))?;
    let(emp,number,name,dept):(i32,String,String,String)=sqlx::query_as("SELECT e.id,coalesce(e.employee_no,''),coalesce(u.display_name,u.login_id,''),
          coalesce(d.name,'') FROM hr_employees e JOIN auth_users u ON u.id=e.user_id LEFT JOIN org_departments d ON d.id=e.department_id
          WHERE e.user_id=$1 LIMIT 1").bind(user.id).fetch_optional(&mut *tx).await?.ok_or_else(||ApiError::new(StatusCode::BAD_REQUEST,"사원 프로필을 찾을 수 없습니다."))?;
    let now = Utc::now().naive_utc();
    let month = now.format("%Y%m").to_string();
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(format!("wel:request-number:{month}"))
        .execute(&mut *tx)
        .await?;
    let prefix = format!("WEL-{month}-");
    let previous:Option<String>=sqlx::query_scalar("SELECT request_no FROM wel_benefit_requests WHERE starts_with(request_no,$1) ORDER BY id DESC LIMIT 1")
        .bind(&prefix).fetch_optional(&mut *tx).await?;
    let counter = previous
        .and_then(|n| n.rsplit('-').next()?.parse::<i32>().ok())
        .unwrap_or(0)
        + 1;
    let row:Value=sqlx::query_scalar("INSERT INTO wel_benefit_requests(request_no,benefit_type_code,benefit_type_name,employee_id,employee_no,
         employee_name,department_name,status_code,requested_amount,description,requested_at,created_at,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,'submitted',$8,$9,$10,$10,$10) RETURNING to_jsonb(wel_benefit_requests)")
        .bind(format!("{prefix}{counter:05}")).bind(request.benefit_type_code).bind(benefit).bind(emp).bind(number).bind(name)
        .bind(dept).bind(request.requested_amount).bind(request.description).bind(now).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"item":item(row)?})))
}
async fn own(State(s): State<AppState>, Extension(user): Extension<CurrentUser>) -> Reply {
    gate(&s.pool, &user, EMPLOYEES).await?;
    let rows: Vec<Value> = sqlx::query_scalar(
        "SELECT to_jsonb(w) FROM wel_benefit_requests w WHERE w.employee_id=
        (SELECT id FROM hr_employees WHERE user_id=$1 LIMIT 1) ORDER BY requested_at DESC,id DESC",
    )
    .bind(user.id)
    .fetch_all(&s.pool)
    .await?;
    let rows = rows.into_iter().map(item).collect::<Result<Vec<_>, _>>()?;
    Ok(Json(
        json!({"items":rows,"page":1,"total_count":rows.len(),"limit":rows.len().max(1)}),
    ))
}
enum Decision {
    Approve(Approval),
    Reject(Rejection),
    Withdraw,
}
async fn decide(s: &AppState, user: &CurrentUser, id: i32, decision: Decision) -> Reply {
    gate(
        &s.pool,
        user,
        if matches!(decision, Decision::Withdraw) {
            EMPLOYEES
        } else {
            MANAGERS
        },
    )
    .await?;
    let mut tx = s.pool.begin().await?;
    let (status, owner): (String, Option<i32>) = sqlx::query_as(
        "SELECT status_code,employee_id FROM wel_benefit_requests WHERE id=$1 FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "신청 건을 찾을 수 없습니다."))?;
    let row: Value = match decision {
        Decision::Approve(request) => {
            if status != "submitted" {
                return Err(ApiError::new(
                    StatusCode::CONFLICT,
                    format!("승인 대기(submitted) 상태가 아닙니다. 현재 상태: {status}"),
                ));
            }
            let note = request
                .note
                .filter(|v| !v.trim().is_empty())
                .map(|v| format!("\n[승인메모] {v}"));
            sqlx::query_scalar("UPDATE wel_benefit_requests SET status_code='approved',approved_amount=$2,approved_at=timezone('UTC',clock_timestamp()),
                description=CASE WHEN $3::text IS NULL THEN description ELSE coalesce(description,'')||$3 END,
                updated_at=timezone('UTC',clock_timestamp()) WHERE id=$1 RETURNING to_jsonb(wel_benefit_requests)")
                .bind(id).bind(request.approved_amount).bind(note).fetch_one(&mut *tx).await?
        }
        Decision::Reject(request) => {
            if !matches!(status.as_str(), "submitted" | "draft") {
                return Err(ApiError::new(
                    StatusCode::CONFLICT,
                    format!("반려할 수 없는 상태입니다. 현재 상태: {status}"),
                ));
            }
            let note = request
                .reason
                .filter(|v| !v.trim().is_empty())
                .map(|v| format!("\n[반려사유] {v}"));
            sqlx::query_scalar("UPDATE wel_benefit_requests SET status_code='rejected',
                description=CASE WHEN $2::text IS NULL THEN description ELSE coalesce(description,'')||$2 END,
                updated_at=timezone('UTC',clock_timestamp()) WHERE id=$1 RETURNING to_jsonb(wel_benefit_requests)")
                .bind(id).bind(note).fetch_one(&mut *tx).await?
        }
        Decision::Withdraw => {
            let employee: Option<i32> =
                sqlx::query_scalar("SELECT id FROM hr_employees WHERE user_id=$1 LIMIT 1")
                    .bind(user.id)
                    .fetch_optional(&mut *tx)
                    .await?;
            if employee.is_none() || employee != owner {
                return Err(ApiError::new(
                    StatusCode::FORBIDDEN,
                    "본인의 신청 건만 회수할 수 있습니다.",
                ));
            }
            if !matches!(status.as_str(), "submitted" | "draft") {
                return Err(ApiError::new(
                    StatusCode::CONFLICT,
                    format!("회수할 수 없는 상태입니다. 현재 상태: {status}"),
                ));
            }
            sqlx::query_scalar("UPDATE wel_benefit_requests SET status_code='withdrawn',updated_at=timezone('UTC',clock_timestamp())
                WHERE id=$1 RETURNING to_jsonb(wel_benefit_requests)").bind(id).fetch_one(&mut *tx).await?
        }
    };
    tx.commit().await?;
    Ok(Json(json!({"item":item(row)?})))
}
async fn approve(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
    Body(request): Body<Approval>,
) -> Reply {
    decide(&s, &u, id, Decision::Approve(request)).await
}
async fn reject(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
    Body(request): Body<Rejection>,
) -> Reply {
    decide(&s, &u, id, Decision::Reject(request)).await
}
async fn withdraw(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    decide(&s, &u, id, Decision::Withdraw).await
}

pub struct HriWelfareProjection {
    pub request_no: String,
    pub status_code: String,
    pub benefit_type_code: Option<String>,
    pub benefit_type_name: Option<String>,
    pub requested_amount: i32,
    pub description: Option<String>,
    pub submitted_at: Option<NaiveDateTime>,
    pub completed_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub employee_id: Option<i32>,
    pub employee_no: Option<String>,
    pub employee_name: Option<String>,
    pub department_name: Option<String>,
}

/// Run on the same transaction connection as the HRI transition.
pub async fn sync_from_hri(
    conn: &mut PgConnection,
    p: &HriWelfareProjection,
) -> Result<(), ApiError> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(format!("wel:hri:{}", p.request_no))
        .execute(&mut *conn)
        .await?;
    let code = p.benefit_type_code.as_deref().unwrap_or_default();
    let name = match p
        .benefit_type_name
        .as_deref()
        .filter(|n| !n.trim().is_empty())
    {
        Some(name) => name.to_string(),
        None if code.trim().is_empty() => String::new(),
        None => sqlx::query_scalar::<_, String>(
            "SELECT name FROM wel_benefit_types WHERE code=$1 LIMIT 1",
        )
        .bind(code)
        .fetch_optional(&mut *conn)
        .await?
        .unwrap_or_else(|| code.to_owned()),
    };
    let status = match p.status_code.as_str() {
        "APPROVAL_IN_PROGRESS" => "submitted",
        "APPROVAL_REJECTED" | "RECEIVE_REJECTED" => "rejected",
        "RECEIVE_IN_PROGRESS" => "approved",
        "COMPLETED" => "payroll_reflected",
        "WITHDRAWN" => "withdrawn",
        _ => "draft",
    };
    let approved = matches!(status, "approved" | "payroll_reflected").then_some(p.requested_amount);
    let completed = p.completed_at.unwrap_or(p.updated_at);
    let label =
        (status == "payroll_reflected").then(|| format!("{} 정기급여", completed.format("%Y-%m")));
    // Preserve existing id, created_at and sequence state on repeated updates.
    let id: Option<i32> =
        sqlx::query_scalar("SELECT id FROM wel_benefit_requests WHERE request_no=$1 FOR UPDATE")
            .bind(&p.request_no)
            .fetch_optional(&mut *conn)
            .await?;
    let sql = if id.is_some() {
        "UPDATE wel_benefit_requests SET benefit_type_code=$1,benefit_type_name=$2,employee_id=$3,employee_no=$4,
        employee_name=$5,department_name=$6,status_code=$7,requested_amount=$8,approved_amount=$9,payroll_run_label=$10,
        description=$11,requested_at=$12,approved_at=$13,updated_at=$14 WHERE id=$15"
    } else {
        "INSERT INTO wel_benefit_requests(benefit_type_code,benefit_type_name,employee_id,employee_no,employee_name,
        department_name,status_code,requested_amount,approved_amount,payroll_run_label,description,requested_at,approved_at,updated_at,
        request_no,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)"
    };
    let query = sqlx::query(sql)
        .bind(code)
        .bind(name)
        .bind(p.employee_id)
        .bind(p.employee_no.as_deref().unwrap_or(""))
        .bind(p.employee_name.as_deref().unwrap_or(""))
        .bind(p.department_name.as_deref().unwrap_or("-"))
        .bind(status)
        .bind(p.requested_amount)
        .bind(approved)
        .bind(label)
        .bind(&p.description)
        .bind(p.submitted_at.unwrap_or(p.created_at))
        .bind(approved.map(|_| completed))
        .bind(p.updated_at);
    if let Some(id) = id {
        query.bind(id).execute(conn).await?;
    } else {
        query
            .bind(&p.request_no)
            .bind(p.created_at)
            .execute(conn)
            .await?;
    }
    Ok(())
}
