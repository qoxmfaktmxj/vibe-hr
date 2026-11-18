use super::*;
use crate::input::{range, size};
#[derive(Deserialize)]
struct Request {
    year: i32,
    month: i32,
    note: Option<String>,
}
impl Validate for Request {
    fn validate(&self) -> Vec<Violation> {
        [
            range("year", self.year.into(), 2000, 2100),
            range("month", self.month.into(), 1, 12),
            size("note", self.note.as_deref(), 0, 500),
        ]
        .into_iter()
        .flatten()
        .collect()
    }
}
async fn items(
    conn: &mut PgConnection,
    year: i32,
    month: Option<i32>,
) -> Result<Vec<Value>, ApiError> {
    Ok(sqlx::query_scalar(include_str!("month.sql"))
        .bind(year)
        .bind(month)
        .fetch_all(conn)
        .await?)
}
async fn list(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<reports::Params>,
) -> Reply {
    let year = reports::year(&q, "monthCloses")?;
    manager(&u)?;
    let mut c = s.pool.acquire().await?;
    Ok(Json(
        json!({"items":items(&mut c,year,None).await?,"year":year,"total_count":12}),
    ))
}
async fn generate_pay(
    conn: &mut PgConnection,
    start: NaiveDate,
    end: NaiveDate,
) -> Result<(), ApiError> {
    let month = start.format("%Y-%m").to_string();
    type Work = (i32, i64, i64, i64, i64, i64, f64);
    let rows:Vec<Work>=sqlx::query_as("SELECT a.employee_id, sum(a.overtime_minutes),sum(a.night_minutes),sum(a.holiday_work_minutes),sum(a.holiday_overtime_minutes),sum(a.holiday_night_minutes),coalesce(p.base_salary,0)::float8
      FROM tim_attendance_daily a LEFT JOIN LATERAL (SELECT base_salary FROM pay_employee_profiles p WHERE p.employee_id=a.employee_id AND p.is_active AND p.effective_from<=$2 AND (p.effective_to IS NULL OR p.effective_to>=$1) ORDER BY p.effective_from DESC,p.id DESC LIMIT 1) p ON true
      WHERE a.work_date BETWEEN $1 AND $2 GROUP BY a.employee_id,p.base_salary ORDER BY a.employee_id").bind(start).bind(end).fetch_all(&mut *conn).await?;
    for (employee, ot, night, holiday, hot, hn, salary) in rows {
        for (code, minutes, factor) in [
            ("OTX", ot, 1.5),
            ("NGT", night, 0.5),
            ("HDW", holiday, 1.5),
            ("HDO", hot, 2.),
            ("HDN", hn, 2.),
        ] {
            let amount = if minutes > 0 {
                ((salary / 209.) * factor * (minutes as f64 / 60.)).round_ties_even()
            } else {
                0.
            };
            lock(conn, &format!("tim:pay-variable:{month}:{employee}:{code}")).await?;
            let existing:Option<i32>=sqlx::query_scalar("SELECT id FROM pay_variable_inputs WHERE year_month=$1 AND employee_id=$2 AND item_code=$3 LIMIT 1 FOR UPDATE").bind(&month).bind(employee).bind(code).fetch_optional(&mut *conn).await?;
            let memo = format!("월마감 자동생성 ({minutes}분)");
            if let Some(id) = existing {
                sqlx::query("UPDATE pay_variable_inputs SET direction='earning',amount=$2,memo=$3,updated_at=clock_timestamp() AT TIME ZONE 'UTC' WHERE id=$1").bind(id).bind(amount).bind(memo).execute(&mut *conn).await?;
            } else if amount > 0. {
                sqlx::query("INSERT INTO pay_variable_inputs(year_month,employee_id,item_code,direction,amount,memo,created_at,updated_at) VALUES($1,$2,$3,'earning',$4,$5,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC')").bind(&month).bind(employee).bind(code).bind(amount).bind(memo).execute(&mut *conn).await?;
            }
        }
    }
    Ok(())
}
async fn close(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(p): Body<Request>,
) -> Reply {
    manager(&u)?;
    let mut tx = s.pool.begin().await?;
    let start = NaiveDate::from_ymd_opt(p.year, p.month as u32, 1).expect("validated month");
    let last = (start + Months::new(1)).pred_opt().unwrap();
    lock_months(&mut tx, start, start).await?;
    let status: Option<String> = sqlx::query_scalar(
        "SELECT close_status FROM tim_month_closes WHERE year=$1 AND month=$2 FOR UPDATE",
    )
    .bind(p.year)
    .bind(p.month)
    .fetch_optional(&mut *tx)
    .await?;
    if status.as_deref() == Some("closed") {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            format!("{}년 {}월은 이미 마감 상태입니다.", p.year, p.month),
        ));
    }
    lock(&mut tx, &format!("tim:calculate:{}:{}", p.year, p.month)).await?;
    let ids:Vec<i32>=sqlx::query_scalar("SELECT id FROM tim_attendance_daily WHERE work_date BETWEEN $1 AND $2 ORDER BY id FOR UPDATE").bind(start).bind(last).fetch_all(&mut *tx).await?;
    for id in ids {
        let a = attendance_by_id(&mut tx, id).await?;
        let sched = schedule(&mut tx, a.employee_id, a.work_date).await?;
        calculate(
            &mut tx,
            id,
            a.check_in_at,
            a.check_out_at,
            &a.attendance_status,
            &sched,
        )
        .await?;
    }
    sqlx::query(include_str!("close_month.sql"))
        .bind(start)
        .bind(last)
        .bind(p.year)
        .bind(p.month)
        .bind(u.id)
        .bind(p.note)
        .execute(&mut *tx)
        .await?;
    generate_pay(&mut tx, start, last).await?;
    let out = items(&mut tx, p.year, Some(p.month)).await?.remove(0);
    tx.commit().await?;
    Ok(Json(json!({"item":out})))
}
async fn reopen(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path((year, month)): Path<(i32, i32)>,
) -> Reply {
    manager(&u)?;
    let mut tx = s.pool.begin().await?;
    lock(&mut tx, &format!("tim:month-close:{year}:{month}")).await?;
    let affected=sqlx::query("UPDATE tim_month_closes SET close_status='open',reopened_by=$3,reopened_at=statement_timestamp() AT TIME ZONE 'UTC',updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE year=$1 AND month=$2 AND close_status<>'open'")
        .bind(year).bind(month).bind(u.id).execute(&mut *tx).await?.rows_affected();
    if affected == 0 {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            format!("{year}년 {month}월은 마감 상태가 아닙니다."),
        ));
    }
    let out = items(&mut tx, year, Some(month)).await?.remove(0);
    tx.commit().await?;
    Ok(Json(json!({"item":out})))
}
pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/tim/month-close", get(list).post(close))
        .route(
            "/api/v1/tim/month-close/{year}/{month}/reopen",
            post(reopen),
        )
}
