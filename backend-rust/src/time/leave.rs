use super::*;
use crate::input::{not_blank, range, size};
use std::collections::BTreeMap;

async fn annual(conn: &mut PgConnection, employee: i32, year: i32) -> Result<i32, ApiError> {
    lock(conn, &format!("tim:annual-leave:{employee}:{year}")).await?;
    if let Some(id) = sqlx::query_scalar(
        "SELECT id FROM tim_annual_leaves WHERE employee_id=$1 AND year=$2 FOR UPDATE",
    )
    .bind(employee)
    .bind(year)
    .fetch_optional(&mut *conn)
    .await?
    {
        return Ok(id);
    }
    let hire: NaiveDate = sqlx::query_scalar("SELECT hire_date FROM hr_employees WHERE id=$1")
        .bind(employee)
        .fetch_optional(&mut *conn)
        .await?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "사원 프로필을 찾을 수 없습니다."))?;
    let granted = if year > hire.year() { 15.0 } else { 11.0 };
    Ok(sqlx::query_scalar("INSERT INTO tim_annual_leaves(employee_id,year,granted_days,used_days,carried_over_days,remaining_days,grant_type,created_at,updated_at)
        VALUES($1,$2,$3,0,0,$3,'auto',statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC') RETURNING id")
        .bind(employee).bind(year).bind(granted).fetch_one(conn).await?)
}
async fn annual_row(conn: &mut PgConnection, id: i32) -> Result<Value, ApiError> {
    Ok(sqlx::query_scalar("SELECT (to_jsonb(l)-'created_at'-'updated_at')||jsonb_build_object('employee_no',e.employee_no,'employee_name',u.display_name,'department_name',d.name)
        FROM tim_annual_leaves l JOIN hr_employees e ON e.id=l.employee_id JOIN auth_users u ON u.id=e.user_id JOIN org_departments d ON d.id=e.department_id WHERE l.id=$1")
        .bind(id).fetch_one(conn).await?)
}
async fn get_annual(pool: &PgPool, employee: i32, year: i32) -> Reply {
    let mut tx = pool.begin().await?;
    let id = annual(&mut tx, employee, year).await?;
    let item = annual_row(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({"item":item})))
}
async fn my_annual(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<reports::Params>,
) -> Reply {
    let year = reports::year(&q, "myAnnualLeave")?;
    let employee = own_employee(&s.pool, &u, None).await?;
    get_annual(&s.pool, employee, year).await
}
async fn employee_annual(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(employee): Path<i32>,
    Query(q): Query<reports::Params>,
) -> Reply {
    let year = reports::year(&q, "annualLeave")?;
    manager(&u)?;
    get_annual(&s.pool, employee, year).await
}
#[derive(Deserialize)]
struct Adjust {
    employee_id: i32,
    year: i32,
    adjustment_days: f64,
    reason: String,
}
impl Validate for Adjust {
    fn validate(&self) -> Vec<Violation> {
        [
            range("year", self.year.into(), 2000, 2100),
            not_blank("reason", Some(&self.reason)),
            size("reason", Some(&self.reason), 0, 500),
            (self.employee_id <= 0).then(|| {
                Violation::field(
                    "positive",
                    "employee_id",
                    "must be greater than 0".into(),
                    json!(self.employee_id),
                )
            }),
        ]
        .into_iter()
        .flatten()
        .collect()
    }
}
async fn adjust(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(p): Body<Adjust>,
) -> Reply {
    manager(&u)?;
    let mut tx = s.pool.begin().await?;
    let id = annual(&mut tx, p.employee_id, p.year).await?;
    sqlx::query("UPDATE tim_annual_leaves SET granted_days=granted_days+$2,remaining_days=remaining_days+$2,grant_type='adjustment',note=$3,updated_at=clock_timestamp() AT TIME ZONE 'UTC' WHERE id=$1").bind(id).bind(p.adjustment_days).bind(p.reason).execute(&mut *tx).await?;
    let item = annual_row(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({"item":item})))
}
#[derive(Deserialize)]
struct Create {
    leave_type: String,
    start_date: NaiveDate,
    end_date: NaiveDate,
    reason: String,
}
impl Validate for Create {
    fn validate(&self) -> Vec<Violation> {
        let mut issues: Vec<_> = [
            not_blank("leave_type", Some(&self.leave_type)),
            not_blank("reason", Some(&self.reason)),
            size("reason", Some(&self.reason), 0, 500),
        ]
        .into_iter()
        .flatten()
        .collect();
        if !matches!(
            self.leave_type.as_str(),
            "annual" | "sick" | "half_day" | "unpaid" | "other"
        ) {
            issues.push(Violation::field(
                "pattern",
                "leave_type",
                r#"must match "annual|sick|half_day|unpaid|other""#.into(),
                json!(self.leave_type),
            ));
        }
        issues
    }
}
#[derive(Deserialize)]
struct Decision {
    reason: Option<String>,
}
impl Validate for Decision {
    fn validate(&self) -> Vec<Violation> {
        size("reason", self.reason.as_deref(), 0, 500)
            .into_iter()
            .collect()
    }
}
async fn check_open(
    conn: &mut PgConnection,
    start: NaiveDate,
    end: NaiveDate,
) -> Result<(), ApiError> {
    let mut m = start.with_day(1).unwrap();
    while m <= end {
        open_month(conn, m).await?;
        m = m
            .checked_add_months(Months::new(1))
            .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Invalid date."))?;
    }
    Ok(())
}
type Days = Vec<(NaiveDate, i32)>;
async fn workdays(
    conn: &mut PgConnection,
    employee: i32,
    start: NaiveDate,
    end: NaiveDate,
    kind: &str,
) -> Result<Days, ApiError> {
    let days:Days=sqlx::query_as("SELECT dt::date,greatest(0,coalesce(s.expected_minutes,480)) FROM generate_series($2::date::timestamp,$3::date::timestamp,interval '1 day') dt
      LEFT JOIN tim_employee_daily_schedules s ON s.employee_id=$1 AND s.work_date=dt::date
      WHERE CASE WHEN s.id IS NOT NULL THEN s.is_workday AND NOT s.is_holiday ELSE extract(isodow from dt)<6 AND NOT EXISTS(SELECT 1 FROM tim_holidays h WHERE h.holiday_date=dt::date AND h.is_active) END ORDER BY dt")
        .bind(employee).bind(start).bind(end).fetch_all(conn).await?;
    if kind == "half_day"
        && (start != end || start.weekday().number_from_monday() > 5 || days.len() != 1)
    {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "반차는 근무일 하루에만 신청할 수 있습니다.",
        ));
    }
    Ok(days)
}
fn deductions(kind: &str, days: &Days) -> BTreeMap<i32, f64> {
    let mut map = BTreeMap::new();
    if matches!(kind, "annual" | "half_day") {
        for (day, _) in days {
            *map.entry(day.year()).or_insert(0.) += if kind == "annual" { 1.0 } else { 0.5 };
        }
    }
    map
}
async fn charge(
    conn: &mut PgConnection,
    employee: i32,
    amounts: &BTreeMap<i32, f64>,
    apply: bool,
) -> Result<(), ApiError> {
    for (&year, &delta) in amounts {
        let id = annual(conn, employee, year).await?;
        let available: f64 =
            sqlx::query_scalar("SELECT remaining_days FROM tim_annual_leaves WHERE id=$1")
                .bind(id)
                .fetch_one(&mut *conn)
                .await?;
        if delta > 0. && available < delta {
            return Err(ApiError::new(
                StatusCode::BAD_REQUEST,
                "연차 잔여일수가 부족합니다.",
            ));
        }
        if apply {
            sqlx::query("UPDATE tim_annual_leaves SET used_days=used_days+$2,remaining_days=remaining_days-$2,updated_at=clock_timestamp() AT TIME ZONE 'UTC' WHERE id=$1").bind(id).bind(delta).execute(&mut *conn).await?;
        }
    }
    Ok(())
}
const LIST: &str = include_str!("leave.sql");
async fn item(conn: &mut PgConnection, id: i32) -> Result<Value, ApiError> {
    Ok(sqlx::query_scalar(LIST)
        .bind(id)
        .bind(None::<i32>)
        .bind(None::<&str>)
        .bind(false)
        .bind(1_i64)
        .bind(0_i64)
        .fetch_one(conn)
        .await?)
}
async fn list<const OWN: bool>(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<reports::Params>,
) -> Reply {
    let method = if OWN {
        "myLeaveRequests"
    } else {
        "leaveRequests"
    };
    let (page, limit) = reports::paging(&q, method)?;
    let pending = if OWN {
        false
    } else {
        q.get("pendingOnly")
            .filter(|v| !v.is_empty())
            .map(|v| crate::input::params::query_bool("pendingOnly", v))
            .transpose()?
            .unwrap_or(false)
    };
    let own = if OWN {
        Some(own_employee(&s.pool, &u, None).await?)
    } else {
        manager(&u)?;
        None
    };
    let status = q.get("status").filter(|s| !s.is_empty());
    let mut tx = s.pool.begin().await?;
    let count:i64=sqlx::query_scalar("SELECT count(*) FROM tim_leave_requests WHERE ($1::int IS NULL OR employee_id=$1) AND ($2::text IS NULL OR request_status=$2) AND (NOT $3 OR request_status='pending')")
        .bind(own).bind(status).bind(pending).fetch_one(&mut *tx).await?;
    let items: Vec<Value> = sqlx::query_scalar(LIST)
        .bind(None::<i32>)
        .bind(own)
        .bind(status)
        .bind(pending)
        .bind(i64::from(limit))
        .bind(i64::from(limit) * i64::from(page - 1))
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(
        json!({"items":items,"total_count":count,"page":page,"limit":limit}),
    ))
}

