mod binding;
use super::*;
use crate::input::{not_blank, range, size};

#[derive(Clone, Copy, PartialEq)]
enum Grid {
    Attendance,
    Work,
    Holiday,
    Department,
    Employee,
}
impl Grid {
    fn permission(self) -> (Option<&'static str>, Option<&'static str>) {
        match self {
            Self::Holiday => (Some("tim.holidays"), None),
            Self::Attendance => (None, Some("/tim/codes")),
            _ => (None, Some("/tim/work-codes")),
        }
    }
    fn select_sql(self) -> &'static str {
        match self {
            Self::Attendance => {
                "SELECT to_jsonb(t)||jsonb_build_object('created_at',(to_jsonb(created_at)#>>'{}')||'Z','updated_at',(to_jsonb(updated_at)#>>'{}')||'Z') FROM tim_attendance_codes t ORDER BY is_active DESC,sort_order,id"
            }
            Self::Work => {
                "SELECT to_jsonb(t)||jsonb_build_object('created_at',(to_jsonb(created_at)#>>'{}')||'Z','updated_at',(to_jsonb(updated_at)#>>'{}')||'Z') FROM tim_work_schedule_codes t ORDER BY is_active DESC,sort_order,id"
            }
            Self::Holiday => {
                "SELECT to_jsonb(t)||jsonb_build_object('created_at',(to_jsonb(created_at)#>>'{}')||'Z','updated_at',(to_jsonb(updated_at)#>>'{}')||'Z') FROM tim_holidays t WHERE extract(year FROM holiday_date)=$1 ORDER BY holiday_date"
            }
            Self::Department => {
                "SELECT (to_jsonb(a)-'created_at'-'updated_at') || jsonb_build_object('department_code',d.code,'department_name',d.name,'organization_type',d.organization_type,'cost_center_code',d.cost_center_code,'employee_count',(SELECT count(*) FROM hr_employees e WHERE e.department_id=d.id),'pattern_code',p.code,'pattern_name',p.name) FROM tim_department_schedule_assignments a JOIN org_departments d ON d.id=a.department_id JOIN tim_schedule_patterns p ON p.id=a.pattern_id WHERE ($1::int IS NULL OR a.department_id=$1) ORDER BY a.is_active DESC,a.priority DESC,a.department_id,a.effective_from DESC,a.id DESC"
            }
            Self::Employee => {
                "SELECT (to_jsonb(a)-'created_at'-'updated_at') || jsonb_build_object('employee_no',e.employee_no,'employee_name',u.display_name,'department_id',d.id,'department_code',d.code,'department_name',d.name,'pattern_code',p.code,'pattern_name',p.name) FROM tim_employee_schedule_exceptions a JOIN hr_employees e ON e.id=a.employee_id JOIN auth_users u ON u.id=e.user_id JOIN org_departments d ON d.id=e.department_id JOIN tim_schedule_patterns p ON p.id=a.pattern_id WHERE ($1::int IS NULL OR a.employee_id=$1) ORDER BY a.effective_from DESC,a.id DESC"
            }
        }
    }
    fn delete_sql(self) -> &'static str {
        match self {
            Self::Attendance => "DELETE FROM tim_attendance_codes WHERE id=ANY($1)",
            Self::Work => "DELETE FROM tim_work_schedule_codes WHERE id=ANY($1)",
            Self::Holiday => "DELETE FROM tim_holidays WHERE id=ANY($1)",
            Self::Department => "DELETE FROM tim_department_schedule_assignments WHERE id=ANY($1)",
            Self::Employee => "DELETE FROM tim_employee_schedule_exceptions WHERE id=ANY($1)",
        }
    }
    fn write_sql(self, insert: bool) -> &'static str {
        match (self, insert) {
            (Self::Attendance, true) => {
                "INSERT INTO tim_attendance_codes(code,name,category,unit,is_requestable,min_days,max_days,deduct_annual,is_active,sort_order,description,created_at,updated_at) SELECT code,name,category,unit,is_requestable,min_days,max_days,deduct_annual,is_active,sort_order,description,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC' FROM jsonb_populate_record(NULL::tim_attendance_codes,$1)"
            }
            (Self::Attendance, false) => {
                "UPDATE tim_attendance_codes t SET (code,name,category,unit,is_requestable,min_days,max_days,deduct_annual,is_active,sort_order,description,updated_at)=(v.code,v.name,v.category,v.unit,v.is_requestable,v.min_days,v.max_days,v.deduct_annual,v.is_active,v.sort_order,v.description,statement_timestamp() AT TIME ZONE 'UTC') FROM jsonb_populate_record(NULL::tim_attendance_codes,$1) v WHERE t.id=v.id"
            }
            (Self::Work, true) => {
                "INSERT INTO tim_work_schedule_codes(code,name,work_start,work_end,break_minutes,is_overnight,work_hours,is_active,sort_order,description,created_at,updated_at) SELECT code,name,work_start,work_end,break_minutes,is_overnight,work_hours,is_active,sort_order,description,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC' FROM jsonb_populate_record(NULL::tim_work_schedule_codes,$1)"
            }
            (Self::Work, false) => {
                "UPDATE tim_work_schedule_codes t SET (code,name,work_start,work_end,break_minutes,is_overnight,work_hours,is_active,sort_order,description,updated_at)=(v.code,v.name,v.work_start,v.work_end,v.break_minutes,v.is_overnight,v.work_hours,v.is_active,v.sort_order,v.description,statement_timestamp() AT TIME ZONE 'UTC') FROM jsonb_populate_record(NULL::tim_work_schedule_codes,$1) v WHERE t.id=v.id"
            }
            (Self::Holiday, true) => {
                "INSERT INTO tim_holidays(holiday_date,name,holiday_type,is_active,created_at,updated_at) SELECT holiday_date,name,holiday_type,is_active,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC' FROM jsonb_populate_record(NULL::tim_holidays,$1)"
            }
            (Self::Holiday, false) => {
                "UPDATE tim_holidays t SET (holiday_date,name,holiday_type,is_active,updated_at)=(v.holiday_date,v.name,v.holiday_type,v.is_active,statement_timestamp() AT TIME ZONE 'UTC') FROM jsonb_populate_record(NULL::tim_holidays,$1) v WHERE t.id=v.id"
            }
            (Self::Department, true) => {
                "INSERT INTO tim_department_schedule_assignments(department_id,pattern_id,effective_from,effective_to,priority,is_active,created_at,updated_at) SELECT department_id,pattern_id,effective_from,effective_to,priority,is_active,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC' FROM jsonb_populate_record(NULL::tim_department_schedule_assignments,$1)"
            }
            (Self::Department, false) => {
                "UPDATE tim_department_schedule_assignments t SET (department_id,pattern_id,effective_from,effective_to,priority,is_active,updated_at)=(v.department_id,v.pattern_id,v.effective_from,v.effective_to,v.priority,v.is_active,statement_timestamp() AT TIME ZONE 'UTC') FROM jsonb_populate_record(NULL::tim_department_schedule_assignments,$1) v WHERE t.id=v.id"
            }
            (Self::Employee, true) => {
                "INSERT INTO tim_employee_schedule_exceptions(employee_id,pattern_id,effective_from,effective_to,reason,priority,is_active,created_at,updated_at) SELECT employee_id,pattern_id,effective_from,effective_to,reason,priority,is_active,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC' FROM jsonb_populate_record(NULL::tim_employee_schedule_exceptions,$1)"
            }
            (Self::Employee, false) => {
                "UPDATE tim_employee_schedule_exceptions t SET (employee_id,pattern_id,effective_from,effective_to,reason,priority,is_active,updated_at)=(v.employee_id,v.pattern_id,v.effective_from,v.effective_to,v.reason,v.priority,v.is_active,statement_timestamp() AT TIME ZONE 'UTC') FROM jsonb_populate_record(NULL::tim_employee_schedule_exceptions,$1) v WHERE t.id=v.id"
            }
        }
    }
    fn missing(self) -> &'static str {
        match self {
            Self::Attendance => "근태 코드를 찾을 수 없습니다.",
            Self::Work => "근무 코드를 찾을 수 없습니다.",
            Self::Holiday => "휴일을 찾을 수 없습니다.",
            Self::Department => "부서 근무 배정을 찾을 수 없습니다.",
            Self::Employee => "사원 근무 예외를 찾을 수 없습니다.",
        }
    }
}
#[derive(Default)]
struct Filter {
    year: Option<i32>,
    dept: Option<i32>,
    employee: Option<i32>,
}
impl Filter {
    fn parse(g: Grid, q: &reports::Params, save: bool) -> Result<Self, ApiError> {
        let mut f = Self::default();
        match g {
            Grid::Holiday => {
                f.year = Some(reports::year(
                    q,
                    if save { "saveHolidays" } else { "holidays" },
                )?)
            }
            Grid::Department if !save => f.dept = reports::int_arg(q, "departmentId")?,
            Grid::Employee if !save => f.employee = reports::int_arg(q, "employeeId")?,
            _ => {}
        }
        Ok(f)
    }
}
#[derive(Deserialize)]
struct Batch {
    items: Option<Vec<Value>>,
    delete_ids: Option<Vec<i32>>,
}
impl Validate for Batch {
    fn validate(&self) -> Vec<Violation> {
        let mut v = vec![];
        if self.items.is_none() {
            v.push(Violation::field(
                "notnull",
                "items",
                "must not be null".into(),
                Value::Null,
            ));
        }
        for (i, id) in self.delete_ids.iter().flatten().enumerate() {
            if *id <= 0 {
                v.push(Violation::field(
                    "positive",
                    &format!("delete_ids[{i}]"),
                    "must be greater than 0".into(),
                    json!(id),
                ));
            }
        }
        v
    }
}
async fn authorize(
    s: &AppState,
    u: &CurrentUser,
    grid: Grid,
    action: &str,
) -> Result<(), ApiError> {
    manager(u)?;
    let (code, path) = grid.permission();
    crate::menu::require_action(&s.pool, u.id, code, path, action).await
}
async fn rows(conn: &mut PgConnection, g: Grid, f: &Filter) -> Result<Value, ApiError> {
    let mut query = sqlx::query_scalar(g.select_sql());
    let year = f.year.unwrap_or_else(|| today().year());
    match g {
        Grid::Holiday => {
            query = query.bind(year);
        }
        Grid::Department => {
            query = query.bind(f.dept);
        }
        Grid::Employee => {
            query = query.bind(f.employee);
        }
        _ => {}
    }
    let items: Vec<Value> = query.fetch_all(conn).await?;
    let mut out = json!({"total_count":items.len(),"items":items});
    if g == Grid::Holiday {
        out["year"] = json!(year);
    }
    Ok(out)
}
async fn list(s: AppState, u: CurrentUser, g: Grid, q: reports::Params) -> Reply {
    let f = Filter::parse(g, &q, false)?;
    authorize(&s, &u, g, "query").await?;
    let mut c = s.pool.acquire().await?;
    Ok(Json(rows(&mut c, g, &f).await?))
}
fn normalize(g: Grid, row: &mut Value, index: usize) -> Vec<Violation> {
    let mut issues = Vec::new();
    let mut required = |field: &str, max| {
        let val = row[field].as_str();
        issues.extend(not_blank(&format!("items[{index}].{field}"), val));
        issues.extend(size(&format!("items[{index}].{field}"), val, 0, max));
    };
    if matches!(g, Grid::Work | Grid::Attendance) {
        required("code", 20);
    }
    if matches!(g, Grid::Work | Grid::Attendance | Grid::Holiday) {
        required("name", 100);
    }
    let defaults: Vec<(&str, Value)> = match g {
        Grid::Attendance => vec![
            ("unit", json!("day")),
            ("is_requestable", json!(true)),
            ("deduct_annual", json!(false)),
            ("sort_order", json!(0)),
        ],
        Grid::Work => vec![
            ("break_minutes", json!(60)),
            ("is_overnight", json!(false)),
            ("work_hours", json!(8.0)),
            ("sort_order", json!(0)),
        ],
        Grid::Holiday => vec![("holiday_type", json!("legal"))],
        Grid::Department => vec![("priority", json!(100))],
        Grid::Employee => vec![("priority", json!(1000))],
    };
    if !row.is_object() {
        return vec![Violation::field(
            "notnull",
            &format!("items[{index}]"),
            "must not be null".into(),
            Value::Null,
        )];
    }
    for (k, v) in defaults.into_iter().chain([("is_active", json!(true))]) {
        if row[k].is_null() {
            row[k] = v;
        }
    }
    let field = |k: &str| format!("items[{index}].{k}");
    for k in ["code", "name"] {
        if let Some(s) = row[k].as_str() {
            row[k] = json!(s.trim());
        }
    }
    let choices: &[(&str, &str)] = match g {
        Grid::Attendance => &[
            ("category", "leave|work|special"),
            ("unit", "day|am|pm|hour"),
        ],
        Grid::Holiday => &[("holiday_type", "legal|company|substitute")],
        _ => &[],
    };
    for (k, values) in choices {
        let value = row[*k].as_str();
        if *k == "category" {
            issues.extend(not_blank(&field(k), value));
        }
        if let Some(v) = value
            && !values.split('|').any(|x| x == v)
        {
            issues.push(Violation::field(
                "pattern",
                &field(k),
                format!("must match \"{values}\""),
                json!(v),
            ));
        }
    }
    issues.extend(size(&field("reason"), row["reason"].as_str(), 0, 255));
    issues.extend(size(
        &field("description"),
        row["description"].as_str(),
        0,
        200,
    ));
    if g == Grid::Work {
        for k in ["work_start", "work_end"] {
            let val = row[k].as_str();
            issues.extend(not_blank(&field(k), val));
            if let Some(s) = val {
                let bytes = s.as_bytes();
                if bytes.len() != 5
                    || bytes[2] != b':'
                    || ![0, 1, 3, 4].iter().all(|i| bytes[*i].is_ascii_digit())
                {
                    issues.push(Violation::field(
                        "pattern",
                        &field(k),
                        r#"must match "\d{2}:\d{2}""#.into(),
                        json!(s),
                    ));
                }
            }
        }
        if row["break_minutes"].as_i64().unwrap_or(0) < 0 {
            issues.extend(range(
                &field("break_minutes"),
                row["break_minutes"].as_i64().unwrap(),
                0,
                i64::MAX,
            ));
        }
        if row["work_hours"].as_f64().unwrap_or(0.) < 0.01 {
            issues.push(Violation::field(
                "decimalmin",
                &field("work_hours"),
                "must be greater than or equal to 0.01".into(),
                row["work_hours"].clone(),
            ));
        }
    }
    if matches!(g, Grid::Department | Grid::Employee) {
        for k in [
            "pattern_id",
            if g == Grid::Department {
                "department_id"
            } else {
                "employee_id"
            },
        ] {
            if row[k].as_i64().unwrap_or(0) <= 0 {
                issues.push(Violation::field(
                    "positive",
                    &field(k),
                    "must be greater than 0".into(),
                    row[k].clone(),
                ));
            }
        }
    }
    let date = match g {
        Grid::Department | Grid::Employee => Some("effective_from"),
        Grid::Holiday => Some("holiday_date"),
        _ => None,
    };
    if let Some(k) = date
        && row[k].is_null()
    {
        issues.push(Violation::field(
            "notnull",
            &field(k),
            "must not be null".into(),
            Value::Null,
        ));
    }
    issues
}
async fn save(
    s: AppState,
    u: CurrentUser,
    g: Grid,
    q: reports::Params,
    bytes: axum::body::Bytes,
) -> Reply {
    let mut p = binding::batch(g, bytes)?;
    let f = Filter::parse(g, &q, true)?;
    let items = p.items.take().unwrap_or_default();
    let mut normalized = items;
    let mut errors = Vec::new();
    for (i, row) in normalized.iter_mut().enumerate() {
        errors.extend(normalize(g, row, i));
    }
    if !errors.is_empty() {
        return Err(ApiError::validation(errors));
    }
    authorize(&s, &u, g, "save").await?;
    let mut tx = s.pool.begin().await?;
    let deleted = sqlx::query(g.delete_sql())
        .bind(p.delete_ids.unwrap_or_default())
        .execute(&mut *tx)
        .await?
        .rows_affected();
    let mut inserted = 0;
    let mut updated = 0;
    let year = f.year.unwrap_or_else(|| today().year());
    for row in normalized {
        if let (Some(from), Some(to)) =
            (row["effective_from"].as_str(), row["effective_to"].as_str())
            && from > to
        {
            return Err(ApiError::new(
                StatusCode::BAD_REQUEST,
                "시작일은 종료일보다 늦을 수 없습니다.",
            ));
        }
        if g == Grid::Holiday
            && row["holiday_date"]
                .as_str()
                .and_then(|s| s.parse::<NaiveDate>().ok())
                .is_none_or(|d| d.year() != year)
        {
            return Err(ApiError::new(
                StatusCode::BAD_REQUEST,
                "휴일 연도가 요청 연도와 일치해야 합니다.",
            ));
        }
        let new = row["id"].is_null();
        let count = sqlx::query(g.write_sql(new))
            .bind(row)
            .execute(&mut *tx)
            .await?
            .rows_affected();
        if count == 0 {
            return Err(ApiError::new(StatusCode::NOT_FOUND, g.missing()));
        }
        if new {
            inserted += 1;
        } else {
            updated += 1;
        }
    }
    let mut out = rows(
        &mut tx,
        g,
        &Filter {
            year: Some(year),
            ..Filter::default()
        },
    )
    .await?;
    out["inserted_count"] = json!(inserted);
    out["updated_count"] = json!(updated);
    out["deleted_count"] = json!(deleted);
    tx.commit().await?;
    Ok(Json(out))
}
#[derive(Deserialize)]
struct CopyYear {
    year_from: i32,
    year_to: i32,
}
impl Validate for CopyYear {
    fn validate(&self) -> Vec<Violation> {
        [
            range("year_from", self.year_from.into(), 2000, 2100),
            range("year_to", self.year_to.into(), 2000, 2100),
        ]
        .into_iter()
        .flatten()
        .collect()
    }
}
async fn copy_year(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(p): Body<CopyYear>,
) -> Reply {
    authorize(&s, &u, Grid::Holiday, "save").await?;
    if p.year_from == p.year_to {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "복사 원본과 대상 연도는 달라야 합니다.",
        ));
    }
    let copied=sqlx::query("INSERT INTO tim_holidays(holiday_date,name,holiday_type,is_active,created_at,updated_at)
      SELECT (holiday_date+make_interval(years=>$2-$1))::date,name,holiday_type,true,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC'
      FROM tim_holidays WHERE extract(year FROM holiday_date)=$1 AND is_active ORDER BY id ON CONFLICT(holiday_date) DO NOTHING").bind(p.year_from).bind(p.year_to).execute(&s.pool).await?.rows_affected();
    Ok(Json(json!({"copied_count":copied,"year_to":p.year_to})))
}
pub(super) fn routes() -> Router<AppState> {
    let mut r = Router::new().route("/api/v1/tim/holidays/copy-year", post(copy_year));
    for (g, name) in [
        (Grid::Attendance, "attendance-codes"),
        (Grid::Work, "work-schedules"),
        (Grid::Holiday, "holidays"),
        (Grid::Department, "schedules/departments"),
        (Grid::Employee, "schedules/exceptions/employees"),
    ] {
        r = r
            .route(
                &format!("/api/v1/tim/{name}"),
                get(move |State(s), Extension(u), Query(q)| list(s, u, g, q)),
            )
            .route(
                &format!("/api/v1/tim/{name}/batch"),
                post(
                    move |State(s), Extension(u), Query(q), bytes: axum::body::Bytes| {
                        save(s, u, g, q, bytes)
                    },
                ),
            );
    }
    r
}
