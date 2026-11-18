use super::*;
use crate::input::{Body, Validate, Violation};
use axum::extract::{FromRequest, Request};
use serde_json::Map;

pub(super) struct Payload {
    fields: Map<String, Value>,
    length: usize,
}
impl<S: Sync + Send> FromRequest<S> for Payload {
    type Rejection = ApiError;
    async fn from_request(request: Request, state: &S) -> Result<Self, ApiError> {
        let bytes = crate::input::json_bytes(request, state).await?;
        let length = String::from_utf8_lossy(&bytes).encode_utf16().count();
        let fields=serde_json::from_slice(&bytes).map_err(|_|ApiError::with_detail(StatusCode::UNPROCESSABLE_ENTITY,json!([{"type":"json_invalid","loc":["body",length],"msg":"JSON decode error","input":{}}])))?;
        Ok(Self { fields, length })
    }
}
macro_rules! insert {
    ($table:literal,$fields:literal)=>{concat!("INSERT INTO ",$table,"(",$fields,",created_at,updated_at) SELECT ",$fields,
      ",statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC' FROM jsonb_populate_record(null::",$table,",$1) input RETURNING id")};
}
macro_rules! update {
    ($table:literal,$fields:literal)=>{concat!("UPDATE ",$table," AS current SET (",$fields,",updated_at)=(SELECT ",$fields,
      ",statement_timestamp() AT TIME ZONE 'UTC' FROM jsonb_populate_record(current,$2) input) WHERE current.id=$1 RETURNING current.id")};
}
fn insert_sql(screen: Screen) -> &'static str {
    match screen {
        Screen::Companies => insert!(
            "mng_companies",
            "company_code,company_name,company_group_code,company_type,management_type,representative_company,start_date,is_active"
        ),
        Screen::Managers => insert!(
            "mng_manager_companies",
            "employee_id,company_id,start_date,end_date,note,is_active"
        ),
        Screen::Requests => insert!(
            "mng_dev_requests",
            "company_id,request_ym,request_seq,status_code,part_code,requester_name,request_content,manager_employee_id,developer_employee_id,is_paid,paid_content,has_tax_bill,start_ym,end_ym,dev_start_date,dev_end_date,paid_man_months,actual_man_months,note"
        ),
        Screen::Projects => insert!(
            "mng_dev_projects",
            "project_name,company_id,part_code,assigned_staff,contract_start_date,contract_end_date,dev_start_date,dev_end_date,inspection_status,has_tax_bill,actual_man_months,contract_amount,note"
        ),
        Screen::Inquiries => insert!(
            "mng_dev_inquiries",
            "company_id,inquiry_content,hoped_start_date,estimated_man_months,sales_rep_name,client_contact_name,progress_code,is_confirmed,project_name,note"
        ),
        Screen::Contracts => insert!(
            "mng_outsource_contracts",
            "employee_id,start_date,end_date,total_leave_count,extra_leave_count,note,is_active"
        ),
        Screen::Attendances => insert!(
            "mng_outsource_attendances",
            "contract_id,employee_id,attendance_code,apply_date,status_code,start_date,end_date,apply_count,note"
        ),
        Screen::Masters => insert!(
            "mng_infra_masters",
            "company_id,service_type,env_type,is_active"
        ),
        _ => unreachable!("write screen"),
    }
}
fn update_sql(screen: Screen) -> &'static str {
    match screen {
        Screen::Companies => update!(
            "mng_companies",
            "company_name,company_group_code,company_type,management_type,representative_company,start_date,is_active"
        ),
        Screen::Requests => update!(
            "mng_dev_requests",
            "company_id,request_ym,status_code,part_code,requester_name,request_content,manager_employee_id,developer_employee_id,is_paid,paid_content,has_tax_bill,start_ym,end_ym,dev_start_date,dev_end_date,paid_man_months,actual_man_months,note"
        ),
        Screen::Projects => update!(
            "mng_dev_projects",
            "project_name,company_id,part_code,assigned_staff,contract_start_date,contract_end_date,dev_start_date,dev_end_date,inspection_status,has_tax_bill,actual_man_months,contract_amount,note"
        ),
        Screen::Inquiries => update!(
            "mng_dev_inquiries",
            "company_id,inquiry_content,hoped_start_date,estimated_man_months,sales_rep_name,client_contact_name,progress_code,is_confirmed,project_name,note"
        ),
        Screen::Contracts => update!(
            "mng_outsource_contracts",
            "start_date,end_date,total_leave_count,extra_leave_count,note,is_active"
        ),
        _ => unreachable!("patch screen"),
    }
}
fn conflict_text(screen: Screen) -> &'static str {
    match screen {
        Screen::Companies => "이미 존재하는 회사코드입니다.",
        Screen::Contracts => "동일한 사원/시작일 계약이 이미 존재합니다.",
        Screen::Masters => "동일한 인프라 구성이 이미 존재합니다.",
        _ => "Data integrity conflict.",
    }
}
fn default_value(map: &mut Map<String, Value>, key: &str, v: Value) {
    if map.get(key).is_none_or(Value::is_null) {
        map.insert(key.to_owned(), v);
    }
}
fn id(map: &Map<String, Value>, key: &str) -> i32 {
    map[key].as_i64().expect("validated integer") as i32
}
async fn prepare(
    conn: &mut PgConnection,
    screen: Screen,
    v: &mut Map<String, Value>,
) -> Result<(), ApiError> {
    match screen {
        Screen::Companies => {
            if sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT FROM mng_companies WHERE company_code=$1)",
            )
            .bind(v["company_code"].as_str())
            .fetch_one(&mut *conn)
            .await?
            {
                return Err(conflict(conflict_text(screen)));
            }
            v.insert("is_active".into(), json!(true));
        }
        Screen::Managers | Screen::Contracts => {
            let employee = id(v, "employee_id");
            if !sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT FROM hr_employees WHERE id=$1)")
                .bind(employee)
                .fetch_one(&mut *conn)
                .await?
            {
                return Err(bad("사원을 찾을 수 없습니다."));
            }
            v.insert("is_active".into(), json!(true));
            if screen == Screen::Managers {
                if !sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(SELECT FROM mng_companies WHERE id=$1)",
                )
                .bind(id(v, "company_id"))
                .fetch_one(&mut *conn)
                .await?
                {
                    return Err(bad("고객사를 찾을 수 없습니다."));
                }
            } else {
                let exists:bool=sqlx::query_scalar("SELECT EXISTS(SELECT FROM mng_outsource_contracts WHERE employee_id=$1 AND start_date=$2::text::date)").bind(employee).bind(v["start_date"].as_str()).fetch_one(&mut *conn).await?;
                if exists {
                    return Err(conflict(conflict_text(screen)));
                }
                for field in ["total_leave_count", "extra_leave_count"] {
                    default_value(v, field, json!(0.0));
                }
            }
        }
        Screen::Requests => {
            default_value(v, "is_paid", json!(false));
            default_value(v, "has_tax_bill", json!(false));
            if v.get("request_seq")
                .and_then(Value::as_i64)
                .unwrap_or_default()
                == 0
            {
                let company = id(v, "company_id");
                sqlx::query("SELECT id FROM mng_companies WHERE id=$1 FOR UPDATE")
                    .bind(company)
                    .fetch_optional(&mut *conn)
                    .await?;
                let next:i32=sqlx::query_scalar("SELECT coalesce(max(request_seq),0)+1 FROM mng_dev_requests WHERE company_id=$1 AND request_ym=$2::text::date")
                    .bind(company).bind(v["request_ym"].as_str()).fetch_one(&mut *conn).await?;
                v.insert("request_seq".into(), json!(next));
            }
        }
        Screen::Projects => default_value(v, "has_tax_bill", json!(false)),
        Screen::Inquiries => default_value(v, "is_confirmed", json!(false)),
        Screen::Attendances => {
            if !sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT FROM mng_outsource_contracts WHERE id=$1)",
            )
            .bind(id(v, "contract_id"))
            .fetch_one(&mut *conn)
            .await?
            {
                return Err(bad("계약을 찾을 수 없습니다."));
            }
        }
        Screen::Masters => {
            if sqlx::query_scalar::<_,bool>("SELECT EXISTS(SELECT FROM mng_infra_masters WHERE company_id=$1 AND service_type=$2 AND env_type=$3)").bind(id(v,"company_id")).bind(v["service_type"].as_str()).bind(v["env_type"].as_str()).fetch_one(&mut *conn).await?{return Err(conflict(conflict_text(screen)))}
            v.insert("is_active".into(), json!(true));
        }
        _ => unreachable!("create screen"),
    }
    Ok(())
}
pub(super) async fn create(
    s: AppState,
    u: CurrentUser,
    screen: Screen,
    payload: Payload,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let mut fields = super::form::decode(screen, &payload.fields, false, payload.length)?;
    allow(&s.pool, &u, screen, Some("save")).await?;
    let mut tx = s.pool.begin().await?;
    prepare(&mut tx, screen, &mut fields).await?;
    let parent = fields
        .get("contract_id")
        .and_then(Value::as_i64)
        .map(|n| n as i32);
    let id: i32 = sqlx::query_scalar(insert_sql(screen))
        .bind(Value::Object(fields))
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| integrity(e, conflict_text(screen)))?;
    let result = if matches!(
        screen,
        Screen::Managers | Screen::Masters | Screen::Attendances
    ) {
        let all = read::rows(
            &mut tx,
            screen,
            Filter {
                parent,
                ..Filter::default()
            },
        )
        .await?;
        let limit = all.len().max(1) as i32;
        list(screen, all, 1, limit)
    } else {
        json!({(screen.item_key()):read::one(&mut tx,screen,id).await?})
    };
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(result)))
}
pub(super) async fn patch(
    s: AppState,
    u: CurrentUser,
    screen: Screen,
    id: i32,
    payload: Payload,
) -> Reply {
    let fields = super::form::decode(screen, &payload.fields, true, payload.length)?;
    allow(&s.pool, &u, screen, Some("save")).await?;
    let mut tx = s.pool.begin().await?;
    let detail = if screen == Screen::Contracts {
        conflict_text(screen)
    } else {
        "Data integrity conflict."
    };
    sqlx::query_scalar::<_, i32>(update_sql(screen))
        .bind(id)
        .bind(Value::Object(fields))
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| integrity(e, detail))?
        .ok_or_else(|| screen.not_found())?;
    let value = read::one(&mut tx, screen, id).await?;
    tx.commit().await?;
    Ok(Json(json!({(screen.item_key()):value})))
}
#[derive(Deserialize)]
pub(super) struct DeleteIds {
    ids: Option<Vec<i32>>,
}
impl Validate for DeleteIds {
    fn validate(&self) -> Vec<Violation> {
        if self.ids.as_ref().is_none_or(Vec::is_empty) {
            vec![Violation::field(
                "notempty",
                "ids",
                "must not be empty".into(),
                json!(self.ids),
            )]
        } else {
            vec![]
        }
    }
}
pub(super) async fn remove(
    s: AppState,
    u: CurrentUser,
    screen: Screen,
    Body(v): Body<DeleteIds>,
) -> Reply {
    let ids = v.ids.unwrap_or_default();
    allow(&s.pool, &u, screen, Some("save")).await?;
    let mut tx = s.pool.begin().await?;
    if screen == Screen::Masters {
        sqlx::query("DELETE FROM mng_infra_configs WHERE master_id=ANY($1)")
            .bind(&ids)
            .execute(&mut *tx)
            .await?;
    }
    let sql = match screen {
        Screen::Companies => "DELETE FROM mng_companies WHERE id=ANY($1)",
        Screen::Managers => "DELETE FROM mng_manager_companies WHERE id=ANY($1)",
        Screen::Requests => "DELETE FROM mng_dev_requests WHERE id=ANY($1)",
        Screen::Projects => "DELETE FROM mng_dev_projects WHERE id=ANY($1)",
        Screen::Inquiries => "DELETE FROM mng_dev_inquiries WHERE id=ANY($1)",
        Screen::Contracts => "DELETE FROM mng_outsource_contracts WHERE id=ANY($1)",
        Screen::Attendances => "DELETE FROM mng_outsource_attendances WHERE id=ANY($1)",
        Screen::Masters => "DELETE FROM mng_infra_masters WHERE id=ANY($1)",
        _ => unreachable!("bulk delete screen"),
    };
    let n = sqlx::query(sql)
        .bind(&ids)
        .execute(&mut *tx)
        .await
        .map_err(|e| integrity(e, "Data integrity conflict."))?
        .rows_affected();
    if n == 0 && screen == Screen::Companies {
        return Err(missing("삭제할 고객사가 없습니다."));
    }
    if n == 0 && screen == Screen::Managers {
        return Err(missing("삭제할 매핑이 없습니다."));
    }
    tx.commit().await?;
    Ok(Json(json!({"deleted_count":n})))
}
#[derive(Deserialize, serde::Serialize)]
pub(super) struct ConfigRow {
    section: String,
    config_key: String,
    config_value: Option<String>,
    sort_order: i32,
}
#[derive(Deserialize)]
pub(super) struct Configs {
    rows: Option<Vec<Option<ConfigRow>>>,
}
impl Validate for Configs {
    fn validate(&self) -> Vec<Violation> {
        let Some(rows) = &self.rows else {
            return vec![Violation::field(
                "notnull",
                "rows",
                "must not be null".into(),
                Value::Null,
            )];
        };
        let mut errors = Vec::new();
        for (i, row) in rows.iter().enumerate() {
            if row.is_none() {
                errors.push(Violation::field(
                    "notnull",
                    &format!("rows[{i}]"),
                    "must not be null".into(),
                    Value::Null,
                ));
            }
        }
        errors
    }
}
pub(super) async fn upsert_configs(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
    Body(v): Body<Configs>,
) -> Reply {
    allow(&s.pool, &u, Screen::Configs, None).await?;
    let mut tx = s.pool.begin().await?;
    sqlx::query("SELECT id FROM mng_infra_masters WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| missing("인프라 마스터를 찾을 수 없습니다."))?;
    for row in v.rows.unwrap_or_default().into_iter().flatten() {
        let existing:Option<i32>=sqlx::query_scalar("SELECT id FROM mng_infra_configs WHERE master_id=$1 AND section=$2 AND config_key=$3 LIMIT 1").bind(id).bind(&row.section).bind(&row.config_key).fetch_optional(&mut *tx).await?;
        if let Some(config) = existing {
            sqlx::query("UPDATE mng_infra_configs SET config_value=$2,sort_order=$3,updated_at=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1").bind(config).bind(row.config_value).bind(row.sort_order).execute(&mut *tx).await?;
        } else {
            sqlx::query("INSERT INTO mng_infra_configs(master_id,section,config_key,config_value,sort_order,created_at,updated_at) VALUES($1,$2,$3,$4,$5,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC')")
                .bind(id).bind(row.section.trim()).bind(row.config_key.trim()).bind(row.config_value).bind(row.sort_order).execute(&mut *tx).await.map_err(|e|integrity(e,"Data integrity conflict."))?;
        }
    }
    let all = read::rows(
        &mut tx,
        Screen::Configs,
        Filter {
            parent: Some(id),
            ..Filter::default()
        },
    )
    .await?;
    let limit = all.len().max(1) as i32;
    tx.commit().await?;
    Ok(Json(list(Screen::Configs, all, 1, limit)))
}
pub(super) async fn delete_config(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Result<StatusCode, ApiError> {
    allow(&s.pool, &u, Screen::Configs, None).await?;
    if sqlx::query("DELETE FROM mng_infra_configs WHERE id=$1")
        .bind(id)
        .execute(&s.pool)
        .await?
        .rows_affected()
        == 0
    {
        return Err(Screen::Configs.not_found());
    }
    Ok(StatusCode::NO_CONTENT)
}
