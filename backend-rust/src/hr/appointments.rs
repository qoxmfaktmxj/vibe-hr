use super::{
    Reply, appointment_codes,
    basic::instant_fields,
    employees::{employee, int, lock_employee},
    forms::{AppointmentRecordCreate, AppointmentRecordUpdate},
    hr_role,
    recruit::lock_named,
};
use crate::{ApiError, AppState, input::Body, security::CurrentUser};
use axum::{
    Extension, Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post, put},
};
use chrono::{NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::PgConnection;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/hr/appointments/records", get(list).post(create))
        .route(
            "/api/v1/hr/appointments/records/{item_id}",
            put(update).delete(remove),
        )
        .route(
            "/api/v1/hr/appointments/orders/{order_id}/confirm",
            post(confirm),
        )
}

fn bad(msg: impl Into<String>) -> ApiError {
    ApiError::new(StatusCode::BAD_REQUEST, msg)
}
fn missing(msg: &str) -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, msg)
}
fn conflict(msg: impl Into<String>) -> ApiError {
    ApiError::new(StatusCode::CONFLICT, msg)
}
fn text(p: &Value, k: &str) -> Option<String> {
    p[k].as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}

#[derive(Default, Deserialize)]
struct Filters {
    employee_no: Option<String>,
    name: Option<String>,
    department: Option<String>,
    order_status: Option<String>,
    appointment_kind: Option<String>,
    appointment_no: Option<String>,
}
async fn read(
    conn: &mut PgConnection,
    id: Option<i32>,
    q: Filters,
) -> Result<Vec<Value>, ApiError> {
    let lower = |s: Option<String>| s.map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty());
    let status = lower(q.order_status);
    let kind = lower(q.appointment_kind);
    if status
        .as_deref()
        .is_some_and(|s| !matches!(s, "draft" | "confirmed" | "cancelled"))
    {
        return Err(bad("Invalid order status."));
    }
    if kind
        .as_deref()
        .is_some_and(|s| !matches!(s, "permanent" | "temporary"))
    {
        return Err(bad("Invalid appointment kind."));
    }
    let mut rows:Vec<Value>=sqlx::query_scalar("SELECT to_jsonb(view) FROM (SELECT i.id,i.order_id,o.appointment_no,o.title order_title,o.description order_description,
        o.effective_date,o.status order_status,o.confirmed_at,o.confirmed_by,i.employee_id,e.employee_no,u.display_name,d.name department_name,e.employment_status,
        coalesce(i.appointment_code_id,o.appointment_code_id) appointment_code_id,coalesce(ic.name,oc.name) appointment_code_name,
        i.appointment_kind,i.action_type,i.start_date,i.end_date,i.from_department_id,i.to_department_id,i.from_position_title,i.to_position_title,i.from_employment_status,
        i.to_employment_status,i.apply_status,i.applied_at,i.temporary_reason,i.note,i.created_at,i.updated_at
        FROM hr_appointment_order_items i JOIN hr_appointment_orders o ON o.id=i.order_id JOIN hr_employees e ON e.id=i.employee_id
        JOIN auth_users u ON u.id=e.user_id JOIN org_departments d ON d.id=e.department_id LEFT JOIN app_codes ic ON ic.id=i.appointment_code_id LEFT JOIN app_codes oc ON oc.id=o.appointment_code_id
        WHERE ($1::int IS NULL OR i.id=$1) AND ($2::text IS NULL OR o.status=$2) AND ($3::text IS NULL OR i.appointment_kind=$3)
        AND strpos(lower(u.display_name),$4)>0 AND strpos(lower(e.employee_no),$5)>0 AND strpos(lower(d.name),$6)>0 AND strpos(lower(o.appointment_no),$7)>0
        ORDER BY o.effective_date DESC,o.id DESC,i.id DESC) view")
        .bind(id).bind(status).bind(kind).bind(lower(q.name).unwrap_or_default()).bind(lower(q.employee_no).unwrap_or_default()).bind(lower(q.department).unwrap_or_default())
        .bind(lower(q.appointment_no).unwrap_or_default()).fetch_all(conn).await?;
    for row in &mut rows {
        instant_fields(
            row,
            &["created_at", "updated_at", "confirmed_at", "applied_at"],
        );
    }
    Ok(rows)
}
async fn list(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Filters>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut conn = s.pool.acquire().await?;
    Ok(Json(json!({"items":read(&mut conn,None,q).await?})))
}

