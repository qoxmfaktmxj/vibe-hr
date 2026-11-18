use super::*;
use crate::input::{Validate, Violation};
use chrono::NaiveDate;
use serde_json::Map;
use sqlx::{AssertSqlSafe, PgConnection};

#[derive(Deserialize)]
pub(super) struct Batch {
    items: Option<Vec<Map<String, Value>>>,
    delete_ids: Vec<i32>,
}
impl Validate for Batch {
    fn validate(&self) -> Vec<Violation> {
        if self.items.is_none() {
            vec![Violation::field(
                "notnull",
                "items",
                "must not be null".into(),
                Value::Null,
            )]
        } else {
            vec![]
        }
    }
}

#[derive(Clone, Copy)]
enum Kind {
    Text {
        min: usize,
        max: usize,
        required: bool,
        trim: bool,
    },
    Choice(&'static str, bool),
    Int(bool),
    Float {
        required: bool,
        nonnegative: bool,
    },
    Bool,
    Date(bool),
    Month,
}
struct Column(&'static str, Kind, Option<&'static str>);
use Kind::*;
const fn text(name: &'static str, max: usize, trim: bool) -> Column {
    Column(
        name,
        Text {
            min: 0,
            max,
            required: true,
            trim,
        },
        None,
    )
}
const fn optional_text(name: &'static str, max: usize) -> Column {
    Column(
        name,
        Text {
            min: 0,
            max,
            required: false,
            trim: false,
        },
        None,
    )
}
const fn boolean(name: &'static str, default: &'static str) -> Column {
    Column(name, Bool, Some(default))
}
const ACTIVE: Column = boolean("is_active", "true");
const ORDER: Column = Column("sort_order", Int(false), Some("0"));

pub(super) struct Master {
    pub path: &'static str,
    table: &'static str,
    natural: &'static [&'static str],
    columns: &'static [Column],
}

