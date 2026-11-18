use super::forms::{EmployeeBatch, EmployeeCreate, EmployeeUpdate};
use super::{Reply, hr_role};
use crate::{
    ApiError, AppState,
    input::{Body, Violation},
    security::{self, CurrentUser},
};
use axum::{
    Extension, Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post, put},
};
use chrono::{Local, NaiveDate, SecondsFormat, TimeZone, Utc};
use ring::rand::{SecureRandom, SystemRandom};
use serde_json::{Value, json};
use sqlx::{PgConnection, PgPool};

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/employees", get(list).post(create))
        .route("/api/v1/employees/departments", get(departments))
        .route("/api/v1/employees/me", get(me))
        .route("/api/v1/employees/batch", post(batch))
        .route(
            "/api/v1/employees/{employee_id}",
            put(update).delete(remove),
        )
}

async fn authorize(pool: &PgPool, user: &CurrentUser, action: &str) -> Result<(), ApiError> {
    hr_role(pool, user).await?;
    // HR uses a role override even when the menu has no default row for the action.
    let menu_id: i32 = sqlx::query_scalar(
        "SELECT id FROM app_menus WHERE path='/hr/employee' AND is_active ORDER BY id LIMIT 1",
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Menu not found."))?;
    let (access,allowed):(bool,bool)=sqlx::query_as("SELECT EXISTS(
        SELECT 1 FROM app_menu_roles m JOIN auth_user_roles u USING (role_id) WHERE u.user_id=$1 AND m.menu_id=$2),
        COALESCE((SELECT bool_or(a.allowed) FROM app_role_menu_actions a JOIN auth_user_roles u USING(role_id)
                  WHERE u.user_id=$1 AND a.menu_id=$2 AND a.action_code=$3),
                 (SELECT enabled_default FROM app_menu_actions WHERE menu_id=$2 AND action_code=$3),
                 NOT EXISTS(SELECT 1 FROM app_menu_actions WHERE menu_id=$2))")
        .bind(user.id).bind(menu_id).bind(action).fetch_one(pool).await?;
    if !access {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Access denied."));
    }
    if !allowed {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Action not allowed."));
    }
    Ok(())
}

async fn departments(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
) -> Reply {
    authorize(&state.pool, &user, "query").await?;
    let rows:Vec<Value>=sqlx::query_scalar("SELECT jsonb_build_object('id',id,'code',code,'name',name) FROM org_departments ORDER BY code")
        .fetch_all(&state.pool).await?;
    Ok(Json(json!({"departments":rows})))
}

fn query_error(name: &str, raw: &str, integer: bool) -> ApiError {
    ApiError::validation(vec![Violation {
        kind: if integer {
            "int_parsing"
        } else {
            "value_error"
        },
        msg: if integer {
            "Input should be a valid integer, unable to parse string as an integer"
        } else {
            "Input should be a valid value"
        }
        .into(),
        loc: vec![json!("query"), json!(name)],
        input: json!(raw),
    }])
}

async fn list(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Query(params): Query<Vec<(String, String)>>,
) -> Reply {
    let get = |name: &str| {
        params
            .iter()
            .find(|(k, _)| k == name)
            .map(|(_, v)| v.as_str())
    };
    let string_list = |name: &str| {
        let values: Vec<_> = params
            .iter()
            .filter(|(k, _)| k == name)
            .map(|(_, v)| v.clone())
            .collect();
        if values.len() == 1 {
            values[0]
                .split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_owned)
                .collect()
        } else {
            values
        }
    };
    let integer = |name: &str, default: i32| -> Result<i32, ApiError> {
        get(name)
            .filter(|s| !s.is_empty())
            .map(|s| s.trim().parse().map_err(|_| query_error(name, s, true)))
            .transpose()
            .map(|n| n.unwrap_or(default))
    };
    let boolean = |name: &str| -> Result<Option<bool>, ApiError> {
        get(name)
            .filter(|s| !s.is_empty())
            .map(|s| match s.trim().to_ascii_lowercase().as_str() {
                "true" | "yes" | "on" | "1" => Ok(true),
                "false" | "no" | "off" | "0" => Ok(false),
                _ => Err(query_error(name, s, false)),
            })
            .transpose()
    };
    let page = integer("page", 1)?;
    let limit = integer("limit", 100)?;
    let all = boolean("all")?.unwrap_or(false);
    let active = boolean("active")?;
    let date: Option<NaiveDate> = get("hire_date_to")
        .filter(|s| !s.is_empty())
        .map(|s| s.parse().map_err(|_| query_error("hire_date_to", s, false)))
        .transpose()?;
    if page < 1 || !(1..=1000).contains(&limit) {
        let field = if page < 1 { "page" } else { "limit" };
        let bound = if page >= 1 && limit > 1000 {
            "less than or equal to 1000"
        } else {
            "greater than or equal to 1"
        };
        return Err(ApiError::validation(vec![Violation {
            kind: "validation_error",
            loc: vec![json!("request")],
            input: Value::Null,
            msg: format!("employees.{field}: must be {bound}"),
        }]));
    }
    authorize(&state.pool, &user, "query").await?;
    let (count,mut employees):(i64, Value)=sqlx::query_as("WITH filtered AS (
        SELECT e.id,e.employee_no,u.login_id,u.display_name,u.email,e.department_id,d.name department_name,
               e.position_title,e.hire_date,e.employment_status,u.is_active
        FROM hr_employees e JOIN auth_users u ON u.id=e.user_id JOIN org_departments d ON d.id=e.department_id
        WHERE ($1::text IS NULL OR lower(e.employee_no) LIKE '%'||lower($1)||'%')
          AND ($2::text IS NULL OR lower(u.display_name) LIKE '%'||lower($2)||'%')
          AND ($3::text IS NULL OR lower(d.name) LIKE '%'||lower($3)||'%')
          AND ($4::text IS NULL OR e.employment_status=$4) AND ($5::bool IS NULL OR u.is_active=$5)
          AND (cardinality($6::text[])=0 OR e.position_title=ANY($6))
          AND (cardinality($7::text[])=0 OR e.employment_status=ANY($7))
          AND ($8::date IS NULL OR e.hire_date<=$8)),
        page AS (SELECT * FROM filtered ORDER BY id LIMIT $9 OFFSET $10)
        SELECT (SELECT count(*) FROM filtered),COALESCE(jsonb_agg(to_jsonb(page) ORDER BY id),'[]') FROM page")
        .bind(get("employee_no")).bind(get("name")).bind(get("department")).bind(get("employment_status"))
        .bind(active).bind(string_list("positions")).bind(string_list("employment_statuses")).bind(date)
        .bind((!all).then_some(limit)).bind(if all {0} else {i64::from(page-1)*i64::from(limit)}).fetch_one(&state.pool).await?;
    if let Some(rows) = employees.as_array_mut() {
        for row in rows {
            if let Some(date) = row["hire_date"]
                .as_str()
                .and_then(|date| date.parse::<NaiveDate>().ok())
                && let Some(local) = Local
                    .from_local_datetime(&date.and_hms_opt(0, 0, 0).unwrap())
                    .earliest()
            {
                row["hire_date"] = json!(
                    local
                        .with_timezone(&Utc)
                        .to_rfc3339_opts(SecondsFormat::Millis, true)
                );
            }
        }
    }
    let mut result = json!({"employees":employees,"total_count":count});
    if !all {
        result["page"] = json!(page);
        result["limit"] = json!(limit);
    }
    Ok(Json(result))
}

