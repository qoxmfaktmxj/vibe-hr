use super::*;
use crate::input::params::query_i32;
use serde_json::Map;
#[derive(Clone, Copy, PartialEq)]
pub(super) enum Resource {
    Organizations,
    Courses,
    Events,
    RequiredStandards,
    RequiredTargets,
    Applications,
    ElearningWindows,
    Histories,
    CyberUploads,
}

#[derive(Clone, Copy)]
enum Column {
    Text,
    Int,
    OptionalInt,
    Double,
    OptionalDouble,
    Bool,
    Date,
}
struct Spec {
    fields: &'static [(&'static str, Column)],
    list: &'static str,
    year: bool,
    insert: &'static str,
    update: &'static str,
    delete: &'static str,
}
macro_rules! spec{
 ($table:literal,$fields:literal,$types:expr,$list:literal,$year:literal)=>{Spec{
    fields:$types,list:$list,year:$year,
    insert:concat!("INSERT INTO ",$table,"(",$fields,",created_at,updated_at) SELECT ",$fields,",statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC' FROM jsonb_populate_record(null::",$table,",$1) input RETURNING id"),
    update:concat!("UPDATE ",$table," AS current SET (",$fields,",updated_at)=(SELECT ",$fields,",statement_timestamp() AT TIME ZONE 'UTC' FROM jsonb_populate_record(current,$2) input) WHERE current.id=$1"),
    delete:concat!("DELETE FROM ",$table," WHERE id=$1"),
 }}
}
impl Resource {
    fn parse(name: &str) -> Result<Self, ApiError> {
        match name {
            "organizations" => Ok(Self::Organizations),
            "courses" => Ok(Self::Courses),
            "events" => Ok(Self::Events),
            "required-standards" => Ok(Self::RequiredStandards),
            "required-targets" => Ok(Self::RequiredTargets),
            "applications" => Ok(Self::Applications),
            "elearning-windows" => Ok(Self::ElearningWindows),
            "histories" => Ok(Self::Histories),
            "cyber-uploads" => Ok(Self::CyberUploads),
            _ => Err(missing(&format!("Unknown TRA resource: {name}"))),
        }
    }
    fn spec(self) -> Spec {
        use Column::*;
        match self {
            Self::Organizations => spec!(
                "tra_organizations",
                "code,name,business_no,contact_name,contact_phone,contact_email,is_active",
                &[
                    ("code", Text),
                    ("name", Text),
                    ("business_no", Text),
                    ("contact_name", Text),
                    ("contact_phone", Text),
                    ("contact_email", Text),
                    ("is_active", Bool)
                ],
                "SELECT to_jsonb(t) FROM tra_organizations t ORDER BY t.code,t.id",
                false
            ),
            Self::Courses => spec!(
                "tra_courses",
                "course_code,course_name,in_out_type,branch_code,sub_branch_code,method_code,status_code,organization_id,mandatory_yn,job_code,edu_level,memo,note,manager_employee_no,manager_phone,is_active",
                &[
                    ("course_code", Text),
                    ("course_name", Text),
                    ("in_out_type", Text),
                    ("branch_code", Text),
                    ("sub_branch_code", Text),
                    ("method_code", Text),
                    ("status_code", Text),
                    ("organization_id", OptionalInt),
                    ("mandatory_yn", Bool),
                    ("job_code", Text),
                    ("edu_level", Text),
                    ("memo", Text),
                    ("note", Text),
                    ("manager_employee_no", Text),
                    ("manager_phone", Text),
                    ("is_active", Bool)
                ],
                "SELECT to_jsonb(t)||jsonb_build_object('organization_name',o.name) FROM tra_courses t LEFT JOIN tra_organizations o ON o.id=t.organization_id ORDER BY t.course_code,t.id",
                false
            ),
            Self::Events => spec!(
                "tra_events",
                "course_id,event_code,event_name,status_code,organization_id,place,start_date,end_date,start_time,end_time,edu_day,edu_hour,appl_start_date,appl_end_date,currency_code,per_expense_amount,real_expense_amount,labor_apply_yn,labor_amount,labor_return_yn,labor_return_date,result_app_skip_yn,max_person,note,manager_employee_no,manager_phone,is_active",
                &[
                    ("course_id", Int),
                    ("event_code", Text),
                    ("event_name", Text),
                    ("status_code", Text),
                    ("organization_id", OptionalInt),
                    ("place", Text),
                    ("start_date", Date),
                    ("end_date", Date),
                    ("start_time", Text),
                    ("end_time", Text),
                    ("edu_day", Int),
                    ("edu_hour", Double),
                    ("appl_start_date", Date),
                    ("appl_end_date", Date),
                    ("currency_code", Text),
                    ("per_expense_amount", Double),
                    ("real_expense_amount", Double),
                    ("labor_apply_yn", Bool),
                    ("labor_amount", Double),
                    ("labor_return_yn", Bool),
                    ("labor_return_date", Date),
                    ("result_app_skip_yn", Bool),
                    ("max_person", Int),
                    ("note", Text),
                    ("manager_employee_no", Text),
                    ("manager_phone", Text),
                    ("is_active", Bool)
                ],
                "SELECT to_jsonb(t)||jsonb_build_object('course_name',c.course_name,'organization_name',o.name) FROM tra_events t LEFT JOIN tra_courses c ON c.id=t.course_id LEFT JOIN tra_organizations o ON o.id=t.organization_id ORDER BY t.start_date,t.id",
                false
            ),
            Self::RequiredStandards => spec!(
                "tra_required_rules",
                "year,rule_code,order_seq,job_grade_code,job_grade_year,job_code,search_seq,entry_month,start_month,end_month,course_id,edu_level,note,is_active",
                &[
                    ("year", Int),
                    ("rule_code", Text),
                    ("order_seq", Int),
                    ("job_grade_code", Text),
                    ("job_grade_year", OptionalInt),
                    ("job_code", Text),
                    ("search_seq", OptionalInt),
                    ("entry_month", OptionalInt),
                    ("start_month", Int),
                    ("end_month", Int),
                    ("course_id", Int),
                    ("edu_level", Text),
                    ("note", Text),
                    ("is_active", Bool)
                ],
                "SELECT to_jsonb(t)||jsonb_build_object('course_name',c.course_name) FROM tra_required_rules t LEFT JOIN tra_courses c ON c.id=t.course_id WHERE ($1::int IS NULL OR t.year=$1) ORDER BY t.year,t.rule_code,t.order_seq,t.id",
                true
            ),
            Self::RequiredTargets => spec!(
                "tra_required_targets",
                "year,employee_id,rule_code,course_id,edu_month,event_id,application_id,standard_rule_id,edu_level,completion_status,completed_count,note,error_note",
                &[
                    ("year", Int),
                    ("employee_id", Int),
                    ("rule_code", Text),
                    ("course_id", Int),
                    ("edu_month", Text),
                    ("event_id", OptionalInt),
                    ("application_id", OptionalInt),
                    ("standard_rule_id", OptionalInt),
                    ("edu_level", Text),
                    ("completion_status", Text),
                    ("completed_count", Int),
                    ("note", Text),
                    ("error_note", Text)
                ],
                "SELECT to_jsonb(t)||jsonb_build_object('course_name',c.course_name,'event_name',e.event_name,'employee_no',h.employee_no) FROM tra_required_targets t LEFT JOIN tra_courses c ON c.id=t.course_id LEFT JOIN tra_events e ON e.id=t.event_id LEFT JOIN hr_employees h ON h.id=t.employee_id WHERE ($1::int IS NULL OR t.year=$1) ORDER BY t.year,t.edu_month,t.employee_id,t.id",
                true
            ),
            Self::Applications => spec!(
                "tra_applications",
                "application_no,employee_id,course_id,event_id,in_out_type,job_code,year_plan_yn,edu_memo,note,survey_yn,approval_request_id,status",
                &[
                    ("application_no", Text),
                    ("employee_id", Int),
                    ("course_id", Int),
                    ("event_id", OptionalInt),
                    ("in_out_type", Text),
                    ("job_code", Text),
                    ("year_plan_yn", Bool),
                    ("edu_memo", Text),
                    ("note", Text),
                    ("survey_yn", Bool),
                    ("approval_request_id", OptionalInt),
                    ("status", Text)
                ],
                "SELECT to_jsonb(t)||jsonb_build_object('course_name',c.course_name,'event_name',e.event_name,'employee_no',h.employee_no) FROM tra_applications t LEFT JOIN tra_courses c ON c.id=t.course_id LEFT JOIN tra_events e ON e.id=t.event_id LEFT JOIN hr_employees h ON h.id=t.employee_id ORDER BY t.id",
                false
            ),
            Self::ElearningWindows => spec!(
                "tra_elearning_windows",
                "year_month,start_date,end_date,app_count,note",
                &[
                    ("year_month", Text),
                    ("start_date", Date),
                    ("end_date", Date),
                    ("app_count", Int),
                    ("note", Text)
                ],
                "SELECT to_jsonb(t) FROM tra_elearning_windows t ORDER BY t.year_month,t.id",
                false
            ),
            Self::Histories => spec!(
                "tra_histories",
                "employee_id,course_id,event_id,application_id,confirm_type,unconfirm_reason,app_point,job_code,note,completed_at",
                &[
                    ("employee_id", Int),
                    ("course_id", Int),
                    ("event_id", OptionalInt),
                    ("application_id", OptionalInt),
                    ("confirm_type", Text),
                    ("unconfirm_reason", Text),
                    ("app_point", OptionalDouble),
                    ("job_code", Text),
                    ("note", Text),
                    ("completed_at", Date)
                ],
                "SELECT to_jsonb(t)||jsonb_build_object('course_name',c.course_name,'event_name',e.event_name,'employee_no',h.employee_no) FROM tra_histories t LEFT JOIN tra_courses c ON c.id=t.course_id LEFT JOIN tra_events e ON e.id=t.event_id LEFT JOIN hr_employees h ON h.id=t.employee_id ORDER BY t.completed_at,t.id",
                false
            ),
            Self::CyberUploads => spec!(
                "tra_cyber_uploads",
                "upload_ym,employee_no,employee_id,course_name,start_date,end_date,reward_hour,edu_hour,labor_apply_yn,labor_amount,per_expense_amount,real_expense_amount,confirm_type,unconfirm_reason,edu_branch_code,edu_sub_branch_code,in_out_type,method_code,organization_name,business_no,mandatory_yn,job_code,edu_level,event_name,place,close_yn,applied_course_id,applied_event_id,applied_history_id,note",
                &[
                    ("upload_ym", Text),
                    ("employee_no", Text),
                    ("employee_id", OptionalInt),
                    ("course_name", Text),
                    ("start_date", Date),
                    ("end_date", Date),
                    ("reward_hour", Double),
                    ("edu_hour", Double),
                    ("labor_apply_yn", Bool),
                    ("labor_amount", Double),
                    ("per_expense_amount", Double),
                    ("real_expense_amount", Double),
                    ("confirm_type", Text),
                    ("unconfirm_reason", Text),
                    ("edu_branch_code", Text),
                    ("edu_sub_branch_code", Text),
                    ("in_out_type", Text),
                    ("method_code", Text),
                    ("organization_name", Text),
                    ("business_no", Text),
                    ("mandatory_yn", Bool),
                    ("job_code", Text),
                    ("edu_level", Text),
                    ("event_name", Text),
                    ("place", Text),
                    ("close_yn", Bool),
                    ("applied_course_id", OptionalInt),
                    ("applied_event_id", OptionalInt),
                    ("applied_history_id", OptionalInt),
                    ("note", Text)
                ],
                "SELECT to_jsonb(t) FROM tra_cyber_uploads t ORDER BY t.upload_ym,t.id",
                false
            ),
        }
    }
}
pub(super) async fn list(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(resource): Path<String>,
    Query(q): Query<std::collections::HashMap<String, String>>,
) -> Reply {
    let year = q
        .get("year")
        .filter(|v| !v.is_empty())
        .map(|v| query_i32("year", v))
        .transpose()?;
    if let Some(y) = year
        && !(2000..=2100).contains(&y)
    {
        let msg = if y < 2000 {
            "must be greater than or equal to 2000"
        } else {
            "must be less than or equal to 2100"
        };
        return Err(ApiError::with_detail(
            StatusCode::UNPROCESSABLE_ENTITY,
            json!([{"type":"validation_error","loc":["request"],"msg":format!("listResource.year: {msg}"),"input":null}]),
        ));
    }
    role(&u, true)?;
    let r = Resource::parse(&resource)?.spec();
    let mut query = sqlx::query_scalar(r.list);
    if r.year {
        query = query.bind(year);
    }
    let rows = query.fetch_all(&s.pool).await?;
    let rows: Vec<_> = rows.into_iter().map(dates).collect();
    Ok(Json(json!({"items":rows,"total_count":rows.len()})))
}
pub(super) async fn insert(
    conn: &mut PgConnection,
    r: Resource,
    mut data: Map<String, Value>,
) -> Result<i32, sqlx::Error> {
    let spec = r.spec();
    for &(key, ty) in spec.fields {
        if data.contains_key(key) {
            continue;
        }
        let default = match (r, key) {
            (
                Resource::Organizations
                | Resource::Courses
                | Resource::Events
                | Resource::RequiredStandards,
                "is_active",
            ) => json!(true),
            (Resource::Courses, "in_out_type") => json!("INTERNAL"),
            (Resource::Courses | Resource::Events, "status_code") => json!("open"),
            (Resource::Events, "currency_code") => json!("KRW"),
            (Resource::RequiredStandards, "order_seq" | "start_month") => json!(1),
            (Resource::RequiredStandards, "end_month") => json!(12),
            (Resource::Applications, "status") => json!("draft"),
            (Resource::RequiredTargets, "completion_status") => json!("pending"),
            (Resource::CyberUploads | Resource::Histories, "confirm_type") => json!("0"),
            (Resource::ElearningWindows, "app_count") => json!(2),
            _ => match ty {
                Column::Bool => json!(false),
                Column::Int => json!(0),
                Column::Double => json!(0.0),
                _ => Value::Null,
            },
        };
        data.insert(key.into(), default);
    }
    let auto = match r {
        Resource::Organizations => Some((
            "code",
            "TRORG",
            "tra:organization-sequence",
            "SELECT coalesce(max(id),0)+1 FROM tra_organizations",
        )),
        Resource::Courses => Some((
            "course_code",
            "TRAC",
            "tra:course-sequence",
            "SELECT coalesce(max(id),0)+1 FROM tra_courses",
        )),
        Resource::Applications => Some((
            "application_no",
            "TRA",
            "tra:application-sequence",
            "SELECT coalesce(max(id),0)+1 FROM tra_applications",
        )),
        _ => None,
    };
    if let Some((key, prefix, lock_key, sql)) = auto
        && data[key].as_str().is_none_or(|v| v.trim().is_empty())
    {
        lock(conn, lock_key).await?;
        let n: i32 = sqlx::query_scalar(sql).fetch_one(&mut *conn).await?;
        let code = if r == Resource::Applications {
            format!("TRA-{}-{n:06}", chrono::Local::now().year())
        } else {
            format!("{prefix}{n:05}")
        };
        data.insert(key.into(), json!(code));
    }
    sqlx::query_scalar(spec.insert)
        .bind(Value::Object(data))
        .fetch_one(conn)
        .await
}
pub(super) async fn update(
    conn: &mut PgConnection,
    r: Resource,
    id: i32,
    data: Map<String, Value>,
) -> Result<u64, sqlx::Error> {
    Ok(sqlx::query(r.spec().update)
        .bind(id)
        .bind(Value::Object(data))
        .execute(conn)
        .await?
        .rows_affected())
}
fn integer(value: &Value) -> Option<i32> {
    if let Some(n) = value.as_i64() {
        return Some(n as i32);
    }
    if let Some(n) = value.as_f64() {
        return Some(n as i32);
    }
    value.as_str()?.parse().ok()
}
fn convert(value: &Value, ty: Column) -> Result<Value, ApiError> {
    let invalid = || ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error");
    let absent = value.is_null() || value.as_str() == Some("");
    Ok(match ty {
        Column::Text => {
            if absent {
                Value::Null
            } else if value.is_string() {
                value.clone()
            } else {
                json!(value.to_string())
            }
        }
        Column::Int | Column::OptionalInt => {
            if absent {
                if matches!(ty, Column::Int) {
                    json!(0)
                } else {
                    Value::Null
                }
            } else {
                json!(integer(value).ok_or_else(invalid)?)
            }
        }
        Column::Double | Column::OptionalDouble => {
            if absent {
                if matches!(ty, Column::Double) {
                    json!(0.0)
                } else {
                    Value::Null
                }
            } else {
                json!(
                    value
                        .as_f64()
                        .or_else(|| value.as_str()?.parse().ok())
                        .ok_or_else(invalid)?
                )
            }
        }
        Column::Bool => {
            json!(
                value
                    .as_bool()
                    .unwrap_or_else(|| value.as_f64().is_some_and(|n| n != 0.0)
                        || value.as_str().is_some_and(|s| matches!(
                            s.trim().to_lowercase().as_str(),
                            "1" | "true" | "t" | "y" | "yes"
                        )))
            )
        }
        Column::Date => {
            if absent {
                Value::Null
            } else {
                let s = value.as_str().ok_or_else(invalid)?.trim();
                let date = if s.len() == 8 {
                    NaiveDate::parse_from_str(s, "%Y%m%d")
                } else {
                    s.parse()
                };
                json!(date.map_err(|_| invalid())?)
            }
        }
    })
}
#[derive(Deserialize)]
pub(super) struct Batch {
    items: Option<Vec<Map<String, Value>>>,
}
impl Validate for Batch {
    fn validate(&self) -> Vec<Violation> {
        vec![]
    }
}
pub(super) async fn batch(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(name): Path<String>,
    Body(v): Body<Batch>,
) -> Reply {
    role(&u, false)?;
    let resource = Resource::parse(&name)?;
    let spec = resource.spec();
    let rows = v
        .items
        .ok_or_else(|| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error"))?;
    let mut tx = s.pool.begin().await?;
    let mut created = 0;
    let mut updated = 0;
    let mut deleted = 0;
    for row in rows {
        let op = row
            .get("_status")
            .and_then(Value::as_str)
            .unwrap_or("clean")
            .to_lowercase();
        if op == "clean" {
            continue;
        }
        let id = row.get("id").and_then(integer);
        if op == "deleted" {
            if let Some(id) = id {
                deleted += sqlx::query(spec.delete)
                    .bind(id)
                    .execute(&mut *tx)
                    .await?
                    .rows_affected();
            }
            continue;
        }
        if op != "added" && !(op == "updated" && id.is_some()) {
            continue;
        }
        let mut values = Map::new();
        for &(key, ty) in spec.fields {
            if let Some(value) = row.get(key) {
                values.insert(key.to_owned(), convert(value, ty)?);
            }
        }
        if op == "added" {
            insert(&mut tx, resource, values).await?;
            created += 1;
        } else if let Some(id) = id {
            updated += update(&mut tx, resource, id, values).await?
        }
    }
    tx.commit().await?;
    Ok(Json(
        json!({"created":created,"updated":updated,"deleted":deleted}),
    ))
}
