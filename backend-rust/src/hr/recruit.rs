use super::forms::{FinalistCreate, FinalistUpdate, Ids, IfSync};
use super::{
    Reply,
    basic::instant_fields,
    employees::{insert_employee, int, number_lock},
    hr_role,
};
use crate::{ApiError, AppState, input::Body, security::CurrentUser};
use axum::{
    Extension, Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post, put},
};
use base64::Engine;
use chrono::Utc;
use ring::rand::{SecureRandom, SystemRandom};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{Acquire, PgConnection};

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/hr/recruit/finalists",
            get(list).post(create).delete(remove),
        )
        .route("/api/v1/hr/recruit/finalists/{finalist_id}", put(update))
        .route("/api/v1/hr/recruit/finalists/if-sync", post(sync))
        .route(
            "/api/v1/hr/recruit/finalists/generate-employee-no",
            post(numbers),
        )
        .route(
            "/api/v1/hr/recruit/finalists/create-employees",
            post(create_employees),
        )
}

#[derive(Deserialize)]
struct Search {
    search: Option<String>,
}
async fn list(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Search>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let filter = q.search.as_deref().unwrap_or("").trim();
    let mut items:Vec<Value>=sqlx::query_scalar("SELECT to_jsonb(f) FROM hr_recruit_finalists f WHERE
        strpos(lower(full_name),lower($1))>0 OR strpos(lower(candidate_no),lower($1))>0 OR strpos(lower(employee_no),lower($1))>0 OR strpos(lower(login_id),lower($1))>0 ORDER BY id DESC")
        .bind(filter).fetch_all(&s.pool).await?;
    for row in &mut items {
        instant_fields(row, &["created_at", "updated_at"]);
    }
    Ok(Json(json!({"items":items,"total_count":items.len()})))
}

fn not_found(msg: &str) -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, msg)
}
fn conflict(msg: &str) -> ApiError {
    ApiError::new(StatusCode::CONFLICT, msg)
}
fn stripped(v: &Value) -> Option<&str> {
    v.as_str().map(str::trim).filter(|s| !s.is_empty())
}

pub(super) async fn lock_named(conn: &mut PgConnection, name: &str) -> Result<(), ApiError> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1))")
        .bind(name)
        .execute(conn)
        .await?;
    Ok(())
}

async fn next_candidate(conn: &mut PgConnection) -> Result<String, ApiError> {
    let prefix = format!("RC{}-", Utc::now().format("%Y%m%d"));
    let values: Vec<String> = sqlx::query_scalar(
        "SELECT candidate_no FROM hr_recruit_finalists WHERE candidate_no LIKE $1||'%'",
    )
    .bind(&prefix)
    .fetch_all(conn)
    .await?;
    let max = values
        .iter()
        .filter_map(|n| n.rsplit('-').next()?.parse::<i32>().ok())
        .max()
        .unwrap_or(0);
    Ok(format!("{prefix}{:04}", i64::from(max) + 1))
}

async fn next_number(conn: &mut PgConnection) -> Result<i64, ApiError> {
    let rows: Vec<String> = sqlx::query_scalar(
        "SELECT employee_no FROM hr_employees WHERE employee_no LIKE 'EMP-%'
        UNION ALL SELECT employee_no FROM hr_recruit_finalists WHERE employee_no LIKE 'EMP-%'",
    )
    .fetch_all(conn)
    .await?;
    Ok(1 + i64::from(
        rows.iter()
            .filter_map(|s| s.get(4..)?.parse::<i32>().ok())
            .max()
            .unwrap_or(0),
    ))
}
async fn number_available(
    conn: &mut PgConnection,
    no: &str,
    except: Option<i32>,
) -> Result<(), ApiError> {
    let (employee, finalist): (bool, bool) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM hr_employees WHERE employee_no=$1),
        EXISTS(SELECT 1 FROM hr_recruit_finalists WHERE employee_no=$1 AND id IS DISTINCT FROM $2)",
    )
    .bind(no)
    .bind(except)
    .fetch_one(conn)
    .await?;
    if employee {
        Err(conflict("employee_no already exists."))
    } else if finalist {
        Err(conflict(
            "employee_no is reserved by a recruitment finalist.",
        ))
    } else {
        Ok(())
    }
}

const COLS: [&str; 16] = [
    "source_type",
    "external_key",
    "full_name",
    "resident_no_masked",
    "birth_date",
    "phone_mobile",
    "email",
    "hire_type",
    "career_years",
    "login_id",
    "employee_no",
    "expected_join_date",
    "status_code",
    "note",
    "is_active",
    "candidate_no",
];

