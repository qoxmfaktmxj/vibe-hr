use super::{
    calculation::*,
    snapshots::{Period, Target},
    *,
};
use crate::input::{Body, Validate, Violation};
use chrono::Datelike;
use sqlx::{PgConnection, Row};
use std::collections::HashMap;

#[derive(Deserialize)]
pub(super) struct CreateRun {
    year_month: Option<String>,
    payroll_code_id: Option<i32>,
    run_name: Option<String>,
}

impl Validate for CreateRun {
    fn validate(&self) -> Vec<Violation> {
        let mut errors = vec![];
        if let Some(v) = crate::input::not_blank("year_month", self.year_month.as_deref()) {
            errors.push(v);
        }
        if let Some(month) = self.year_month.as_deref()
            && (month.len() != 7 || Period::parse(month).is_err())
        {
            errors.push(Violation::field(
                "pattern",
                "year_month",
                "must match \"^\\d{4}-(0[1-9]|1[0-2])$\"".into(),
                json!(month),
            ));
        }
        if self.payroll_code_id.is_none() {
            errors.push(Violation::field(
                "notnull",
                "payroll_code_id",
                "must not be null".into(),
                Value::Null,
            ));
        }
        if let Some(v) = crate::input::size("run_name", self.run_name.as_deref(), 0, 120) {
            errors.push(v);
        }
        errors
    }
}

async fn event(
    conn: &mut PgConnection,
    id: i32,
    kind: &str,
    message: &str,
) -> Result<(), ApiError> {
    sqlx::query("INSERT INTO pay_payroll_run_events(run_id,event_type,message,created_at) VALUES($1,$2,$3,timezone('UTC',clock_timestamp()))")
        .bind(id).bind(kind).bind(message).execute(conn).await?;
    Ok(())
}

pub(super) async fn create(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Body(request): Body<CreateRun>,
) -> Reply {
    require_role(&user, false)?;
    let month = request.year_month.as_deref().expect("validated year month");
    let code = request.payroll_code_id.expect("validated payroll code");
    let mut tx = state.pool.begin().await?;
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM pay_payroll_codes WHERE id=$1)")
            .bind(code)
            .fetch_one(&mut *tx)
            .await?;
    if !exists {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            format!("Invalid payroll_code_id: {code}"),
        ));
    }
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1))")
        .bind(format!("payroll-run:{month}:{code}"))
        .execute(&mut *tx)
        .await?;
    let duplicate: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM pay_payroll_runs WHERE year_month=$1 AND payroll_code_id=$2)",
    )
    .bind(month)
    .bind(code)
    .fetch_one(&mut *tx)
    .await?;
    if duplicate {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "Payroll run already exists for year_month + payroll_code.",
        ));
    }
    let id:i32=sqlx::query_scalar("INSERT INTO pay_payroll_runs(year_month,payroll_code_id,run_name,status,total_employees,total_gross,total_deductions,total_net,created_at,updated_at)
        VALUES($1,$2,$3,'draft',0,0,0,0,timezone('UTC',clock_timestamp()),timezone('UTC',clock_timestamp())) RETURNING id")
        .bind(month).bind(code).bind(request.run_name).fetch_one(&mut *tx).await?;
    let (targets, events) = snapshots::materialize(&mut tx, id, month, code, true).await?;
    event(&mut tx, id, "created", "Payroll run created.").await?;
    event(
        &mut tx,
        id,
        "snapshot_created",
        &format!("Payroll target snapshot created for {targets} employees ({events} events)."),
    )
    .await?;
    let run = read::run_item(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({"run":run})))
}

async fn code(conn: &mut PgConnection, id: i32) -> Result<i32, ApiError> {
    Ok(
        sqlx::query_scalar("SELECT payroll_code_id FROM pay_payroll_runs WHERE id=$1")
            .bind(id)
            .fetch_one(conn)
            .await?,
    )
}

