use super::*;
use sqlx::{Executor, PgConnection, Postgres};

pub(super) struct Grid {
    pub path: &'static str,
    pub menu: Option<&'static str>,
    pub sql: &'static str,
}

pub(super) const GRIDS: &[Grid] = &[
    Grid { path: "/setup/codes", menu: Some("payroll.codes"), sql:
        "SELECT to_jsonb(r) FROM (SELECT id, code, name, pay_type, payment_day, tax_deductible, social_ins_deductible,
            is_active, created_at, updated_at FROM pay_payroll_codes) r ORDER BY code" },
    Grid { path: "/setup/tax-rates", menu: Some("payroll.tax-rates"), sql:
        "SELECT to_jsonb(r) FROM (SELECT id, year, rate_type, employee_rate, employer_rate, min_limit, max_limit,
            created_at, updated_at FROM pay_tax_rates) r ORDER BY year DESC, id" },
    Grid { path: "/setup/income-tax-brackets", menu: Some("payroll.income-tax-brackets"), sql:
        "SELECT to_jsonb(r) FROM (SELECT id, year, annual_taxable_from, annual_taxable_to, tax_rate, quick_deduction,
            created_at, updated_at FROM pay_income_tax_brackets) r ORDER BY year DESC, annual_taxable_from" },
    Grid { path: "/setup/allowance-deductions", menu: Some("payroll.allowance-deduction-items"), sql:
        "SELECT to_jsonb(r) FROM (SELECT id, code, name, type, tax_type, calculation_type, is_active, sort_order,
            created_at, updated_at FROM pay_allowance_deductions) r ORDER BY sort_order" },
    Grid { path: "/setup/item-groups", menu: Some("payroll.item-groups"), sql:
        "SELECT to_jsonb(r) FROM (SELECT g.id, g.code, g.name, g.description, g.is_active, g.created_at, g.updated_at,
            COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM
                 (SELECT id, group_id, item_id, type, created_at FROM pay_item_group_details WHERE group_id=g.id) d),'[]') details
            FROM pay_item_groups g) r ORDER BY code" },
    Grid { path: "/gl-accounts", menu: None, sql:
        "SELECT to_jsonb(r) FROM (SELECT id, code, name, account_type, is_net_pay_account, is_cash_account, is_active,
            sort_order, created_at, updated_at FROM gl_accounts) r ORDER BY sort_order, code" },
    Grid { path: "/gl-mappings", menu: None, sql:
        "SELECT to_jsonb(r) FROM (SELECT m.id, m.pay_item_code, d.name AS pay_item_name, m.gl_account_code,
            a.name AS gl_account_name, m.effective_from, m.note, m.is_active, m.created_at, m.updated_at
            FROM pay_gl_mappings m LEFT JOIN pay_allowance_deductions d ON d.code=m.pay_item_code
            LEFT JOIN gl_accounts a ON a.code=m.gl_account_code) r ORDER BY pay_item_code, effective_from DESC" },
    Grid { path: "/severance-item-rules", menu: None, sql:
        "SELECT to_jsonb(r) FROM (SELECT s.id, s.pay_item_code, a.name AS pay_item_name, s.include_type,
            s.note, s.is_active, s.created_at, s.updated_at FROM pay_severance_item_rules s
            LEFT JOIN pay_allowance_deductions a ON a.code=s.pay_item_code) r ORDER BY pay_item_code" },
    Grid { path: "/employee-profiles", menu: None, sql:
        "SELECT to_jsonb(r) FROM (SELECT p.id, p.employee_id, e.employee_no, u.display_name AS employee_name,
            p.payroll_code_id, c.name AS payroll_code_name, p.item_group_id, g.name AS item_group_name,
            p.base_salary, p.pay_type_code, p.payment_day_type, p.payment_day_value, p.holiday_adjustment,
            p.effective_from, p.effective_to, p.is_active, p.created_at, p.updated_at FROM pay_employee_profiles p
            LEFT JOIN hr_employees e ON e.id=p.employee_id LEFT JOIN auth_users u ON u.id=e.user_id
            LEFT JOIN pay_payroll_codes c ON c.id=p.payroll_code_id LEFT JOIN pay_item_groups g ON g.id=p.item_group_id
        ) r ORDER BY employee_id, effective_from DESC" },
];