fn fields(p: &Value) -> Value {
    let mut result = json!({});
    for field in &COLS[..15] {
        let value = &p[*field];
        if value.is_null() {
            continue;
        }
        result[*field] = match *field {
            "external_key" | "resident_no_masked" | "phone_mobile" | "email" | "login_id"
            | "employee_no" | "note" => json!(stripped(value)),
            "full_name" => json!(value.as_str().unwrap_or("").trim()),
            _ => value.clone(),
        };
    }
    result
}

async fn persist(
    conn: &mut PgConnection,
    id: Option<i32>,
    mut data: Value,
) -> Result<Value, ApiError> {
    let mut row: Value = if let Some(id) = id {
        sqlx::query_scalar("UPDATE hr_recruit_finalists f SET
            (source_type,external_key,full_name,resident_no_masked,birth_date,phone_mobile,email,hire_type,career_years,login_id,employee_no,expected_join_date,status_code,note,is_active)=
            (SELECT v.source_type,v.external_key,v.full_name,v.resident_no_masked,v.birth_date,v.phone_mobile,v.email,v.hire_type,v.career_years,v.login_id,v.employee_no,v.expected_join_date,v.status_code,v.note,v.is_active FROM jsonb_populate_record(f,$2) v),
            updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1 RETURNING to_jsonb(f)").bind(id).bind(data).fetch_one(conn).await?
    } else {
        data["candidate_no"] = json!(next_candidate(conn).await?);
        sqlx::query_scalar("INSERT INTO hr_recruit_finalists AS f
            (source_type,external_key,full_name,resident_no_masked,birth_date,phone_mobile,email,hire_type,career_years,login_id,employee_no,expected_join_date,status_code,note,is_active,candidate_no,created_at,updated_at)
            SELECT coalesce(v.source_type,'manual'),v.external_key,v.full_name,v.resident_no_masked,v.birth_date,v.phone_mobile,v.email,coalesce(v.hire_type,'new'),v.career_years,v.login_id,v.employee_no,v.expected_join_date,coalesce(v.status_code,'draft'),v.note,coalesce(v.is_active,true),v.candidate_no,
            statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC' FROM jsonb_populate_record(NULL::hr_recruit_finalists,$1) v RETURNING to_jsonb(f)")
            .bind(data).fetch_one(conn).await?
    };
    instant_fields(&mut row, &["created_at", "updated_at"]);
    Ok(row)
}

async fn create(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(FinalistCreate(p)): Body<FinalistCreate>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    lock_named(&mut tx, "hr_recruit_candidate_no").await?;
    let data = fields(&p);
    if let Some(no) = data["employee_no"].as_str() {
        number_lock(&mut tx).await?;
        number_available(&mut tx, no, None).await?;
    }
    let row = persist(&mut tx, None, data).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({"item":row}))))
}

