use crate::input::params::NumericPath as Path;
mod closing;
mod formula;
mod grids;
mod leave;
mod reports;
mod schedules;
use crate::{
    ApiError, AppState,
    input::{Body, Validate, Violation},
    security::CurrentUser,
};
use axum::{
    Extension, Json, Router,
    extract::{Query, State},
    http::StatusCode,
    routing::{get, post},
};
use chrono::{DateTime, Datelike, Months, NaiveDate, NaiveDateTime, Utc};
use chrono_tz::Asia::Seoul;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{PgConnection, PgPool};

type Reply = Result<Json<Value>, ApiError>;
fn manager(user: &CurrentUser) -> Result<(), ApiError> {
    if user.has_role("admin") || user.has_role("hr_manager") {
        Ok(())
    } else {
        Err(ApiError::new(StatusCode::FORBIDDEN, "권한이 없습니다."))
    }
}
fn today() -> NaiveDate {
    Utc::now().with_timezone(&Seoul).date_naive()
}
pub(super) async fn lock_months(
    conn: &mut PgConnection,
    start: NaiveDate,
    end: NaiveDate,
) -> Result<(), ApiError> {
    let mut m = start.with_day(1).expect("first of month");
    while m <= end {
        lock(conn, &format!("tim:month-close:{}:{}", m.year(), m.month())).await?;
        m = m
            .checked_add_months(Months::new(1))
            .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Invalid date."))?;
    }
    Ok(())
}
async fn lock(conn: &mut PgConnection, key: &str) -> Result<(), ApiError> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(key)
        .execute(conn)
        .await?;
    Ok(())
}
async fn open_month(conn: &mut PgConnection, date: NaiveDate) -> Result<(), ApiError> {
    let closed:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tim_month_closes WHERE year=$1 AND month=$2 AND close_status='closed')").bind(date.year()).bind(date.month() as i32).fetch_one(conn).await?;
    if closed {
        Err(ApiError::new(
            StatusCode::LOCKED,
            format!(
                "{}년 {}월은 마감된 기간입니다. 수정할 수 없습니다.",
                date.year(),
                date.month()
            ),
        ))
    } else {
        Ok(())
    }
}
async fn guard_payroll(
    conn: &mut PgConnection,
    employee: i32,
    start: NaiveDate,
    end: NaiveDate,
) -> Result<(), ApiError> {
    let finalized:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM pay_payroll_runs r JOIN pay_payroll_run_targets t ON r.id=t.run_id WHERE t.employee_id=$1 AND r.year_month BETWEEN $2 AND $3 AND r.status IN ('closed','paid'))").bind(employee).bind(start.format("%Y-%m").to_string()).bind(end.format("%Y-%m").to_string()).fetch_one(conn).await?;
    if finalized {
        Err(ApiError::new(
            StatusCode::CONFLICT,
            "마감 또는 지급 완료된 급여가 있어 근태와 승인 휴가를 변경할 수 없습니다.",
        ))
    } else {
        Ok(())
    }
}
async fn own_employee(
    pool: &PgPool,
    user: &CurrentUser,
    requested: Option<i32>,
) -> Result<i32, ApiError> {
    let own: i32 = sqlx::query_scalar("SELECT id FROM hr_employees WHERE user_id=$1 LIMIT 1")
        .bind(user.id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "사원 프로필을 찾을 수 없습니다."))?;
    if requested.is_some_and(|id| id != own) {
        manager(user)?;
    }
    Ok(requested.unwrap_or(own))
}
#[derive(Serialize, sqlx::FromRow)]
struct Attendance {
    id: i32,
    employee_id: i32,
    employee_no: String,
    employee_name: String,
    department_id: i32,
    department_name: String,
    work_date: NaiveDate,
    check_in_at: Option<DateTime<Utc>>,
    check_out_at: Option<DateTime<Utc>>,
    worked_minutes: Option<i32>,
    attendance_status: String,
    actual_minutes: i32,
    regular_minutes: i32,
    overtime_minutes: i32,
    night_minutes: i32,
    holiday_work_minutes: i32,
    holiday_overtime_minutes: i32,
    holiday_night_minutes: i32,
    is_holiday_work: bool,
    approved_leave_type: Option<String>,
}
const ATTENDANCE: &str = include_str!("attendance.sql");
async fn attendance_by_id(conn: &mut PgConnection, id: i32) -> Result<Attendance, ApiError> {
    sqlx::query_as(ATTENDANCE)
        .bind(Some(id))
        .bind(None::<i32>)
        .bind(None::<NaiveDate>)
        .bind(None::<NaiveDate>)
        .bind(None::<&str>)
        .bind(1_i64)
        .bind(0_i64)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "근태 기록을 찾을 수 없습니다."))
}
async fn by_day(
    conn: &mut PgConnection,
    employee: i32,
    day: NaiveDate,
) -> Result<Option<Attendance>, ApiError> {
    Ok(sqlx::query_as(ATTENDANCE)
        .bind(None::<i32>)
        .bind(employee)
        .bind(day)
        .bind(day)
        .bind(None::<&str>)
        .bind(1_i64)
        .bind(0_i64)
        .fetch_optional(conn)
        .await?)
}
#[derive(Deserialize)]
struct Punch {
    employee_id: Option<i32>,
}
impl Validate for Punch {
    fn validate(&self) -> Vec<Violation> {
        vec![]
    }
}