pub(super) async fn variable_inputs(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Query(f): Query<Filter>,
) -> Reply {
    require_role(&user, false)?;
    let items = sqlx::query_scalar(VARIABLE_INPUTS)
        .bind(Filter::nonblank(f.year_month.as_deref()))
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(list(items)))
}

pub(super) const VARIABLE_INPUTS: &str = "SELECT to_jsonb(r) FROM (
        SELECT v.id,v.year_month,v.employee_id,e.employee_no,u.display_name AS employee_name,
               v.item_code,a.name AS item_name,v.direction,v.amount,v.memo,v.created_at,v.updated_at
          FROM pay_variable_inputs v LEFT JOIN hr_employees e ON e.id=v.employee_id
          LEFT JOIN auth_users u ON u.id=e.user_id LEFT JOIN pay_allowance_deductions a ON a.code=v.item_code
         WHERE ($1::text IS NULL OR v.year_month=$1)) r ORDER BY year_month DESC,employee_id";

macro_rules! run_projection {
    ($filter:literal) => { concat!("SELECT to_jsonb(r) FROM (
        SELECT r.id,r.year_month,r.payroll_code_id,c.name AS payroll_code_name,r.run_name,r.status,r.total_employees,
          r.total_gross,r.total_deductions,r.total_net,r.calculated_at,r.closed_at,r.paid_at,r.created_at,r.updated_at
          FROM pay_payroll_runs r LEFT JOIN pay_payroll_codes c ON c.id=r.payroll_code_id ", $filter, ") r") };
}

pub(super) async fn runs(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Query(f): Query<Filter>,
) -> Reply {
    require_role(&user, false)?;
    let items = sqlx::query_scalar(run_projection!(
        "WHERE ($1::text IS NULL OR r.year_month=$1) AND ($2::text IS NULL OR r.status=$2) ORDER BY r.year_month DESC,r.id DESC"
    )).bind(Filter::nonblank(f.year_month.as_deref())).bind(Filter::nonblank(f.status.as_deref())).fetch_all(&state.pool).await?;
    Ok(Json(list(items)))
}

pub(super) async fn run_item(conn: &mut PgConnection, id: i32) -> Result<Value, ApiError> {
    Ok(sqlx::query_scalar(run_projection!("WHERE r.id=$1"))
        .bind(id)
        .fetch_one(conn)
        .await?)
}

async fn require_run(pool: &PgPool, id: i32) -> Result<(), ApiError> {
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM pay_payroll_runs WHERE id=$1)")
            .bind(id)
            .fetch_one(pool)
            .await?;
    if exists {
        Ok(())
    } else {
        Err(ApiError::new(
            StatusCode::NOT_FOUND,
            "Payroll run not found.",
        ))
    }
}