async fn unpaid_minutes(
    conn: &mut PgConnection,
    month: &str,
    period: Period,
    employees: &[i32],
) -> Result<HashMap<i32, i64>, ApiError> {
    let exists:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM pay_variable_inputs WHERE year_month=$1 AND item_code='TIM_UNPAID' AND employee_id=ANY($2))")
        .bind(month).bind(employees).fetch_one(&mut *conn).await?;
    if exists {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "TIM_UNPAID 수동 입력을 먼저 검토하고 삭제한 뒤 자동 무급휴가 공제를 계산하세요.",
        ));
    }
    let minutes:Vec<(i32,i64)>=sqlx::query_as("SELECT employee_id,sum(coalesce((payroll_minutes_snapshot->>$1)::integer,0))
        FROM tim_leave_requests WHERE employee_id=ANY($2) AND request_status='approved' AND leave_type='unpaid'
        AND payroll_minutes_snapshot IS NOT NULL AND start_date<=$4 AND end_date>=$3 GROUP BY employee_id")
        .bind(month).bind(employees).bind(period.start).bind(period.end).fetch_all(conn).await?;
    Ok(minutes.into_iter().collect())
}

async fn masters(conn: &mut PgConnection, year: i32) -> Result<PayMasters, ApiError> {
    let rates = sqlx::query(
        "SELECT rate_type,employee_rate,min_limit,max_limit FROM pay_tax_rates WHERE year=$1",
    )
    .bind(year)
    .fetch_all(&mut *conn)
    .await?
    .into_iter()
    .map(|r| {
        Ok(TaxRate {
            rate_type: r.try_get("rate_type")?,
            employee_rate: r.try_get("employee_rate")?,
            min_limit: r.try_get("min_limit")?,
            max_limit: r.try_get("max_limit")?,
        })
    })
    .collect::<Result<_, sqlx::Error>>()?;
    let brackets=sqlx::query("SELECT annual_taxable_from,annual_taxable_to,tax_rate,quick_deduction FROM pay_income_tax_brackets WHERE year=$1 ORDER BY annual_taxable_from")
        .bind(year).fetch_all(&mut *conn).await?.into_iter().map(|r|Ok(IncomeBracket{annual_from:r.try_get("annual_taxable_from")?,
            annual_to:r.try_get("annual_taxable_to")?,rate:r.try_get("tax_rate")?,quick_deduction:r.try_get("quick_deduction")?})).collect::<Result<_,sqlx::Error>>()?;
    let definitions =
        sqlx::query("SELECT code,name,tax_type,calculation_type FROM pay_allowance_deductions")
            .fetch_all(conn)
            .await?
            .into_iter()
            .map(|r| {
                Ok((
                    r.try_get("code")?,
                    Definition {
                        name: r.try_get("name")?,
                        tax_type: r.try_get("tax_type")?,
                        calculation_type: r.try_get("calculation_type")?,
                    },
                ))
            })
            .collect::<Result<_, sqlx::Error>>()?;
    Ok(PayMasters {
        rates,
        brackets,
        definitions,
    })
}

async fn save_employee(
    conn: &mut PgConnection,
    id: i32,
    target: &Target,
    result: &EmployeeResult,
) -> Result<(), ApiError> {
    let (status, warning) = if result.warnings.is_empty() {
        ("ok", None)
    } else {
        ("warning", Some(result.warnings.join("; ")))
    };
    let re:i32=sqlx::query_scalar("INSERT INTO pay_payroll_run_employees(run_id,employee_id,profile_id,gross_pay,taxable_income,
        non_taxable_income,total_deductions,net_pay,status,warning_message,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,timezone('UTC',clock_timestamp()),timezone('UTC',clock_timestamp())) RETURNING id")
        .bind(id).bind(target.employee_id).bind(target.profile_id).bind(result.gross).bind(result.taxable)
        .bind(result.non_taxable).bind(result.deductions).bind(result.net).bind(status).bind(warning).fetch_one(&mut *conn).await?;
    for item in &result.items {
        sqlx::query("INSERT INTO pay_payroll_run_items(run_employee_id,item_code,item_name,direction,amount,tax_type,calculation_type,source_type,created_at)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,timezone('UTC',clock_timestamp()))")
            .bind(re).bind(&item.code).bind(&item.name).bind(&item.direction).bind(item.amount).bind(&item.tax_type)
            .bind(&item.calculation_type).bind(item.source).execute(&mut *conn).await?;
    }
    Ok(())
}