pub(super) async fn employee(
    conn: &mut PgConnection,
    id: i32,
    by_user: bool,
) -> Result<Value, ApiError> {
    sqlx::query_scalar("SELECT to_jsonb(src) FROM (
        SELECT e.id,e.employee_no,u.login_id,u.display_name,u.email,e.department_id,d.name AS department_name,
               e.position_title,e.hire_date,e.employment_status,u.is_active,e.user_id
        FROM hr_employees e JOIN auth_users u ON u.id=e.user_id JOIN org_departments d ON d.id=e.department_id
        WHERE CASE WHEN $2 THEN e.user_id=$1 ELSE e.id=$1 END) src").bind(id).bind(by_user)
        .fetch_optional(conn).await?.ok_or_else(||ApiError::new(StatusCode::NOT_FOUND,if by_user{"Employee profile not found."}else{"Employee not found."}))
}

async fn me(State(s): State<AppState>, Extension(user): Extension<CurrentUser>) -> Reply {
    let mut conn = s.pool.acquire().await?;
    Ok(Json(
        json!({"employee":employee(&mut conn,user.id,true).await?}),
    ))
}

fn bad(msg: &str) -> ApiError {
    ApiError::new(StatusCode::BAD_REQUEST, msg)
}
fn conflict(msg: &str) -> ApiError {
    ApiError::new(StatusCode::CONFLICT, msg)
}
fn internal() -> ApiError {
    ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
}
pub(super) fn int(v: &Value) -> Option<i32> {
    v.as_i64().and_then(|n| i32::try_from(n).ok())
}
fn field_date(v: &Value) -> Result<Option<NaiveDate>, ApiError> {
    v.as_str()
        .map(|s| s.parse().map_err(|_| bad("Invalid date.")))
        .transpose()
}