macro_rules! employee_projection {
    ($filter:literal) => { concat!("SELECT to_jsonb(details) FROM (
        SELECT re.id,re.run_id,re.employee_id,e.employee_no,u.display_name AS employee_name,re.profile_id,
          re.gross_pay,re.taxable_income,re.non_taxable_income,re.total_deductions,re.net_pay,re.status,
          re.warning_message,re.created_at,re.updated_at FROM pay_payroll_run_employees re
          LEFT JOIN hr_employees e ON e.id=re.employee_id LEFT JOIN auth_users u ON u.id=e.user_id ", $filter, ") details") };
}

pub(super) async fn employees(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    require_role(&user, false)?;
    require_run(&state.pool, id).await?;
    let rows = sqlx::query_scalar(employee_projection!(
        "WHERE re.run_id=$1 ORDER BY re.employee_id"
    ))
    .bind(id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(list(rows)))
}

async fn details(pool: &PgPool, employee_row: i32) -> Result<Vec<Value>, ApiError> {
    Ok(sqlx::query_scalar("SELECT to_jsonb(i) FROM (SELECT id,run_employee_id,item_code,item_name,
         direction,amount,tax_type,calculation_type,source_type,created_at FROM pay_payroll_run_items
         WHERE run_employee_id=$1) i ORDER BY id").bind(employee_row).fetch_all(pool).await?)
}

pub(super) async fn employee_detail(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path((id, employee)): Path<(i32, i32)>,
) -> Reply {
    require_role(&user, false)?;
    require_run(&state.pool, id).await?;
    let row: Value = sqlx::query_scalar(employee_projection!("WHERE re.run_id=$1 AND re.id=$2"))
        .bind(id)
        .bind(employee)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Run employee not found."))?;
    Ok(Json(
        json!({"employee":row, "items":details(&state.pool, employee).await?}),
    ))
}

pub(super) async fn employee_id(pool: &PgPool, user: &CurrentUser) -> Result<i32, ApiError> {
    sqlx::query_scalar("SELECT id FROM hr_employees WHERE user_id=$1")
        .bind(user.id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "직원 정보를 찾을 수 없습니다."))
}

macro_rules! payslip_projection {
    ($filter:literal) => { concat!("SELECT to_jsonb(s) FROM (SELECT r.id AS run_id,re.id AS run_employee_id,
          r.year_month,r.run_name,r.status AS run_status,re.gross_pay,re.taxable_income,re.non_taxable_income,
          re.total_deductions,re.net_pay,r.paid_at FROM pay_payroll_runs r JOIN pay_payroll_run_employees re
          ON r.id=re.run_id WHERE re.employee_id=$1 AND r.status IN ('closed','paid') ",$filter,") s") };
}

pub(super) async fn payslips(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
) -> Reply {
    let employee = employee_id(&state.pool, &user).await?;
    let rows = sqlx::query_scalar(payslip_projection!("ORDER BY r.year_month DESC"))
        .bind(employee)
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(list(rows)))
}

pub(super) async fn payslip(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    let employee = employee_id(&state.pool, &user).await?;
    Ok(Json(payslip_for(&state.pool, employee, id).await?))
}

pub(super) async fn payslip_for(pool: &PgPool, employee: i32, id: i32) -> Result<Value, ApiError> {
    let summary: Value = sqlx::query_scalar(payslip_projection!("AND r.id=$2"))
        .bind(employee)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "급여 정보를 찾을 수 없습니다."))?;
    let row = serde_json::from_value(summary["run_employee_id"].clone())
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error"))?;
    Ok(json!({"summary":summary,"items":details(pool,row).await?}))
}

macro_rules! voucher_projection {
    ($filter:literal) => { concat!("SELECT to_jsonb(i) FROM (SELECT v.id,v.voucher_no,v.run_id,v.voucher_type,r.year_month,
          v.voucher_date,v.status,v.total_debit,v.total_credit,v.summary,v.created_by,v.confirmed_by,v.confirmed_at,
          v.created_at,v.updated_at FROM pay_vouchers v LEFT JOIN pay_payroll_runs r ON r.id=v.run_id ",$filter,") i") };
}

pub(super) async fn vouchers(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Query(f): Query<Filter>,
) -> Reply {
    require_role(&user, false)?;
    let values = sqlx::query_scalar(voucher_projection!(
        "WHERE ($1::text IS NULL OR r.year_month=$1)
            AND ($2::text IS NULL OR v.status=$2) ORDER BY v.voucher_date DESC,v.id DESC"
    ))
    .bind(Filter::nonblank(f.year_month.as_deref()))
    .bind(Filter::nonblank(f.status.as_deref()))
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(list(values)))
}

pub(super) async fn voucher_item<'a>(
    conn: impl Executor<'a, Database = Postgres>,
    id: i32,
) -> Result<Value, ApiError> {
    sqlx::query_scalar(voucher_projection!("WHERE v.id=$1"))
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Voucher not found."))
}

pub(super) async fn voucher_detail(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    require_role(&user, false)?;
    let voucher = voucher_item(&state.pool, id).await?;
    let lines: Vec<Value> = sqlx::query_scalar("SELECT to_jsonb(i) FROM (SELECT l.id,l.line_no,l.gl_account_code,
            a.name AS gl_account_name,l.cost_center_code,l.debit_amount,l.credit_amount,l.summary,l.source_item_code,
            l.created_at FROM pay_voucher_lines l LEFT JOIN gl_accounts a ON a.code=l.gl_account_code
            WHERE l.voucher_id=$1) i ORDER BY line_no").bind(id).fetch_all(&state.pool).await?;
    Ok(Json(json!({"voucher":voucher,"lines":lines})))
}