fn employment(
    current: &str,
    requested: Option<&str>,
    action: &str,
) -> Result<Option<String>, ApiError> {
    if let Some(v) = requested.map(str::trim).filter(|v| !v.is_empty()) {
        let v = v.to_lowercase();
        if matches!(v.as_str(), "active" | "leave" | "resigned") {
            return Ok(Some(v));
        }
        return Err(bad("Invalid employment status."));
    }
    let action = action.to_lowercase();
    Ok((current == "leave"
        && ["입사", "신규", "hire", "onboard", "join"]
            .iter()
            .any(|s| action.contains(s)))
    .then(|| "active".into()))
}

async fn rules(
    conn: &mut PgConnection,
    employee: i32,
    kind: &str,
    start: NaiveDate,
    end: Option<NaiveDate>,
    excluded: Option<i32>,
) -> Result<Vec<i32>, ApiError> {
    if !matches!(kind, "permanent" | "temporary") {
        return Err(bad("Invalid appointment kind."));
    }
    if kind == "temporary" && end.is_none() {
        return Err(bad("Temporary appointment requires end_date."));
    }
    if end.is_some_and(|e| start > e) {
        return Err(bad("start_date must be before or equal to end_date."));
    }
    let rows:Vec<(i32,NaiveDate,Option<NaiveDate>,String,String)>=sqlx::query_as("SELECT i.id,i.start_date,i.end_date,i.appointment_kind,o.status FROM hr_appointment_order_items i JOIN hr_appointment_orders o ON o.id=i.order_id
        WHERE employee_id=$1 AND o.status IN ('draft','confirmed') AND i.id IS DISTINCT FROM $2")
        .bind(employee).bind(excluded).fetch_all(conn).await?;
    let mut prior = vec![];
    for (id, old_start, old_end, old_kind, status) in rows {
        let overlap = old_end.is_none_or(|e| start <= e) && end.is_none_or(|e| e >= old_start);
        if overlap
            && kind == "permanent"
            && old_kind == "permanent"
            && status == "confirmed"
            && start > old_start
        {
            prior.push(id);
            continue;
        }
        match old_end {
            None => {
                return Err(conflict(
                    "해당 직원에게 겹치는 발령이 이미 존재합니다. 기존 발령을 취소한 후 진행하세요.",
                ));
            }
            Some(e) if overlap => {
                return Err(conflict(format!(
                    "해당 직원의 기존 발령 기간({old_start}~{e})과 겹칩니다."
                )));
            }
            _ => {}
        }
    }
    Ok(prior)
}
fn date(v: &Value) -> Option<NaiveDate> {
    v.as_str().and_then(|s| s.parse().ok())
}

async fn order_no(
    conn: &mut PgConnection,
    proposed: Option<&str>,
    id: Option<i32>,
) -> Result<String, ApiError> {
    lock_named(conn, "hr_appointment_no").await?;
    let number = if let Some(no) = proposed.map(str::trim).filter(|s| !s.is_empty()) {
        no.to_owned()
    } else {
        let prefix = format!("APT-{}-", Utc::now().format("%Y%m%d"));
        let rows: Vec<String> = sqlx::query_scalar(
            "SELECT appointment_no FROM hr_appointment_orders WHERE appointment_no LIKE $1||'%'",
        )
        .bind(&prefix)
        .fetch_all(&mut *conn)
        .await?;
        let max = rows
            .iter()
            .filter_map(|r| r.strip_prefix(&prefix)?.parse::<i32>().ok())
            .max()
            .unwrap_or(0);
        format!("{prefix}{:04}", i64::from(max) + 1)
    };
    if sqlx::query_scalar::<_,bool>("SELECT EXISTS(SELECT 1 FROM hr_appointment_orders WHERE appointment_no=$1 AND id IS DISTINCT FROM $2)")
        .bind(&number).bind(id).fetch_one(conn).await?{return Err(conflict("Appointment number already exists."));}
    Ok(number)
}

async fn editable(conn: &mut PgConnection, item: i32) -> Result<(Value, Value), ApiError> {
    let i: Value = sqlx::query_scalar(
        "SELECT to_jsonb(i) FROM hr_appointment_order_items i WHERE id=$1 FOR UPDATE",
    )
    .bind(item)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| missing("Appointment record not found."))?;
    let o: Value = sqlx::query_scalar(
        "SELECT to_jsonb(o) FROM hr_appointment_orders o WHERE id=$1 FOR UPDATE",
    )
    .bind(int(&i["order_id"]))
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| missing("Appointment order not found."))?;
    if o["status"] != "draft" {
        return Err(conflict("Only draft appointment orders can be modified."));
    }
    Ok((i, o))
}