pub(super) const MASTERS: &[Master] = &[
    Master {
        path: "/setup/codes",
        table: "pay_payroll_codes",
        natural: &["code"],
        columns: &[
            text("code", 20, true),
            text("name", 100, true),
            text("pay_type", 20, false),
            text("payment_day", 20, false),
            boolean("tax_deductible", "true"),
            boolean("social_ins_deductible", "true"),
            ACTIVE,
        ],
    },
    Master {
        path: "/setup/tax-rates",
        table: "pay_tax_rates",
        natural: &["year", "rate_type"],
        columns: &[
            Column("year", Int(true), None),
            text("rate_type", 50, true),
            Column(
                "employee_rate",
                Float {
                    required: false,
                    nonnegative: false,
                },
                None,
            ),
            Column(
                "employer_rate",
                Float {
                    required: false,
                    nonnegative: false,
                },
                None,
            ),
            Column("min_limit", Int(false), None),
            Column("max_limit", Int(false), None),
        ],
    },
    Master {
        path: "/setup/income-tax-brackets",
        table: "pay_income_tax_brackets",
        natural: &["year", "annual_taxable_from"],
        columns: &[
            Column("year", Int(true), None),
            Column("annual_taxable_from", Int(true), None),
            Column("annual_taxable_to", Int(false), None),
            Column(
                "tax_rate",
                Float {
                    required: true,
                    nonnegative: true,
                },
                None,
            ),
            Column(
                "quick_deduction",
                Float {
                    required: true,
                    nonnegative: true,
                },
                None,
            ),
        ],
    },
    Master {
        path: "/setup/allowance-deductions",
        table: "pay_allowance_deductions",
        natural: &["code"],
        columns: &[
            text("code", 20, true),
            text("name", 100, true),
            Column("type", Choice("allowance|deduction", true), None),
            Column(
                "tax_type",
                Choice("taxable|non-taxable|tax|insurance", true),
                None,
            ),
            Column(
                "calculation_type",
                Choice("fixed|hourly|formula", false),
                Some("\"fixed\""),
            ),
            ACTIVE,
            ORDER,
        ],
    },
    Master {
        path: "/setup/item-groups",
        table: "pay_item_groups",
        natural: &["code"],
        columns: &[
            text("code", 20, true),
            text("name", 100, true),
            optional_text("description", 200),
            ACTIVE,
        ],
    },
    Master {
        path: "/gl-accounts",
        table: "gl_accounts",
        natural: &["code"],
        columns: &[
            text("code", 20, false),
            text("name", 100, false),
            Column(
                "account_type",
                Choice("expense|liability|asset|equity|revenue", true),
                None,
            ),
            boolean("is_net_pay_account", "false"),
            boolean("is_cash_account", "false"),
            ACTIVE,
            ORDER,
        ],
    },
    Master {
        path: "/gl-mappings",
        table: "pay_gl_mappings",
        natural: &["pay_item_code", "effective_from"],
        columns: &[
            text("pay_item_code", 30, false),
            text("gl_account_code", 20, false),
            Column("effective_from", Date(true), None),
            optional_text("note", 200),
            ACTIVE,
        ],
    },
    Master {
        path: "/severance-item-rules",
        table: "pay_severance_item_rules",
        natural: &["pay_item_code"],
        columns: &[
            text("pay_item_code", 30, false),
            Column(
                "include_type",
                Choice("full|prorate_12|exclude", true),
                None,
            ),
            optional_text("note", 200),
            ACTIVE,
        ],
    },
    Master {
        path: "/employee-profiles",
        table: "pay_employee_profiles",
        natural: &["employee_id", "effective_from"],
        columns: &[
            Column("employee_id", Int(true), None),
            Column("payroll_code_id", Int(true), None),
            Column("item_group_id", Int(false), None),
            Column(
                "base_salary",
                Float {
                    required: false,
                    nonnegative: true,
                },
                Some("0.0"),
            ),
            Column(
                "pay_type_code",
                Text {
                    min: 1,
                    max: 20,
                    required: false,
                    trim: false,
                },
                Some("\"regular\""),
            ),
            Column(
                "payment_day_type",
                Choice("fixed_day|month_end", false),
                Some("\"fixed_day\""),
            ),
            Column("payment_day_value", Int(false), None),
            Column(
                "holiday_adjustment",
                Choice("previous_business_day|next_business_day|none", false),
                Some("\"previous_business_day\""),
            ),
            Column("effective_from", Date(true), None),
            Column("effective_to", Date(false), None),
            ACTIVE,
        ],
    },
    Master {
        path: "/variable-inputs",
        table: "pay_variable_inputs",
        natural: &["year_month", "employee_id", "item_code"],
        columns: &[
            Column("year_month", Month, None),
            Column("employee_id", Int(true), None),
            text("item_code", 20, true),
            Column("direction", Choice("earning|deduction", true), None),
            Column(
                "amount",
                Float {
                    required: true,
                    nonnegative: false,
                },
                None,
            ),
            optional_text("memo", 200),
        ],
    },
];

fn invalid_json(offset: usize) -> ApiError {
    ApiError::with_detail(
        StatusCode::UNPROCESSABLE_ENTITY,
        json!([{"type":"json_invalid","loc":["body",offset],"msg":"JSON decode error","input":{}}]),
    )
}

