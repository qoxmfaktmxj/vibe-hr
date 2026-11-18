use super::calculation::{money, whole_won};
use super::*;
use crate::input::{Body, Validate, Violation};
use sqlx::PgConnection;
use std::collections::{BTreeMap, HashMap, HashSet};

#[derive(Deserialize)]
pub(super) struct RunId {
    run_id: Option<i32>,
}

impl Validate for RunId {
    fn validate(&self) -> Vec<Violation> {
        if self.run_id.is_none() {
            vec![Violation::field(
                "notnull",
                "run_id",
                "must not be null".into(),
                Value::Null,
            )]
        } else {
            vec![]
        }
    }
}

#[derive(sqlx::FromRow)]
struct Source {
    employee_id: i32,
    item_code: String,
    item_name: Option<String>,
    direction: String,
    amount: f64,
    center: Option<String>,
    account: Option<String>,
}

async fn source(connection: &mut PgConnection, id: i32) -> Result<Vec<Source>, ApiError> {
    Ok(sqlx::query_as(
        "SELECT e.employee_id,i.item_code,a.name AS item_name,i.direction,i.amount,
            d.cost_center_code AS center,m.gl_account_code AS account
          FROM pay_payroll_run_items i JOIN pay_payroll_run_employees e ON e.id=i.run_employee_id
          JOIN pay_payroll_runs r ON r.id=e.run_id LEFT JOIN hr_employees h ON h.id=e.employee_id
          LEFT JOIN org_departments d ON d.id=h.department_id
          LEFT JOIN pay_allowance_deductions a ON a.code=i.item_code
          LEFT JOIN LATERAL (SELECT gl_account_code FROM pay_gl_mappings m
               WHERE m.pay_item_code=i.item_code AND m.is_active AND
                   m.effective_from<=coalesce(r.closed_at::date,timezone('UTC',now())::date)
               ORDER BY m.effective_from DESC LIMIT 1) m ON true
         WHERE r.id=$1 ORDER BY i.id",
    )
    .bind(id)
    .fetch_all(connection)
    .await?)
}

pub(super) async fn gaps(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Query(params): Query<HashMap<String, String>>,
) -> Reply {
    let run_id =
        crate::input::params::required_i32("run_id", params.get("run_id").map(String::as_str))?;
    require_role(&user, false)?;
    let mut conn = state.pool.acquire().await?;
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM pay_payroll_runs WHERE id=$1)")
            .bind(run_id)
            .fetch_one(&mut *conn)
            .await?;
    if !exists {
        return Err(ApiError::new(
            StatusCode::NOT_FOUND,
            "Payroll run not found.",
        ));
    }
    let mut seen = HashSet::new();
    let gaps: Vec<_> = source(&mut conn, run_id)
        .await?
        .into_iter()
        .filter(|i| i.account.is_none() && seen.insert(i.item_code.clone()))
        .map(|i| json!({"item_code":i.item_code,"item_name":i.item_name,"direction":i.direction}))
        .collect();
    Ok(Json(json!({"run_id":run_id,"missing_item_codes":gaps})))
}

struct Line {
    code: String,
    center: Option<String>,
    debit: f64,
    credit: f64,
    summary: String,
    item: Option<String>,
}

struct Draft {
    debit: f64,
    credit: f64,
    summary: String,
    lines: Vec<Line>,
}

async fn account(connection: &mut PgConnection, cash: bool) -> Result<String, ApiError> {
    let (sql, flag) = if cash {
        (
            "SELECT code FROM gl_accounts WHERE is_cash_account LIMIT 1",
            "is_cash_account",
        )
    } else {
        (
            "SELECT code FROM gl_accounts WHERE is_net_pay_account LIMIT 1",
            "is_net_pay_account",
        )
    };
    sqlx::query_scalar(sql)
        .fetch_optional(connection)
        .await?
        .ok_or_else(|| {
            ApiError::new(
                StatusCode::BAD_REQUEST,
                format!("No GL account flagged as {flag}."),
            )
        })
}

async fn prior(
    connection: &mut PgConnection,
    id: i32,
    kind: &str,
) -> Result<Option<(i32, String)>, ApiError> {
    Ok(
        sqlx::query_as("SELECT id,status FROM pay_vouchers WHERE run_id=$1 AND voucher_type=$2")
            .bind(id)
            .bind(kind)
            .fetch_optional(connection)
            .await?,
    )
}

