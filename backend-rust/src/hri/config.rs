use super::*;
use std::collections::HashSet;

#[derive(Deserialize)]
pub(super) struct Batch<T> {
    items: Option<Vec<T>>,
    delete_ids: Option<Vec<i32>>,
}
#[derive(Deserialize)]
pub(super) struct Form {
    id: Option<i32>,
    form_code: Option<String>,
    form_name_ko: Option<String>,
    form_name_en: Option<String>,
    module_code: Option<String>,
    is_active: Option<bool>,
    allow_draft: Option<bool>,
    allow_withdraw: Option<bool>,
    requires_receive: Option<bool>,
    default_priority: Option<i32>,
}
#[derive(Deserialize)]
pub(super) struct Template {
    id: Option<i32>,
    template_code: Option<String>,
    template_name: Option<String>,
    scope_type: Option<String>,
    scope_id: Option<String>,
    is_default: Option<bool>,
    is_active: Option<bool>,
    priority: Option<i32>,
    steps: Option<Vec<Step>>,
}

#[derive(Deserialize, sqlx::FromRow)]
pub(super) struct Step {
    #[serde(default)]
    pub step_order: i32,
    pub step_type: Option<String>,
    pub actor_resolve_type: Option<String>,
    pub actor_role_code: Option<String>,
    pub actor_user_id: Option<i32>,
    pub allow_delegate: Option<bool>,
    pub required_action: Option<String>,
}
fn blank_to_none(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|v| !v.is_empty())
}
fn field(
    errors: &mut Vec<Violation>,
    path: String,
    value: Option<&str>,
    max: usize,
    required: bool,
) {
    if required && let Some(e) = input::not_blank(&path, value) {
        errors.push(e);
    }
    if let Some(e) = input::size(&path, value, 0, max) {
        errors.push(e);
    }
}
fn choice(errors: &mut Vec<Violation>, path: String, value: Option<&str>, choices: &str) {
    if let Some(v) = value
        && !choices.split('|').any(|c| c == v)
    {
        errors.push(Violation::field(
            "pattern",
            &path,
            format!("must match \"^({choices})$\""),
            json!(v),
        ));
    }
}
impl Validate for Batch<Form> {
    fn validate(&self) -> Vec<Violation> {
        let mut errors = vec![];
        for (i, r) in self.items.iter().flatten().enumerate() {
            for (k, v, max, required) in [
                ("form_code", &r.form_code, 30, true),
                ("form_name_ko", &r.form_name_ko, 100, true),
                ("form_name_en", &r.form_name_en, 100, false),
                ("module_code", &r.module_code, 30, false),
            ] {
                field(
                    &mut errors,
                    format!("items[{i}].{k}"),
                    v.as_deref(),
                    max,
                    required,
                );
            }
        }
        errors
    }
}
impl Validate for Batch<Template> {
    fn validate(&self) -> Vec<Violation> {
        let mut errors = vec![];
        for (i, r) in self.items.iter().flatten().enumerate() {
            for (k, v, max, required) in [
                ("template_code", &r.template_code, 30, true),
                ("template_name", &r.template_name, 100, true),
                ("scope_id", &r.scope_id, 40, false),
            ] {
                field(
                    &mut errors,
                    format!("items[{i}].{k}"),
                    v.as_deref(),
                    max,
                    required,
                );
            }
            choice(
                &mut errors,
                format!("items[{i}].scope_type"),
                r.scope_type.as_deref(),
                "GLOBAL|COMPANY|DEPT|TEAM|USER",
            );
            for (j, s) in r.steps.iter().flatten().enumerate() {
                let path = format!("items[{i}].steps[{j}]");
                if let Some(e) =
                    input::range(&format!("{path}.step_order"), s.step_order.into(), 1, 99)
                {
                    errors.push(e);
                }
                field(
                    &mut errors,
                    format!("{path}.actor_role_code"),
                    s.actor_role_code.as_deref(),
                    30,
                    false,
                );
                for (k, v, opts) in [
                    ("step_type", &s.step_type, "APPROVAL|RECEIVE|REFERENCE"),
                    (
                        "actor_resolve_type",
                        &s.actor_resolve_type,
                        "ROLE_BASED|USER_FIXED",
                    ),
                    ("required_action", &s.required_action, "APPROVE|RECEIVE"),
                ] {
                    choice(&mut errors, format!("{path}.{k}"), v.as_deref(), opts);
                }
            }
        }
        errors
    }
}
const FORMS: &str =
    "SELECT to_jsonb(f) FROM hri_form_types f ORDER BY module_code,default_priority,id";