async fn update(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
    Body(FinalistUpdate(p)): Body<FinalistUpdate>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let (old, no): (String, Option<String>) = sqlx::query_as(
        "SELECT status_code,employee_no FROM hr_recruit_finalists WHERE id=$1 FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| not_found("채용합격자 정보를 찾을 수 없습니다."))?;
    let data = fields(&p);
    if let Some(next) = data["status_code"].as_str()
        && next != old
        && !matches!(
            (old.as_str(), next),
            ("draft", "ready") | ("ready", "draft" | "appointed")
        )
    {
        return Err(ApiError::new(
            StatusCode::UNPROCESSABLE_ENTITY,
            format!("상태 전이 불가: '{old}' → '{next}'"),
        ));
    }
    if let Some(num) = data.get("employee_no") {
        number_lock(&mut tx).await?;
        if old == "appointed" && num.as_str() != no.as_deref() {
            return Err(conflict(
                "Appointed finalist employee_no cannot be changed.",
            ));
        }
        if old != "appointed"
            && let Some(n) = num.as_str()
        {
            number_available(&mut tx, n, Some(id)).await?;
        }
    }
    let row = persist(&mut tx, Some(id), data).await?;
    tx.commit().await?;
    Ok(Json(json!({"item":row})))
}

fn row_ids(p: &Value) -> Vec<i32> {
    p["ids"]
        .as_array()
        .expect("validated ID list")
        .iter()
        .filter_map(int)
        .collect()
}
async fn remove(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(q): Body<Ids>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let ids = row_ids(&q.0);
    let found: Vec<i32> = sqlx::query_scalar(
        "SELECT id FROM hr_recruit_finalists WHERE id=ANY($1) ORDER BY id FOR UPDATE",
    )
    .bind(&ids)
    .fetch_all(&mut *tx)
    .await?;
    let count = ids.iter().filter(|i| found.contains(i)).count();
    if count == 0 {
        return Err(not_found("삭제할 채용합격자 데이터가 없습니다."));
    }
    sqlx::query("DELETE FROM hr_recruit_finalists WHERE id=ANY($1)")
        .bind(found)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(json!({"deleted_count":count})))
}
async fn sync(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(IfSync(p)): Body<IfSync>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    lock_named(&mut tx, "hr_recruit_candidate_no").await?;
    let mut ins = 0;
    let mut upd = 0;
    for inbound in p["rows"].as_array().map(Vec::as_slice).unwrap_or(&[]) {
        let id: Option<i32> =
            sqlx::query_scalar("SELECT id FROM hr_recruit_finalists WHERE external_key=$1 LIMIT 1")
                .bind(inbound["external_key"].as_str())
                .fetch_optional(&mut *tx)
                .await?;
        let data = json!({"source_type":"if","external_key":inbound["external_key"],"full_name":inbound["full_name"].as_str().unwrap_or("").trim(),
            "phone_mobile":stripped(&inbound["phone_mobile"]),"email":stripped(&inbound["email"]),"note":stripped(&inbound["note"]),
            "expected_join_date":inbound["expected_join_date"],"hire_type":inbound["hire_type"].as_str().unwrap_or("new")});
        persist(&mut tx, id, data).await?;
        if id.is_some() {
            upd += 1;
        } else {
            ins += 1;
        }
    }
    tx.commit().await?;
    Ok(Json(json!({"inserted_count":ins,"updated_count":upd})))
}

async fn locked(conn: &mut PgConnection, mut ids: Vec<i32>) -> Result<Vec<i32>, ApiError> {
    ids.sort_unstable();
    let found: Vec<i32> = sqlx::query_scalar(
        "SELECT id FROM hr_recruit_finalists WHERE id=ANY($1) ORDER BY id FOR UPDATE",
    )
    .bind(&ids)
    .fetch_all(conn)
    .await?;
    if found.is_empty() {
        return Err(not_found("대상 채용합격자 데이터가 없습니다."));
    }
    ids.retain(|i| found.binary_search(i).is_ok());
    Ok(ids)
}