#[derive(sqlx::FromRow)]
struct Schedule {
    planned_start_at: Option<NaiveDateTime>,
    expected_minutes: i32,
    break_minutes: i32,
    is_holiday: bool,
    is_workday: bool,
}
async fn schedule(
    conn: &mut PgConnection,
    employee: i32,
    day: NaiveDate,
) -> Result<Schedule, ApiError> {
    let row=sqlx::query_as("SELECT planned_start_at,expected_minutes,break_minutes,is_holiday,is_workday FROM tim_employee_daily_schedules WHERE employee_id=$1 AND work_date=$2")
        .bind(employee).bind(day).fetch_optional(conn).await?;
    let weekday = day.weekday().number_from_monday() <= 5;
    Ok(row.unwrap_or(Schedule {
        planned_start_at: None,
        expected_minutes: 480,
        break_minutes: 60,
        is_holiday: !weekday,
        is_workday: weekday,
    }))
}
async fn calculate(
    conn: &mut PgConnection,
    id: i32,
    start: Option<DateTime<Utc>>,
    end: Option<DateTime<Utc>>,
    status: &str,
    s: &Schedule,
) -> Result<(), ApiError> {
    let v = formula::calculate(
        start,
        end,
        status,
        s.break_minutes,
        s.expected_minutes,
        s.is_holiday,
        s.is_workday,
    );
    sqlx::query("UPDATE tim_attendance_daily SET actual_minutes=$2, regular_minutes=$3,overtime_minutes=$4,night_minutes=$5,holiday_work_minutes=$6,holiday_overtime_minutes=$7,holiday_night_minutes=$8,is_holiday_work=$9,calculated_at=clock_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
        .bind(id).bind(v.actual).bind(v.regular).bind(v.overtime).bind(v.night).bind(v.holiday_work).bind(v.holiday_overtime).bind(v.holiday_night).bind(v.holiday).execute(conn).await?;
    Ok(())
}
async fn punch<const IN: bool>(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(p): Body<Punch>,
) -> Reply {
    let employee = own_employee(&s.pool, &u, p.employee_id).await?;
    let now = Utc::now();
    let day = now.with_timezone(&Seoul).date_naive();
    let mut tx = s.pool.begin().await?;
    lock_months(&mut tx, day, day).await?;
    lock(&mut tx, &format!("tim:attendance:{employee}:{day}")).await?;
    let schedule = schedule(&mut tx, employee, day).await?;
    let current:Option<(i32,Option<i32>)>=sqlx::query_as("SELECT id,approved_leave_request_id FROM tim_attendance_daily WHERE employee_id=$1 AND work_date=$2 FOR UPDATE").bind(employee).bind(day).fetch_optional(&mut *tx).await?;
    let previous = if let Some((id, leave)) = current {
        let item = attendance_by_id(&mut tx, id).await?;
        if leave.is_some() {
            guard_payroll(&mut tx, employee, day, day).await?;
            if item
                .approved_leave_type
                .as_deref()
                .is_some_and(|s| s != "half_day")
            {
                return Err(ApiError::new(
                    StatusCode::CONFLICT,
                    "승인된 전일 휴가를 취소한 뒤 출퇴근을 처리해야 합니다.",
                ));
            }
        }
        Some(item)
    } else {
        None
    };
    let id = if IN {
        let status = if schedule
            .planned_start_at
            .is_some_and(|v| now.naive_utc() > v)
        {
            "late"
        } else {
            "present"
        };
        if let Some(old) = previous {
            if old.check_in_at.is_some() {
                return Err(ApiError::new(
                    StatusCode::CONFLICT,
                    "오늘 이미 출근 처리되었습니다.",
                ));
            }
            sqlx::query("UPDATE tim_attendance_daily SET check_in_at=$2,updated_at=$2,attendance_status=$3,leave_base_status=CASE WHEN approved_leave_request_id IS NULL THEN leave_base_status ELSE $3 END WHERE id=$1")
                .bind(old.id).bind(now.naive_utc()).bind(status).execute(&mut *tx).await?;
            calculate(
                &mut tx,
                old.id,
                Some(now),
                old.check_out_at,
                status,
                &schedule,
            )
            .await?;
            old.id
        } else {
            let id=sqlx::query_scalar("INSERT INTO tim_attendance_daily(employee_id,work_date,check_in_at,attendance_status,actual_minutes,regular_minutes,overtime_minutes,night_minutes,holiday_work_minutes,holiday_overtime_minutes,holiday_night_minutes,is_holiday_work,created_at,updated_at) VALUES($1,$2,$3,$4,0,0,0,0,0,0,0,false,$3,$3) RETURNING id").bind(employee).bind(day).bind(now.naive_utc()).bind(status).fetch_one(&mut *tx).await?;
            calculate(&mut tx, id, Some(now), None, status, &schedule).await?;
            id
        }
    } else {
        let old = previous
            .filter(|r| r.check_in_at.is_some())
            .ok_or_else(|| {
                ApiError::new(
                    StatusCode::BAD_REQUEST,
                    "출근 기록이 없어 퇴근 처리할 수 없습니다.",
                )
            })?;
        if old.check_out_at.is_some() {
            return Err(ApiError::new(
                StatusCode::CONFLICT,
                "오늘 이미 퇴근 처리되었습니다.",
            ));
        }
        sqlx::query("UPDATE tim_attendance_daily SET check_out_at=$2,updated_at=$2 WHERE id=$1")
            .bind(old.id)
            .bind(now.naive_utc())
            .execute(&mut *tx)
            .await?;
        calculate(
            &mut tx,
            old.id,
            old.check_in_at,
            Some(now),
            &old.attendance_status,
            &schedule,
        )
        .await?;
        old.id
    };
    let item = attendance_by_id(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!(item)))
}
#[derive(Deserialize)]
struct Correction {
    new_status: String,
    reason: String,
    new_check_in_at: Option<DateTime<Utc>>,
    new_check_out_at: Option<DateTime<Utc>>,
}
impl Validate for Correction {
    fn validate(&self) -> Vec<Violation> {
        let mut issues: Vec<_> = [
            crate::input::not_blank("new_status", Some(&self.new_status)),
            crate::input::not_blank("reason", Some(&self.reason)),
            crate::input::size("reason", Some(&self.reason), 0, 500),
        ]
        .into_iter()
        .flatten()
        .collect();
        if !matches!(
            self.new_status.as_str(),
            "present" | "late" | "absent" | "leave" | "remote"
        ) {
            issues.push(Violation::field(
                "pattern",
                "new_status",
                r#"must match "present|late|absent|leave|remote""#.into(),
                json!(self.new_status),
            ));
        }
        issues
    }
}
async fn correct(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
    Body(p): Body<Correction>,
) -> Reply {
    manager(&u)?;
    let actor = own_employee(&s.pool, &u, None).await?;
    let mut tx = s.pool.begin().await?;
    let initial = attendance_by_id(&mut tx, id).await?;
    lock_months(&mut tx, initial.work_date, initial.work_date).await?;
    sqlx::query("SELECT id FROM tim_attendance_daily WHERE id=$1 FOR UPDATE")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    let old = attendance_by_id(&mut tx, id).await?;
    open_month(&mut tx, old.work_date).await?;
    guard_payroll(&mut tx, old.employee_id, old.work_date, old.work_date).await?;
    if old
        .approved_leave_type
        .as_deref()
        .is_some_and(|s| s != "half_day")
        && (p.new_status != "leave" || p.new_check_in_at.is_some() || p.new_check_out_at.is_some())
    {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "승인된 전일 휴가를 취소한 뒤 근태를 교정해야 합니다.",
        ));
    }
    let naive = |v: Option<DateTime<Utc>>| v.map(|t| t.naive_utc());
    sqlx::query("INSERT INTO tim_attendance_corrections(attendance_id,corrected_by_employee_id,old_status,new_status,old_check_in_at,new_check_in_at,old_check_out_at,new_check_out_at,reason,corrected_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp() AT TIME ZONE 'UTC')")
        .bind(id).bind(actor).bind(old.attendance_status).bind(&p.new_status).bind(naive(old.check_in_at)).bind(naive(p.new_check_in_at)).bind(naive(old.check_out_at)).bind(naive(p.new_check_out_at)).bind(p.reason).execute(&mut *tx).await?;
    sqlx::query("UPDATE tim_attendance_daily SET attendance_status=$2,check_in_at=$3,check_out_at=$4,leave_base_status=CASE WHEN $5 THEN $2 ELSE leave_base_status END,updated_at=clock_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
        .bind(id).bind(&p.new_status).bind(naive(p.new_check_in_at)).bind(naive(p.new_check_out_at)).bind(old.approved_leave_type.as_deref()==Some("half_day")).execute(&mut *tx).await?;
    let schedule = schedule(&mut tx, old.employee_id, old.work_date).await?;
    calculate(
        &mut tx,
        id,
        p.new_check_in_at,
        p.new_check_out_at,
        &p.new_status,
        &schedule,
    )
    .await?;
    let item = attendance_by_id(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!(item)))
}
async fn detail(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    manager(&u)?;
    let mut c = s.pool.acquire().await?;
    Ok(Json(json!(attendance_by_id(&mut c, id).await?)))
}
async fn current(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(f): Query<reports::Params>,
) -> Reply {
    let employee = own_employee(&s.pool, &u, reports::int_arg(&f, "employeeId")?).await?;
    let mut c = s.pool.acquire().await?;
    Ok(Json(json!({"item":by_day(&mut c,employee,today()).await?})))
}
pub fn routes() -> Router<AppState> {
    Router::new()
        .merge(leave::routes())
        .merge(reports::routes())
        .merge(grids::routes())
        .merge(schedules::routes())
        .merge(closing::routes())
        .route("/api/v1/tim/attendance-daily/today", get(current))
        .route(
            "/api/v1/tim/attendance-daily/detail/{attendance_id}",
            get(detail),
        )
        .route("/api/v1/tim/attendance-daily/check-in", post(punch::<true>))
        .route(
            "/api/v1/tim/attendance-daily/check-out",
            post(punch::<false>),
        )
        .route(
            "/api/v1/tim/attendance-daily/{attendance_id}/correct",
            post(correct),
        )
}