async fn replace(
    connection: &mut PgConnection,
    id: i32,
    previous: Option<i32>,
    kind: &str,
    month: &str,
    user: Option<i32>,
    draft: Draft,
) -> Result<Value, ApiError> {
    if let Some(old) = previous {
        sqlx::query("DELETE FROM pay_voucher_lines WHERE voucher_id=$1")
            .bind(old)
            .execute(&mut *connection)
            .await?;
        sqlx::query("DELETE FROM pay_vouchers WHERE id=$1")
            .bind(old)
            .execute(&mut *connection)
            .await?;
    }
    let prefix = format!("PV-{}-", month.replace('-', ""));
    let numbers: Vec<String> =
        sqlx::query_scalar("SELECT voucher_no FROM pay_vouchers WHERE starts_with(voucher_no,$1)")
            .bind(&prefix)
            .fetch_all(&mut *connection)
            .await?;
    let sequence = numbers
        .iter()
        .filter_map(|n| n.rsplit('-').next()?.parse::<i32>().ok())
        .max()
        .unwrap_or(0)
        .max(0)
        + 1;
    let voucher_id: i32 = sqlx::query_scalar("INSERT INTO pay_vouchers (voucher_no,run_id,voucher_type,
            voucher_date,status,total_debit,total_credit,summary,created_by,created_at,updated_at)
          VALUES ($1,$2,$3,timezone('UTC',now())::date,'draft',$4,$5,$6,$7,
                  timezone('UTC',clock_timestamp()),timezone('UTC',clock_timestamp())) RETURNING id")
        .bind(format!("{prefix}{sequence:04}")).bind(id).bind(kind).bind(draft.debit).bind(draft.credit)
        .bind(draft.summary).bind(user).fetch_one(&mut *connection).await?;
    for (index, line) in draft.lines.into_iter().enumerate() {
        sqlx::query("INSERT INTO pay_voucher_lines
            (voucher_id,line_no,gl_account_code,cost_center_code,debit_amount,credit_amount,summary,source_item_code,created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,timezone('UTC',clock_timestamp()))")
            .bind(voucher_id).bind(index as i32+1).bind(line.code).bind(line.center)
            .bind(line.debit).bind(line.credit).bind(line.summary).bind(line.item).execute(&mut *connection).await?;
    }
    read::voucher_item(&mut *connection, voucher_id).await
}

pub(super) async fn accrual_in_transaction(
    conn: &mut PgConnection,
    id: i32,
    month: &str,
    status: &str,
    user: Option<i32>,
) -> Result<Value, ApiError> {
    if !matches!(status, "paid" | "closed") {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            format!(
                "Run status must be one of [closed, paid] to generate a voucher. Current: {status}"
            ),
        ));
    }
    let previous = prior(conn, id, "accrual").await?;
    if previous.as_ref().is_some_and(|(_, s)| s != "draft") {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "Voucher already confirmed or cancelled for this run; regeneration is only allowed before confirm.",
        ));
    }
    let rows = source(conn, id).await?;
    if rows.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Run has no payroll items to generate a voucher from.",
        ));
    }
    let net_account = account(conn, false).await?;
    let draft = accrual_draft(&rows, &net_account, month)?;
    replace(
        conn,
        id,
        previous.map(|p| p.0),
        "accrual",
        month,
        user,
        draft,
    )
    .await
}