fn decode(
    col: &Column,
    raw: &Value,
    path: &str,
    errors: &mut Vec<Violation>,
    offset: usize,
) -> Result<Value, ApiError> {
    let Column(key, kind, default) = *col;
    let field = format!("{path}.{key}");
    if raw.is_null() {
        let issue = match kind {
            Text { required: true, .. } | Choice(_, true) | Month => {
                Some(("notblank", "must not be blank"))
            }
            Int(true) | Float { required: true, .. } | Date(true) => {
                Some(("notnull", "must not be null"))
            }
            _ => None,
        };
        if let Some((k, m)) = issue {
            errors.push(Violation::field(k, &field, m.into(), Value::Null));
        }
        return Ok(default.map_or(Value::Null, |s| {
            serde_json::from_str(s).expect("schema default")
        }));
    }
    let parse_error = || invalid_json(offset);
    match kind {
        Text {
            min,
            max,
            required,
            trim,
        } => {
            let text = as_text(raw).ok_or_else(parse_error)?;
            if required && let Some(v) = crate::input::not_blank(&field, Some(&text)) {
                errors.push(v);
            }
            if let Some(v) = crate::input::size(&field, Some(&text), min, max) {
                errors.push(v);
            }
            Ok(json!(if trim { text.trim().to_owned() } else { text }))
        }
        Choice(pattern, required) => {
            let text = as_text(raw).ok_or_else(parse_error)?;
            if required && let Some(v) = crate::input::not_blank(&field, Some(&text)) {
                errors.push(v);
            }
            if !pattern.split('|').any(|v| v == text) {
                errors.push(Violation::field(
                    "pattern",
                    &field,
                    format!("must match \"^({pattern})$\""),
                    json!(text),
                ));
            }
            Ok(json!(text))
        }
        Int(_) => {
            let num = parse_int(raw).ok_or_else(parse_error)?;
            let v = i64::from(num);
            if key == "annual_taxable_from" && v < 0 {
                errors.push(Violation::field(
                    "min",
                    &field,
                    "must be greater than or equal to 0".into(),
                    json!(v),
                ));
            }
            if key == "payment_day_value"
                && let Some(issue) = crate::input::range(&field, v, 1, 31)
            {
                errors.push(issue);
            }
            Ok(json!(num))
        }
        Float { nonnegative, .. } => {
            let num = raw
                .as_f64()
                .or_else(|| raw.as_str()?.trim().parse().ok())
                .filter(|v| v.is_finite())
                .ok_or_else(parse_error)?;
            if nonnegative && num < 0.0 {
                errors.push(Violation::field(
                    "decimalmin",
                    &field,
                    "must be greater than or equal to 0.0".into(),
                    json!(num),
                ));
            }
            Ok(json!(num))
        }
        Bool => raw
            .as_bool()
            .or_else(|| raw.as_str()?.trim().to_ascii_lowercase().parse().ok())
            .or_else(|| raw.as_i64().map(|n| n != 0))
            .map(Value::Bool)
            .ok_or_else(parse_error),
        Date(_) => {
            let text = raw.as_str().ok_or_else(parse_error)?;
            let date = NaiveDate::parse_from_str(text, "%Y-%m-%d").map_err(|_| parse_error())?;
            Ok(json!(date.to_string()))
        }
        Month => {
            let text = as_text(raw).ok_or_else(parse_error)?;
            if let Some(v) = crate::input::not_blank(&field, Some(&text)) {
                errors.push(v);
            }
            if text.len() != 7 || snapshots::Period::parse(&text).is_err() {
                errors.push(Violation::field(
                    "pattern",
                    &field,
                    "must match \"^\\d{4}-(0[1-9]|1[0-2])$\"".into(),
                    json!(text),
                ));
            }
            Ok(json!(text))
        }
    }
}

