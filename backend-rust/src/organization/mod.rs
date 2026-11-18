use crate::input::params::{NumericPath as Path, Pagination, query_i64};
mod directory;
mod mappings;
#[cfg(test)]
mod postgres_test;
mod restructure;

use crate::{ApiError, AppState, menu, security::CurrentUser};
use axum::{
    Extension, Json, Router,
    extract::{Query, State},
    http::StatusCode,
    routing::{get, post},
};
use chrono::{DateTime, NaiveDate, NaiveDateTime, SecondsFormat};
use serde_json::{Value, json};
use sqlx::{PgConnection, PgPool};
use std::collections::HashMap;

type Reply = Result<Json<Value>, ApiError>;
type Params = HashMap<String, String>;

pub fn routes() -> Router<AppState> {
    Router::new().nest(
        "/api/v1/org",
        directory::routes()
            .merge(mappings::routes())
            .merge(restructure::routes()),
    )
}

fn privileged(user: &CurrentUser) -> Result<(), ApiError> {
    if user.has_role("admin") || user.has_role("hr_manager") {
        Ok(())
    } else {
        Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "Not enough permissions.",
        ))
    }
}
async fn action(pool: &PgPool, user: &CurrentUser, path: &str, code: &str) -> Result<(), ApiError> {
    if path != "/org/chart" {
        privileged(user)?;
    }
    menu::require_action(pool, user.id, None, Some(path), code).await
}
fn checked_id(value: i64, field: &str) -> Result<i32, ApiError> {
    i32::try_from(value).map_err(|_| {
        ApiError::new(
            StatusCode::BAD_REQUEST,
            format!("{field} is outside the supported INTEGER range."),
        )
    })
}
fn bad(detail: &str) -> ApiError {
    ApiError::new(StatusCode::BAD_REQUEST, detail)
}
fn missing(detail: &str) -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, detail)
}
fn conflict(detail: &str) -> ApiError {
    ApiError::new(StatusCode::CONFLICT, detail)
}
fn unprocessable(detail: &str) -> ApiError {
    ApiError::new(StatusCode::UNPROCESSABLE_ENTITY, detail)
}
fn conflict_on_constraint(error: sqlx::Error, detail: &str) -> ApiError {
    if error
        .as_database_error()
        .and_then(|e| e.code())
        .is_some_and(|c| c.starts_with("23"))
    {
        conflict(detail)
    } else {
        error.into()
    }
}
fn nullable(text: &str) -> Option<&str> {
    let v = text.trim();
    (!v.is_empty()).then_some(v)
}
fn required(text: &str) -> Result<&str, ApiError> {
    nullable(text).ok_or_else(|| unprocessable("A required value is blank."))
}

fn query_error(field: &str, value: Option<&String>, kind: &str, message: &str) -> ApiError {
    ApiError::with_detail(
        StatusCode::UNPROCESSABLE_ENTITY,
        json!([{"type":kind,"loc":["query",field],"msg":message,"input":value}]),
    )
}
fn query_date(params: &Params, field: &str) -> Result<Option<NaiveDate>, ApiError> {
    params
        .get(field)
        .filter(|v| !v.is_empty())
        .map(|v| {
            v.parse().map_err(|_| {
                query_error(
                    field,
                    Some(v),
                    "value_error",
                    "Input should be a valid value",
                )
            })
        })
        .transpose()
}
fn query_integer(params: &Params, key: &str) -> Result<Option<i64>, ApiError> {
    params
        .get(key)
        .filter(|v| !v.is_empty())
        .map(|v| query_i64(key, v))
        .transpose()
}
struct Page {
    page: i64,
    limit: i64,
    all: bool,
}
impl Page {
    fn parse(q: &Params, all_supported: bool, method: &str) -> Result<Self, ApiError> {
        let (page, limit) = Pagination {
            page: q.get("page").cloned(),
            limit: q.get("limit").cloned(),
        }
        .with_limits(method, 100, 1000)?;
        let all = if all_supported {
            match q
                .get("all")
                .map(|s| s.trim().to_ascii_lowercase())
                .as_deref()
            {
                Some("true" | "1" | "on" | "yes") => true,
                None | Some("" | "false" | "0" | "off" | "no") => false,
                _ => {
                    return Err(query_error(
                        "all",
                        q.get("all"),
                        "value_error",
                        "Input should be a valid value",
                    ));
                }
            }
        } else {
            false
        };
        Ok(Self {
            page: page.into(),
            limit: limit.into(),
            all,
        })
    }
    fn response(&self, key: &str, rows: Vec<Value>) -> Value {
        let total = rows.len();
        let items = if self.all {
            rows
        } else {
            rows.into_iter()
                .skip((self.page - 1).saturating_mul(self.limit) as usize)
                .take(self.limit as usize)
                .collect()
        };
        json!({key:items,"total_count":total,"page":(!self.all).then_some(self.page),"limit":(!self.all).then_some(self.limit)})
    }
}
fn timestamps(mut row: Value) -> Value {
    for key in ["created_at", "updated_at", "applied_at", "changed_at"] {
        if let Some(text) = row.get(key).and_then(Value::as_str) {
            let stamp = DateTime::parse_from_rfc3339(text)
                .map(|d| d.to_utc())
                .or_else(|_| text.parse::<NaiveDateTime>().map(|d| d.and_utc()));
            if let Ok(utc) = stamp {
                row[key] = json!(utc.to_rfc3339_opts(SecondsFormat::AutoSi, true));
            }
        }
    }
    row
}

async fn record_change(
    conn: &mut PgConnection,
    department: i32,
    user: i32,
    field: &str,
    before: Option<&str>,
    after: Option<&str>,
    reason: Option<&str>,
) -> Result<(), ApiError> {
    if before != after {
        sqlx::query("INSERT INTO org_dept_change_histories(department_id,changed_by,field_name,before_value,after_value,change_reason,changed_at) VALUES($1,$2,$3,$4,$5,$6,clock_timestamp() AT TIME ZONE 'UTC')")
            .bind(department).bind(user).bind(field).bind(before).bind(after).bind(reason).execute(conn).await?;
    }
    Ok(())
}