async fn check_department(conn: &mut PgConnection, id: i32) -> Result<(), ApiError> {
    if sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM org_departments WHERE id=$1)")
        .bind(id)
        .fetch_one(conn)
        .await?
    {
        Ok(())
    } else {
        Err(bad("Invalid department_id."))
    }
}

async fn hash(pass: &str) -> Result<String, ApiError> {
    let pass = pass.to_owned();
    tokio::task::spawn_blocking(move || security::hash_password(&pass))
        .await
        .map_err(|_| internal())?
        .map_err(|_| internal())
}

pub(super) async fn number_lock(conn: &mut PgConnection) -> Result<(), ApiError> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext('hr_employee_number_namespace'))")
        .execute(conn)
        .await?;
    Ok(())
}

async fn generate_id(conn: &mut PgConnection, is_employee: bool) -> Result<String, ApiError> {
    let rng = SystemRandom::new();
    for _ in 0..30 {
        let mut bytes = [0; 10];
        rng.fill(&mut bytes).map_err(|_| internal())?;
        let candidate = if is_employee {
            format!(
                "EMP-{:06}",
                u32::from_be_bytes(bytes[..4].try_into().unwrap()) % 1_000_000
            )
        } else {
            let alphabet = b"abcdefghijklmnopqrstuvwxyz0123456789";
            let letters: String = bytes
                .iter()
                .map(|b| char::from(alphabet[usize::from(*b) % alphabet.len()]))
                .collect();
            format!("usr-{letters}")
        };
        let used:bool=if is_employee {sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM hr_employees WHERE employee_no=$1 UNION ALL SELECT 1 FROM hr_recruit_finalists WHERE employee_no=$1)")}
            else{sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM auth_users WHERE login_id=$1)")}.bind(&candidate).fetch_one(&mut *conn).await?;
        if !used {
            return Ok(candidate);
        }
    }
    Err(bad(if is_employee {
        "Failed to generate employee_no."
    } else {
        "Failed to generate login_id."
    }))
}