fn as_text(v: &Value) -> Option<String> {
    match v {
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        Value::Bool(b) => Some(b.to_string()),
        _ => None,
    }
}
fn parse_int(v: &Value) -> Option<i32> {
    v.as_i64()
        .and_then(|n| i32::try_from(n).ok())
        .or_else(|| v.as_str()?.trim().parse().ok())
}
fn duplicate_message(table: &str, item: &Value, raw: &Map<String, Value>) -> String {
    let txt = |k: &str| raw.get(k).and_then(as_text).unwrap_or_default();
    match table {
        "pay_payroll_codes" => format!("급여코드 '{}'가 이미 존재합니다.", txt("code")),
        "pay_tax_rates" => format!(
            "연도 '{}'에 해당하는 세율 '{}'가 이미 존재합니다.",
            item["year"],
            txt("rate_type")
        ),
        "pay_income_tax_brackets" => format!(
            "연도 '{}' 구간 '{}'이 이미 존재합니다.",
            item["year"], item["annual_taxable_from"]
        ),
        "pay_allowance_deductions" => format!("수당/공제항목 '{}'가 이미 존재합니다.", txt("code")),
        "pay_item_groups" => format!("항목그룹 '{}'가 이미 존재합니다.", txt("code")),
        "gl_accounts" => format!("gl_account code '{}' already exists.", txt("code")),
        "pay_gl_mappings" => format!(
            "pay_item_code '{}' already has mapping for effective_from '{}'.",
            txt("pay_item_code"),
            txt("effective_from")
        ),
        "pay_severance_item_rules" => {
            format!("pay_item_code '{}' already exists.", txt("pay_item_code"))
        }
        "pay_employee_profiles" => format!(
            "employee_id '{}' already has profile for effective_from '{}'.",
            item["employee_id"],
            txt("effective_from")
        ),
        "pay_variable_inputs" => format!(
            "year_month '{}', employee_id '{}', item_code '{}' already exists.",
            txt("year_month"),
            item["employee_id"],
            item["item_code"].as_str().unwrap_or_default()
        ),
        _ => unreachable!("registered payroll table"),
    }
}

struct Prepared<'a> {
    id: Option<i32>,
    fields: Value,
    raw: &'a Map<String, Value>,
    details: Option<Vec<Value>>,
}