async fn numbers(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(p): Body<Ids>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    number_lock(&mut tx).await?;
    let rows = locked(&mut tx, row_ids(&p.0)).await?;
    let mut next = next_number(&mut tx).await?;
    let mut updated = 0;
    for id in &rows {
        let n = format!("EMP-{next:06}");
        let changes=sqlx::query("UPDATE hr_recruit_finalists SET employee_no=$2,login_id=CASE WHEN btrim(coalesce(login_id,''))='' THEN $3 ELSE login_id END,
            status_code=CASE WHEN status_code='draft' THEN 'ready' ELSE status_code END,updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1 AND btrim(coalesce(employee_no,''))=''")
            .bind(id).bind(&n).bind(n.to_ascii_lowercase().replace('-',"")).execute(&mut *tx).await?.rows_affected();
        if changes == 1 {
            next += 1;
            updated += 1;
        }
    }
    tx.commit().await?;
    Ok(Json(
        json!({"updated_count":updated,"skipped_count":rows.len()-updated}),
    ))
}

fn valid_email(v: &str) -> bool {
    v.split_once('@').is_some_and(|(a, b)| {
        !a.is_empty()
            && !b.contains('@')
            && b.rsplit_once('.')
                .is_some_and(|(l, r)| !l.is_empty() && !r.is_empty())
            && !v.chars().any(char::is_whitespace)
    })
}

async fn create_employees(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(p): Body<Ids>,
) -> Reply {
    hr_role(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    number_lock(&mut tx).await?;
    let rows = locked(&mut tx, row_ids(&p.0)).await?;
    let mut next = next_number(&mut tx).await?;
    let dep:i32=sqlx::query_scalar("SELECT id FROM org_departments WHERE code='HQ-HR' OR is_active ORDER BY (code='HQ-HR') DESC,id LIMIT 1")
        .fetch_optional(&mut *tx).await?.ok_or_else(||ApiError::new(StatusCode::BAD_REQUEST,"사원 생성에 사용할 기본 부서를 찾을 수 없습니다."))?;
    let mut results = vec![];
    let mut created = 0;
    let mut skipped = 0;
    let mut errors = 0;
    for id in rows {
        let f: Value =
            sqlx::query_scalar("SELECT to_jsonb(f) FROM hr_recruit_finalists f WHERE id=$1")
                .bind(id)
                .fetch_one(&mut *tx)
                .await?;
        let no = stripped(&f["employee_no"])
            .map(str::to_owned)
            .unwrap_or_else(|| {
                let n = format!("EMP-{next:06}");
                next += 1;
                n
            });
        let login = match stripped(&f["login_id"]) {
            Some(value) => value.to_owned(),
            None => {
                let base = no.to_lowercase().replace('-', "");
                let mut login = base.clone();
                let mut suffix = 1;
                while sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(SELECT 1 FROM auth_users WHERE login_id=$1)",
                )
                .bind(&login)
                .fetch_one(&mut *tx)
                .await?
                {
                    suffix += 1;
                    login = format!("{base}{suffix}");
                }
                login
            }
        };
        let mut sub = tx.begin().await?;
        let existing:Option<i32>=sqlx::query_scalar("SELECT e.id FROM hr_employees e JOIN auth_users u ON u.id=e.user_id WHERE employee_no=$1 AND login_id=$2")
            .bind(&no).bind(&login).fetch_optional(&mut *sub).await?;
        let mut result = json!({"finalist_id":id,"candidate_no":f["candidate_no"],"full_name":f["full_name"],"employee_id":null,"employee_no":f["employee_no"],"login_id":f["login_id"]});
        let employee = match existing {
            Some(e) => {
                skipped += 1;
                result["outcome"] = json!("skipped");
                result["detail"] = json!("이미 생성된 사원과 연결되어 있어 건너뛰었습니다.");
                e
            }
            None => {
                let email = stripped(&f["email"])
                    .filter(|e| valid_email(e))
                    .map(str::to_owned)
                    .unwrap_or_else(|| format!("{login}@hr.minosek91.cloud"));
                let mut random = [0; 9];
                SystemRandom::new().fill(&mut random).map_err(|_| {
                    ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                })?;
                let pass = format!(
                    "Aa1!{}",
                    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(random)
                );
                let data = json!({"employee_no":no,"display_name":f["full_name"].as_str().unwrap_or("").trim(),"department_id":dep,"position_title":"채용대기",
                    "hire_date":f["expected_join_date"].as_str().map(str::to_owned).unwrap_or_else(||chrono::Local::now().date_naive().to_string()),
                    "employment_status":"leave","login_id":login,"email":email,"password":pass});
                let emp = match insert_employee(&mut sub, &data, Some(id)).await {
                    Ok(emp) => emp,
                    Err(e) if e.0.is_client_error() => {
                        errors += 1;
                        result["outcome"] = json!("error");
                        result["detail"] = e.1;
                        sub.rollback().await?;
                        results.push(result);
                        continue;
                    }
                    Err(e) => return Err(e),
                };
                let emp_id = int(&emp["id"]).ok_or_else(|| {
                    ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                })?;
                sqlx::query("INSERT INTO hr_employee_basic_profiles(employee_id,birth_date,resident_no_masked,created_at,updated_at)
                    VALUES($1,($2->>'birth_date')::date,$2->>'resident_no_masked',statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC')
                    ON CONFLICT(employee_id) DO UPDATE SET birth_date=excluded.birth_date,resident_no_masked=excluded.resident_no_masked,updated_at=excluded.updated_at")
                    .bind(emp_id).bind(&f).execute(&mut *sub).await?;
                created += 1;
                result["outcome"] = json!("created");
                result["detail"] =
                    json!("사원 생성이 완료되었습니다. 발령 전까지 채용대기 상태로 유지됩니다.");
                emp_id
            }
        };
        sqlx::query("UPDATE hr_recruit_finalists SET employee_no=$2,login_id=$3,status_code=CASE WHEN status_code='draft' THEN 'ready' ELSE status_code END,
            updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1").bind(id).bind(&no).bind(&login).execute(&mut *sub).await?;
        sub.commit().await?;
        result["employee_id"] = json!(employee);
        result["employee_no"] = json!(no);
        result["login_id"] = json!(login);
        results.push(result);
    }
    tx.commit().await?;
    Ok(Json(
        json!({"created_count":created,"skipped_count":skipped,"error_count":errors,"results":results}),
    ))
}
