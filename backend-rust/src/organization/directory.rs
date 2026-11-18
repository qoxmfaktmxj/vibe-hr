use super::*;
use crate::input::{Body, Validate, Violation, not_blank, size};
use serde::{Deserialize, Deserializer};

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/corporations", get(corporations).post(create_corporation))
        .route(
            "/corporations/{corporation_id}",
            axum::routing::put(update_corporation).delete(delete_corporation),
        )
        .route("/departments", get(departments).post(create_department))
        .route(
            "/departments/{department_id}",
            axum::routing::put(update_department).delete(delete_department),
        )
        .route("/chart", get(chart))
        .route("/dept-history", get(history))
}

macro_rules! corporation_fields { () => { "id,enter_cd,company_code,corporation_name,corporation_number,business_number,company_seal_url,certificate_seal_url,company_logo_url,is_active,created_at,updated_at" }; }
async fn corporations(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Params>,
) -> Reply {
    let page = Page::parse(&q, true, "corporations")?;
    privileged(&u)?;
    let sql = concat!(
        "SELECT to_jsonb(r) FROM (SELECT ",
        corporation_fields!(),
        " FROM org_corporations WHERE strpos(lower(enter_cd),lower($1))>0 AND strpos(lower(company_code),lower($2))>0 AND strpos(lower(corporation_name),lower($3))>0 ORDER BY enter_cd,company_code) r"
    );
    let rows = sqlx::query_scalar(sql)
        .bind(filter(&q, "enter_cd"))
        .bind(filter(&q, "company_code"))
        .bind(filter(&q, "corporation_name"))
        .fetch_all(&s.pool)
        .await?;
    Ok(Json(page.response(
        "corporations",
        rows.into_iter().map(timestamps).collect(),
    )))
}
fn filter<'a>(q: &'a Params, key: &str) -> &'a str {
    q.get(key).map(|s| s.trim()).unwrap_or_default()
}