async fn save(
    conn: &mut PgConnection,
    p: &Value,
    actor: i32,
    item_id: Option<i32>,
) -> Result<Value, ApiError> {
    let (mut i, mut o) = if let Some(id) = item_id {
        editable(conn, id).await?
    } else {
        (json!({}), json!({}))
    };
    let old_employee = int(&i["employee_id"]);
    let emp = int(&p["employee_id"])
        .or(old_employee)
        .ok_or_else(|| bad("Employee id is required."))?;
    lock_employee(conn, emp).await?;
    let e = employee(conn, emp, false).await?;
    if Some(emp) != old_employee {
        for (key, target) in [
            ("department_id", "from_department_id"),
            ("position_title", "from_position_title"),
            ("employment_status", "from_employment_status"),
        ] {
            i[target] = e[key].clone();
        }
        i["employee_id"] = json!(emp);
    }
    for (key, db) in [
        ("order_title", "title"),
        ("order_description", "description"),
        ("effective_date", "effective_date"),
        ("order_appointment_code_id", "appointment_code_id"),
    ] {
        if !p[key].is_null() {
            o[db] = match key {
                "order_title" => json!(p[key].as_str().unwrap_or("").trim()),
                "order_description" => json!(text(p, key)),
                _ => p[key].clone(),
            };
        }
    }
    for (key, db) in [
        ("item_appointment_code_id", "appointment_code_id"),
        ("appointment_kind", "appointment_kind"),
        ("action_type", "action_type"),
        ("start_date", "start_date"),
        ("end_date", "end_date"),
        ("to_position_title", "to_position_title"),
        ("to_department_id", "to_department_id"),
        ("temporary_reason", "temporary_reason"),
        ("note", "note"),
    ] {
        if !p[key].is_null() {
            i[db] = match key {
                "appointment_kind" => json!(p[key].as_str().unwrap_or("").trim().to_lowercase()),
                "action_type" => json!(p[key].as_str().unwrap_or("").trim()),
                "to_position_title" | "temporary_reason" | "note" => json!(text(p, key)),
                _ => p[key].clone(),
            };
        }
    }
    let kind = i["appointment_kind"].as_str().unwrap_or("permanent");
    let start = date(&i["start_date"]).ok_or_else(|| {
        ApiError::new(StatusCode::UNPROCESSABLE_ENTITY, "start_date is required.")
    })?;
    rules(conn, emp, kind, start, date(&i["end_date"]), item_id).await?;
    if item_id.is_none() || !p["to_employment_status"].is_null() {
        i["to_employment_status"] = json!(employment(
            e["employment_status"].as_str().unwrap_or(""),
            p["to_employment_status"].as_str(),
            i["action_type"].as_str().unwrap_or("")
        )?);
    }
    if item_id.is_none() || !p["appointment_no"].is_null() {
        o["appointment_no"] =
            json!(order_no(conn, p["appointment_no"].as_str(), int(&o["id"])).await?);
    }
    appointment_codes::valid(conn, int(&p["order_appointment_code_id"])).await?;
    appointment_codes::valid(conn, int(&p["item_appointment_code_id"])).await?;
    let id = if let Some(id) = item_id {
        sqlx::query("UPDATE hr_appointment_orders t SET (appointment_no,appointment_code_id,title,description,effective_date)=
            (SELECT appointment_no,appointment_code_id,title,description,effective_date FROM jsonb_populate_record(NULL::hr_appointment_orders,$2)),
            updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1").bind(int(&o["id"])).bind(&o).execute(&mut *conn).await?;
        sqlx::query("UPDATE hr_appointment_order_items SET
            (employee_id,appointment_code_id,appointment_kind,action_type,start_date,end_date,from_department_id,to_department_id,from_position_title,to_position_title,from_employment_status,to_employment_status,temporary_reason,note)=
            (SELECT employee_id,appointment_code_id,appointment_kind,action_type,start_date,end_date,from_department_id,to_department_id,from_position_title,to_position_title,from_employment_status,to_employment_status,temporary_reason,note FROM jsonb_populate_record(NULL::hr_appointment_order_items,$2)),
            updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1").bind(id).bind(i).execute(&mut *conn).await?;
        id
    } else {
        let oid:i32=sqlx::query_scalar("INSERT INTO hr_appointment_orders(appointment_no,appointment_code_id,title,description,effective_date,status,created_by,created_at,updated_at)
            SELECT appointment_no,appointment_code_id,title,description,effective_date,'draft',$2,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC' FROM jsonb_populate_record(NULL::hr_appointment_orders,$1) RETURNING id")
            .bind(o).bind(actor).fetch_one(&mut *conn).await?;
        sqlx::query_scalar("INSERT INTO hr_appointment_order_items(order_id,employee_id,appointment_code_id,appointment_kind,action_type,start_date,end_date,from_department_id,to_department_id,from_position_title,to_position_title,from_employment_status,to_employment_status,temporary_reason,note,apply_status,created_at,updated_at)
            SELECT $2,employee_id,appointment_code_id,appointment_kind,action_type,start_date,end_date,from_department_id,to_department_id,from_position_title,to_position_title,from_employment_status,to_employment_status,temporary_reason,note,'pending',statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC' FROM jsonb_populate_record(NULL::hr_appointment_order_items,$1) RETURNING id")
            .bind(i).bind(oid).fetch_one(&mut *conn).await?
    };
    read(conn, Some(id), Filters::default())
        .await?
        .pop()
        .ok_or_else(|| missing("Appointment record not found."))
}
async fn create(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(AppointmentRecordCreate(p)): Body<AppointmentRecordCreate>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let item = save(&mut tx, &p, u.id, None).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({"item":item}))))
}
async fn update(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
    Body(AppointmentRecordUpdate(p)): Body<AppointmentRecordUpdate>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let item = save(&mut tx, &p, u.id, Some(id)).await?;
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
    let (_, o) = editable(&mut tx, id).await?;
    sqlx::query("DELETE FROM hr_appointment_order_items WHERE id=$1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM hr_appointment_orders WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM hr_appointment_order_items WHERE order_id=$1)").bind(int(&o["id"])).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn confirm(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(oid): Path<i32>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let (status, no, title): (String, String, String) = sqlx::query_as(
        "SELECT status,appointment_no,title FROM hr_appointment_orders WHERE id=$1 FOR UPDATE",
    )
    .bind(oid)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| missing("Appointment order not found."))?;
    if status != "draft" {
        return Err(conflict("Only draft order can be confirmed."));
    }
    let rows:Vec<Value>=sqlx::query_scalar("SELECT to_jsonb(i) FROM hr_appointment_order_items i WHERE order_id=$1 ORDER BY id FOR UPDATE").bind(oid).fetch_all(&mut *tx).await?;
    if rows.is_empty() {
        return Err(bad("No appointment items to confirm."));
    }
    let mut applied = 0;
    for i in rows {
        if i["apply_status"] == "cancelled" {
            continue;
        }
        let id = int(&i["id"]).expect("integer id");
        let emp = int(&i["employee_id"]).expect("integer employee foreign key");
        lock_employee(&mut tx, emp).await?;
        let e = employee(&mut tx, emp, false).await?;
        let start = date(&i["start_date"]).ok_or_else(|| bad("start_date is required."))?;
        let previous = rules(
            &mut tx,
            emp,
            i["appointment_kind"].as_str().unwrap_or(""),
            start,
            date(&i["end_date"]),
            Some(id),
        )
        .await?;
        for prior in previous {
            sqlx::query("INSERT INTO hr_personnel_histories(employee_id,history_type,source_table,source_id,appointment_order_id,effective_date,field_name,before_value,after_value,description,created_by,created_at)
                SELECT $1,'appointment_end','hr_appointment_order_items',id,order_id,$2,'end_date',end_date::text,($2::date-1)::text,$4,$5,statement_timestamp() AT TIME ZONE 'UTC'
                FROM hr_appointment_order_items WHERE id=$3").bind(emp).bind(start).bind(prior).bind(format!("Superseded by {no}.")).bind(u.id).execute(&mut *tx).await?;
            sqlx::query("UPDATE hr_appointment_order_items SET end_date=$2::date-1,updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
                .bind(prior).bind(start).execute(&mut *tx).await?;
        }
        let mut changes = vec![];
        for (field, target) in [
            ("department_id", "to_department_id"),
            ("position_title", "to_position_title"),
            ("employment_status", "to_employment_status"),
        ] {
            if !i[target].is_null() && e[field] != i[target] {
                changes.push((
                    Some(field),
                    Some(
                        e[field]
                            .as_str()
                            .map(str::to_owned)
                            .unwrap_or_else(|| e[field].to_string()),
                    ),
                    Some(
                        i[target]
                            .as_str()
                            .map(str::to_owned)
                            .unwrap_or_else(|| i[target].to_string()),
                    ),
                ));
            }
        }
        if changes.is_empty() {
            changes.push((None, None, None));
        } else {
            sqlx::query("UPDATE hr_employees SET department_id=coalesce(($2->>'to_department_id')::int,department_id),position_title=coalesce($2->>'to_position_title',position_title),
                employment_status=coalesce($2->>'to_employment_status',employment_status),updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
                .bind(emp).bind(&i).execute(&mut *tx).await?;
        }
        let action = i["action_type"].as_str().unwrap_or("");
        for (field, before, after) in changes {
            sqlx::query("INSERT INTO hr_personnel_histories(employee_id,history_type,source_table,source_id,appointment_order_id,effective_date,field_name,before_value,after_value,description,created_by,created_at)
                VALUES($1,$2,'hr_appointment_order_items',$3,$4,$5,$6,$7,$8,$9,$10,statement_timestamp() AT TIME ZONE 'UTC')")
                .bind(emp).bind(action).bind(id).bind(oid).bind(start).bind(field).bind(before).bind(after).bind(format!("{no} {action}")).bind(u.id).execute(&mut *tx).await?;
        }
        sqlx::query("INSERT INTO hr_employee_info_records(employee_id,category,record_date,title,type,organization,value,note,created_at)
            SELECT $1,'appointment',$2,$3,$4,d.name,$5,$6,statement_timestamp() AT TIME ZONE 'UTC' FROM hr_employees e JOIN org_departments d ON d.id=e.department_id WHERE e.id=$1")
            .bind(emp).bind(start).bind(&title).bind(action).bind(text(&i,"to_position_title").or_else(||text(&i,"to_employment_status")).unwrap_or_else(||no.clone()))
            .bind(i["note"].as_str()).execute(&mut *tx).await?;
        sqlx::query("UPDATE hr_recruit_finalists SET status_code='appointed',updated_at=statement_timestamp() AT TIME ZONE 'UTC'
            WHERE status_code<>'appointed' AND employee_no=$1 AND login_id=$2").bind(e["employee_no"].as_str()).bind(e["login_id"].as_str()).execute(&mut *tx).await?;
        sqlx::query("UPDATE hr_appointment_order_items SET apply_status='applied',applied_at=transaction_timestamp() AT TIME ZONE 'UTC',updated_at=transaction_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
            .bind(id).execute(&mut *tx).await?;
        applied += 1;
    }
    let mut response:Value=sqlx::query_scalar("UPDATE hr_appointment_orders SET status='confirmed',confirmed_at=transaction_timestamp() AT TIME ZONE 'UTC',updated_at=transaction_timestamp() AT TIME ZONE 'UTC',confirmed_by=$2
        WHERE id=$1 RETURNING jsonb_build_object('order_id',id,'status',status,'confirmed_at',confirmed_at,'confirmed_by',confirmed_by,'applied_count',$3::int)")
        .bind(oid).bind(u.id).bind(applied).fetch_one(&mut *tx).await?;
    instant_fields(&mut response, &["confirmed_at"]);
    tx.commit().await?;
    Ok(Json(response))
}
