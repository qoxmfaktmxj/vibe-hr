use super::forms::{BasicProfileUpdate, BasicRecordBatch, BasicRecordCreate, BasicRecordUpdate};
use super::{
    Reply,
    employees::{int, lock_employee},
    hr_role,
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
use chrono::{NaiveDateTime, SecondsFormat};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{AssertSqlSafe, PgConnection};
use std::collections::HashSet;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/hr/basic/admin-records", get(admin_records))
        .route("/api/v1/hr/basic/{employee_id}", get(detail))
        .route(
            "/api/v1/hr/basic/{employee_id}/profile",
            put(update_profile),
        )
        .route("/api/v1/hr/basic/{employee_id}/records", post(create))
        .route("/api/v1/hr/basic/{employee_id}/records/batch", post(batch))
        .route(
            "/api/v1/hr/basic/{employee_id}/records/{record_id}",
            put(update).delete(remove),
        )
}

fn bad(msg: &str) -> ApiError {
    ApiError::new(StatusCode::BAD_REQUEST, msg)
}
fn missing_record() -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, "Record not found.")
}

struct Category {
    name: &'static str,
    table: &'static str,
    cols: [&'static str; 5],
    // SQL only uses the canonical identifiers and expressions declared below.
    defaults: &'static str,
    default_values: &'static str,
}

fn category(raw: &str) -> Result<Category, ApiError> {
    let fields = match raw.trim().to_ascii_lowercase().as_str() {
        name @ ("appointment" | "education" | "evaluation") => {
            let name = match name {
                "appointment" => "appointment",
                "education" => "education",
                _ => "evaluation",
            };
            (
                name,
                "hr_employee_info_records",
                ["record_date", "title", "type", "organization", "value"],
                "category",
                "$3",
            )
        }
        "address" | "contact" | "contact_points" => (
            "contact_points",
            "hr_contact_points",
            [
                "record_date",
                "contact_type",
                "phone_mobile",
                "email",
                "addr1",
            ],
            "seq,is_primary,updated_at",
            "1,false,statement_timestamp() AT TIME ZONE 'UTC'",
        ),
        "career" | "careers" => (
            "careers",
            "hr_careers",
            [
                "record_date",
                "company_name",
                "career_scope",
                "department_name",
                "position_title",
            ],
            "seq,is_current,updated_at",
            "1,false,statement_timestamp() AT TIME ZONE 'UTC'",
        ),
        "certificate" | "licenses" => (
            "licenses",
            "hr_licenses",
            [
                "record_date",
                "license_name",
                "license_type",
                "issued_org",
                "license_no",
            ],
            "seq,allowance_yn,updated_at",
            "1,false,statement_timestamp() AT TIME ZONE 'UTC'",
        ),
        "military" => (
            "military",
            "hr_military",
            [
                "record_date",
                "military_type",
                "branch",
                "rank",
                "discharge_type",
            ],
            "seq,special_case_yn,updated_at",
            "1,false,statement_timestamp() AT TIME ZONE 'UTC'",
        ),
        "reward_penalty" | "reward_punish" => (
            "reward_punish",
            "hr_reward_punish",
            [
                "action_date",
                "title",
                "reward_punish_type",
                "office_name",
                "reason",
            ],
            "seq,status,updated_at",
            "1,'DRAFT',statement_timestamp() AT TIME ZONE 'UTC'",
        ),
        _ => return Err(bad("Invalid category.")),
    };
    Ok(Category {
        name: fields.0,
        table: fields.1,
        cols: fields.2,
        defaults: fields.3,
        default_values: fields.4,
    })
}

impl Category {
    fn legacy(&self) -> bool {
        self.table == "hr_employee_info_records"
    }
    fn filter(&self) -> &str {
        if self.legacy() {
            "r.category = $2"
        } else {
            "$2::text IS NOT NULL"
        }
    }
    fn project(&self) -> String {
        let [date, title, ty, org, value] = self.cols;
        let (date, ty, value) = match self.name {
            "contact_points" => (
                "coalesce(r.record_date,r.valid_from)",
                "coalesce(r.phone_mobile,r.phone_home)",
                value,
            ),
            "careers" => (
                "coalesce(r.record_date,r.start_date)",
                ty,
                "coalesce(r.position_title,r.job_title)",
            ),
            "licenses" => ("coalesce(r.record_date,r.issued_date)", ty, value),
            "military" => ("coalesce(r.record_date,r.service_start_date)", ty, value),
            _ => (date, ty, value),
        };
        format!("jsonb_build_object('id',r.id,'category',$2::text,'record_date',{date},'title',r.{title},'type',{ty},
            'organization',r.{org},'value',{value},'note',r.note,'created_at',r.created_at)")
    }
    fn normalized_type(&self, value: Option<&str>) -> Option<String> {
        let upper = value.unwrap_or("").trim().to_uppercase();
        match self.name {
            "careers" => Some(
                if upper.starts_with("IN") || upper.contains("사내") {
                    "INTERNAL"
                } else {
                    "EXTERNAL"
                }
                .to_owned(),
            ),
            "reward_punish" => Some(
                if upper.starts_with("PUN")
                    || upper.starts_with("DIS")
                    || upper.contains("징계")
                    || upper.contains('벌')
                {
                    "PUNISH"
                } else {
                    "REWARD"
                }
                .to_owned(),
            ),
            _ => value.map(str::to_owned),
        }
    }
}

pub(super) fn instant_fields(value: &mut Value, fields: &[&str]) {
    for field in fields {
        if let Some(ts) = value[*field]
            .as_str()
            .and_then(|s| NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f").ok())
        {
            value[*field] = json!(ts.and_utc().to_rfc3339_opts(SecondsFormat::AutoSi, true));
        }
    }
}

async fn records(
    conn: &mut PgConnection,
    employee: i32,
    c: &Category,
    id: Option<i32>,
) -> Result<Vec<Value>, ApiError> {
    let sql = format!(
        "SELECT {} FROM {} r WHERE r.employee_id=$1 AND {} AND ($3::integer IS NULL OR r.id=$3)
                     ORDER BY r.{} DESC,r.id DESC",
        c.project(),
        c.table,
        c.filter(),
        c.cols[0]
    );
    let mut rows: Vec<Value> = sqlx::query_scalar(AssertSqlSafe(sql))
        .bind(employee)
        .bind(c.name)
        .bind(id)
        .fetch_all(conn)
        .await?;
    for row in &mut rows {
        instant_fields(row, &["created_at"]);
    }
    Ok(rows)
}

async fn profile(conn: &mut PgConnection, employee: i32) -> Result<Value, ApiError> {
    sqlx::query_scalar("SELECT to_jsonb(info) FROM (SELECT e.id employee_id,e.employee_no,u.display_name full_name,
       p.gender,p.resident_no_masked,p.birth_date,e.hire_date,p.retire_date,p.blood_type,p.marital_status,p.mbti,p.probation_end_date,
       d.name department_name,e.position_title,p.job_family,coalesce(p.job_role,e.position_title) job_role,p.grade
       FROM hr_employees e JOIN auth_users u ON u.id=e.user_id JOIN org_departments d ON d.id=e.department_id
       LEFT JOIN hr_employee_basic_profiles p ON p.employee_id=e.id WHERE e.id=$1) info")
        .bind(employee).fetch_optional(conn).await?.ok_or_else(||ApiError::new(StatusCode::NOT_FOUND,"Employee not found."))
}

async fn detail(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let mut result = json!({"profile":profile(&mut tx,id).await?});
    for (key, cat) in [
        ("appointments", "appointment"),
        ("rewards_penalties", "reward_punish"),
        ("contacts", "contact_points"),
        ("educations", "education"),
        ("careers", "careers"),
        ("certificates", "licenses"),
        ("military", "military"),
        ("evaluations", "evaluation"),
    ] {
        result[key] = json!(records(&mut tx, id, &category(cat)?, None).await?);
    }
    tx.commit().await?;
    Ok(Json(result))
}

async fn update_profile(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
    Body(BasicProfileUpdate(p)): Body<BasicProfileUpdate>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let user = lock_employee(&mut tx, id).await?;
    sqlx::query("INSERT INTO hr_employee_basic_profiles(employee_id,created_at,updated_at)
        SELECT $1,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC'
        WHERE NOT EXISTS(SELECT 1 FROM hr_employee_basic_profiles WHERE employee_id=$1) ON CONFLICT(employee_id) DO NOTHING")
        .bind(id).execute(&mut *tx).await?;
    if let Some(name) = p["full_name"].as_str() {
        sqlx::query("UPDATE auth_users SET display_name=$2,updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
        .bind(user).bind(name).execute(&mut *tx).await?;
    }
    sqlx::query("UPDATE hr_employees SET hire_date=coalesce(($2->>'hire_date')::date,hire_date),
        position_title=coalesce($2->>'position_title',position_title),updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1").bind(id).bind(&p).execute(&mut *tx).await?;
    sqlx::query("UPDATE hr_employee_basic_profiles b SET
        (gender,resident_no_masked,birth_date,retire_date,blood_type,marital_status,mbti,probation_end_date,job_family,job_role,grade)=
        (SELECT v.gender,v.resident_no_masked,coalesce(v.birth_date,b.birth_date),v.retire_date,v.blood_type,v.marital_status,v.mbti,v.probation_end_date,v.job_family,v.job_role,v.grade FROM jsonb_populate_record(b,$2) v),
        updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE employee_id=$1").bind(id).bind(&p).execute(&mut *tx).await?;
    let result = profile(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(result))
}

async fn save(
    conn: &mut PgConnection,
    c: &Category,
    employee: i32,
    id: Option<i32>,
    p: &Value,
) -> Result<Value, ApiError> {
    let [date, title, ty, org, value] = c.cols;
    let normalized = c.normalized_type(p["type"].as_str());
    let id = if let Some(id) = id {
        let updated = if c.legacy() {
            ""
        } else {
            ",updated_at = statement_timestamp() AT TIME ZONE 'UTC'"
        };
        let sql=format!("UPDATE {} r SET {date}=CASE WHEN $4 ? 'record_date' THEN ($4->>'record_date')::date ELSE {date} END,
            {title}=CASE WHEN $4 ? 'title' THEN $4->>'title' ELSE {title} END, {ty}=CASE WHEN $4 ? 'type' THEN $5 ELSE {ty} END,
            {org}=CASE WHEN $4 ? 'organization' THEN $4->>'organization' ELSE {org} END, {value}=CASE WHEN $4 ? 'value' THEN $4->>'value' ELSE {value} END,
            note=CASE WHEN $4 ? 'note' THEN $4->>'note' ELSE note END {updated}
            WHERE r.employee_id=$1 AND {} AND r.id=$3 RETURNING id",c.table,c.filter());
        sqlx::query_scalar(AssertSqlSafe(sql))
            .bind(employee)
            .bind(c.name)
            .bind(id)
            .bind(p)
            .bind(normalized)
            .fetch_optional(&mut *conn)
            .await?
            .ok_or_else(missing_record)?
    } else {
        // $3 is the category parameter for the shared legacy table. Bind it for
        // dedicated tables as well, so every prepared statement uses identical positions.
        let sql=format!("INSERT INTO {}(employee_id,{date},{title},{ty},{org},{value},note,created_at,{})
            SELECT $1,($2->>'record_date')::date,$2->>'title',$4,$2->>'organization',$2->>'value',$2->>'note',statement_timestamp() AT TIME ZONE 'UTC',{}
            WHERE $3::text IS NOT NULL RETURNING id",c.table,c.defaults,c.default_values);
        sqlx::query_scalar(AssertSqlSafe(sql))
            .bind(employee)
            .bind(p)
            .bind(c.name)
            .bind(normalized)
            .fetch_one(&mut *conn)
            .await?
    };
    records(conn, employee, c, Some(id))
        .await?
        .pop()
        .ok_or_else(missing_record)
}

async fn delete(
    conn: &mut PgConnection,
    c: &Category,
    employee: i32,
    id: i32,
) -> Result<(), ApiError> {
    let sql = format!(
        "DELETE FROM {} r WHERE employee_id=$1 AND {} AND id=$3",
        c.table,
        c.filter()
    );
    if sqlx::query(AssertSqlSafe(sql))
        .bind(employee)
        .bind(c.name)
        .bind(id)
        .execute(conn)
        .await?
        .rows_affected()
        == 0
    {
        return Err(missing_record());
    }
    Ok(())
}

#[derive(Deserialize)]
struct CategoryQuery {
    category: Option<String>,
    employee_no: Option<String>,
    name: Option<String>,
    department: Option<String>,
    employment_status: Option<String>,
}
impl CategoryQuery {
    fn name(&self) -> Result<&str, ApiError> {
        self.category.as_deref().ok_or_else(|| {
            ApiError::validation(vec![Violation {
                kind: "missing",
                msg: "Field required".into(),
                loc: vec![json!("query"), json!("category")],
                input: Value::Null,
            }])
        })
    }
}

async fn create(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
    Body(BasicRecordCreate(p)): Body<BasicRecordCreate>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    lock_employee(&mut tx, id).await?;
    let cat = category(p["category"].as_str().expect("validated category"))?;
    let result = save(&mut tx, &cat, id, None, &p).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(result)))
}
async fn update(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path((id, record)): Path<(i32, i32)>,
    Query(q): Query<CategoryQuery>,
    Body(BasicRecordUpdate(p)): Body<BasicRecordUpdate>,
) -> Reply {
    let name = q.name()?;
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    lock_employee(&mut tx, id).await?;
    let c = category(name)?;
    let result = save(&mut tx, &c, id, Some(record), &p).await?;
    tx.commit().await?;
    Ok(Json(result))
}
async fn remove(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path((id, record)): Path<(i32, i32)>,
    Query(q): Query<CategoryQuery>,
) -> Result<StatusCode, ApiError> {
    let name = q.name()?;
    hr_role(&s.pool, &u).await?;
    let c = category(name)?;
    let mut tx = s.pool.begin().await?;
    delete(&mut tx, &c, id, record).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn admin_records(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<CategoryQuery>,
) -> Reply {
    let name = q.name()?;
    hr_role(&s.pool, &u).await?;
    let c = category(name)?;
    let sql=format!("SELECT {} || jsonb_build_object('employee_id',e.id,'employee_no',e.employee_no,'display_name',u.display_name,
        'department_name',d.name,'employment_status',e.employment_status) FROM {} r JOIN hr_employees e ON e.id=r.employee_id
        JOIN auth_users u ON u.id=e.user_id JOIN org_departments d ON d.id=e.department_id
        WHERE {} AND strpos(lower(e.employee_no),lower($1))>0 AND strpos(lower(u.display_name),lower($3))>0
        AND strpos(lower(d.name),lower($4))>0 AND ($5::text IS NULL OR e.employment_status=$5)
        ORDER BY e.employee_no,r.{} DESC,r.id DESC",c.project(),c.table,c.filter(),c.cols[0]);
    let mut items: Vec<Value> = sqlx::query_scalar(AssertSqlSafe(sql))
        .bind(q.employee_no.as_deref().unwrap_or("").trim())
        .bind(c.name)
        .bind(q.name.as_deref().unwrap_or("").trim())
        .bind(q.department.as_deref().unwrap_or("").trim())
        .bind(q.employment_status.filter(|s| !s.trim().is_empty()))
        .fetch_all(&s.pool)
        .await?;
    for item in &mut items {
        instant_fields(item, &["created_at"]);
    }
    Ok(Json(json!({"items":items})))
}

async fn batch(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
    Body(BasicRecordBatch(p)): Body<BasicRecordBatch>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let c = category(p["category"].as_str().expect("validated category"))?;
    let mut tx = s.pool.begin().await?;
    lock_employee(&mut tx, id).await?;
    let items = p["items"].as_array().map(Vec::as_slice).unwrap_or(&[]);
    let deletes = p["delete_ids"].as_array().map(Vec::as_slice).unwrap_or(&[]);
    let mut seen = HashSet::new();
    let mut inserted = 0;
    for row in deletes {
        let record = int(row)
            .filter(|i| *i > 0)
            .ok_or_else(|| bad("Invalid record id."))?;
        if !seen.insert(record) {
            return Err(bad("Duplicate record id."));
        }
        delete(&mut tx, &c, id, record).await?;
    }
    for row in items {
        if row["title"].as_str().is_none_or(|s| s.trim().is_empty()) {
            return Err(bad("Record title is required."));
        }
        let record = int(&row["id"]);
        if let Some(record) = record {
            if !seen.insert(record) {
                return Err(bad("Duplicate record id."));
            }
        } else {
            inserted += 1;
        }
        save(&mut tx, &c, id, record, row).await?;
    }
    let list = records(&mut tx, id, &c, None).await?;
    tx.commit().await?;
    Ok(Json(
        json!({"items":list,"inserted_count":inserted,"updated_count":items.len()-inserted,"deleted_count":deletes.len()}),
    ))
}