#[derive(Default, Deserialize)]
struct CorporationData {
    enter_cd: Option<String>,
    company_code: Option<String>,
    corporation_name: Option<String>,
    corporation_number: Option<String>,
    business_number: Option<String>,
    company_seal_url: Option<String>,
    certificate_seal_url: Option<String>,
    company_logo_url: Option<String>,
    is_active: Option<bool>,
}
impl Validate for CorporationData {
    fn validate(&self) -> Vec<Violation> {
        [
            ("enter_cd", &self.enter_cd, 20),
            ("company_code", &self.company_code, 20),
            ("corporation_name", &self.corporation_name, 120),
            ("corporation_number", &self.corporation_number, 30),
            ("business_number", &self.business_number, 30),
            ("company_seal_url", &self.company_seal_url, 500),
            ("certificate_seal_url", &self.certificate_seal_url, 500),
            ("company_logo_url", &self.company_logo_url, 500),
        ]
        .into_iter()
        .filter_map(|(field, v, max)| size(field, v.as_deref(), 0, max))
        .collect()
    }
}
fn required_fields(fields: &[(&str, &Option<String>)]) -> Result<(), ApiError> {
    let errors: Vec<_> = fields
        .iter()
        .filter_map(|(field, value)| not_blank(field, value.as_deref()))
        .collect();
    if errors.is_empty() {
        Ok(())
    } else {
        Err(ApiError::validation(errors))
    }
}
pub(super) fn patch_fields(fields: &[(&str, &Option<String>, usize)]) -> Result<(), ApiError> {
    let errors: Vec<_> = fields
        .iter()
        .filter_map(|(field, value, max)| size(field, value.as_deref(), 1, *max))
        .collect();
    if errors.is_empty() {
        Ok(())
    } else {
        Err(ApiError::validation(errors))
    }
}
async fn create_corporation(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(v): Body<CorporationData>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    required_fields(&[
        ("enter_cd", &v.enter_cd),
        ("company_code", &v.company_code),
        ("corporation_name", &v.corporation_name),
    ])?;
    privileged(&u)?;
    Ok((
        StatusCode::CREATED,
        save_corporation(&s.pool, None, v).await?,
    ))
}
async fn update_corporation(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i64>,
    Body(v): Body<CorporationData>,
) -> Reply {
    patch_fields(&[
        ("enter_cd", &v.enter_cd, 20),
        ("company_code", &v.company_code, 20),
        ("corporation_name", &v.corporation_name, 120),
    ])?;
    privileged(&u)?;
    save_corporation(&s.pool, Some(checked_id(id, "corporation_id")?), v).await
}
async fn save_corporation(pool: &PgPool, id: Option<i32>, v: CorporationData) -> Reply {
    let mut tx = pool.begin().await?;
    if let Some(id) = id {
        sqlx::query("select id from org_corporations where id=$1 for update")
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(|| missing("Corporation not found."))?;
    }
    let enter = v
        .enter_cd
        .as_deref()
        .map(required)
        .transpose()?
        .map(str::to_uppercase);
    let company = v
        .company_code
        .as_deref()
        .map(required)
        .transpose()?
        .map(str::to_uppercase);
    let name = v.corporation_name.as_deref().map(required).transpose()?;
    let (dup_enter,dup_company):(bool,bool)=sqlx::query_as("SELECT EXISTS(SELECT FROM org_corporations WHERE enter_cd=$1 AND id IS DISTINCT FROM $3),EXISTS(SELECT FROM org_corporations WHERE company_code=$2 AND id IS DISTINCT FROM $3)")
        .bind(&enter).bind(&company).bind(id).fetch_one(&mut *tx).await?;
    if dup_enter {
        return Err(conflict("enter_cd already exists."));
    }
    if dup_company {
        return Err(conflict("company_code already exists."));
    }
    let sql = if id.is_none() {
        concat!("WITH r AS (INSERT INTO org_corporations(enter_cd,company_code,corporation_name,corporation_number,business_number,company_seal_url,certificate_seal_url,company_logo_url,is_active,created_at,updated_at)
         VALUES($1,$2,$3,nullif($4,''),nullif($5,''),nullif($6,''),nullif($7,''),nullif($8,''),coalesce($9,true),statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC') RETURNING ", corporation_fields!(), ") SELECT to_jsonb(r) FROM r")
    } else {
        concat!("WITH r AS (UPDATE org_corporations SET enter_cd=coalesce($1,enter_cd),company_code=coalesce($2,company_code),corporation_name=coalesce($3,corporation_name),
         corporation_number=CASE WHEN $4::text IS NULL THEN corporation_number ELSE nullif($4,'') END,business_number=CASE WHEN $5::text IS NULL THEN business_number ELSE nullif($5,'') END,
         company_seal_url=CASE WHEN $6::text IS NULL THEN company_seal_url ELSE nullif($6,'') END,certificate_seal_url=CASE WHEN $7::text IS NULL THEN certificate_seal_url ELSE nullif($7,'') END,
         company_logo_url=CASE WHEN $8::text IS NULL THEN company_logo_url ELSE nullif($8,'') END,is_active=coalesce($9,is_active),updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$10 RETURNING ", corporation_fields!(), ") SELECT to_jsonb(r) FROM r")
    };
    let mut query = sqlx::query_scalar::<_, Value>(sql)
        .bind(enter)
        .bind(company)
        .bind(name)
        .bind(v.corporation_number.as_deref().map(str::trim))
        .bind(v.business_number.as_deref().map(str::trim))
        .bind(v.company_seal_url.as_deref().map(str::trim))
        .bind(v.certificate_seal_url.as_deref().map(str::trim))
        .bind(v.company_logo_url.as_deref().map(str::trim))
        .bind(v.is_active);
    if let Some(id) = id {
        query = query.bind(id);
    }
    let item = query
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| conflict_on_constraint(e, "Corporation conflict."))?;
    tx.commit().await?;
    Ok(Json(json!({"corporation":timestamps(item)})))
}
async fn delete_corporation(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    privileged(&u)?;
    let deleted = sqlx::query("DELETE FROM org_corporations WHERE id=$1")
        .bind(checked_id(id, "corporation_id")?)
        .execute(&s.pool)
        .await
        .map_err(|e| conflict_on_constraint(e, "Corporation conflict."))?;
    if deleted.rows_affected() == 0 {
        return Err(missing("Corporation not found."));
    }
    Ok(StatusCode::NO_CONTENT)
}

macro_rules! department_select { () => { "SELECT d.id,d.code,d.name,d.parent_id,p.name AS parent_name,d.organization_type,d.cost_center_code,d.description,
 (SELECT count(*) FROM hr_employees e WHERE e.department_id=d.id) AS employee_count,d.is_active,d.created_at,d.updated_at
 FROM org_departments d LEFT JOIN org_departments p ON p.id=d.parent_id" }; }
async fn department_rows(pool: &PgPool, q: &Params) -> Result<Vec<Value>, ApiError> {
    let sql = concat!("SELECT to_jsonb(r) FROM (", department_select!(), " WHERE strpos(lower(d.code), lower($1))>0 AND strpos(lower(d.name),lower($2))>0
      AND strpos(lower(coalesce(d.organization_type,'')),lower($3))>0 AND strpos(lower(coalesce(d.cost_center_code,'')),lower($4))>0 ORDER BY d.code) r");
    let rows = sqlx::query_scalar(sql)
        .bind(filter(q, "code"))
        .bind(filter(q, "name"))
        .bind(filter(q, "organization_type"))
        .bind(filter(q, "cost_center_code"))
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(timestamps).collect())
}
async fn departments(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Params>,
) -> Reply {
    let page = Page::parse(&q, true, "departments")?;
    let date = query_date(&q, "reference_date")?;
    action(&s.pool, &u, "/org/departments", "query").await?;
    let mut result = page.response("departments", department_rows(&s.pool, &q).await?);
    result["reference_date"] = json!(date);
    Ok(Json(result))
}
async fn chart(State(s): State<AppState>, Extension(u): Extension<CurrentUser>) -> Reply {
    action(&s.pool, &u, "/org/chart", "query").await?;
    let rows = department_rows(&s.pool, &Params::new()).await?;
    Ok(Json(json!({"departments":rows,"total_count":rows.len()})))
}
pub(super) fn present<'de, D, T: Deserialize<'de>>(
    deserializer: D,
) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}
#[derive(Default, Deserialize)]
struct DepartmentData {
    code: Option<String>,
    name: Option<String>,
    #[serde(default, deserialize_with = "present")]
    parent_id: Option<Option<i64>>,
    organization_type: Option<String>,
    cost_center_code: Option<String>,
    description: Option<String>,
    is_active: Option<bool>,
}
impl Validate for DepartmentData {
    fn validate(&self) -> Vec<Violation> {
        [
            ("code", &self.code, 30),
            ("name", &self.name, 100),
            ("organization_type", &self.organization_type, 50),
            ("cost_center_code", &self.cost_center_code, 30),
            ("description", &self.description, 500),
        ]
        .into_iter()
        .filter_map(|(k, v, m)| size(k, v.as_deref(), 0, m))
        .collect()
    }
}
async fn valid_parent(conn: &mut PgConnection, parent: Option<i32>) -> Result<(), ApiError> {
    if let Some(id) = parent {
        sqlx::query("SELECT id FROM org_departments WHERE id=$1 FOR SHARE")
            .bind(id)
            .fetch_optional(conn)
            .await?
            .ok_or_else(|| bad("Invalid parent_id."))?;
    }
    Ok(())
}
pub(super) async fn creates_cycle(
    conn: &mut PgConnection,
    id: i32,
    parent: Option<i32>,
) -> Result<bool, ApiError> {
    Ok(sqlx::query_scalar("WITH RECURSIVE parents AS (SELECT id,parent_id FROM org_departments WHERE id=$1 UNION SELECT d.id,d.parent_id FROM org_departments d JOIN parents p ON p.parent_id=d.id) SELECT EXISTS (SELECT FROM parents WHERE id=$2)")
        .bind(parent).bind(id).fetch_one(conn).await?)
}
async fn unique_dept(conn: &mut PgConnection, code: &str, id: Option<i32>) -> Result<(), ApiError> {
    if sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT FROM org_departments WHERE code=$1 AND id IS DISTINCT FROM $2)",
    )
    .bind(code)
    .bind(id)
    .fetch_one(conn)
    .await?
    {
        return Err(conflict("code already exists."));
    }
    Ok(())
}
async fn create_department(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(v): Body<DepartmentData>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    required_fields(&[("code", &v.code), ("name", &v.name)])?;
    action(&s.pool, &u, "/org/departments", "save").await?;
    let mut tx = s.pool.begin().await?;
    let code = required(v.code.as_deref().unwrap_or_default())?;
    unique_dept(&mut tx, code, None).await?;
    let parent = v
        .parent_id
        .flatten()
        .map(|n| checked_id(n, "parent_id"))
        .transpose()?;
    valid_parent(&mut tx, parent).await?;
    let row=sqlx::query_scalar("WITH d AS (INSERT INTO org_departments(code,name,parent_id,organization_type,cost_center_code,description,is_active,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC') RETURNING id,code,name,parent_id,organization_type,cost_center_code,description,is_active,created_at,updated_at)
      SELECT to_jsonb(d)||jsonb_build_object('parent_name',null,'employee_count',0) FROM d")
      .bind(code).bind(required(v.name.as_deref().unwrap_or_default())?).bind(parent).bind(v.organization_type.as_deref().and_then(nullable))
      .bind(v.cost_center_code.as_deref().and_then(nullable)).bind(v.description.as_deref().and_then(nullable)).bind(v.is_active.unwrap_or(true))
      .fetch_one(&mut *tx).await.map_err(|e|conflict_on_constraint(e,"Department conflict."))?;
    tx.commit().await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({"department":timestamps(row)})),
    ))
}
pub(super) fn old_parent(value: Option<i32>) -> String {
    value
        .map(|n| n.to_string())
        .unwrap_or_else(|| "None".into())
}
pub(super) fn old_bool(value: bool) -> &'static str {
    if value { "True" } else { "False" }
}
async fn update_department(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i64>,
    Body(v): Body<DepartmentData>,
) -> Reply {
    patch_fields(&[("code", &v.code, 30), ("name", &v.name, 100)])?;
    action(&s.pool, &u, "/org/departments", "save").await?;
    let id = checked_id(id, "department_id")?;
    let mut tx = s.pool.begin().await?;
    let old: Value =
        sqlx::query_scalar("SELECT to_jsonb(d) FROM org_departments d WHERE id=$1 FOR UPDATE")
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(|| missing("Department not found."))?;
    let code = v.code.as_deref().map(required).transpose()?;
    if let Some(code) = code {
        unique_dept(&mut tx, code, Some(id)).await?;
    }
    let name = v.name.as_deref().map(required).transpose()?;
    for (field, value) in [
        ("code", code),
        ("name", name),
        ("organization_type", v.organization_type.as_deref()),
        ("cost_center_code", v.cost_center_code.as_deref()),
    ] {
        if let Some(value) = value {
            record_change(
                &mut tx,
                id,
                u.id,
                field,
                old[field].as_str(),
                nullable(value),
                None,
            )
            .await?;
        }
    }
    let old_id = old["parent_id"].as_i64().map(|n| n as i32);
    let parent = match v.parent_id {
        None => old_id,
        Some(value) => {
            let new = value.map(|n| checked_id(n, "parent_id")).transpose()?;
            if new == Some(id) {
                return Err(bad("Department cannot be its own parent."));
            }
            valid_parent(&mut tx, new).await?;
            if creates_cycle(&mut tx, id, new).await? {
                return Err(bad("Cyclic parent relation is not allowed."));
            }
            record_change(
                &mut tx,
                id,
                u.id,
                "parent_id",
                Some(&old_parent(old_id)),
                Some(&old_parent(new)),
                None,
            )
            .await?;
            new
        }
    };
    if let Some(active) = v.is_active {
        record_change(
            &mut tx,
            id,
            u.id,
            "is_active",
            Some(old_bool(old["is_active"] == true)),
            Some(old_bool(active)),
            None,
        )
        .await?;
    }
    sqlx::query("UPDATE org_departments SET code=coalesce($2,code),name=coalesce($3,name),parent_id=$4,
      organization_type=CASE WHEN $5::text IS NULL THEN organization_type ELSE nullif($5,'') END,
      cost_center_code=CASE WHEN $6::text IS NULL THEN cost_center_code ELSE nullif($6,'') END,
      description=CASE WHEN $7::text IS NULL THEN description ELSE nullif($7,'') END,is_active=coalesce($8,is_active),updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
      .bind(id).bind(code).bind(name).bind(parent).bind(v.organization_type.as_deref().map(str::trim)).bind(v.cost_center_code.as_deref().map(str::trim))
      .bind(v.description.as_deref().map(str::trim)).bind(v.is_active).execute(&mut *tx).await.map_err(|e|conflict_on_constraint(e,"Department conflict."))?;
    let sql = concat!(
        "SELECT to_jsonb(r) FROM (",
        department_select!(),
        " WHERE d.id=$1) r"
    );
    let row = sqlx::query_scalar(sql).bind(id).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"department":timestamps(row)})))
}
async fn delete_department(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    action(&s.pool, &u, "/org/departments", "save").await?;
    let id = checked_id(id, "department_id")?;
    let mut tx = s.pool.begin().await?;
    sqlx::query("SELECT id FROM org_departments WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| missing("Department not found."))?;
    let (children,employees):(bool,bool)=sqlx::query_as("SELECT EXISTS(SELECT FROM org_departments WHERE parent_id=$1), EXISTS(SELECT FROM hr_employees WHERE department_id=$1)")
        .bind(id).fetch_one(&mut *tx).await?;
    if children {
        return Err(conflict("Cannot delete department with child departments."));
    }
    if employees {
        return Err(conflict("Cannot delete department linked to employees."));
    }
    sqlx::query("DELETE FROM org_departments WHERE id=$1")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| conflict_on_constraint(e, "Department conflict."))?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn history(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Params>,
) -> Reply {
    let (_, limit) = Pagination {
        page: None,
        limit: q.get("limit").cloned(),
    }
    .with_limits("deptHistory", 200, 1000)?;
    let dept = query_integer(&q, "department_id")?
        .map(|n| checked_id(n, "department_id"))
        .transpose()?;
    privileged(&u)?;
    let rows=sqlx::query_scalar("SELECT to_jsonb(r) FROM (SELECT h.id,h.department_id,d.name department_name,h.changed_by,u.display_name changed_by_name,h.field_name,h.before_value,h.after_value,h.change_reason,h.changed_at
      FROM org_dept_change_histories h LEFT JOIN org_departments d ON h.department_id=d.id LEFT JOIN auth_users u ON u.id=h.changed_by WHERE ($1::int IS NULL OR h.department_id=$1) ORDER BY h.changed_at DESC LIMIT $2) r")
      .bind(dept).bind(limit).fetch_all(&s.pool).await?;
    let rows: Vec<_> = rows.into_iter().map(timestamps).collect();
    Ok(Json(json!({"items":rows,"total_count":rows.len()})))
}