impl Master {
    fn prepare<'a>(
        &self,
        raw: &'a Map<String, Value>,
        index: usize,
        errors: &mut Vec<Violation>,
        offset: usize,
    ) -> Result<Prepared<'a>, ApiError> {
        let path = format!("items[{index}]");
        let id = raw
            .get("id")
            .filter(|v| !v.is_null())
            .map(|v| parse_int(v).ok_or_else(|| invalid_json(offset)))
            .transpose()?;
        let mut fields = json!({});
        for col in self.columns {
            fields[col.0] = decode(
                col,
                raw.get(col.0).unwrap_or(&Value::Null),
                &path,
                errors,
                offset,
            )?;
        }
        let mut details = None;
        if self.table == "pay_item_groups"
            && let Some(input) = raw.get("details").filter(|v| !v.is_null())
        {
            let mut normalized = vec![];
            for (i, val) in input
                .as_array()
                .ok_or_else(|| invalid_json(offset))?
                .iter()
                .enumerate()
            {
                if !val.is_object() {
                    return Err(invalid_json(offset));
                }
                let path = format!("{path}.details[{i}]");
                let item = decode(
                    &Column("item_id", Int(true), None),
                    &val["item_id"],
                    &path,
                    errors,
                    offset,
                )?;
                let typ = decode(
                    &Column("type", Choice("allowance|deduction", true), None),
                    &val["type"],
                    &path,
                    errors,
                    offset,
                )?;
                normalized.push(json!({"item_id":item,"type":typ}));
            }
            details = Some(normalized);
        }
        Ok(Prepared {
            id,
            fields,
            raw,
            details,
        })
    }

    async fn references(&self, conn: &mut PgConnection, p: &Prepared<'_>) -> Result<(), ApiError> {
        let item = &p.fields;
        let check_id = |id: &str| item[id].as_i64().map(|v| v as i32);
        match self.table {
            "pay_gl_mappings" => {
                let code = item["gl_account_code"].as_str().unwrap();
                let ok: bool =
                    sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM gl_accounts WHERE code=$1)")
                        .bind(code)
                        .fetch_one(conn)
                        .await?;
                if !ok {
                    return Err(ApiError::new(
                        StatusCode::BAD_REQUEST,
                        format!("Invalid gl_account_code: {code}"),
                    ));
                }
            }
            "pay_employee_profiles" => {
                for (key, sql) in [
                    (
                        "payroll_code_id",
                        "SELECT EXISTS(SELECT 1 FROM pay_payroll_codes WHERE id=$1)",
                    ),
                    (
                        "item_group_id",
                        "SELECT EXISTS(SELECT 1 FROM pay_item_groups WHERE id=$1)",
                    ),
                ] {
                    if let Some(id) = check_id(key) {
                        let ok: bool = sqlx::query_scalar(sql)
                            .bind(id)
                            .fetch_one(&mut *conn)
                            .await?;
                        if !ok {
                            return Err(ApiError::new(
                                StatusCode::BAD_REQUEST,
                                format!("Invalid {key}: {id}"),
                            ));
                        }
                    }
                }
            }
            "pay_variable_inputs" => {
                let code = p.raw["item_code"].as_str().unwrap_or_default();
                if item["item_code"] == "TIM_UNPAID" {
                    return Err(ApiError::new(
                        StatusCode::BAD_REQUEST,
                        "승인 무급휴가 공제는 자동 계산되므로 수동 변동입력으로 저장할 수 없습니다.",
                    ));
                }
                let id = check_id("employee_id").unwrap();
                let exists: bool =
                    sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM hr_employees WHERE id=$1)")
                        .bind(id)
                        .fetch_one(&mut *conn)
                        .await?;
                if !exists {
                    return Err(ApiError::new(
                        StatusCode::BAD_REQUEST,
                        format!("Invalid employee_id: {id}"),
                    ));
                }
                let ok: bool = sqlx::query_scalar(
                    "SELECT EXISTS(SELECT 1 FROM pay_allowance_deductions WHERE code=$1)",
                )
                .bind(code)
                .fetch_one(conn)
                .await?;
                if !ok {
                    return Err(ApiError::new(
                        StatusCode::BAD_REQUEST,
                        format!("Invalid item_code: {code}"),
                    ));
                }
            }
            _ => {}
        }
        Ok(())
    }

    // All interpolated identifiers come exclusively from MASTERS. User values are bound.
    async fn save(&self, conn: &mut PgConnection, p: &Prepared<'_>) -> Result<bool, ApiError> {
        self.references(conn, p).await?;
        let table = self.table;
        let cols = self
            .columns
            .iter()
            .map(|c| c.0)
            .collect::<Vec<_>>()
            .join(",");
        let source = format!("jsonb_populate_record(NULL::{table},$1::jsonb) s");
        let exists: Option<i32> = if let Some(id) = p.id.filter(|v| *v > 0) {
            sqlx::query_scalar(AssertSqlSafe(format!(
                "SELECT id FROM {table} WHERE id=$1 FOR UPDATE"
            )))
            .bind(id)
            .fetch_optional(&mut *conn)
            .await?
        } else {
            None
        };
        let id = match exists {
            Some(id) => {
                let updates = self
                    .columns
                    .iter()
                    .map(|c| format!("{k}=s.{k}", k = c.0))
                    .collect::<Vec<_>>()
                    .join(",");
                sqlx::query(AssertSqlSafe(format!("UPDATE {table} SET {updates},updated_at=timezone('UTC',clock_timestamp()) FROM {source} WHERE {table}.id=$2")))
                    .bind(&p.fields).bind(id).execute(&mut *conn).await?;
                id
            }
            None => {
                let join = self
                    .natural
                    .iter()
                    .map(|k| format!("a.{k}=s.{k}"))
                    .collect::<Vec<_>>()
                    .join(" AND ");
                let used: bool = sqlx::query_scalar(AssertSqlSafe(format!(
                    "SELECT EXISTS(SELECT 1 FROM {table} a JOIN {source} ON {join})"
                )))
                .bind(&p.fields)
                .fetch_one(&mut *conn)
                .await?;
                if used {
                    return Err(ApiError::new(
                        StatusCode::CONFLICT,
                        duplicate_message(table, &p.fields, p.raw),
                    ));
                }
                sqlx::query_scalar(AssertSqlSafe(format!("INSERT INTO {table}({cols},created_at,updated_at)
                    SELECT {cols},timezone('UTC',clock_timestamp()),timezone('UTC',clock_timestamp()) FROM {source} RETURNING id")))
                    .bind(&p.fields).fetch_one(&mut *conn).await?
            }
        };
        if let Some(details) = &p.details {
            sqlx::query("DELETE FROM pay_item_group_details WHERE group_id=$1")
                .bind(id)
                .execute(&mut *conn)
                .await?;
            for d in details {
                sqlx::query("INSERT INTO pay_item_group_details(group_id,item_id,type,created_at) VALUES($1,$2,$3,timezone('UTC',clock_timestamp()))")
                    .bind(id).bind(d["item_id"].as_i64().unwrap() as i32).bind(d["type"].as_str()).execute(&mut *conn).await?;
            }
        }
        Ok(exists.is_none())
    }
}

pub(super) fn routes() -> Router<AppState> {
    let mut router = Router::new();
    for master in MASTERS {
        let grid = read::GRIDS.iter().find(|g| g.path == master.path);
        router = router.route(
            &format!("{}/batch", master.path),
            post(
                move |State(state): State<AppState>,
                      Extension(user): Extension<CurrentUser>,
                      bytes: axum::body::Bytes| async move {
                    let offset = String::from_utf8_lossy(&bytes).encode_utf16().count();
                    let batch: Batch =
                        serde_json::from_slice(&bytes).map_err(|_| invalid_json(offset))?;
                    let mut errors = batch.validate();
                    let raw = batch.items.unwrap_or_default();
                    let items: Vec<_> = raw
                        .iter()
                        .enumerate()
                        .map(|(i, r)| master.prepare(r, i, &mut errors, offset))
                        .collect::<Result<_, _>>()?;
                    if !errors.is_empty() {
                        return Err(ApiError::validation(errors));
                    }
                    if let Some(menu) = grid.and_then(|g| g.menu) {
                        require_menu(&state.pool, &user, menu, "save").await?;
                    } else {
                        require_role(&user, master.path == "/severance-item-rules")?;
                    }
                    let mut tx = state.pool.begin().await?;
                    if master.table == "pay_item_groups" {
                        sqlx::query("DELETE FROM pay_item_group_details WHERE group_id=ANY($1)")
                            .bind(&batch.delete_ids)
                            .execute(&mut *tx)
                            .await?;
                    }
                    let deleted = sqlx::query(AssertSqlSafe(format!(
                        "DELETE FROM {} WHERE id=ANY($1)",
                        master.table
                    )))
                    .bind(&batch.delete_ids)
                    .execute(&mut *tx)
                    .await?
                    .rows_affected();
                    let mut inserted = 0;
                    for p in &items {
                        if master.save(&mut tx, p).await? {
                            inserted += 1;
                        }
                    }
                    let rows: Vec<Value> = if let Some(grid) = grid {
                        sqlx::query_scalar(grid.sql).fetch_all(&mut *tx).await?
                    } else {
                        let month = items
                            .first()
                            .and_then(|p| p.fields["year_month"].as_str())
                            .filter(|&m| items.iter().all(|p| p.fields["year_month"] == m));
                        sqlx::query_scalar(read::VARIABLE_INPUTS)
                            .bind(month)
                            .fetch_all(&mut *tx)
                            .await?
                    };
                    tx.commit().await?;
                    Ok::<_, ApiError>(Json(
                        json!({"items":rows,"total_count":rows.len(),"inserted_count":inserted,
                "updated_count":items.len()-inserted,"deleted_count":deleted}),
                    ))
                },
            ),
        );
    }
    router
}