const TEMPLATES:&str="SELECT to_jsonb(t)||jsonb_build_object('steps',coalesce((SELECT jsonb_agg(to_jsonb(s)-'template_id' ORDER BY step_order,id)
    FROM hri_approval_line_steps s WHERE template_id=t.id),'[]')) FROM hri_approval_line_templates t ORDER BY scope_type,priority DESC,id";
async fn rows(conn: &mut PgConnection, sql: &'static str) -> Result<Vec<Value>, ApiError> {
    let mut values: Vec<Value> = sqlx::query_scalar(sql).fetch_all(conn).await?;
    for row in &mut values {
        instants(row)?;
        if let Some(steps) = row.get_mut("steps").and_then(Value::as_array_mut) {
            for step in steps {
                instants(step)?;
            }
        }
    }
    Ok(values)
}
pub(super) async fn forms(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
) -> Reply {
    gate(&s.pool, &u, STAFF).await?;
    let rows = rows(&mut *s.pool.acquire().await?, FORMS).await?;
    Ok(Json(json!({"total_count":rows.len(),"items":rows})))
}
pub(super) async fn templates(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
) -> Reply {
    gate(&s.pool, &u, MANAGERS).await?;
    let rows = rows(&mut *s.pool.acquire().await?, TEMPLATES).await?;
    Ok(Json(json!({"total_count":rows.len(),"items":rows})))
}
pub(super) async fn save_forms(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(input): Body<Batch<Form>>,
) -> Reply {
    gate(&s.pool, &u, MANAGERS).await?;
    let mut tx = s.pool.begin().await?;
    let deleted = sqlx::query("DELETE FROM hri_form_types WHERE id=ANY($1)")
        .bind(input.delete_ids.unwrap_or_default())
        .execute(&mut *tx)
        .await?
        .rows_affected();
    let (mut inserted, mut updated) = (0, 0);
    for f in input.items.unwrap_or_default() {
        let id: Option<i32> =
            sqlx::query_scalar("SELECT id FROM hri_form_types WHERE id=$1 FOR UPDATE")
                .bind(f.id.filter(|id| *id > 0))
                .fetch_optional(&mut *tx)
                .await?;
        let code = f.form_code.unwrap().trim().to_uppercase();
        let sql = if id.is_some() {
            updated += 1;
            "UPDATE hri_form_types SET form_code=$1,form_name_ko=$2,form_name_en=$3,module_code=$4,
            is_active=$5,allow_draft=$6,allow_withdraw=$7,requires_receive=$8,default_priority=$9,updated_by=$10,updated_at=timezone('UTC',clock_timestamp()) WHERE id=$11"
        } else {
            let exists: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM hri_form_types WHERE form_code=$1)",
            )
            .bind(&code)
            .fetch_one(&mut *tx)
            .await?;
            if exists {
                return Err(conflict(format!("form_code '{code}' already exists.")));
            }
            inserted += 1;
            "INSERT INTO hri_form_types(form_code,form_name_ko,form_name_en,module_code,is_active,allow_draft,allow_withdraw,requires_receive,
                default_priority,created_by,updated_by,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,timezone('UTC',clock_timestamp()),timezone('UTC',clock_timestamp()))"
        };
        let mut q = sqlx::query(sql)
            .bind(code)
            .bind(f.form_name_ko.unwrap().trim().to_owned())
            .bind(blank_to_none(f.form_name_en.as_deref()))
            .bind(
                f.module_code
                    .as_deref()
                    .unwrap_or("COMMON")
                    .trim()
                    .to_uppercase(),
            )
            .bind(f.is_active.unwrap_or(true))
            .bind(f.allow_draft.unwrap_or(true))
            .bind(f.allow_withdraw.unwrap_or(true))
            .bind(f.requires_receive.unwrap_or(false))
            .bind(f.default_priority.unwrap_or(50))
            .bind(u.id);
        if let Some(id) = id {
            q = q.bind(id);
        }
        q.execute(&mut *tx).await?;
    }
    let values = rows(&mut tx, FORMS).await?;
    tx.commit().await?;
    Ok(Json(
        json!({"items":values,"total_count":values.len(),"inserted_count":inserted,"updated_count":updated,"deleted_count":deleted}),
    ))
}
pub(super) async fn save_templates(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(input): Body<Batch<Template>>,
) -> Reply {
    gate(&s.pool, &u, MANAGERS).await?;
    let mut tx = s.pool.begin().await?;
    let ids = input.delete_ids.unwrap_or_default();
    sqlx::query("DELETE FROM hri_approval_line_steps WHERE template_id=ANY($1)")
        .bind(&ids)
        .execute(&mut *tx)
        .await?;
    let deleted = sqlx::query("DELETE FROM hri_approval_line_templates WHERE id=ANY($1)")
        .bind(ids)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    let (mut inserted, mut updated) = (0, 0);
    for t in input.items.unwrap_or_default() {
        let scope = t
            .scope_type
            .as_deref()
            .unwrap_or("GLOBAL")
            .trim()
            .to_uppercase();
        let scope_id = blank_to_none(t.scope_id.as_deref());
        if scope == "GLOBAL" && scope_id.is_some() {
            return Err(bad("GLOBAL approval templates must not define scope_id."));
        }
        if scope != "GLOBAL" && scope_id.is_none() {
            return Err(bad(format!("{scope} approval templates require scope_id.")));
        }
        let mut steps = t.steps.unwrap_or_default();
        steps.sort_by_key(|s| s.step_order);
        validate_steps(&mut tx, &steps).await?;
        let id: Option<i32> =
            sqlx::query_scalar("SELECT id FROM hri_approval_line_templates WHERE id=$1 FOR UPDATE")
                .bind(t.id.filter(|id| *id > 0))
                .fetch_optional(&mut *tx)
                .await?;
        let code = t.template_code.unwrap().trim().to_uppercase();
        let sql = if id.is_some() {
            updated += 1;
            "UPDATE hri_approval_line_templates SET template_code=$1,template_name=$2,scope_type=$3,scope_id=$4,
            is_default=$5,is_active=$6,priority=$7,updated_at=timezone('UTC',clock_timestamp()) WHERE id=$8 RETURNING id"
        } else {
            let exists: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM hri_approval_line_templates WHERE template_code=$1)",
            )
            .bind(&code)
            .fetch_one(&mut *tx)
            .await?;
            if exists {
                return Err(conflict(format!("template_code '{code}' already exists.")));
            }
            inserted += 1;
            "INSERT INTO hri_approval_line_templates(template_code,template_name,scope_type,scope_id,is_default,is_active,priority,created_at,updated_at)
                VALUES($1,$2,$3,$4,$5,$6,$7,timezone('UTC',clock_timestamp()),timezone('UTC',clock_timestamp())) RETURNING id"
        };
        let mut q = sqlx::query_scalar(sql)
            .bind(code)
            .bind(t.template_name.unwrap().trim().to_owned())
            .bind(scope)
            .bind(scope_id)
            .bind(t.is_default.unwrap_or(false))
            .bind(t.is_active.unwrap_or(true))
            .bind(t.priority.unwrap_or(100));
        if let Some(id) = id {
            q = q.bind(id);
        }
        let template: i32 = q.fetch_one(&mut *tx).await?;
        sqlx::query("DELETE FROM hri_approval_line_steps WHERE template_id=$1")
            .bind(template)
            .execute(&mut *tx)
            .await?;
        for step in steps {
            sqlx::query("INSERT INTO hri_approval_line_steps(template_id,step_order,step_type,actor_resolve_type,actor_role_code,
                actor_user_id,allow_delegate,required_action,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,
                timezone('UTC',statement_timestamp()),timezone('UTC',statement_timestamp()))").bind(template).bind(step.step_order)
                .bind(step.step_type).bind(step.actor_resolve_type).bind(blank_to_none(step.actor_role_code.as_deref()).map(str::to_uppercase))
                .bind(step.actor_user_id).bind(step.allow_delegate.unwrap_or(true)).bind(step.required_action).execute(&mut *tx).await?;
        }
    }
    let values = rows(&mut tx, TEMPLATES).await?;
    tx.commit().await?;
    Ok(Json(
        json!({"items":values,"total_count":values.len(),"inserted_count":inserted,"updated_count":updated,"deleted_count":deleted}),
    ))
}