async fn calculate_locked(
    conn: &mut PgConnection,
    id: i32,
    month: &str,
    status: &str,
) -> Result<(), ApiError> {
    if matches!(status, "closed" | "paid") {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "Closed/paid run cannot be recalculated.",
        ));
    }
    let period = Period::parse(month)?;
    let mut targets = snapshots::targets(conn, id).await?;
    if targets.is_empty() {
        let code = code(conn, id).await?;
        snapshots::materialize(conn, id, month, code, false).await?;
        targets = snapshots::targets(conn, id).await?;
    }
    let employees: Vec<_> = targets.iter().map(|target| target.employee_id).collect();
    snapshots::leave_events(conn, id, &employees, period, true).await?;
    let minutes = unpaid_minutes(conn, month, period, &employees).await?;
    sqlx::query("DELETE FROM pay_payroll_run_items i USING pay_payroll_run_employees e WHERE i.run_employee_id=e.id AND e.run_id=$1")
        .bind(id).execute(&mut *conn).await?;
    sqlx::query("DELETE FROM pay_payroll_run_employees WHERE run_id=$1")
        .bind(id)
        .execute(&mut *conn)
        .await?;
    let mut variables: HashMap<i32, Vec<Variable>> = HashMap::new();
    for r in sqlx::query("SELECT employee_id,item_code,direction,amount FROM pay_variable_inputs WHERE year_month=$1 AND employee_id=ANY($2)")
        .bind(month).bind(&employees).fetch_all(&mut *conn).await?{
        variables.entry(r.try_get("employee_id")?).or_default().push(Variable{code:r.try_get("item_code")?,direction:r.try_get("direction")?,amount:r.try_get("amount")?});
    }
    let mut review: HashMap<i32, Vec<String>> = HashMap::new();
    let events: Vec<(i32, String)> = sqlx::query_as(
        "SELECT employee_id,event_name FROM pay_payroll_run_target_events
        WHERE run_id=$1 AND decision_code='review' ORDER BY employee_id,effective_date,id",
    )
    .bind(id)
    .fetch_all(&mut *conn)
    .await?;
    for (employee, name) in events {
        review.entry(employee).or_default().push(name);
    }
    let mut welfare: HashMap<i32, Vec<Welfare>> = HashMap::new();
    for r in snapshots::benefits(conn, &employees, month, true).await? {
        welfare.entry(r.employee).or_default().push(r.benefit);
    }
    let masters = masters(conn, period.start.year()).await?;
    let (mut gross, mut deductions, mut net) = (0.0, 0.0, 0.0);
    let mut review_count = 0;
    for target in &targets {
        let employee = target.employee_id;
        let review = review.get(&employee).map_or(&[][..], Vec::as_slice);
        if !review.is_empty() {
            review_count += 1;
        }
        let result = masters.calculate_employee(
            target.base_salary(),
            minutes.get(&employee).copied().unwrap_or_default(),
            review,
            variables.get(&employee).map_or(&[], Vec::as_slice),
            welfare.get(&employee).map_or(&[], Vec::as_slice),
        );
        save_employee(conn, id, target, &result).await?;
        gross += result.gross;
        deductions += result.deductions;
        net += result.net;
    }
    let count = targets.len() as i32;
    sqlx::query("UPDATE pay_payroll_runs SET total_employees=$2,total_gross=$3,total_deductions=$4,total_net=$5,status='calculated',
        calculated_at=timezone('UTC',clock_timestamp()),updated_at=timezone('UTC',clock_timestamp()) WHERE id=$1")
        .bind(id).bind(count).bind(money(gross)).bind(money(deductions)).bind(money(net)).execute(&mut *conn).await?;
    event(
        conn,
        id,
        "calculated",
        &format!("Payroll calculated for {count} employees (review targets: {review_count})."),
    )
    .await
}