pub(super) async fn insert_employee(
    conn: &mut PgConnection,
    p: &Value,
    reservation: Option<i32>,
) -> Result<Value, ApiError> {
    let dep = int(&p["department_id"]).ok_or_else(|| bad("Invalid department_id."))?;
    check_department(conn, dep).await?;
    number_lock(conn).await?;
    let number = match p["employee_no"]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(s) => s.to_owned(),
        None => generate_id(conn, true).await?,
    };
    let login = match p["login_id"]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(s) => s.to_owned(),
        None => generate_id(conn, false).await?,
    };
    let email = p["email"]
        .as_str()
        .map(str::to_owned)
        .unwrap_or_else(|| format!("{login}@vibe-hr.local"));
    let used:(bool,bool,bool,bool)=sqlx::query_as("SELECT EXISTS(SELECT 1 FROM hr_employees WHERE employee_no=$1),
        EXISTS(SELECT 1 FROM hr_recruit_finalists WHERE employee_no=$1 AND id IS DISTINCT FROM $2),
        EXISTS(SELECT 1 FROM auth_users WHERE login_id=$3),EXISTS(SELECT 1 FROM auth_users WHERE email=$4)")
        .bind(&number).bind(reservation).bind(&login).bind(&email).fetch_one(&mut *conn).await?;
    for (exists, msg) in [
        (used.0, "employee_no already exists."),
        (used.1, "employee_no is reserved by a recruitment finalist."),
        (used.2, "login_id already exists."),
        (used.3, "email already exists."),
    ] {
        if exists {
            return Err(conflict(msg));
        }
    }
    let password = p["password"]
        .as_str()
        .ok_or_else(|| bad("Invalid password."))?;
    let user:i32=sqlx::query_scalar("INSERT INTO auth_users(login_id,email,password_hash,display_name,is_active,created_at,updated_at)
      VALUES($1,$2,$3,$4,true,statement_timestamp() at time zone 'UTC',statement_timestamp() at time zone 'UTC') RETURNING id")
        .bind(login).bind(email).bind(hash(password).await?).bind(p["display_name"].as_str()).fetch_one(&mut *conn).await?;
    sqlx::query("INSERT INTO auth_user_roles(user_id,role_id,assigned_at) SELECT $1,id,statement_timestamp() AT TIME ZONE 'UTC' FROM auth_roles WHERE code='employee' ON CONFLICT DO NOTHING")
        .bind(user).execute(&mut *conn).await?;
    let id:i32=sqlx::query_scalar("INSERT INTO hr_employees(user_id,employee_no,department_id,position_title,hire_date,employment_status,created_at,updated_at)
        VALUES ($1,$2,$3,$4,coalesce($5,(statement_timestamp() AT TIME ZONE 'Asia/Seoul')::date),$6,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC') RETURNING id")
        .bind(user).bind(number).bind(dep).bind(p["position_title"].as_str()).bind(field_date(&p["hire_date"])?).bind(p["employment_status"].as_str().unwrap_or("active"))
        .fetch_one(&mut *conn).await?;
    employee(conn, id, false).await
}

pub(super) async fn lock_employee(conn: &mut PgConnection, id: i32) -> Result<i32, ApiError> {
    sqlx::query_scalar("SELECT user_id FROM hr_employees WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Employee not found."))
}

async fn update_employee(conn: &mut PgConnection, id: i32, p: &Value) -> Result<Value, ApiError> {
    let user = lock_employee(conn, id).await?;
    if let Some(dep) = int(&p["department_id"]) {
        check_department(conn, dep).await?;
    }
    let email = p["email"].as_str();
    if let Some(email) = email
        && sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM auth_users WHERE id<>$1 AND email=$2)",
        )
        .bind(user)
        .bind(email)
        .fetch_one(&mut *conn)
        .await?
    {
        return Err(conflict("email already exists."));
    }
    let password = match p["password"].as_str().filter(|p| !p.trim().is_empty()) {
        Some(p) => Some(hash(p).await?),
        None => None,
    };
    sqlx::query("UPDATE auth_users SET email=coalesce($2,email),display_name=coalesce($3,display_name),is_active=coalesce($4,is_active),
        password_hash=coalesce($5,password_hash),updated_at=statement_timestamp() AT TIME ZONE 'UTC'
        WHERE id=$1 AND (($2::text IS NOT NULL AND email IS DISTINCT FROM $2) OR $3 IS NOT NULL OR $4 IS NOT NULL OR $5 IS NOT NULL)")
        .bind(user).bind(email).bind(p["display_name"].as_str()).bind(p["is_active"].as_bool()).bind(password).execute(&mut *conn).await?;
    sqlx::query("UPDATE hr_employees SET department_id=coalesce($2,department_id),position_title=coalesce($3,position_title),
        hire_date=coalesce($4,hire_date),employment_status=coalesce($5,employment_status),updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
        .bind(id).bind(int(&p["department_id"])).bind(p["position_title"].as_str()).bind(field_date(&p["hire_date"])?)
        .bind(p["employment_status"].as_str()).execute(&mut *conn).await?;
    employee(conn, id, false).await
}

async fn delete_employees(conn: &mut PgConnection, ids: &[i32]) -> Result<(), ApiError> {
    let mut ids = ids.to_vec();
    ids.retain(|n| *n > 0);
    ids.sort_unstable();
    ids.dedup();
    let existing: Vec<(i32, i32)> = sqlx::query_as(
        "SELECT id,user_id FROM hr_employees WHERE id=ANY($1) ORDER BY id FOR UPDATE",
    )
    .bind(&ids)
    .fetch_all(&mut *conn)
    .await?;
    if let Some(missing) = ids
        .iter()
        .find(|id| existing.binary_search_by_key(*id, |(id, _)| *id).is_err())
    {
        return Err(ApiError::new(
            StatusCode::NOT_FOUND,
            format!("Employee not found: {missing}"),
        ));
    }
    let users: Vec<_> = existing.iter().map(|(_, id)| *id).collect();
    delete_relations(conn,&ids,&users).await.map_err(|_|conflict("Cannot delete employee linked to existing attendance/leave/schedule/payroll or related records."))
}

async fn delete_relations(
    conn: &mut PgConnection,
    ids: &[i32],
    users: &[i32],
) -> Result<(), sqlx::Error> {
    let orders: Vec<i32> = sqlx::query_scalar(
        "SELECT DISTINCT order_id FROM hr_appointment_order_items WHERE employee_id=ANY($1)",
    )
    .bind(ids)
    .fetch_all(&mut *conn)
    .await?;
    for sql in [
        "UPDATE tim_leave_requests SET approver_employee_id=NULL,updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE approver_employee_id=ANY($1)",
        "DELETE FROM tim_leave_requests WHERE employee_id=ANY($1)",
        "DELETE FROM tim_annual_leaves WHERE employee_id=ANY($1)",
        "DELETE FROM tim_attendance_daily WHERE employee_id=ANY($1)",
        "DELETE FROM hr_personnel_histories WHERE employee_id=ANY($1)",
        "DELETE FROM hr_employee_info_records WHERE employee_id=ANY($1)",
        "DELETE FROM hr_employee_basic_profiles WHERE employee_id=ANY($1)",
        "DELETE FROM hr_appointment_order_items WHERE employee_id=ANY($1)",
    ] {
        sqlx::query(sql).bind(ids).execute(&mut *conn).await?;
    }
    sqlx::query("DELETE FROM hr_appointment_orders o WHERE id=ANY($1) AND NOT EXISTS(SELECT 1 FROM hr_appointment_order_items i WHERE i.order_id=o.id)")
        .bind(orders).execute(&mut *conn).await?;
    sqlx::query("DELETE FROM hr_employees WHERE id=ANY($1)")
        .bind(ids)
        .execute(&mut *conn)
        .await?;
    sqlx::query("DELETE FROM auth_user_roles WHERE user_id=ANY($1)")
        .bind(users)
        .execute(&mut *conn)
        .await?;
    sqlx::query("DELETE FROM auth_users WHERE id=ANY($1)")
        .bind(users)
        .execute(&mut *conn)
        .await?;
    Ok(())
}

async fn create(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Body(p): Body<EmployeeCreate>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    authorize(&s.pool, &user, "save").await?;
    let mut tx = s.pool.begin().await?;
    let result = insert_employee(&mut tx, &p.0, None).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({"employee":result}))))
}
async fn update(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<i32>,
    Body(p): Body<EmployeeUpdate>,
) -> Reply {
    authorize(&s.pool, &user, "save").await?;
    let mut tx = s.pool.begin().await?;
    let result = update_employee(&mut tx, id, &p.0).await?;
    tx.commit().await?;
    Ok(Json(json!({"employee":result})))
}
async fn remove(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Result<StatusCode, ApiError> {
    authorize(&s.pool, &user, "save").await?;
    let mut tx = s.pool.begin().await?;
    delete_employees(&mut tx, &[id]).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn batch(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Body(EmployeeBatch(p)): Body<EmployeeBatch>,
) -> Reply {
    authorize(&s.pool, &user, "save").await?;
    let mut tx = s.pool.begin().await?;
    let updates = p["update"].as_array().expect("validated update list");
    let inserts = p["insert"].as_array().expect("validated insert list");
    let mut ids: Vec<i32> = p["delete"]
        .as_array()
        .expect("validated delete list")
        .iter()
        .filter_map(int)
        .collect();
    ids.retain(|i| *i > 0);
    ids.sort_unstable();
    ids.dedup();
    if !ids.is_empty() {
        delete_employees(&mut tx, &ids).await?;
    }
    for (index, item) in updates.iter().enumerate() {
        let id = int(&item["id"])
            .filter(|id| *id > 0)
            .ok_or_else(|| bad(&format!("update[{}] requires valid id.", index + 1)))?;
        update_employee(&mut tx, id, item).await?;
    }
    for item in inserts {
        insert_employee(&mut tx, item, None).await?;
    }
    tx.commit().await?;
    Ok(Json(
        json!({"inserted_count":inserts.len(),"updated_count":updates.len(),"deleted_count":ids.len()}),
    ))
}
