use super::{
    Reply, basic::instant_fields, employees::int, forms::SeveranceAdjustment, retirement::Page,
};
use crate::{ApiError, AppState, input::Body, security::CurrentUser};
use axum::{
    Extension, Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
};
use bigdecimal::{BigDecimal, FromPrimitive, RoundingMode};
use chrono::{Datelike, Months, NaiveDate};
use serde_json::{Value, json};
use sqlx::{PgConnection, PgPool};
use std::num::NonZeroU64;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/hr/severance/calcs", get(list))
        .route(
            "/api/v1/hr/severance/calcs/{calc_id}",
            get(detail).put(adjust),
        )
        .route(
            "/api/v1/hr/severance/calcs/{calc_id}/recalculate",
            post(recalculate),
        )
        .route(
            "/api/v1/hr/severance/calcs/{calc_id}/confirm",
            post(confirm),
        )
}
async fn allow(pool: &PgPool, user: &CurrentUser) -> Result<(), ApiError> {
    super::require_role(pool, user, &["hr_manager", "payroll_mgr", "admin"]).await
}
fn missing() -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, "Severance calc not found.")
}
fn conflict(msg: &str) -> ApiError {
    ApiError::new(StatusCode::CONFLICT, msg)
}

fn divide(a: f64, b: f64) -> f64 {
    // HrSeveranceMath uses exact-binary BigDecimal operands and DECIMAL128 division,
    // then returns to the legacy double representation at each operation.
    let v = BigDecimal::from_f64(a).unwrap() / BigDecimal::from_f64(b).unwrap();
    v.with_precision_round(NonZeroU64::new(34).unwrap(), RoundingMode::HalfEven)
        .to_string()
        .parse()
        .unwrap()
}
fn tax_base(amount: f64, days: i32) -> Value {
    let years = (f64::from(days) / 365.0).ceil().max(0.0) as i32;
    let mut v = json!({"service_years":years,"service_year_deduction":0.0,"conversion_income":0.0,"conversion_income_deduction":0.0,
        "taxable_base":0.0,"base_tax_rate":0.0,"quick_deduction":0.0,"converted_calculated_tax":0.0,"income_tax":0.0,
        "local_income_tax":0.0,"net_severance":amount,"tax_table_year":null,"warning":null});
    if days < 365 || amount <= 0.0 {
        return v;
    }
    let y = f64::from(years);
    let deduction = match years {
        ..=5 => y * 1e6,
        6..=10 => 5e6 + (y - 5.) * 2e6,
        11..=20 => 15e6 + (y - 10.) * 2.5e6,
        _ => 40e6 + (y - 20.) * 3e6,
    };
    let conversion = divide((amount - deduction).max(0.) * 12., y);
    let cd = if conversion <= 8e6 {
        conversion
    } else if conversion <= 70e6 {
        8e6 + (conversion - 8e6) * 0.6
    } else if conversion <= 100e6 {
        45.2e6 + (conversion - 70e6) * 0.55
    } else if conversion <= 300e6 {
        61.7e6 + (conversion - 100e6) * 0.45
    } else {
        151.7e6 + (conversion - 300e6) * 0.35
    };
    v["service_year_deduction"] = json!(deduction);
    v["conversion_income"] = json!(conversion);
    v["conversion_income_deduction"] = json!(cd);
    v["taxable_base"] = json!((conversion - cd).max(0.));
    v["tax_table_year"] = json!(2026);
    v
}
fn apply_bracket(v: &mut Value, rate: f64, quick: f64, year: i32, warning: Option<String>) {
    let taxable = v["taxable_base"].as_f64().unwrap();
    let y = v["service_years"].as_i64().unwrap() as f64;
    let calculated = (taxable * divide(rate, 100.) - quick).max(0.);
    let income = divide(calculated, 12.) * y;
    let local = income * 0.1;
    let amount = v["net_severance"].as_f64().unwrap();
    v["bracket_year"] = json!(year);
    v["base_tax_rate"] = json!(rate);
    v["quick_deduction"] = json!(quick);
    v["converted_calculated_tax"] = json!(calculated);
    v["income_tax"] = json!(income);
    v["local_income_tax"] = json!(local);
    v["net_severance"] = json!(amount - income - local);
    v["warning"] = json!(warning);
}
async fn tax(
    conn: &mut PgConnection,
    amount: f64,
    days: i32,
    year: i32,
) -> Result<Value, ApiError> {
    let mut v = tax_base(amount, days);
    if v["tax_table_year"].is_null() {
        return Ok(v);
    }
    let found: Option<i32> = sqlx::query_scalar(
        "SELECT year FROM pay_income_tax_brackets ORDER BY (year=$1) DESC,year DESC LIMIT 1",
    )
    .bind(year)
    .fetch_optional(&mut *conn)
    .await?;
    let used = found.unwrap_or(year);
    let bracket:Option<(f64,f64)>=sqlx::query_as("SELECT tax_rate,coalesce(quick_deduction,0::float8) FROM pay_income_tax_brackets
        WHERE year=$1 AND annual_taxable_from<=$2 AND (annual_taxable_to IS NULL OR annual_taxable_to>=$2) ORDER BY annual_taxable_from DESC LIMIT 1")
        .bind(used).bind(v["taxable_base"].as_f64().unwrap()).fetch_optional(conn).await?;
    let (rate, quick) = bracket.unwrap_or((0., 0.));
    let warn_year = if year != 2026 {
        Some(2026)
    } else if used != year {
        Some(used)
    } else {
        None
    };
    apply_bracket(
        &mut v,
        rate,
        quick,
        used,
        warn_year.map(|fallback| {
            format!("{year}년 기본세율 구간이 없어 최신 연도({fallback}) 기준으로 계산했습니다.")
        }),
    );
    Ok(v)
}
async fn wages(
    conn: &mut PgConnection,
    employee: i32,
    from: Option<NaiveDate>,
    to: Option<NaiveDate>,
) -> Result<Vec<Value>, ApiError> {
    let rows:Vec<(String,Option<String>,f64,String)>=sqlx::query_as("SELECT i.item_code,max(a.name),sum(i.amount)::float8,coalesce(r.include_type,'full') FROM pay_payroll_run_items i
        JOIN pay_payroll_run_employees re ON re.id=i.run_employee_id JOIN pay_payroll_runs p ON p.id=re.run_id LEFT JOIN pay_severance_item_rules r ON r.pay_item_code=i.item_code AND r.is_active
        LEFT JOIN pay_allowance_deductions a ON a.code=i.item_code WHERE re.employee_id=$1 AND p.status='paid' AND i.direction='earning' AND
        to_date(p.year_month||'-01','YYYY-MM-DD')<=$3 AND (to_date(p.year_month||'-01','YYYY-MM-DD')+interval '1 month - 1 day')::date>=$2 GROUP BY i.item_code,r.include_type ORDER BY i.item_code")
        .bind(employee).bind(from).bind(to).fetch_all(conn).await?;
    Ok(rows.into_iter().map(|(code,name,raw,kind)|{
        let included=match kind.as_str(){"exclude"=>0.,"prorate_12"=>raw*3./12.,_=>raw};
        json!({"item_code":code,"item_name":name,"raw_amount":raw,"include_type":kind,"included_amount":included})
    }).collect())
}
fn dates(hire: NaiveDate, retire: NaiveDate) -> (i32, NaiveDate, NaiveDate, i32) {
    let days = (retire - hire).num_days() as i32 + 1;
    let end = retire.pred_opt().unwrap();
    let start = end
        .checked_sub_months(Months::new(3))
        .unwrap()
        .succ_opt()
        .unwrap();
    (days, start, end, (end - start).num_days() as i32 + 1)
}
fn sum_income(items: &[Value]) -> f64 {
    // DoubleStream.sum uses compensated summation.
    let mut sum = 0.;
    let mut compensation = 0.;
    for row in items {
        let term = row["included_amount"].as_f64().unwrap() - compensation;
        let next = sum + term;
        compensation = (next - sum) - term;
        sum = next;
    }
    sum - compensation
}
async fn calculate(
    conn: &mut PgConnection,
    id: Option<i32>,
    case: i32,
    adjust: f64,
) -> Result<i32, ApiError> {
    let (employee, hire, retire): (i32, NaiveDate, NaiveDate) = sqlx::query_as(
        "SELECT e.id,e.hire_date,c.retire_date FROM hr_retire_cases c
        JOIN hr_employees e ON e.id=c.employee_id WHERE c.id=$1 FOR UPDATE OF c,e",
    )
    .bind(case)
    .fetch_one(&mut *conn)
    .await?;
    let (days, from, to, base_days) = dates(hire, retire);
    let items = wages(conn, employee, Some(from), Some(to)).await?;
    let total = sum_income(&items);
    let daily = if base_days == 0 {
        0.
    } else {
        total / f64::from(base_days)
    };
    let severance = if days < 365 {
        0.
    } else {
        daily * 30. * divide(f64::from(days), 365.)
    };
    let amount = severance + adjust;
    let tax = tax(conn, amount, days, retire.year()).await?;
    let mut warnings = vec![];
    if total == 0. {
        warnings.push("직전 3개월 내 확정(paid) 급여 데이터가 없습니다.");
    }
    if days < 365 {
        warnings.push("근속일수가 1년 미만이라 퇴직금이 발생하지 않습니다.");
    }
    if let Some(warning) = tax["warning"].as_str() {
        warnings.push(warning);
    }
    let values = json!({"hire_date":hire,"retire_date":retire,"service_days":days,"avg_wage_base_from":from,"avg_wage_base_to":to,"wage_total_3m":total,"base_days_3m":base_days,
        "avg_daily_wage":daily,"severance_amount":severance,"adjustment_amount":adjust,"final_amount":amount,"service_years":tax["service_years"],"income_tax":tax["income_tax"],
        "local_income_tax":tax["local_income_tax"],"net_severance":tax["net_severance"],"warning":(!warnings.is_empty()).then(||warnings.join(" ")),"tax_detail_json":tax.to_string()});
    let id = if let Some(id) = id {
        sqlx::query("UPDATE hr_severance_calcs SET
        (hire_date,retire_date,service_days,avg_wage_base_from,avg_wage_base_to,wage_total_3m,base_days_3m,avg_daily_wage,severance_amount,final_amount,service_years,income_tax,local_income_tax,net_severance,warning,tax_detail_json)=
        (SELECT hire_date,retire_date,service_days,avg_wage_base_from,avg_wage_base_to,wage_total_3m,base_days_3m,avg_daily_wage,severance_amount,final_amount,service_years,income_tax,local_income_tax,net_severance,warning,tax_detail_json FROM jsonb_populate_record(NULL::hr_severance_calcs,$2)),
        calculated_at=statement_timestamp() AT TIME ZONE 'UTC',updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
        .bind(id).bind(values).execute(conn).await?;
        id
    } else {
        sqlx::query_scalar("INSERT INTO hr_severance_calcs
        (retire_case_id,employee_id,hire_date,retire_date,service_days,avg_wage_base_from,avg_wage_base_to,wage_total_3m,base_days_3m,avg_daily_wage,severance_amount,adjustment_amount,final_amount,service_years,income_tax,local_income_tax,net_severance,warning,tax_detail_json,status,created_at,updated_at,calculated_at)
        SELECT $1,$2,hire_date,retire_date,service_days,avg_wage_base_from,avg_wage_base_to,wage_total_3m,base_days_3m,avg_daily_wage,severance_amount,adjustment_amount,final_amount,service_years,income_tax,local_income_tax,net_severance,warning,tax_detail_json,'draft',statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC' FROM jsonb_populate_record(NULL::hr_severance_calcs,$3) RETURNING id")
        .bind(case).bind(employee).bind(values).fetch_one(conn).await?
    };
    Ok(id)
}
pub(super) async fn create_draft(pool: &PgPool, case: i32) -> Result<(), ApiError> {
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT id FROM hr_retire_cases WHERE id=$1 FOR UPDATE")
        .bind(case)
        .execute(&mut *tx)
        .await?;
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM hr_severance_calcs WHERE retire_case_id=$1)",
    )
    .bind(case)
    .fetch_one(&mut *tx)
    .await?;
    if !exists {
        calculate(&mut tx, None, case, 0.).await?;
    }
    tx.commit().await?;
    Ok(())
}
async fn list(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Page>,
) -> Reply {
    let (page, limit, offset) = q.window("severance")?;
    allow(&s.pool, &u).await?;
    let (total,mut rows):(i64,Value)=sqlx::query_as("WITH data AS (
        SELECT c.*, e.employee_no, u.display_name employee_name, d.name department_name FROM hr_severance_calcs c JOIN hr_employees e ON e.id=c.employee_id JOIN auth_users u ON u.id=e.user_id
        JOIN org_departments d ON d.id=e.department_id WHERE ($1::text IS NULL OR c.status=$1) AND ($2::text IS NULL OR extract(year FROM c.retire_date)::int::text=$2)),
        paged AS (SELECT * FROM data ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4)
        SELECT (SELECT count(*) FROM data),coalesce(jsonb_agg(to_jsonb(paged)-'tax_detail_json' ORDER BY created_at DESC,id DESC),'[]') FROM paged")
       .bind(q.status.filter(|v|!v.trim().is_empty())).bind(q.year.filter(|v|!v.trim().is_empty())).bind(limit).bind(offset).fetch_one(&s.pool).await?;
    for row in rows.as_array_mut().unwrap() {
        instant_fields(
            row,
            &["calculated_at", "confirmed_at", "created_at", "updated_at"],
        );
    }
    Ok(Json(
        json!({"items":rows,"total_count":total,"page":page,"limit":limit}),
    ))
}
async fn calc_detail(conn: &mut PgConnection, id: i32) -> Result<Value, ApiError> {
    let mut calc:Value=sqlx::query_scalar("SELECT to_jsonb(c)||jsonb_build_object('employee_no',e.employee_no,'employee_name',u.display_name,'department_name',d.name)
        FROM hr_severance_calcs c JOIN hr_employees e ON e.id=c.employee_id JOIN auth_users u ON u.id=e.user_id JOIN org_departments d ON d.id=e.department_id WHERE c.id=$1")
        .bind(id).fetch_optional(&mut *conn).await?.ok_or_else(missing)?;
    instant_fields(
        &mut calc,
        &["calculated_at", "confirmed_at", "created_at", "updated_at"],
    );
    let mut tax: Value = calc
        .as_object_mut()
        .unwrap()
        .remove("tax_detail_json")
        .and_then(|v| serde_json::from_str(v.as_str()?).ok())
        .unwrap_or(Value::Null);
    if let Some(object) = tax.as_object_mut() {
        object.entry("bracket_year").or_insert(Value::Null);
    }
    let from = calc["avg_wage_base_from"]
        .as_str()
        .and_then(|s| s.parse().ok());
    let to = calc["avg_wage_base_to"]
        .as_str()
        .and_then(|s| s.parse().ok());
    let items = wages(conn, int(&calc["employee_id"]).unwrap(), from, to).await?;
    Ok(json!({"calc":calc,"wage_details":items,"tax_detail":tax}))
}
async fn detail(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    allow(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let r = calc_detail(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(r))
}
async fn locked(conn: &mut PgConnection, id: i32) -> Result<Value, ApiError> {
    sqlx::query_scalar("SELECT to_jsonb(c) FROM hr_severance_calcs c WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(missing)
}
async fn recalculate(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    allow(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let c = locked(&mut tx, id).await?;
    if c["status"] == "confirmed" {
        return Err(conflict("Confirmed calc cannot be recalculated."));
    }
    calculate(
        &mut tx,
        Some(id),
        int(&c["retire_case_id"]).unwrap(),
        c["adjustment_amount"].as_f64().unwrap_or(0.),
    )
    .await?;
    let result = calc_detail(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(result))
}
async fn adjust(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
    Body(SeveranceAdjustment(p)): Body<SeveranceAdjustment>,
) -> Reply {
    allow(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let c = locked(&mut tx, id).await?;
    if c["status"] == "confirmed" {
        return Err(conflict("Confirmed calc cannot be modified."));
    }
    let reason = p["adjustment_reason"].as_str().unwrap().trim();
    if reason.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "adjustment_reason is required.",
        ));
    }
    let adjustment = p["adjustment_amount"].as_f64().unwrap();
    let amount = c["severance_amount"].as_f64().unwrap() + adjustment;
    let year = c["retire_date"]
        .as_str()
        .unwrap()
        .parse::<NaiveDate>()
        .unwrap()
        .year();
    let tax = tax(&mut tx, amount, int(&c["service_days"]).unwrap(), year).await?;
    let mut warning = c["warning"].as_str().map(str::to_owned);
    if let Some(new) = tax["warning"].as_str()
        && !warning.as_deref().is_some_and(|s| s.contains(new))
    {
        warning = Some(
            warning
                .filter(|s| !s.trim().is_empty())
                .map_or_else(|| new.into(), |prev| format!("{prev} {new}")),
        );
    }
    sqlx::query("UPDATE hr_severance_calcs SET adjustment_amount=$2,adjustment_reason=$3,final_amount=$4,status='reviewed',warning=$5,service_years=$6,income_tax=$7,
        local_income_tax=$8,net_severance=$9,tax_detail_json=$10,updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
        .bind(id).bind(adjustment).bind(reason).bind(amount).bind(warning).bind(int(&tax["service_years"])).bind(tax["income_tax"].as_f64()).bind(tax["local_income_tax"].as_f64())
        .bind(tax["net_severance"].as_f64()).bind(tax.to_string()).execute(&mut *tx).await?;
    let result = calc_detail(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(result))
}
async fn confirm(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    allow(&s.pool, &u).await?;
    let mut tx = s.pool.begin().await?;
    let c = locked(&mut tx, id).await?;
    if c["status"] == "confirmed" {
        return Err(conflict("Calc is already confirmed."));
    }
    sqlx::query("UPDATE hr_severance_calcs SET status='confirmed',confirmed_by=$2,confirmed_at=statement_timestamp() AT TIME ZONE 'UTC',updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
        .bind(id).bind(u.id).execute(&mut *tx).await?;
    let result = calc_detail(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(result))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn spring_tax_and_calendar_vectors() {
        let (days, _, _, _) = dates("2025-01-01".parse().unwrap(), "2025-12-31".parse().unwrap());
        assert_eq!(days, 365);
        let (_, from, to, _) = dates("2025-01-01".parse().unwrap(), "2026-05-31".parse().unwrap());
        assert_eq!(from.to_string(), "2026-03-01");
        assert_eq!(to.to_string(), "2026-05-30");
        let mut amount = tax_base(100_000_000., 3650);
        apply_bracket(&mut amount, 15., 1_260_000., 2026, None);
        assert_eq!(amount["taxable_base"], 39_400_000.);
        assert_eq!(amount["income_tax"], 3_875_000.);
        assert_eq!(amount["local_income_tax"], 387_500.);
        assert_eq!(amount["net_severance"], 95_737_500.);
        let under_year = tax_base(125_000., 364);
        assert_eq!(under_year["income_tax"], 0.);
        assert!(under_year.get("bracket_year").is_none());
    }
}