fn accrual_draft(rows: &[Source], net_account: &str, month: &str) -> Result<Draft, ApiError> {
    let mut missing = BTreeMap::new();
    let mut earnings = Vec::new();
    let mut deductions = Vec::new();
    let mut earning_index = HashMap::new();
    let mut deduction_index = HashMap::new();
    let mut by_employee = BTreeMap::new();
    for row in rows {
        let Some(account) = &row.account else {
            missing.insert(
                &row.item_code,
                json!({"item_code":row.item_code,"item_name":row.item_name,"direction":"unknown"}),
            );
            continue;
        };
        let is_earning = row.direction == "earning";
        let (lines, indices) = if is_earning {
            (&mut earnings, &mut earning_index)
        } else {
            (&mut deductions, &mut deduction_index)
        };
        let index = indices
            .entry((&row.item_code, &row.center))
            .or_insert_with(|| {
                let name = row.item_name.as_ref().unwrap_or(&row.item_code);
                lines.push(Line {
                    code: account.clone(),
                    center: row.center.clone(),
                    debit: 0.0,
                    credit: 0.0,
                    summary: format!("{month} 정기급여 {name}"),
                    item: Some(row.item_code.clone()),
                });
                lines.len() - 1
            });
        let line = &mut lines[*index];
        let employee = by_employee
            .entry(row.employee_id)
            .or_insert((&row.center, 0.0));
        if is_earning {
            line.debit += row.amount;
            employee.1 += row.amount;
        } else {
            line.credit += row.amount;
            employee.1 -= row.amount;
        }
    }
    if !missing.is_empty() {
        return Err(ApiError::with_detail(
            StatusCode::UNPROCESSABLE_ENTITY,
            json!({
                "message":"GL mapping missing for one or more pay items.","missing_item_codes":missing.into_values().collect::<Vec<_>>()
            }),
        ));
    }
    earnings.sort_by(|a, b| a.item.cmp(&b.item));
    deductions.sort_by(|a, b| a.item.cmp(&b.item));
    let mut lines = earnings;
    lines.extend(deductions);
    let mut net_by_center = BTreeMap::new();
    for (center, net) in by_employee.into_values() {
        *net_by_center.entry(center).or_insert(0.0) += net;
    }
    for (center, net) in net_by_center {
        lines.push(Line {
            code: net_account.into(),
            center: center.clone(),
            debit: 0.0,
            credit: net,
            summary: format!("{month} 정기급여 미지급금"),
            item: None,
        });
    }
    let mut debit = 0.0;
    let mut credit = 0.0;
    for line in &mut lines {
        line.debit = whole_won(line.debit);
        line.credit = whole_won(line.credit);
        debit += line.debit;
        credit += line.credit;
    }
    let difference = money(debit - credit);
    if difference.abs() > 1.0 {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            format!(
                "Debit/credit imbalance too large to auto-adjust: debit={debit:?}, credit={credit:?}"
            ),
        ));
    }
    if difference != 0.0 {
        let adjustment = Line {
            code: net_account.into(),
            center: None,
            debit: (-difference).max(0.0),
            credit: difference.max(0.0),
            summary: "반올림 조정".into(),
            item: None,
        };
        credit += adjustment.credit;
        debit += adjustment.debit;
        lines.push(adjustment);
    }
    Ok(Draft {
        debit: money(debit),
        credit: money(credit),
        summary: format!("{month} 급여 전표"),
        lines,
    })
}

pub(super) async fn generate(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Body(params): Body<RunId>,
) -> Reply {
    require_role(&user, false)?;
    let id = params.run_id.expect("validated run ID");
    let mut tx = state.pool.begin().await?;
    let (month, status) = approvals::lock_run(&mut tx, id).await?;
    let voucher = accrual_in_transaction(&mut tx, id, &month, &status, Some(user.id)).await?;
    tx.commit().await?;
    Ok(Json(json!({"voucher":voucher})))
}

pub(super) async fn disburse(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Body(params): Body<RunId>,
) -> Reply {
    require_role(&user, false)?;
    let id = params.run_id.expect("validated run ID");
    let mut tx = state.pool.begin().await?;
    let (month, status) = approvals::lock_run(&mut tx, id).await?;
    if status != "paid" {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            format!(
                "Run status must be 'paid' to generate a disbursement voucher. Current: {status}"
            ),
        ));
    }
    let accrual=prior(&mut tx,id,"accrual").await?.filter(|p| p.1=="confirmed")
        .ok_or_else(|| ApiError::new(StatusCode::CONFLICT,"Accrual voucher for this run must be confirmed before generating a disbursement voucher."))?;
    let previous = prior(&mut tx, id, "disbursement").await?;
    if previous.as_ref().is_some_and(|p| p.1 != "draft") {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "Disbursement voucher already confirmed or cancelled for this run; regeneration is only allowed before confirm.",
        ));
    }
    let net = account(&mut tx, false).await?;
    let cash = account(&mut tx, true).await?;
    let credits:Vec<f64>=sqlx::query_scalar("SELECT credit_amount FROM pay_voucher_lines WHERE voucher_id=$1 AND gl_account_code=$2 ORDER BY line_no")
        .bind(accrual.0).bind(&net).fetch_all(&mut *tx).await?;
    // Accrual voucher amounts are whole won.
    let amount = money(credits.iter().sum());
    if amount <= 0.0 {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Accrual voucher has no net-pay amount to disburse.",
        ));
    }
    let draft = Draft {
        debit: amount,
        credit: amount,
        summary: format!("{month} 급여 지급전표"),
        lines: vec![
            Line {
                code: net,
                center: None,
                debit: amount,
                credit: 0.0,
                summary: format!("{month} 급여 지급(미지급금 상환)"),
                item: None,
            },
            Line {
                code: cash,
                center: None,
                debit: 0.0,
                credit: amount,
                summary: format!("{month} 급여 지급(보통예금 출금)"),
                item: None,
            },
        ],
    };
    let voucher = replace(
        &mut tx,
        id,
        previous.map(|p| p.0),
        "disbursement",
        &month,
        Some(user.id),
        draft,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({"voucher":voucher})))
}