pub(super) async fn calculate(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    require_role(&user, false)?;
    let mut tx = state.pool.begin().await?;
    let (month, status) = approvals::lock_run(&mut tx, id).await?;
    calculate_locked(&mut tx, id, &month, &status).await?;
    let run = read::run_item(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({"run":run})))
}

pub(super) async fn refresh(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    require_role(&user, false)?;
    let mut tx = state.pool.begin().await?;
    let (month, status) = approvals::lock_run(&mut tx, id).await?;
    if matches!(status.as_str(), "closed" | "paid") {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "Closed/paid run cannot refresh snapshot.",
        ));
    }
    let code = code(&mut tx, id).await?;
    let (targets, events) = snapshots::materialize(&mut tx, id, &month, code, true).await?;
    sqlx::query(
        "UPDATE pay_payroll_runs SET updated_at=timezone('UTC',clock_timestamp()) WHERE id=$1",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;
    event(
        &mut tx,
        id,
        "snapshot_refreshed",
        &format!("Payroll target snapshot refreshed for {targets} employees ({events} events)."),
    )
    .await?;
    if status == "calculated" {
        calculate_locked(&mut tx, id, &month, &status).await?;
    }
    let run = read::run_item(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({"run":run})))
}

pub(super) async fn close(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    require_role(&user, false)?;
    let mut tx = state.pool.begin().await?;
    let (month, status) = approvals::lock_run(&mut tx, id).await?;
    if status != "calculated" {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "Only calculated run can be closed.",
        ));
    }
    let period = Period::parse(&month)?;
    let targets = snapshots::targets(&mut tx, id).await?;
    let employees: Vec<_> = targets.iter().map(|t| t.employee_id).collect();
    snapshots::leave_events(&mut tx, id, &employees, period, true).await?;
    let stored:Vec<(i32,f64)>=sqlx::query_as("SELECT e.employee_id,i.amount FROM pay_payroll_run_employees e
        JOIN pay_payroll_run_items i ON i.run_employee_id=e.id WHERE e.run_id=$1 AND i.item_code='TIM_UNPAID' AND i.source_type='tim_leave'")
        .bind(id).fetch_all(&mut *tx).await?;
    let minutes = unpaid_minutes(&mut tx, &month, period, &employees).await?;
    let current: HashMap<_, _> = targets
        .iter()
        .filter_map(|t| {
            let approved = minutes.get(&t.employee_id)?;
            let salary = t
                .base_salary()
                .to_string()
                .parse()
                .expect("database salary");
            let amount = unpaid_amount(&salary, *approved);
            (amount > 0.0).then_some((t.employee_id, amount))
        })
        .collect();
    if current != stored.into_iter().collect() {
        calculate_locked(&mut tx, id, &month, &status).await?;
    }
    sqlx::query(
        "UPDATE pay_payroll_runs SET status='closed',closed_at=timezone('UTC',clock_timestamp()),
        updated_at=timezone('UTC',clock_timestamp()) WHERE id=$1",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;
    event(&mut tx, id, "closed", "Payroll run closed.").await?;
    let run = read::run_item(&mut tx, id).await?;
    tx.commit().await?;
    // Spring commits closure independently of the best-effort accrual draft.
    let outcome: Result<(), ApiError> = async {
        let mut tx = state.pool.begin().await?;
        let (month, status) = approvals::lock_run(&mut tx, id).await?;
        voucher::accrual_in_transaction(&mut tx, id, &month, &status, None).await?;
        tx.commit().await?;
        Ok(())
    }
    .await;
    if outcome.is_err() {
        eprintln!("Failed to auto-generate accrual voucher draft for run_id={id} action=close");
    }
    Ok(Json(json!({"run":run})))
}
