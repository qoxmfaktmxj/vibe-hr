use super::*;
use crate::input::params::{NumericPath, query_i32};
use chrono::Duration;
use std::collections::HashMap;
pub(super) type Params = HashMap<String, String>;

fn date(q: &Params, key: &str) -> Result<Option<NaiveDate>, ApiError> {
    q.get(key).filter(|s|!s.is_empty()).map(|raw|raw.parse::<NaiveDate>().map_err(|_|ApiError::with_detail(StatusCode::UNPROCESSABLE_ENTITY,json!([{"type":"value_error","loc":["query",key],"msg":"Input should be a valid value","input":raw}])))).transpose()
}
fn required_date(q: &Params, key: &str) -> Result<NaiveDate, ApiError> {
    date(q, key)?.ok_or_else(|| {
        ApiError::with_detail(
            StatusCode::UNPROCESSABLE_ENTITY,
            json!([{"type":"missing","loc":["query",key],"msg":"Field required","input":null}]),
        )
    })
}
pub(super) fn int_arg(q: &Params, key: &str) -> Result<Option<i32>, ApiError> {
    q.get(key)
        .filter(|s| !s.is_empty())
        .map(|v| query_i32(key, v))
        .transpose()
}
pub(super) fn checked(
    method: &str,
    key: &str,
    n: i32,
    min: i32,
    max: i32,
) -> Result<i32, ApiError> {
    if let Some(mut e) = crate::input::range(key, n.into(), min.into(), max.into()) {
        e.msg = format!("{method}.{key}: {}", e.msg);
        e.kind = "validation_error";
        e.loc = vec![json!("request")];
        e.input = Value::Null;
        Err(ApiError::validation(vec![e]))
    } else {
        Ok(n)
    }
}
pub(super) fn paging(params: &Params, method: &str) -> Result<(i32, i32), ApiError> {
    crate::input::params::Pagination {
        page: params.get("page").cloned(),
        limit: params.get("limit").cloned(),
    }
    .parse(method)
}
pub(super) fn year(params: &Params, method: &str) -> Result<i32, ApiError> {
    checked(
        method,
        "year",
        int_arg(params, "year")?.unwrap_or_else(|| today().year()),
        2000,
        2100,
    )
}
fn period(start: NaiveDate, end: NaiveDate) -> Result<(), ApiError> {
    if start > end {
        Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "시작일은 종료일보다 늦을 수 없습니다.",
        ))
    } else {
        Ok(())
    }
}
async fn daily(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Query(q): Query<Params>,
) -> Reply {
    let start = required_date(&q, "start_date")?;
    let end = required_date(&q, "end_date")?;
    let employee = int_arg(&q, "employee_id")?;
    let (page, limit) = paging(&q, "attendanceDaily")?;
    manager(&user)?;
    period(start, end)?;
    let status = q.get("status").filter(|s| !s.is_empty());
    let mut tx = s.pool.begin().await?;
    let count:i64=sqlx::query_scalar("SELECT count(*) FROM tim_attendance_daily a LEFT JOIN tim_leave_requests r ON r.id=a.approved_leave_request_id AND r.request_status='approved' WHERE a.work_date BETWEEN $1 AND $2 AND ($3::int IS NULL OR a.employee_id=$3) AND ($4::text IS NULL OR a.attendance_status=$4 OR ($4='leave' AND r.leave_type='half_day'))")
        .bind(start).bind(end).bind(employee).bind(status).fetch_one(&mut *tx).await?;
    let rows: Vec<Attendance> = sqlx::query_as(ATTENDANCE)
        .bind(None::<i32>)
        .bind(employee)
        .bind(start)
        .bind(end)
        .bind(status)
        .bind(i64::from(limit))
        .bind(i64::from(limit) * i64::from(page - 1))
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(
        json!({"items":rows,"total_count":count,"page":page,"limit":limit,"total_pages":(count+i64::from(limit)-1)/i64::from(limit)}),
    ))
}
async fn annual(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Query(q): Query<Params>,
) -> Reply {
    let year = checked(
        "annualLeaves",
        "year",
        int_arg(&q, "year")?.unwrap_or_else(|| today().year()),
        2000,
        2100,
    )?;
    let dept = int_arg(&q, "departmentId")?;
    let keyword = q.get("keyword").filter(|s| !s.is_empty());
    let (page, limit) = paging(&q, "annualLeaves")?;
    manager(&user)?;
    let rows:Vec<Value>=sqlx::query_scalar("SELECT (to_jsonb(l)-'created_at'-'updated_at') || jsonb_build_object('employee_no',e.employee_no,'employee_name',u.display_name,'department_name',d.name)
        FROM tim_annual_leaves l JOIN hr_employees e ON l.employee_id=e.id JOIN auth_users u ON u.id=e.user_id JOIN org_departments d ON d.id=e.department_id
        WHERE l.year=$1 AND ($2::int IS NULL OR e.department_id=$2) AND ($3::text IS NULL OR e.employee_no ILIKE '%'||$3||'%' OR u.display_name ILIKE '%'||$3||'%') ORDER BY e.employee_no").bind(year).bind(dept).bind(keyword).fetch_all(&s.pool).await?;
    let count = rows.len();
    let offset = (i64::from(limit) * i64::from(page - 1)) as usize;
    let rows: Vec<_> = rows.into_iter().skip(offset).take(limit as usize).collect();
    Ok(Json(
        json!({"items":rows,"total_count":count,"page":page,"limit":limit}),
    ))
}
async fn corrections(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    NumericPath(id): NumericPath<i32>,
) -> Reply {
    manager(&user)?;
    let rows:Vec<Value>=sqlx::query_scalar("SELECT to_jsonb(c)||jsonb_build_object('corrected_at',(to_jsonb(corrected_at)#>>'{}')||'Z',
      'old_check_in_at',(to_jsonb(old_check_in_at)#>>'{}')||'Z','new_check_in_at',(to_jsonb(new_check_in_at)#>>'{}')||'Z',
      'old_check_out_at',(to_jsonb(old_check_out_at)#>>'{}')||'Z','new_check_out_at',(to_jsonb(new_check_out_at)#>>'{}')||'Z')
      FROM tim_attendance_corrections c WHERE attendance_id=$1 ORDER BY corrected_at DESC,id DESC").bind(id).fetch_all(&s.pool).await?;
    Ok(Json(json!({"total_count":rows.len(),"corrections":rows})))
}
async fn report(
    State(s): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Query(q): Query<Params>,
) -> Reply {
    let end = date(&q, "endDate")?.unwrap_or_else(today);
    let start = date(&q, "startDate")?.unwrap_or(end - Duration::days(30));
    manager(&user)?;
    period(start, end)?;
    let mut tx = s.pool.begin().await?;
    let (total,present,late,absent,leave,remote):(i64,i64,i64,i64,i64,i64)=sqlx::query_as("SELECT count(*),count(*) FILTER(WHERE a.attendance_status='present'),count(*) FILTER(WHERE a.attendance_status='late'),count(*) FILTER(WHERE a.attendance_status='absent'),
     count(*) FILTER(WHERE a.attendance_status='leave' OR r.leave_type='half_day'),count(*) FILTER(WHERE a.attendance_status='remote')
     FROM tim_attendance_daily a LEFT JOIN tim_leave_requests r ON r.id=a.approved_leave_request_id AND r.request_status='approved' WHERE a.work_date BETWEEN $1 AND $2").bind(start).bind(end).fetch_one(&mut *tx).await?;
    let departments:Vec<Value>=sqlx::query_scalar("SELECT jsonb_build_object('department_id',d.id,'department_name',d.name,'attendance_count',count(*),
     'present_rate',round(100.0*count(*) FILTER(WHERE a.attendance_status='present')/count(*),2),'late_rate',round(100.0*count(*) FILTER(WHERE a.attendance_status='late')/count(*),2),
     'absent_rate',round(100.0*count(*) FILTER(WHERE a.attendance_status='absent')/count(*),2)) FROM tim_attendance_daily a JOIN hr_employees e ON e.id=a.employee_id JOIN org_departments d ON d.id=e.department_id
     WHERE a.work_date BETWEEN $1 AND $2 GROUP BY d.id,d.name ORDER BY count(*) DESC,d.id").bind(start).bind(end).fetch_all(&mut *tx).await?;
    let leave_types:Vec<Value>=sqlx::query_scalar("SELECT jsonb_build_object('leave_type',leave_type,'request_count',count(*),'approved_count',count(*) FILTER(WHERE request_status='approved'),'pending_count',count(*) FILTER(WHERE request_status='pending')) FROM tim_leave_requests WHERE start_date<=$2 AND end_date>=$1 GROUP BY leave_type ORDER BY leave_type")
       .bind(start).bind(end).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    let leave_count: i64 = leave_types
        .iter()
        .filter_map(|t| t["request_count"].as_i64())
        .sum();
    Ok(Json(
        json!({"start_date":start,"end_date":end,"total_attendance_records":total,"total_leave_requests":leave_count,"status_counts":{"present":present,"late":late,"absent":absent,"leave":leave,"remote":remote},"department_summaries":departments,"leave_type_summaries":leave_types}),
    ))
}
pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/tim/attendance-daily", get(daily))
        .route("/api/v1/tim/annual-leave/list", get(annual))
        .route(
            "/api/v1/tim/attendance-daily/{attendance_id}/corrections",
            get(corrections),
        )
        .route("/api/v1/tim/reports/summary", get(report))
}