async fn create(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(p): Body<Create>,
) -> Reply {
    let employee = own_employee(&s.pool, &u, None).await?;
    if p.start_date > p.end_date {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "시작일은 종료일보다 늦을 수 없습니다.",
        ));
    }
    let mut tx = s.pool.begin().await?;
    lock_months(&mut tx, p.start_date, p.end_date).await?;
    check_open(&mut tx, p.start_date, p.end_date).await?;
    let days = workdays(&mut tx, employee, p.start_date, p.end_date, &p.leave_type).await?;
    lock(&mut tx, &format!("tim:leave:{employee}")).await?;
    let overlap:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tim_leave_requests WHERE employee_id=$1 AND request_status IN ('pending','approved') AND start_date<=$3 AND end_date>=$2)").bind(employee).bind(p.start_date).bind(p.end_date).fetch_one(&mut *tx).await?;
    if overlap {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "중복 기간 휴가 요청이 존재합니다.",
        ));
    }
    charge(&mut tx, employee, &deductions(&p.leave_type, &days), false).await?;
    let id:i32=sqlx::query_scalar("INSERT INTO tim_leave_requests(employee_id,leave_type,start_date,end_date,reason,request_status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'pending',statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC') RETURNING id").bind(employee).bind(p.leave_type).bind(p.start_date).bind(p.end_date).bind(p.reason).fetch_one(&mut *tx).await?;
    let out = item(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(out))
}

