use super::*;
use chrono::{NaiveTime, TimeZone};
async fn schedule_gate(s: &AppState, u: &CurrentUser, action: &str) -> Result<(), ApiError> {
    manager(u)?;
    crate::menu::require_action(&s.pool, u.id, None, Some("/tim/work-codes"), action).await
}
#[derive(Deserialize)]
struct Generate {
    target: Option<String>,
    department_id: Option<i32>,
    employee_ids: Option<Vec<i32>>,
    date_from: NaiveDate,
    date_to: NaiveDate,
    mode: Option<String>,
}
impl Validate for Generate {
    fn validate(&self) -> Vec<Violation> {
        let mut issues = Vec::new();
        for (field, v, accepted) in [
            ("target", self.target.as_ref(), "all|department|employee"),
            ("mode", self.mode.as_ref(), "create_if_missing|overwrite"),
        ] {
            if let Some(value) = v
                && !accepted.split('|').any(|a| a == value)
            {
                issues.push(Violation::field(
                    "pattern",
                    field,
                    format!("must match \"{accepted}\""),
                    json!(value),
                ));
            }
        }
        if let Some(ids) = &self.employee_ids {
            for (i, v) in ids.iter().enumerate() {
                if *v <= 0 {
                    issues.push(Violation::field(
                        "positive",
                        &format!("employee_ids[{i}]"),
                        "must be greater than 0".into(),
                        json!(v),
                    ));
                }
            }
        }
        issues
    }
}
async fn generate(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(p): Body<Generate>,
) -> Reply {
    schedule_gate(&s, &u, "save").await?;
    if p.date_from > p.date_to {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "시작일은 종료일보다 늦을 수 없습니다.",
        ));
    }
    let target = p.target.as_deref().unwrap_or("all");
    let ids = p.employee_ids.unwrap_or_default();
    if target == "department" && p.department_id.is_none() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "부서 대상을 지정해야 합니다.",
        ));
    }
    if target == "employee" && ids.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "사원 대상을 지정해야 합니다.",
        ));
    }
    let mut tx = s.pool.begin().await?;
    lock_months(&mut tx, p.date_from, p.date_to).await?;
    lock(
        &mut tx,
        &format!("tim:schedule:{}:{}", p.date_from, p.date_to),
    )
    .await?;
    let tag = format!("gen-{}", Utc::now().timestamp_millis());
    let (created, updated, skipped): (i64, i64, i64) = sqlx::query_as(include_str!("generate.sql"))
        .bind(p.date_from)
        .bind(p.date_to)
        .bind(target)
        .bind(p.department_id)
        .bind(ids)
        .bind(p.mode.as_deref() == Some("overwrite"))
        .bind(&tag)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(
        json!({"created_count":created,"updated_count":updated,"skipped_count":skipped,"version_tag":tag}),
    ))
}
async fn patterns(State(s): State<AppState>, Extension(u): Extension<CurrentUser>) -> Reply {
    schedule_gate(&s, &u, "query").await?;
    let items:Vec<Value>=sqlx::query_scalar("SELECT jsonb_build_object('id',id,'code',code,'name',name) FROM tim_schedule_patterns WHERE is_active ORDER BY id").fetch_all(&s.pool).await?;
    Ok(Json(json!({"items":items,"total_count":items.len()})))
}
async fn day_schedule(
    conn: &mut PgConnection,
    employee: i32,
    day: NaiveDate,
) -> Result<Value, ApiError> {
    Ok(sqlx::query_scalar(include_str!("day_schedule.sql"))
        .bind(employee)
        .bind(day)
        .fetch_one(conn)
        .await?)
}
async fn mine(State(s): State<AppState>, Extension(u): Extension<CurrentUser>) -> Reply {
    let employee = own_employee(&s.pool, &u, None).await?;
    let mut conn = s.pool.acquire().await?;
    Ok(Json(
        json!({"item":day_schedule(&mut conn,employee,today()).await?}),
    ))
}
async fn today_schedule(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<reports::Params>,
) -> Reply {
    let e = own_employee(&s.pool, &u, reports::int_arg(&q, "employeeId")?).await?;
    let day = today();
    let mut tx = s.pool.begin().await?;
    let schedule = day_schedule(&mut tx, e, day).await?;
    let a = by_day(&mut tx, e, day).await?;
    tx.commit().await?;
    let instant = |k: &str| {
        schedule[k]
            .as_str()
            .and_then(|time| NaiveTime::parse_from_str(time, "%H:%M").ok())
            .and_then(|t| Seoul.from_local_datetime(&day.and_time(t)).earliest())
            .map(|d| d.to_utc())
    };
    let check_in = a.as_ref().and_then(|v| v.check_in_at);
    let late = check_in
        .zip(instant("work_start"))
        .is_some_and(|(a, b)| a > b);
    let overtime = a
        .as_ref()
        .and_then(|a| a.check_out_at)
        .zip(instant("work_end"))
        .map_or(0, |(end, start)| (end - start).num_minutes().max(0));
    Ok(Json(
        json!({"attendance":a,"derived":{"is_late":late,"overtime_minutes":overtime,"is_weekend_work":check_in.is_some() && schedule["day_type"]!="workday"},
      "schedule":{"work_date":day,"day_type":schedule["day_type"],"schedule_code":schedule["pattern_code"],"schedule_name":schedule["pattern_name"],
        "work_start":schedule["work_start"],"work_end":schedule["work_end"],"break_minutes":schedule["break_minutes"],"work_hours":schedule["expected_minutes"].as_f64().unwrap_or(0.)/60.,
        "is_holiday":schedule["is_holiday"],"holiday_name":schedule["holiday_name"]}}),
    ))
}
pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/tim/schedules/patterns", get(patterns))
        .route("/api/v1/tim/schedules/generate", post(generate))
        .route("/api/v1/tim/schedules/me/today", get(mine))
        .route(
            "/api/v1/tim/attendance-daily/today-schedule",
            get(today_schedule),
        )
}
