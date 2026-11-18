use super::directory::present;
use super::*;
use crate::input::{Body, Validate, Violation, not_blank, size};
use serde::Deserialize;

mod upload;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/mapping-types", get(types))
        .route("/mapping-type-options", get(type_options))
        .route("/mapping-item-options", get(item_options))
        .route("/department-options", get(dept_options))
        .route("/mapping-type-items", get(items).post(create_item))
        .route(
            "/mapping-type-items/{item_id}",
            axum::routing::put(update_item).delete(delete_item),
        )
        .route(
            "/mapping-assignments",
            get(assignments).post(create_assignment),
        )
        .route(
            "/mapping-assignments/{assignment_id}",
            axum::routing::put(update_assignment).delete(delete_assignment),
        )
        .route("/mapping-assignments/upload-template", get(template))
        .route("/mapping-assignments/upload-preview", post(upload::preview))
        .route("/mapping-assignments/upload-confirm", post(upload::confirm))
        .route("/mapping-personal-status", get(personal_status))
}
macro_rules! type_group { () => { "SELECT c.code,c.name FROM app_codes c JOIN app_code_groups g ON g.id=c.group_id WHERE g.code='ORG_MAPPING_TYPE' AND g.is_active AND c.is_active ORDER BY c.sort_order,c.id" }; }
async fn type_list(pool: &PgPool) -> Result<Vec<Value>, ApiError> {
    let sql = concat!(
        "SELECT to_jsonb(r)||jsonb_build_object('id',null) FROM (",
        type_group!(),
        ") r"
    );
    Ok(sqlx::query_scalar(sql).fetch_all(pool).await?)
}
async fn types(State(s): State<AppState>, Extension(u): Extension<CurrentUser>) -> Reply {
    action(&s.pool, &u, "/org/type-items", "query").await?;
    Ok(Json(json!({"items":type_list(&s.pool).await?})))
}
async fn type_options(State(s): State<AppState>, Extension(u): Extension<CurrentUser>) -> Reply {
    action(&s.pool, &u, "/org/types", "query").await?;
    Ok(Json(json!({"items":type_list(&s.pool).await?})))
}
async fn item_options(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Params>,
) -> Reply {
    let t = q
        .get("type_code")
        .ok_or_else(|| query_error("type_code", None, "missing", "Field required"))?;
    action(&s.pool, &u, "/org/types", "query").await?;
    let rows:Vec<Value>=sqlx::query_scalar("SELECT jsonb_build_object('id',id,'code',item_code,'name',name) FROM org_mapping_type_items WHERE type_code=$1 AND is_active ORDER BY sort_order,id").bind(required(t)?.to_uppercase()).fetch_all(&s.pool).await?;
    Ok(Json(json!({"items":rows})))
}
async fn dept_options(State(s): State<AppState>, Extension(u): Extension<CurrentUser>) -> Reply {
    action(&s.pool, &u, "/org/types", "query").await?;
    let rows:Vec<Value>=sqlx::query_scalar("SELECT jsonb_build_object('id',id,'code',code,'name',name) FROM org_departments WHERE is_active ORDER BY code").fetch_all(&s.pool).await?;
    Ok(Json(json!({"items":rows})))
}
async fn template(State(s): State<AppState>, Extension(u): Extension<CurrentUser>) -> Reply {
    action(&s.pool, &u, "/org/type-upload", "template_download").await?;
    Ok(Json(
        json!({"headers":["조직코드","유형코드","항목코드","시작일","종료일"]}),
    ))
}
fn parsed_type(q: &Params) -> Result<Option<String>, ApiError> {
    q.get("type_code")
        .map(|v| required(v).map(str::to_uppercase))
        .transpose()
}
macro_rules! item_fields { () => { "id,type_code,item_code,name,effective_from,effective_to,erp_employee_code,cost_center_type,remark,sort_order,is_active,created_at,updated_at" }; }
async fn items(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Params>,
) -> Reply {
    let page = Page::parse(&q, false, "mappingTypeItems")?;
    let date = query_date(&q, "reference_date")?;
    action(&s.pool, &u, "/org/type-items", "query").await?;
    let sql = concat!(
        "SELECT to_jsonb(r) FROM (SELECT ",
        item_fields!(),
        " FROM org_mapping_type_items WHERE ($1::text IS NULL OR type_code=$1) AND ($2::date IS NULL OR $2 BETWEEN effective_from AND coalesce(effective_to,DATE '9999-12-31')) ORDER BY type_code,sort_order,item_code,effective_from,id) r"
    );
    let rows = sqlx::query_scalar(sql)
        .bind(parsed_type(&q)?)
        .bind(date)
        .fetch_all(&s.pool)
        .await?;
    Ok(Json(page.response(
        "items",
        rows.into_iter().map(timestamps).collect(),
    )))
}
macro_rules! assignments { () => { "SELECT a.id,a.department_id,d.code department_code,d.name department_name,a.type_code,a.item_id,i.item_code,i.name item_name,
 a.effective_from,a.effective_to,a.created_at,a.updated_at FROM org_mapping_assignments a JOIN org_departments d ON d.id=a.department_id
 JOIN org_mapping_type_items i ON i.id=a.item_id AND i.type_code=a.type_code" }; }
async fn assignments(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Params>,
) -> Reply {
    let page = Page::parse(&q, false, "mappingAssignments")?;
    let date = query_date(&q, "reference_date")?;
    let dept = query_integer(&q, "department_id")?
        .map(|v| checked_id(v, "department_id"))
        .transpose()?;
    action(&s.pool, &u, "/org/types", "query").await?;
    let sql = concat!(
        "SELECT to_jsonb(r) FROM (",
        assignments!(),
        " WHERE ($1::text IS NULL OR a.type_code=$1) AND ($2::int IS NULL OR a.department_id=$2) AND ($3::date IS NULL OR $3 BETWEEN a.effective_from AND coalesce(a.effective_to,DATE '9999-12-31')) ORDER BY d.code,a.type_code,a.effective_from,a.id) r"
    );
    let rows = sqlx::query_scalar(sql)
        .bind(parsed_type(&q)?)
        .bind(dept)
        .bind(date)
        .fetch_all(&s.pool)
        .await?;
    Ok(Json(page.response(
        "items",
        rows.into_iter().map(timestamps).collect(),
    )))
}

async fn personal_status(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Params>,
) -> Reply {
    let date = query_date(&q, "reference_date")?
        .ok_or_else(|| query_error("reference_date", None, "missing", "Field required"))?;
    let page = Page::parse(&q, false, "personalStatus")?;
    action(&s.pool, &u, "/org/type-personal-status", "query").await?;
    let mut tx = s.pool.begin().await?;
    let sql = concat!(
        "SELECT jsonb_build_object('type_code',code,'name',name) FROM (",
        type_group!(),
        ") g"
    );
    let columns: Vec<Value> = sqlx::query_scalar(sql).fetch_all(&mut *tx).await?;
    let sql = concat!("WITH types AS (", type_group!(), "), history AS (
       SELECT DISTINCT ON (employee_id,field_name) employee_id,field_name,before_value FROM hr_personnel_histories
       WHERE effective_date>$1 AND ((field_name='department_id' AND nullif(trim(before_value),'') IS NOT NULL) OR (field_name='employment_status' AND before_value IS NOT NULL))
       ORDER BY employee_id,field_name,effective_date,id),
     emp AS (SELECT e.id employee_id,e.employee_no,u.display_name,coalesce(h.before_value::bigint,e.department_id) department_id,e.position_title FROM hr_employees e JOIN auth_users u ON u.id=e.user_id
       LEFT JOIN history h ON h.employee_id=e.id AND h.field_name='department_id'
       LEFT JOIN history hs ON hs.employee_id=e.id AND hs.field_name='employment_status'
       WHERE e.hire_date <= $1 AND coalesce(hs.before_value,e.employment_status)='active')
     SELECT to_jsonb(emp)||jsonb_build_object('department_code',coalesce(d.code,''),'department_name',coalesce(d.name,''),'mappings',
       coalesce((SELECT jsonb_object_agg(t.code,jsonb_build_object('item_code',coalesce(item.item_code,''),'item_name',coalesce(item.name,''))) FROM types t
        LEFT JOIN LATERAL(SELECT i.item_code,i.name FROM org_mapping_assignments a JOIN org_mapping_type_items i ON i.id=a.item_id AND i.type_code=a.type_code
           WHERE a.department_id=emp.department_id AND a.type_code=t.code AND $1 BETWEEN a.effective_from AND coalesce(a.effective_to,DATE '9999-12-31') ORDER BY a.effective_from,a.id LIMIT 1) item ON true),'{}'::jsonb))
     FROM emp LEFT JOIN org_departments d ON d.id=emp.department_id ORDER BY emp.employee_no,emp.employee_id");
    let rows = sqlx::query_scalar(sql)
        .bind(date)
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;
    let mut result = page.response("items", rows);
    result["type_columns"] = json!(columns);
    Ok(Json(result))
}
#[derive(Default, Deserialize)]
struct ItemData {
    type_code: Option<String>,
    item_code: Option<String>,
    name: Option<String>,
    effective_from: Option<NaiveDate>,
    #[serde(default, deserialize_with = "present")]
    effective_to: Option<Option<NaiveDate>>,
    #[serde(default, deserialize_with = "present")]
    erp_employee_code: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    cost_center_type: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    remark: Option<Option<String>>,
    sort_order: Option<i32>,
    is_active: Option<bool>,
}
impl Validate for ItemData {
    fn validate(&self) -> Vec<Violation> {
        [
            ("type_code", self.type_code.as_deref(), 50),
            ("item_code", self.item_code.as_deref(), 50),
            ("name", self.name.as_deref(), 100),
            (
                "erp_employee_code",
                self.erp_employee_code.as_ref().and_then(Option::as_deref),
                50,
            ),
            (
                "cost_center_type",
                self.cost_center_type.as_ref().and_then(Option::as_deref),
                50,
            ),
            (
                "remark",
                self.remark.as_ref().and_then(Option::as_deref),
                500,
            ),
        ]
        .into_iter()
        .filter_map(|(k, v, m)| size(k, v, 0, m))
        .collect()
    }
}
#[derive(Deserialize)]
struct AssignmentData {
    department_id: Option<i64>,
    type_code: Option<String>,
    item_id: Option<i64>,
    effective_from: Option<NaiveDate>,
    #[serde(default, deserialize_with = "present")]
    effective_to: Option<Option<NaiveDate>>,
}
impl Validate for AssignmentData {
    fn validate(&self) -> Vec<Violation> {
        size("type_code", self.type_code.as_deref(), 0, 50)
            .into_iter()
            .collect()
    }
}
fn validate_create(
    fields: &[(&str, Option<&str>)],
    from: Option<NaiveDate>,
) -> Result<(), ApiError> {
    let mut errors: Vec<_> = fields
        .iter()
        .filter_map(|(key, s)| not_blank(key, *s))
        .collect();
    if from.is_none() {
        errors.push(Violation::field(
            "notnull",
            "effective_from",
            "must not be null".into(),
            Value::Null,
        ));
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(ApiError::validation(errors))
    }
}
fn period(from: NaiveDate, to: Option<NaiveDate>) -> Result<(), ApiError> {
    if to.is_some_and(|v| v < from) {
        Err(unprocessable(
            "effective_to must be on or after effective_from.",
        ))
    } else {
        Ok(())
    }
}
fn code(value: &str) -> Result<String, ApiError> {
    Ok(required(value)?.to_uppercase())
}
fn merged<'a>(patch: &'a Option<Option<String>>, old: &'a Value, key: &str) -> Option<&'a str> {
    match patch {
        None => old[key].as_str(),
        Some(v) => v.as_deref().and_then(nullable),
    }
}
fn old_date(row: &Value, key: &str) -> Result<Option<NaiveDate>, ApiError> {
    row[key]
        .as_str()
        .map(str::parse)
        .transpose()
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Invalid stored date"))
}
async fn create_item(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(v): Body<ItemData>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    validate_create(
        &[
            ("type_code", v.type_code.as_deref()),
            ("item_code", v.item_code.as_deref()),
            ("name", v.name.as_deref()),
        ],
        v.effective_from,
    )?;
    action(&s.pool, &u, "/org/type-items", "save").await?;
    Ok((StatusCode::CREATED, save_item(&s.pool, None, v).await?))
}
async fn update_item(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i64>,
    Body(v): Body<ItemData>,
) -> Reply {
    super::directory::patch_fields(&[
        ("type_code", &v.type_code, 50),
        ("item_code", &v.item_code, 50),
        ("name", &v.name, 100),
    ])?;
    action(&s.pool, &u, "/org/type-items", "save").await?;
    save_item(&s.pool, Some(checked_id(id, "item_id")?), v).await
}
async fn save_item(pool: &PgPool, id: Option<i32>, input: ItemData) -> Reply {
    let mut tx = pool.begin().await?;
    let old = if let Some(id) = id {
        sqlx::query_scalar::<_, Value>(
            "SELECT to_jsonb(i) FROM org_mapping_type_items i WHERE id=$1 FOR UPDATE",
        )
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| missing("Mapping item not found."))?
    } else {
        Value::Null
    };
    let ty = code(
        input
            .type_code
            .as_deref()
            .or(old["type_code"].as_str())
            .unwrap_or_default(),
    )?;
    let item = code(
        input
            .item_code
            .as_deref()
            .or(old["item_code"].as_str())
            .unwrap_or_default(),
    )?;
    let name = required(
        input
            .name
            .as_deref()
            .or(old["name"].as_str())
            .unwrap_or_default(),
    )?;
    let from = input
        .effective_from
        .or(old_date(&old, "effective_from")?)
        .ok_or_else(|| unprocessable("effective_from is required."))?;
    let to = input
        .effective_to
        .unwrap_or(old_date(&old, "effective_to")?);
    period(from, to)?;
    sqlx::query(
        "SELECT id FROM org_mapping_type_items WHERE type_code=$1 AND item_code=$2 FOR UPDATE",
    )
    .bind(&ty)
    .bind(&item)
    .fetch_all(&mut *tx)
    .await?;
    let overlap:bool=sqlx::query_scalar("SELECT EXISTS (SELECT FROM org_mapping_type_items WHERE type_code=$1 AND item_code=$2 AND effective_from<=coalesce($4,DATE '9999-12-31') AND coalesce(effective_to,DATE '9999-12-31')>=$3 AND id IS DISTINCT FROM $5)")
        .bind(&ty).bind(&item).bind(from).bind(to).bind(id).fetch_one(&mut *tx).await?;
    if overlap {
        return Err(conflict("Mapping item period overlaps existing record."));
    }
    if let Some(id) = id {
        let (linked,outside):(bool,bool)=sqlx::query_as("SELECT EXISTS(SELECT FROM org_mapping_assignments WHERE item_id=$1),EXISTS(SELECT FROM org_mapping_assignments WHERE item_id=$1 AND (effective_from<$2 OR ($3::date IS NOT NULL AND (effective_to IS NULL OR effective_to>$3))))").bind(id).bind(from).bind(to).fetch_one(&mut *tx).await?;
        if linked {
            if old["type_code"] != ty || old["item_code"] != item {
                return Err(conflict(
                    "Referenced mapping item type_code/item_code cannot be changed.",
                ));
            }
            if outside {
                return Err(conflict(
                    "Referenced mapping item period must contain existing assignments.",
                ));
            }
            if input.is_active == Some(false) {
                return Err(conflict("Referenced mapping item cannot be deactivated."));
            }
        }
    }
    let sql = if id.is_none() {
        concat!(
            "WITH r AS (INSERT INTO org_mapping_type_items(type_code,item_code,name,effective_from,effective_to,erp_employee_code,cost_center_type,remark,sort_order,is_active,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,statement_timestamp(),statement_timestamp()) RETURNING ",
            item_fields!(),
            ") SELECT to_jsonb(r) FROM r"
        )
    } else {
        concat!(
            "WITH r AS (UPDATE org_mapping_type_items SET type_code=$1,item_code=$2,name=$3,effective_from=$4,effective_to=$5,erp_employee_code=$6,cost_center_type=$7,remark=$8,sort_order=$9,is_active=$10,updated_at=statement_timestamp() WHERE id=$11 RETURNING ",
            item_fields!(),
            ") SELECT to_jsonb(r) FROM r"
        )
    };
    let mut query = sqlx::query_scalar(sql)
        .bind(ty)
        .bind(item)
        .bind(name)
        .bind(from)
        .bind(to)
        .bind(merged(&input.erp_employee_code, &old, "erp_employee_code"))
        .bind(merged(&input.cost_center_type, &old, "cost_center_type"))
        .bind(merged(&input.remark, &old, "remark"))
        .bind(
            input
                .sort_order
                .unwrap_or(old["sort_order"].as_i64().unwrap_or_default() as i32),
        )
        .bind(
            input
                .is_active
                .or(old["is_active"].as_bool())
                .unwrap_or(true),
        );
    if let Some(id) = id {
        query = query.bind(id);
    }
    let row = query
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| conflict_on_constraint(e, "Mapping item conflict."))?;
    tx.commit().await?;
    Ok(Json(json!({"item":timestamps(row)})))
}
async fn delete_item(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    action(&s.pool, &u, "/org/type-items", "save").await?;
    let id = checked_id(id, "item_id")?;
    let mut tx = s.pool.begin().await?;
    sqlx::query("SELECT id FROM org_mapping_type_items WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| missing("Mapping item not found."))?;
    if sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT FROM org_mapping_assignments WHERE item_id=$1)",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?
    {
        return Err(conflict("Referenced mapping item cannot be deleted."));
    }
    sqlx::query("DELETE FROM org_mapping_type_items WHERE id=$1")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| conflict_on_constraint(e, "Mapping item conflict."))?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn create_assignment(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(v): Body<AssignmentData>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    validate_create(&[("type_code", v.type_code.as_deref())], v.effective_from)?;
    action(&s.pool, &u, "/org/types", "save").await?;
    Ok((
        StatusCode::CREATED,
        save_assignment(&s.pool, None, v).await?,
    ))
}
async fn update_assignment(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i64>,
    Body(v): Body<AssignmentData>,
) -> Reply {
    super::directory::patch_fields(&[("type_code", &v.type_code, 50)])?;
    action(&s.pool, &u, "/org/types", "save").await?;
    save_assignment(&s.pool, Some(checked_id(id, "assignment_id")?), v).await
}
async fn lock_group(conn: &mut PgConnection, dept: i32, ty: &str) -> Result<(), ApiError> {
    sqlx::query("SELECT id FROM org_mapping_assignments WHERE department_id=$1 AND type_code=$2 ORDER BY id FOR UPDATE").bind(dept).bind(ty).fetch_all(conn).await?;
    Ok(())
}
async fn save_assignment(pool: &PgPool, id: Option<i32>, v: AssignmentData) -> Reply {
    let mut tx = pool.begin().await?;
    let old = if let Some(id) = id {
        sqlx::query_scalar::<_, Value>(
            "SELECT to_jsonb(a) FROM org_mapping_assignments a WHERE id=$1 FOR UPDATE",
        )
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| missing("Mapping assignment not found."))?
    } else {
        Value::Null
    };
    let dept = checked_id(
        v.department_id
            .or(old["department_id"].as_i64())
            .unwrap_or(0),
        "department_id",
    )?;
    let item = checked_id(
        v.item_id.or(old["item_id"].as_i64()).unwrap_or(0),
        "item_id",
    )?;
    let ty = code(
        v.type_code
            .as_deref()
            .or(old["type_code"].as_str())
            .unwrap_or_default(),
    )?;
    sqlx::query("SELECT id FROM org_departments WHERE id=$1 FOR SHARE")
        .bind(dept)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| missing("Department not found."))?;
    let (item_from,item_to,active):(NaiveDate,Option<NaiveDate>,bool)=sqlx::query_as("SELECT effective_from,effective_to,is_active FROM org_mapping_type_items WHERE id=$1 AND type_code=$2 FOR SHARE")
        .bind(item).bind(&ty).fetch_optional(&mut *tx).await?.ok_or_else(||missing("Mapping item not found."))?;
    if !active {
        return Err(conflict("Mapping item is inactive."));
    }
    let from = v
        .effective_from
        .or(old_date(&old, "effective_from")?)
        .ok_or_else(|| unprocessable("effective_from is required."))?;
    let to = v.effective_to.unwrap_or(old_date(&old, "effective_to")?);
    period(from, to)?;
    if from < item_from || item_to.is_some_and(|end| to.is_none_or(|d| d > end)) {
        return Err(conflict(
            "Mapping assignment item period must contain the assignment period.",
        ));
    }
    lock_group(&mut tx, dept, &ty).await?;
    let overlap:bool=sqlx::query_scalar("SELECT EXISTS(SELECT FROM org_mapping_assignments WHERE department_id=$1 AND type_code=$2 AND effective_from<=coalesce($4,DATE '9999-12-31') AND coalesce(effective_to,DATE '9999-12-31')>=$3 AND id IS DISTINCT FROM $5)").bind(dept).bind(&ty).bind(from).bind(to).bind(id).fetch_one(&mut *tx).await?;
    if overlap {
        return Err(conflict(
            "Mapping assignment period overlaps existing record.",
        ));
    }
    let statement = if id.is_none() {
        "INSERT INTO org_mapping_assignments(department_id,type_code,item_id,effective_from,effective_to,created_at,updated_at) VALUES($1,$2,$3,$4,$5,statement_timestamp(),statement_timestamp()) RETURNING id"
    } else {
        "UPDATE org_mapping_assignments SET department_id=$1,type_code=$2,item_id=$3,effective_from=$4,effective_to=$5,updated_at=statement_timestamp() WHERE id=$6 RETURNING id"
    };
    let mut query = sqlx::query_scalar::<_, i32>(statement)
        .bind(dept)
        .bind(ty)
        .bind(item)
        .bind(from)
        .bind(to);
    if let Some(id) = id {
        query = query.bind(id)
    }
    let id = query
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| conflict_on_constraint(e, "Mapping assignment conflict."))?;
    let sql = concat!(
        "SELECT to_jsonb(r) FROM (",
        assignments!(),
        " WHERE a.id=$1) r"
    );
    let row = sqlx::query_scalar(sql).bind(id).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"item":timestamps(row)})))
}
async fn delete_assignment(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    action(&s.pool, &u, "/org/types", "save").await?;
    let result = sqlx::query("DELETE FROM org_mapping_assignments WHERE id=$1")
        .bind(checked_id(id, "assignment_id")?)
        .execute(&s.pool)
        .await
        .map_err(|e| conflict_on_constraint(e, "Mapping assignment conflict."))?;
    if result.rows_affected() == 0 {
        return Err(missing("Mapping assignment not found."));
    }
    Ok(StatusCode::NO_CONTENT)
}