#[derive(sqlx::FromRow)]
struct Rule {
    resolve_method: String,
    fallback_rule: String,
    position_keywords_json: Option<String>,
}
impl Rule {
    fn words(&self) -> Vec<String> {
        self.position_keywords_json
            .as_deref()
            .and_then(|s| serde_json::from_str::<Vec<Option<String>>>(s).ok())
            .unwrap_or_default()
            .into_iter()
            .flatten()
            .filter(|s| !s.trim().is_empty())
            .collect()
    }
}
async fn rule(conn: &mut PgConnection, role: &str) -> Result<Rule, ApiError> {
    sqlx::query_as("SELECT resolve_method,fallback_rule,position_keywords_json FROM hri_approval_actor_rules WHERE role_code=$1 AND is_active LIMIT 1")
        .bind(role).fetch_optional(conn).await?.ok_or_else(||bad(format!("결재 역할 '{role}'에 대한 설정이 없습니다. HriApprovalActorRule 테이블을 확인하세요.")))
}
async fn validate_steps(conn: &mut PgConnection, steps: &[Step]) -> Result<(), ApiError> {
    if steps.is_empty() {
        return Err(bad("The selected approval template has no steps."));
    }
    let mut orders = HashSet::new();
    let mut receive = false;
    for s in steps {
        if !orders.insert(s.step_order) {
            return Err(bad(format!(
                "Duplicate approval step_order: {}",
                s.step_order
            )));
        }
        let kind = s.step_type.as_deref().unwrap_or("");
        let resolve = s.actor_resolve_type.as_deref().unwrap_or("");
        if !matches!(kind, "APPROVAL" | "RECEIVE" | "REFERENCE") {
            return Err(bad(format!("Invalid approval step_type: {kind}")));
        }
        if !matches!(resolve, "ROLE_BASED" | "USER_FIXED") {
            return Err(bad(format!("Invalid actor_resolve_type: {resolve}")));
        }
        if kind == "RECEIVE" {
            receive = true;
        }
        if receive && kind == "APPROVAL" {
            return Err(bad("APPROVAL steps must precede RECEIVE steps."));
        }
        let expected = if kind == "RECEIVE" {
            "RECEIVE"
        } else {
            "APPROVE"
        };
        if s.required_action.as_deref() != Some(expected) {
            return Err(bad(format!(
                "required_action must be '{expected}' for step_type '{kind}'."
            )));
        }
        let code = blank_to_none(s.actor_role_code.as_deref());
        if resolve == "ROLE_BASED" {
            if s.actor_user_id.is_some() || code.is_none() {
                return Err(bad(
                    "ROLE_BASED steps require actor_role_code and prohibit actor_user_id.",
                ));
            }
            let role = code.unwrap().to_uppercase();
            let r = rule(conn, &role).await?;
            if matches!(r.resolve_method.as_str(), "ORG_CHAIN" | "JOB_POSITION")
                && r.words().is_empty()
            {
                return Err(bad(format!(
                    "역할 '{role}'의 position_keywords 설정이 비어 있습니다."
                )));
            }
        } else {
            let id = s
                .actor_user_id
                .filter(|id| *id > 0)
                .filter(|_| code.is_none())
                .ok_or_else(|| {
                    bad("USER_FIXED steps require actor_user_id and prohibit actor_role_code.")
                })?;
            let exists: bool =
                sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM auth_users WHERE id=$1)")
                    .bind(id)
                    .fetch_one(&mut *conn)
                    .await?;
            if !exists {
                return Err(bad("Fixed approval actor was not found."));
            }
        }
    }
    Ok(())
}
pub(super) async fn select_steps(
    conn: &mut PgConnection,
    form: i32,
    receive: bool,
    today: NaiveDate,
) -> Result<(i32, Vec<Step>), ApiError> {
    let id:i32=sqlx::query_scalar("SELECT id FROM (SELECT t.id,t.priority,1 AS preferred FROM hri_form_type_approval_maps m JOIN hri_approval_line_templates t
         ON t.id=m.template_id AND t.is_active WHERE m.form_type_id=$1 AND m.is_active AND m.effective_from<=$2 AND (m.effective_to IS NULL OR m.effective_to>=$2)
         UNION ALL SELECT id,priority,0 FROM hri_approval_line_templates WHERE is_active AND is_default) candidates
         ORDER BY preferred DESC,priority DESC,id DESC LIMIT 1").bind(form).bind(today).fetch_optional(&mut *conn).await?
        .ok_or_else(||bad("No active approval template is available for this form type."))?;
    let steps:Vec<Step>=sqlx::query_as("SELECT step_order,step_type,actor_resolve_type,actor_role_code,actor_user_id,allow_delegate,required_action
        FROM hri_approval_line_steps WHERE template_id=$1 ORDER BY step_order,id").bind(id).fetch_all(&mut *conn).await?;
    validate_steps(conn, &steps).await?;
    if receive
        != steps
            .iter()
            .any(|s| s.step_type.as_deref() == Some("RECEIVE"))
    {
        return Err(bad(if receive {
            "This form type requires a RECEIVE step in its approval template."
        } else {
            "This form type does not allow RECEIVE steps in its approval template."
        }));
    }
    Ok((id, steps))
}

async fn admin(conn: &mut PgConnection) -> Result<i32, ApiError> {
    sqlx::query_scalar("SELECT ur.user_id FROM auth_user_roles ur JOIN auth_roles r ON r.id=ur.role_id JOIN auth_users u ON u.id=ur.user_id
        WHERE r.code='admin' AND u.is_active ORDER BY CASE WHEN u.login_id='admin' THEN 0 ELSE 1 END,ur.user_id LIMIT 1")
        .fetch_optional(conn).await?.ok_or_else(||bad("No admin user is available for fallback."))
}
pub(super) async fn actor(
    conn: &mut PgConnection,
    requester: i32,
    step: &Step,
) -> Result<i32, ApiError> {
    if step.actor_resolve_type.as_deref() != Some("ROLE_BASED") {
        return if let Some(id) = step.actor_user_id {
            Ok(id)
        } else {
            admin(conn).await
        };
    }
    let code = step.actor_role_code.as_deref().unwrap_or("TEAM_LEADER");
    let rule = rule(conn, code).await?;
    if rule.resolve_method == "FIXED_USER" {
        return admin(conn).await;
    }
    let dept: Option<i32> =
        sqlx::query_scalar("SELECT department_id FROM hr_employees WHERE user_id=$1 LIMIT 1")
            .bind(requester)
            .fetch_optional(&mut *conn)
            .await?;
    let words = rule.words();
    let reason;
    if let Some(id) = dept {
        if words.is_empty() {
            reason = format!("역할 '{code}'의 position_keywords 설정이 비어 있습니다.");
        } else {
            let chain = rule.resolve_method == "ORG_CHAIN";
            let mut departments = vec![id];
            let mut visited = HashSet::from([id]);
            if chain {
                let mut next = id;
                while let Some(parent) = sqlx::query_scalar::<_, Option<i32>>(
                    "SELECT parent_id FROM org_departments WHERE id=$1",
                )
                .bind(next)
                .fetch_optional(&mut *conn)
                .await?
                .flatten()
                {
                    if !visited.insert(parent) {
                        break;
                    }
                    departments.push(parent);
                    next = parent;
                }
            }
            for department in departments {
                for word in &words {
                    let result:Option<i32>=sqlx::query_scalar("SELECT user_id FROM hr_employees WHERE user_id<>$1 AND employment_status='active'
                          AND (NOT $2 OR department_id=$3) AND lower(coalesce(position_title,'')) LIKE lower($4) ORDER BY id LIMIT 1")
                        .bind(requester).bind(chain).bind(department).bind(format!("%{word}%")).fetch_optional(&mut *conn).await?;
                    if let Some(found) = result {
                        return Ok(found);
                    }
                }
            }
            reason = format!(
                "역할 '{code}'에 해당하는 결재자를 찾지 못했습니다 (키워드: [{}]).",
                words.join(", ")
            );
        }
    } else {
        reason = "신청자 사원 정보를 찾을 수 없습니다.".into();
    }
    if matches!(rule.fallback_rule.as_str(), "HR_ADMIN" | "SKIP") {
        admin(conn).await
    } else {
        Err(bad(format!("결재자 resolve 실패 [{code}]: {reason}")))
    }
}
