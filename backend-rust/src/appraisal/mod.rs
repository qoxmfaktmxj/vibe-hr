mod targets;
use crate::{
    ApiError, AppState,
    input::{
        Body, Validate, Violation, not_blank,
        params::{NumericPath, query_i32},
        range, size,
    },
    security::CurrentUser,
};
use axum::{
    Extension, Json, Router,
    extract::{Query, State},
    http::StatusCode,
    routing::{get, post, put},
};
use chrono::{DateTime, NaiveDate, NaiveDateTime, SecondsFormat};
use serde::{Deserialize, Deserializer};
use serde_json::{Value, json};
use sqlx::{PgConnection, PgPool};

type Reply = Result<Json<Value>, ApiError>;
pub fn routes() -> Router<AppState> {
    Router::new().nest(
        "/api/v1/pap",
        Router::new()
            .route("/appraisals", get(appraisals).post(create_appraisal))
            .route(
                "/appraisals/{appraisalId}",
                put(update_appraisal).delete(delete_appraisal),
            )
            .route("/final-results", get(results).post(create_result))
            .route(
                "/final-results/{resultId}",
                put(update_result).delete(delete_result),
            )
            .route("/targets", get(targets::list))
            .route("/targets/batch", post(targets::batch)),
    )
}
pub(crate) fn role(user: &CurrentUser, employee_ok: bool) -> Result<(), ApiError> {
    if user.has_role("admin")
        || user.has_role("hr_manager")
        || employee_ok && user.has_role("employee")
    {
        Ok(())
    } else {
        Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "Not enough permissions.",
        ))
    }
}
async fn gate(
    pool: &PgPool,
    user: &CurrentUser,
    master: bool,
    action: &str,
) -> Result<(), ApiError> {
    role(user, false)?;
    let code = if master {
        "pap.appraisals"
    } else {
        "pap.final-results"
    };
    let permissions:Option<(bool,bool)>=sqlx::query_as("SELECT EXISTS(SELECT FROM app_menu_roles r JOIN auth_user_roles u USING(role_id) WHERE r.menu_id=m.id AND u.user_id=$2),
      coalesce((SELECT bool_or(o.allowed) FROM app_role_menu_actions o JOIN auth_user_roles u USING(role_id) WHERE o.menu_id=m.id AND o.action_code=$3 AND u.user_id=$2),
      (SELECT a.enabled_default FROM app_menu_actions a WHERE a.menu_id=m.id AND a.action_code=$3),NOT EXISTS(SELECT FROM app_menu_actions a WHERE a.menu_id=m.id))
      FROM app_menus m WHERE m.code=$1 AND m.is_active").bind(code).bind(user.id).bind(action).fetch_optional(pool).await?;
    match permissions {
        None => Err(ApiError::new(StatusCode::NOT_FOUND, "Menu not found.")),
        Some((false, _)) => Err(ApiError::new(StatusCode::FORBIDDEN, "Access denied.")),
        Some((true, false)) => Err(ApiError::new(StatusCode::FORBIDDEN, "Action not allowed.")),
        Some((true, true)) => Ok(()),
    }
}
pub(crate) fn dates(mut row: Value) -> Value {
    for key in ["created_at", "updated_at", "evaluated_at"] {
        if let Some(value) = row[key].as_str()
            && let Ok(stamp) = DateTime::parse_from_rfc3339(value)
                .map(|v| v.to_utc())
                .or_else(|_| value.parse::<NaiveDateTime>().map(|v| v.and_utc()))
        {
            row[key] = json!(stamp.to_rfc3339_opts(SecondsFormat::AutoSi, true));
        }
    }
    row
}
// JDBC getTimestamp interprets these MyBatis projections in the process timezone.
pub(crate) fn projection_dates(mut row: Value) -> Value {
    use chrono::TimeZone;
    for key in ["created_at", "updated_at", "evaluated_at"] {
        if let Some(naive) = row[key]
            .as_str()
            .and_then(|s| s.parse::<NaiveDateTime>().ok())
            && let Some(value) = chrono::Local.from_local_datetime(&naive).latest()
        {
            row[key] = json!(value.to_utc().to_rfc3339_opts(SecondsFormat::AutoSi, true));
        }
    }
    row
}
type Params = std::collections::HashMap<String, String>;
#[derive(Clone, Copy)]
enum Kind {
    Master,
    Result,
}
impl Kind {
    fn master(self) -> bool {
        matches!(self, Self::Master)
    }
    fn missing(self) -> ApiError {
        ApiError::new(
            StatusCode::NOT_FOUND,
            if self.master() {
                "Appraisal master not found."
            } else {
                "Final result not found."
            },
        )
    }
}
async fn list(s: AppState, u: CurrentUser, q: Params, k: Kind) -> Reply {
    let number = |name: &str, default: i32| {
        q.get(name)
            .filter(|v| !v.is_empty())
            .map(|v| query_i32(name, v))
            .transpose()
            .map(|v| v.unwrap_or(default))
    };
    let boolean = |name: &str| {
        q.get(name).filter(|s|!s.is_empty()).map(|s|match s.trim().to_lowercase().as_str(){"true"|"on"|"yes"|"1"=>Ok(true),"false"|"off"|"no"|"0"=>Ok(false),_=>Err(ApiError::with_detail(StatusCode::UNPROCESSABLE_ENTITY,json!([{"type":"value_error","loc":["query",name],"msg":"Input should be a valid value","input":s}])))}).transpose()
    };
    let page = number("page", 1)?;
    let limit = number("limit", 100)?;
    let active = boolean("active_only")?;
    let all = boolean("all")?.unwrap_or(false);
    let year = if k.master() {
        q.get("appraisal_year")
            .filter(|v| !v.is_empty())
            .map(|v| query_i32("appraisal_year", v))
            .transpose()?
    } else {
        None
    };
    let method = if k.master() {
        "listAppraisals"
    } else {
        "listFinalResults"
    };
    for (key, n, low, high) in [
        ("page", Some(page), 1, i32::MAX),
        ("limit", Some(limit), 1, 500),
        ("appraisalYear", year, 2000, 2100),
    ] {
        if let Some(n) = n
            && !(low..=high).contains(&n)
        {
            let why = if n < low {
                format!("must be greater than or equal to {low}")
            } else {
                format!("must be less than or equal to {high}")
            };
            return Err(ApiError::with_detail(
                StatusCode::UNPROCESSABLE_ENTITY,
                json!([{"type":"validation_error","loc":["request"],"msg":format!("{method}.{key}: {why}"),"input":null}]),
            ));
        }
    }
    gate(&s.pool, &u, k.master(), "query").await?;
    let code = q
        .get("code")
        .map(|v| v.trim().to_uppercase())
        .filter(|v| !v.is_empty());
    let name = q.get("name").map(|v| v.trim()).filter(|v| !v.is_empty());
    let sql = if k.master() {
        r#"SELECT to_jsonb(a)||jsonb_build_object('final_result_code',r.result_code,'final_result_name',r.result_name) FROM "PAP_APPRAISAL_MASTERS" a LEFT JOIN "PAP_FINAL_RESULTS" r ON r.id=a.final_result_id WHERE ($1::text IS NULL OR a.appraisal_code LIKE '%'||$1||'%') AND ($2::text IS NULL OR a.appraisal_name LIKE '%'||$2||'%') AND ($3::boolean IS NULL OR a.is_active=$3) AND ($4::int IS NULL OR a.appraisal_year=$4) ORDER BY a.appraisal_year DESC,a.sort_order,a.id"#
    } else {
        r#"SELECT to_jsonb(r) FROM "PAP_FINAL_RESULTS" r WHERE ($1::text IS NULL OR r.result_code LIKE '%'||$1||'%') AND ($2::text IS NULL OR r.result_name LIKE '%'||$2||'%') AND ($3::boolean IS NULL OR r.is_active=$3) ORDER BY r.sort_order,r.id"#
    };
    let mut query = sqlx::query_scalar(sql).bind(code).bind(name).bind(active);
    if k.master() {
        query = query.bind(year);
    }
    let rows = query.fetch_all(&s.pool).await?;
    let count = rows.len();
    let rows: Vec<_> = rows
        .into_iter()
        .skip(if all {
            0
        } else {
            ((i64::from(page) - 1) * i64::from(limit)) as usize
        })
        .take(if all { usize::MAX } else { limit as usize })
        .map(dates)
        .collect();
    Ok(Json(
        json!({"items":rows,"total_count":count,"page":page,"limit":limit}),
    ))
}
async fn appraisals(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Params>,
) -> Reply {
    list(s, u, q, Kind::Master).await
}
async fn results(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Params>,
) -> Reply {
    list(s, u, q, Kind::Result).await
}

fn supplied<'de, D: Deserializer<'de>, T: Deserialize<'de>>(
    d: D,
) -> Result<Option<Option<T>>, D::Error> {
    Option::<T>::deserialize(d).map(Some)
}
#[derive(Default, Deserialize)]
struct Edit {
    appraisal_code: Option<String>,
    appraisal_name: Option<String>,
    appraisal_year: Option<i32>,
    #[serde(default, deserialize_with = "supplied")]
    final_result_id: Option<Option<i32>>,
    #[serde(default, deserialize_with = "supplied")]
    appraisal_type: Option<Option<String>>,
    #[serde(default, deserialize_with = "supplied")]
    start_date: Option<Option<NaiveDate>>,
    #[serde(default, deserialize_with = "supplied")]
    end_date: Option<Option<NaiveDate>>,
    result_code: Option<String>,
    result_name: Option<String>,
    #[serde(default, deserialize_with = "supplied")]
    score_grade: Option<Option<f64>>,
    is_active: Option<bool>,
    sort_order: Option<i32>,
    #[serde(default, deserialize_with = "supplied")]
    description: Option<Option<String>>,
}
impl Validate for Edit {
    fn validate(&self) -> Vec<Violation> {
        [
            size("appraisal_code", self.appraisal_code.as_deref(), 1, 30),
            size("appraisal_name", self.appraisal_name.as_deref(), 1, 120),
            size("result_code", self.result_code.as_deref(), 1, 30),
            size("result_name", self.result_name.as_deref(), 1, 120),
            size(
                "appraisal_type",
                self.appraisal_type.as_ref().and_then(Option::as_deref),
                0,
                40,
            ),
            size(
                "description",
                self.description.as_ref().and_then(Option::as_deref),
                0,
                500,
            ),
            self.appraisal_year
                .and_then(|v| range("appraisal_year", v.into(), 2000, 2100)),
        ]
        .into_iter()
        .flatten()
        .collect()
    }
}
#[derive(Deserialize)]
struct NewMaster {
    appraisal_year: i32,
    sort_order: i32,
    #[serde(flatten)]
    edit: Edit,
}
impl Validate for NewMaster {
    fn validate(&self) -> Vec<Violation> {
        let mut v = self.edit.validate();
        v.extend(
            [
                not_blank("appraisal_code", self.edit.appraisal_code.as_deref()),
                not_blank("appraisal_name", self.edit.appraisal_name.as_deref()),
                range("appraisal_year", self.appraisal_year.into(), 2000, 2100),
            ]
            .into_iter()
            .flatten(),
        );
        v
    }
}
#[derive(Deserialize)]
struct NewResult {
    sort_order: i32,
    #[serde(flatten)]
    edit: Edit,
}
impl Validate for NewResult {
    fn validate(&self) -> Vec<Violation> {
        let mut v = self.edit.validate();
        v.extend(
            [
                not_blank("result_code", self.edit.result_code.as_deref()),
                not_blank("result_name", self.edit.result_name.as_deref()),
            ]
            .into_iter()
            .flatten(),
        );
        v
    }
}
async fn create_appraisal(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(v): Body<NewMaster>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let e = Edit {
        appraisal_year: Some(v.appraisal_year),
        sort_order: Some(v.sort_order),
        ..v.edit
    };
    Ok((
        StatusCode::CREATED,
        save(&s, &u, Kind::Master, None, e).await?,
    ))
}
async fn create_result(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(v): Body<NewResult>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    Ok((
        StatusCode::CREATED,
        save(
            &s,
            &u,
            Kind::Result,
            None,
            Edit {
                sort_order: Some(v.sort_order),
                ..v.edit
            },
        )
        .await?,
    ))
}
async fn update_appraisal(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    NumericPath(id): NumericPath<i32>,
    Body(v): Body<Edit>,
) -> Reply {
    save(&s, &u, Kind::Master, Some(id), v).await
}
async fn update_result(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    NumericPath(id): NumericPath<i32>,
    Body(v): Body<Edit>,
) -> Reply {
    save(&s, &u, Kind::Result, Some(id), v).await
}
async fn stored(conn: &mut PgConnection, kind: Kind, id: i32) -> Result<Value, ApiError> {
    let sql = match kind {
        Kind::Master => {
            r#"SELECT to_jsonb(a) FROM "PAP_APPRAISAL_MASTERS" a WHERE id=$1 FOR UPDATE"#
        }
        Kind::Result => r#"SELECT to_jsonb(a) FROM "PAP_FINAL_RESULTS" a WHERE id=$1 FOR UPDATE"#,
    };
    sqlx::query_scalar(sql)
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| kind.missing())
}
async fn save(s: &AppState, u: &CurrentUser, k: Kind, id: Option<i32>, v: Edit) -> Reply {
    gate(&s.pool, u, k.master(), "save").await?;
    let mut tx = s.pool.begin().await?;
    let old = match id {
        Some(n) => stored(&mut tx, k, n).await?,
        None => Value::Null,
    };
    let description = v
        .description
        .as_ref()
        .map(|v| v.as_deref())
        .unwrap_or(old["description"].as_str());
    let active = v.is_active.or(old["is_active"].as_bool()).unwrap_or(true);
    let sort = v
        .sort_order
        .unwrap_or(old["sort_order"].as_i64().unwrap_or(0) as i32);
    let result: Value = if k.master() {
        let year = v
            .appraisal_year
            .unwrap_or(old["appraisal_year"].as_i64().unwrap_or(0) as i32);
        let code = v
            .appraisal_code
            .as_deref()
            .or(old["appraisal_code"].as_str())
            .unwrap_or_default()
            .trim()
            .to_uppercase();
        let name = v
            .appraisal_name
            .as_deref()
            .or(old["appraisal_name"].as_str())
            .unwrap_or_default()
            .trim();
        let dup:bool=sqlx::query_scalar(r#"SELECT EXISTS(SELECT FROM "PAP_APPRAISAL_MASTERS" WHERE appraisal_year=$1 AND appraisal_code=$2 AND id IS DISTINCT FROM $3)"#)
            .bind(year).bind(&code).bind(id).fetch_one(&mut *tx).await?;
        let date = |key: &str| old[key].as_str().and_then(|s| s.parse::<NaiveDate>().ok());
        let start = v.start_date.unwrap_or(date("start_date"));
        let end = v.end_date.unwrap_or(date("end_date"));
        let validate_dates = || {
            if start.zip(end).is_some_and(|(s, e)| s > e) {
                Err(ApiError::new(
                    StatusCode::BAD_REQUEST,
                    "start_date must be earlier than or equal to end_date.",
                ))
            } else {
                Ok(())
            }
        };
        let need_result = || {
            v.final_result_id
                .unwrap_or(old["final_result_id"].as_i64().map(|n| n as i32))
                .ok_or_else(|| {
                    ApiError::new(StatusCode::BAD_REQUEST, "final_result_id is required.")
                })
        };
        if id.is_none() {
            need_result()?;
            validate_dates()?;
        }
        if dup {
            return Err(ApiError::new(
                StatusCode::CONFLICT,
                "Appraisal code already exists in the same year.",
            ));
        }
        validate_dates()?;
        let result_id = need_result()?;
        let (result_code, result_name): (String, String) = sqlx::query_as(
            r#"SELECT result_code,result_name FROM "PAP_FINAL_RESULTS" WHERE id=$1"#,
        )
        .bind(result_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| Kind::Result.missing())?;
        let ty = v
            .appraisal_type
            .as_ref()
            .map(|v| v.as_deref())
            .unwrap_or(old["appraisal_type"].as_str());
        let sql = if id.is_none() {
            r#"WITH r AS (INSERT INTO "PAP_APPRAISAL_MASTERS" (appraisal_year,appraisal_code,appraisal_name,final_result_id,appraisal_type,start_date,end_date,is_active,sort_order,description,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,statement_timestamp(),statement_timestamp()) RETURNING *) SELECT to_jsonb(r) FROM r"#
        } else {
            r#"WITH r AS (UPDATE "PAP_APPRAISAL_MASTERS" SET appraisal_year=$1,appraisal_code=$2,appraisal_name=$3,final_result_id=$4,appraisal_type=$5,start_date=$6,end_date=$7,is_active=$8,sort_order=$9,description=$10,updated_at=statement_timestamp() WHERE id=$11 RETURNING *) SELECT to_jsonb(r) FROM r"#
        };
        let mut query = sqlx::query_scalar::<_, Value>(sql)
            .bind(year)
            .bind(code)
            .bind(name)
            .bind(result_id)
            .bind(ty)
            .bind(start)
            .bind(end)
            .bind(active)
            .bind(sort)
            .bind(description);
        if let Some(id) = id {
            query = query.bind(id);
        }
        let mut row = query.fetch_one(&mut *tx).await?;
        row["final_result_code"] = json!(result_code);
        row["final_result_name"] = json!(result_name);
        row
    } else {
        let code = v
            .result_code
            .as_deref()
            .or(old["result_code"].as_str())
            .unwrap_or_default()
            .trim()
            .to_uppercase();
        let name = v
            .result_name
            .as_deref()
            .or(old["result_name"].as_str())
            .unwrap_or_default()
            .trim();
        let score = v.score_grade.unwrap_or(old["score_grade"].as_f64());
        let dup:bool=sqlx::query_scalar(r#"SELECT EXISTS(SELECT FROM "PAP_FINAL_RESULTS" WHERE result_code=$1 AND id IS DISTINCT FROM $2)"#).bind(&code).bind(id).fetch_one(&mut *tx).await?;
        if dup {
            return Err(ApiError::new(
                StatusCode::CONFLICT,
                "Final result code already exists.",
            ));
        }
        let sql = if id.is_none() {
            r#"WITH r AS (INSERT INTO "PAP_FINAL_RESULTS"(result_code,result_name,score_grade,is_active,sort_order,description,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,statement_timestamp(),statement_timestamp()) RETURNING *) SELECT to_jsonb(r) FROM r"#
        } else {
            r#"WITH r AS (UPDATE "PAP_FINAL_RESULTS" SET result_code=$1,result_name=$2,score_grade=$3,is_active=$4,sort_order=$5,description=$6,updated_at=statement_timestamp() WHERE id=$7 RETURNING *) SELECT to_jsonb(r) FROM r"#
        };
        let mut query = sqlx::query_scalar(sql)
            .bind(code)
            .bind(name)
            .bind(score)
            .bind(active)
            .bind(sort)
            .bind(description);
        if let Some(id) = id {
            query = query.bind(id);
        }
        query.fetch_one(&mut *tx).await?
    };
    tx.commit().await?;
    Ok(Json(json!({"item":dates(result)})))
}
async fn delete_appraisal(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    NumericPath(id): NumericPath<i32>,
) -> Result<StatusCode, ApiError> {
    remove(&s, &u, Kind::Master, id).await
}
async fn delete_result(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    NumericPath(id): NumericPath<i32>,
) -> Result<StatusCode, ApiError> {
    remove(&s, &u, Kind::Result, id).await
}
async fn remove(s: &AppState, u: &CurrentUser, k: Kind, id: i32) -> Result<StatusCode, ApiError> {
    gate(&s.pool, u, k.master(), "save").await?;
    let sql = match k {
        Kind::Master => r#"DELETE FROM "PAP_APPRAISAL_MASTERS" WHERE id=$1"#,
        Kind::Result => r#"DELETE FROM "PAP_FINAL_RESULTS" WHERE id=$1"#,
    };
    if sqlx::query(sql)
        .bind(id)
        .execute(&s.pool)
        .await?
        .rows_affected()
        == 0
    {
        return Err(k.missing());
    }
    Ok(StatusCode::NO_CONTENT)
}