#[derive(sqlx::FromRow)]
struct Leave {
    employee_id: i32,
    start_date: NaiveDate,
    end_date: NaiveDate,
    leave_type: String,
    request_status: String,
    annual_charge_breakdown: Option<Value>,
}
async fn apply_attendance(
    conn: &mut PgConnection,
    id: i32,
    leave: &Leave,
    days: &Days,
) -> Result<(), ApiError> {
    for &(day, _) in days {
        lock(conn, &format!("tim:attendance:{}:{day}", leave.employee_id)).await?;
        type LockedAttendance = (
            i32,
            Option<i32>,
            Option<NaiveDateTime>,
            Option<NaiveDateTime>,
            String,
        );
        let prev:Option<LockedAttendance>=sqlx::query_as("SELECT id,approved_leave_request_id,check_in_at,check_out_at,attendance_status FROM tim_attendance_daily WHERE employee_id=$1 AND work_date=$2 FOR UPDATE")
            .bind(leave.employee_id).bind(day).fetch_optional(&mut *conn).await?;
        let (aid, start, end, status) = if let Some((aid, link, start, end, old)) = prev {
            if link.is_some()
                || (leave.leave_type != "half_day" && (start.is_some() || end.is_some()))
            {
                return Err(ApiError::new(
                    StatusCode::CONFLICT,
                    "휴가 기간에 출퇴근 기록 또는 다른 승인 휴가가 있습니다. 근태와 휴가를 확인해 주세요.",
                ));
            }
            let status = if leave.leave_type == "half_day" {
                old.as_str()
            } else {
                "leave"
            };
            sqlx::query("UPDATE tim_attendance_daily SET leave_base_status=attendance_status,attendance_status=$2,approved_leave_request_id=$3,updated_at=clock_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
                .bind(aid).bind(status).bind(id).execute(&mut *conn).await?;
            (aid, start, end, status.to_owned())
        } else {
            let aid=sqlx::query_scalar("INSERT INTO tim_attendance_daily(employee_id,work_date,approved_leave_request_id,leave_generated,leave_base_status,attendance_status,actual_minutes,regular_minutes,overtime_minutes,night_minutes,holiday_work_minutes,holiday_overtime_minutes,holiday_night_minutes,is_holiday_work,created_at,updated_at) VALUES($1,$2,$3,true,'absent','leave',0,0,0,0,0,0,0,false,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC') RETURNING id").bind(leave.employee_id).bind(day).bind(id).fetch_one(&mut *conn).await?;
            (aid, None, None, "leave".into())
        };
        let sched = schedule(conn, leave.employee_id, day).await?;
        calculate(
            conn,
            aid,
            start.map(|x| x.and_utc()),
            end.map(|x| x.and_utc()),
            &status,
            &sched,
        )
        .await?;
    }
    Ok(())
}
async fn restore(conn: &mut PgConnection, id: i32, employee: i32) -> Result<(), ApiError> {
    let ids:Vec<i32>=sqlx::query_scalar("SELECT id FROM tim_attendance_daily WHERE approved_leave_request_id=$1 ORDER BY work_date,id FOR UPDATE").bind(id).fetch_all(&mut *conn).await?;
    for aid in ids {
        let removed=sqlx::query("DELETE FROM tim_attendance_daily a WHERE id=$1 AND leave_generated AND check_in_at IS NULL AND check_out_at IS NULL AND NOT EXISTS(SELECT 1 FROM tim_attendance_corrections WHERE attendance_id=a.id)").bind(aid).execute(&mut *conn).await?.rows_affected();
        if removed == 0 {
            sqlx::query("UPDATE tim_attendance_daily SET attendance_status=leave_base_status,approved_leave_request_id=NULL,leave_base_status=NULL,leave_generated=false,updated_at=clock_timestamp() AT TIME ZONE 'UTC' WHERE id=$1").bind(aid).execute(&mut *conn).await?;
            let a = attendance_by_id(conn, aid).await?;
            let sched = schedule(conn, employee, a.work_date).await?;
            calculate(
                conn,
                aid,
                a.check_in_at,
                a.check_out_at,
                &a.attendance_status,
                &sched,
            )
            .await?;
        }
    }
    Ok(())
}
#[derive(Clone, Copy, PartialEq)]
enum Action {
    Approve,
    Reject,
    Cancel,
}
async fn decide(s: AppState, u: CurrentUser, id: i32, p: Decision, action: Action) -> Reply {
    if action != Action::Cancel {
        manager(&u)?;
    }
    let actor = own_employee(&s.pool, &u, None).await?;
    let mut tx = s.pool.begin().await?;
    let dates: Option<(NaiveDate, NaiveDate)> =
        sqlx::query_as("SELECT start_date,end_date FROM tim_leave_requests WHERE id=$1")
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?;
    let missing = || ApiError::new(StatusCode::NOT_FOUND, "휴가 요청을 찾을 수 없습니다.");
    let (start, end) = dates.ok_or_else(missing)?;
    lock_months(&mut tx, start, end).await?;
    let r:Leave=sqlx::query_as("SELECT employee_id,start_date,end_date,leave_type,request_status,annual_charge_breakdown FROM tim_leave_requests WHERE id=$1 FOR UPDATE").bind(id).fetch_optional(&mut *tx).await?.ok_or_else(missing)?;
    if action == Action::Cancel && r.employee_id != actor {
        return Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "본인 휴가 요청만 취소할 수 있습니다.",
        ));
    }
    check_open(&mut tx, r.start_date, r.end_date).await?;
    if action == Action::Cancel {
        if matches!(r.request_status.as_str(), "rejected" | "cancelled") {
            return Err(ApiError::new(
                StatusCode::CONFLICT,
                "취소할 수 없는 휴가 상태입니다.",
            ));
        }
        if r.request_status == "approved" {
            guard_payroll(&mut tx, r.employee_id, r.start_date, r.end_date).await?;
            let historical = r.annual_charge_breakdown.is_none();
            let mut values: BTreeMap<i32, f64> = if let Some(v) = r.annual_charge_breakdown {
                serde_json::from_value(v).map_err(|_| {
                    ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                })?
            } else {
                BTreeMap::new()
            };
            if historical && r.leave_type == "annual" {
                // Historical requests can predate the per-year debit snapshot.
                let days:i64=sqlx::query_scalar("SELECT count(*) FROM generate_series($1::date::timestamp,$2::date::timestamp,interval '1 day') d WHERE extract(isodow FROM d)<6 AND NOT EXISTS(SELECT 1 FROM tim_holidays WHERE holiday_date=d::date AND is_active)").bind(r.start_date).bind(r.end_date).fetch_one(&mut *tx).await?;
                values.insert(r.start_date.year(), days as f64);
            }
            for amount in values.values_mut() {
                *amount = -*amount;
            }
            charge(&mut tx, r.employee_id, &values, true).await?;
            restore(&mut tx, id, r.employee_id).await?;
        }
        sqlx::query("UPDATE tim_leave_requests SET request_status='cancelled',decision_comment=$2,decided_by=$3,decided_at=statement_timestamp() AT TIME ZONE 'UTC',updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1").bind(id).bind(p.reason).bind(actor).execute(&mut *tx).await?;
    } else {
        if r.request_status != "pending" {
            return Err(ApiError::new(
                StatusCode::BAD_REQUEST,
                "대기 상태의 요청만 처리할 수 있습니다.",
            ));
        }
        if action == Action::Approve {
            guard_payroll(&mut tx, r.employee_id, r.start_date, r.end_date).await?;
            let days = workdays(
                &mut tx,
                r.employee_id,
                r.start_date,
                r.end_date,
                &r.leave_type,
            )
            .await?;
            let amounts = deductions(&r.leave_type, &days);
            apply_attendance(&mut tx, id, &r, &days).await?;
            charge(&mut tx, r.employee_id, &amounts, true).await?;
            if matches!(r.leave_type.as_str(), "annual" | "half_day") {
                sqlx::query("UPDATE tim_leave_requests SET annual_charge_breakdown=$2 WHERE id=$1")
                    .bind(id)
                    .bind(json!(amounts))
                    .execute(&mut *tx)
                    .await?;
            } else if r.leave_type == "unpaid" {
                let mut months = BTreeMap::<String, i32>::new();
                for (day, minutes) in days {
                    *months.entry(day.format("%Y-%m").to_string()).or_default() += minutes;
                }
                sqlx::query(
                    "UPDATE tim_leave_requests SET payroll_minutes_snapshot=$2 WHERE id=$1",
                )
                .bind(id)
                .bind(json!(months))
                .execute(&mut *tx)
                .await?;
            }
        }
        sqlx::query("UPDATE tim_leave_requests SET request_status=$2,approver_employee_id=$3,approved_at=statement_timestamp() AT TIME ZONE 'UTC',decided_by=$3,decided_at=statement_timestamp() AT TIME ZONE 'UTC',decision_comment=$4,updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
            .bind(id).bind(if action==Action::Approve{"approved"}else{"rejected"}).bind(actor).bind(p.reason).execute(&mut *tx).await?;
    }
    let result = item(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(result))
}
pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/tim/annual-leave/my", get(my_annual))
        .route(
            "/api/v1/tim/annual-leave/employee/{employee_id}",
            get(employee_annual),
        )
        .route("/api/v1/tim/annual-leave/adjust", post(adjust))
        .route(
            "/api/v1/tim/leave-requests",
            get(list::<false>).post(create),
        )
        .route("/api/v1/tim/leave-requests/my", get(list::<true>))
        .route(
            "/api/v1/tim/leave-requests/{request_id}/approve",
            post(|State(s), Extension(u), Path(id), Body(p)| decide(s, u, id, p, Action::Approve)),
        )
        .route(
            "/api/v1/tim/leave-requests/{request_id}/reject",
            post(|State(s), Extension(u), Path(id), Body(p)| decide(s, u, id, p, Action::Reject)),
        )
        .route(
            "/api/v1/tim/leave-requests/{request_id}/cancel",
            post(|State(s), Extension(u), Path(id), Body(p)| decide(s, u, id, p, Action::Cancel)),
        )
}
