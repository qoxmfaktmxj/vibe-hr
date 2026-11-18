use super::*;
use crate::welfare::{HriWelfareProjection, sync_from_hri};
use sqlx::Row;

#[derive(Deserialize)]
pub(super) struct Command {
    request_id: Option<i32>,
    #[serde(default)]
    form_type_id: i32,
    title: Option<String>,
    content_json: Option<Map<String, Value>>,
}
impl Validate for Command {
    fn validate(&self) -> Vec<Violation> {
        let mut issues = vec![];
        if self.form_type_id < 1 {
            issues.push(Violation::field(
                "min",
                "form_type_id",
                "must be greater than or equal to 1".into(),
                json!(self.form_type_id),
            ));
        }
        issues.extend(input::not_blank("title", self.title.as_deref()));
        issues.extend(input::size("title", self.title.as_deref(), 0, 200));
        issues
    }
}
#[derive(Deserialize)]
pub(super) struct Comment {
    comment: Option<String>,
}
impl Validate for Comment {
    fn validate(&self) -> Vec<Violation> {
        input::size("comment", self.comment.as_deref(), 0, 1000)
            .into_iter()
            .collect()
    }
}
#[derive(sqlx::FromRow)]
struct Form {
    form_code: String,
    allow_draft: bool,
    requires_receive: bool,
}
async fn form(conn: &mut PgConnection, id: i32) -> Result<Form, ApiError> {
    sqlx::query_as("SELECT form_code,allow_draft,requires_receive FROM hri_form_types WHERE id=$1 AND is_active").bind(id)
        .fetch_optional(conn).await?.ok_or_else(form_missing)
}
#[derive(sqlx::FromRow)]
struct Master {
    requester_id: i32,
    form_type_id: i32,
    status_code: String,
    current_step_order: Option<i32>,
    content_json: String,
}
async fn lock(conn: &mut PgConnection, id: i32) -> Result<Master, ApiError> {
    sqlx::query_as("SELECT requester_id,form_type_id,status_code,current_step_order,content_json FROM hri_request_masters WHERE id=$1 FOR UPDATE")
        .bind(id).fetch_optional(conn).await?.ok_or_else(missing)
}
async fn history(
    conn: &mut PgConnection,
    id: i32,
    actor: i32,
    action: &str,
    from: Option<&str>,
    to: &str,
    payload: Value,
) -> Result<(), ApiError> {
    sqlx::query("INSERT INTO hri_request_histories(request_id,actor_user_id,event_type,from_status,to_status,event_payload_json,created_at)
       VALUES($1,$2,$3,$4,$5,$6,timezone('UTC',clock_timestamp()))").bind(id).bind(actor).bind(action).bind(from).bind(to).bind(payload.to_string()).execute(conn).await?;
    Ok(())
}
async fn sync_welfare(conn: &mut PgConnection, id: i32) -> Result<(), ApiError> {
    let row=sqlx::query("SELECT r.request_no,r.status_code,r.content_json,r.submitted_at,r.completed_at,r.created_at,r.updated_at,e.id AS employee_id,
         coalesce(e.employee_no,'USER-'||r.requester_id) AS employee_no,coalesce(u.display_name,u.login_id,e.employee_no,'USER-'||r.requester_id) AS employee_name,
         coalesce(d.name,'-') AS department_name FROM hri_request_masters r JOIN hri_form_types f ON f.id=r.form_type_id
         LEFT JOIN hr_employees e ON e.user_id=r.requester_id LEFT JOIN auth_users u ON u.id=r.requester_id
         LEFT JOIN org_departments d ON d.id=coalesce(e.department_id,r.requester_org_id) WHERE r.id=$1 AND f.form_code='WEL_BENEFIT_REQUEST'")
        .bind(id).fetch_optional(&mut *conn).await?;
    let Some(row) = row else {
        return Ok(());
    };
    let v = content(row.try_get("content_json")?);
    let proj = HriWelfareProjection {
        request_no: row.try_get("request_no")?,
        status_code: row.try_get("status_code")?,
        benefit_type_code: Some(v["benefit_type_code"].as_str().unwrap_or_default().into()),
        benefit_type_name: Some(v["benefit_type_name"].as_str().unwrap_or_default().into()),
        requested_amount: v["requested_amount"]
            .as_i64()
            .and_then(|n| n.try_into().ok())
            .unwrap_or(0),
        description: Some(
            v["description"]
                .as_str()
                .or(v["reason"].as_str())
                .unwrap_or("")
                .into(),
        ),
        submitted_at: row.try_get("submitted_at")?,
        completed_at: row.try_get("completed_at")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
        employee_id: row.try_get("employee_id")?,
        employee_no: row.try_get("employee_no")?,
        employee_name: row.try_get("employee_name")?,
        department_name: row.try_get("department_name")?,
    };
    sync_from_hri(conn, &proj).await
}
async fn number(conn: &mut PgConnection, code: &str) -> Result<String, ApiError> {
    let now = Utc::now();
    let month = now.format("%Y%m").to_string();
    let key = format!("{month}:{}", code.to_uppercase());
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(format!("hri:request-counter:{key}"))
        .execute(&mut *conn)
        .await?;
    let seq:i32=sqlx::query_scalar("INSERT INTO hri_request_counters(counter_key,last_seq,updated_at) VALUES($1,1,$2)
        ON CONFLICT(counter_key) DO UPDATE SET last_seq=hri_request_counters.last_seq+1,updated_at=excluded.updated_at RETURNING last_seq")
        .bind(key).bind(now.naive_utc()).fetch_one(conn).await?;
    Ok(format!("HRI-{month}-{seq:06}"))
}
async fn save(
    conn: &mut PgConnection,
    actor: i32,
    c: Command,
    submitting: bool,
) -> Result<i32, ApiError> {
    let f = form(conn, c.form_type_id).await?;
    if !submitting && !f.allow_draft {
        return Err(conflict("Draft is disabled for this form type."));
    }
    let mut value = Value::Object(c.content_json.unwrap_or_default());
    let date = today();
    let policies = detail::Policies::load(conn, c.form_type_id, date).await?;
    let complete = detail::validate(&f.form_code, &mut value, &policies, date, false)?;
    let title = c.title.as_deref().unwrap_or("").trim();
    let (id, prior) = if let Some(id) = c.request_id {
        let r = lock(conn, id).await?;
        if r.requester_id != actor {
            return Err(missing());
        }
        if !editable(&r.status_code) {
            return Err(conflict(format!(
                "Cannot edit request in status '{}'.",
                r.status_code
            )));
        }
        sqlx::query("UPDATE hri_request_masters SET form_type_id=$2,title=$3,content_json=$4,status_code='DRAFT',current_step_order=null,
            updated_at=timezone('UTC',clock_timestamp()) WHERE id=$1").bind(id).bind(c.form_type_id).bind(title).bind(value.to_string()).execute(&mut *conn).await?;
        (id, Some(r.status_code))
    } else {
        let no = number(conn, &f.form_code).await?;
        let id:i32=sqlx::query_scalar("INSERT INTO hri_request_masters(request_no,form_type_id,requester_id,requester_org_id,
            title,content_json,status_code,created_at,updated_at) VALUES($1,$2,$3,(SELECT department_id FROM hr_employees WHERE user_id=$3 LIMIT 1),
            $4,$5,'DRAFT',timezone('UTC',statement_timestamp()),timezone('UTC',statement_timestamp())) RETURNING id")
            .bind(no).bind(c.form_type_id).bind(actor).bind(title).bind(value.to_string()).fetch_one(&mut *conn).await?;
        (id, None)
    };
    if complete {
        detail::write(conn, &f.form_code, id, &value).await?;
    }
    if let Some(ref prior) = prior {
        history(
            conn,
            id,
            actor,
            "DRAFT_SAVE",
            Some(prior),
            "DRAFT",
            json!({}),
        )
        .await?;
    } else {
        history(
            conn,
            id,
            actor,
            "CREATE",
            None,
            "DRAFT",
            json!({"title":title}),
        )
        .await?;
    }
    sync_welfare(conn, id).await?;
    Ok(id)
}

async fn submit_locked(conn: &mut PgConnection, actor: i32, id: i32) -> Result<Value, ApiError> {
    let r = lock(conn, id).await?;
    if r.requester_id != actor {
        return Err(missing());
    }
    if !editable(&r.status_code) {
        return Err(conflict(format!(
            "Cannot submit request in status '{}'.",
            r.status_code
        )));
    }
    let f = form(conn, r.form_type_id).await?;
    let date = today();
    let policies = detail::Policies::load(conn, r.form_type_id, date).await?;
    let mut value = content(&r.content_json);
    let complete = detail::validate(&f.form_code, &mut value, &policies, date, true)?;
    policies.attachments(conn, id).await?;
    if complete {
        detail::write(conn, &f.form_code, id, &value).await?;
    }
    let mut prior:Vec<Value>=sqlx::query_scalar("SELECT to_jsonb(s)-'request_id' FROM hri_request_step_snapshots s WHERE request_id=$1 ORDER BY step_order,id")
        .bind(id).fetch_all(&mut *conn).await?;
    for step in &mut prior {
        instants(step)?;
    }
    sqlx::query("DELETE FROM hri_request_step_snapshots WHERE request_id=$1")
        .bind(id)
        .execute(&mut *conn)
        .await?;
    let (template, steps) =
        config::select_steps(conn, r.form_type_id, f.requires_receive, date).await?;
    let mut current = None;
    let mut status = "COMPLETED";
    for s in steps {
        let resolved = config::actor(conn, actor, &s).await?;
        let kind = s.step_type.as_deref().unwrap();
        let auto = kind == "REFERENCE";
        if current.is_none() && !auto {
            current = Some(s.step_order);
            status = if kind == "APPROVAL" {
                "APPROVAL_IN_PROGRESS"
            } else {
                "RECEIVE_IN_PROGRESS"
            };
        }
        sqlx::query("INSERT INTO hri_request_step_snapshots(request_id,step_order,step_type,actor_user_id,actor_name,actor_org_id,actor_role_code,
              action_status,acted_at,comment,created_at,updated_at) VALUES($1,$2,$3,$4,coalesce((SELECT coalesce(display_name,login_id)
              FROM auth_users WHERE id=$4),'USER-'||$4::int),(SELECT department_id FROM hr_employees WHERE user_id=$4 LIMIT 1),$5,
              CASE WHEN $6 THEN 'RECEIVED' ELSE 'WAITING' END,CASE WHEN $6 THEN timezone('UTC',statement_timestamp()) END,
              CASE WHEN $6 THEN 'AUTO_REFERENCE' END,timezone('UTC',statement_timestamp()),timezone('UTC',statement_timestamp()))")
            .bind(id).bind(s.step_order).bind(kind).bind(resolved).bind(&s.actor_role_code).bind(auto).execute(&mut *conn).await?;
    }
    sqlx::query("UPDATE hri_request_masters SET content_json=$2,status_code=$3,current_step_order=$4,
        submitted_at=timezone('UTC',statement_timestamp()),completed_at=CASE WHEN $3='COMPLETED' THEN timezone('UTC',statement_timestamp()) END,
        updated_at=timezone('UTC',statement_timestamp()) WHERE id=$1").bind(id).bind(value.to_string()).bind(status).bind(current).execute(&mut *conn).await?;
    let mut payload = json!({"template_id":template,"resubmission":!prior.is_empty()});
    if !prior.is_empty() {
        payload["prior_steps"] = json!(prior);
    }
    history(
        conn,
        id,
        actor,
        "SUBMIT",
        Some(&r.status_code),
        status,
        payload,
    )
    .await?;
    sync_welfare(conn, id).await?;
    Ok(json!({"request_id":id,"status_code":status,"current_step_order":current}))
}
pub(super) async fn draft(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(c): Body<Command>,
) -> Reply {
    gate(&s.pool, &u, STAFF).await?;
    let mut tx = s.pool.begin().await?;
    let id = save(&mut tx, u.id, c, false).await?;
    let r = request_item(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({"request":r})))
}
pub(super) async fn create_submit(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(c): Body<Command>,
) -> Reply {
    gate(&s.pool, &u, STAFF).await?;
    let mut tx = s.pool.begin().await?;
    let id = save(&mut tx, u.id, c, true).await?;
    let r = submit_locked(&mut tx, u.id, id).await?;
    tx.commit().await?;
    Ok(Json(r))
}
pub(super) async fn submit(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    gate(&s.pool, &u, STAFF).await?;
    let mut tx = s.pool.begin().await?;
    let r = submit_locked(&mut tx, u.id, id).await?;
    tx.commit().await?;
    Ok(Json(r))
}

pub(super) async fn withdraw(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    gate(&s.pool, &u, STAFF).await?;
    let mut tx = s.pool.begin().await?;
    let r = lock(&mut tx, id).await?;
    if r.requester_id != u.id {
        return Err(missing());
    }
    if r.status_code != "APPROVAL_IN_PROGRESS" {
        return Err(conflict(format!(
            "Cannot withdraw request in status '{}'.",
            r.status_code
        )));
    }
    let allowed: Option<bool> =
        sqlx::query_scalar("SELECT allow_withdraw FROM hri_form_types WHERE id=$1")
            .bind(r.form_type_id)
            .fetch_optional(&mut *tx)
            .await?;
    if allowed == Some(false) {
        return Err(conflict("Withdraw is disabled for this form type."));
    }
    let now = Utc::now().naive_utc();
    sqlx::query("UPDATE hri_request_masters SET status_code='WITHDRAWN',current_step_order=null,updated_at=$2 WHERE id=$1")
        .bind(id).bind(now).execute(&mut *tx).await?;
    sqlx::query("UPDATE hri_request_step_snapshots SET action_status='REJECTED',acted_at=$2,updated_at=$2,comment='WITHDRAWN_BY_REQUESTER'
        WHERE request_id=$1 AND action_status='WAITING'").bind(id).bind(now).execute(&mut *tx).await?;
    history(
        &mut tx,
        id,
        u.id,
        "WITHDRAW",
        Some(&r.status_code),
        "WITHDRAWN",
        json!({}),
    )
    .await?;
    sync_welfare(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({"request_id":id,"status_code":"WITHDRAWN"})))
}

async fn decide(
    s: &AppState,
    u: &CurrentUser,
    id: i32,
    comment: Option<String>,
    event: &str,
) -> Reply {
    gate(&s.pool, u, STAFF).await?;
    let mut tx = s.pool.begin().await?;
    let r = lock(&mut tx, id).await?;
    let (kind, expected, verb, action) = match event {
        "APPROVE" => (
            "APPROVAL",
            "APPROVAL_IN_PROGRESS",
            "approve request",
            "APPROVED",
        ),
        "REJECT" => (
            "APPROVAL",
            "APPROVAL_IN_PROGRESS",
            "reject request",
            "REJECTED",
        ),
        "RECEIVE_COMPLETE" => (
            "RECEIVE",
            "RECEIVE_IN_PROGRESS",
            "complete receive",
            "RECEIVED",
        ),
        "RECEIVE_REJECT" => (
            "RECEIVE",
            "RECEIVE_IN_PROGRESS",
            "reject receive",
            "REJECTED",
        ),
        _ => unreachable!(),
    };
    if r.status_code != expected {
        return Err(conflict(format!(
            "Cannot {verb} in status '{}'.",
            r.status_code
        )));
    }
    let order = r
        .current_step_order
        .ok_or_else(|| conflict("Current step is not set."))?;
    let step:i32=sqlx::query_scalar("SELECT id FROM hri_request_step_snapshots WHERE request_id=$1 AND step_order=$2 AND actor_user_id=$3
        AND step_type=$4 AND action_status='WAITING' LIMIT 1 FOR UPDATE").bind(id).bind(order).bind(u.id).bind(kind).fetch_optional(&mut *tx).await?
        .ok_or_else(||ApiError::new(StatusCode::FORBIDDEN,"No actionable task for current user."))?;
    let now = Utc::now().naive_utc();
    sqlx::query("UPDATE hri_request_step_snapshots SET action_status=$2,acted_at=$3,updated_at=$3,comment=$4 WHERE id=$1")
        .bind(step).bind(action).bind(now).bind(&comment).execute(&mut *tx).await?;
    let (status, current) = if action == "REJECTED" {
        (
            if kind == "APPROVAL" {
                "APPROVAL_REJECTED"
            } else {
                "RECEIVE_REJECTED"
            },
            None,
        )
    } else {
        let next:Option<(String,i32)>=sqlx::query_as("SELECT step_type,step_order FROM hri_request_step_snapshots
            WHERE request_id=$1 AND action_status='WAITING' AND ((step_order>$2 AND step_type=$3) OR ($3='APPROVAL' AND step_type='RECEIVE'))
            ORDER BY CASE WHEN step_type=$3 THEN 0 ELSE 1 END,step_order,id LIMIT 1").bind(id).bind(order).bind(kind).fetch_optional(&mut *tx).await?;
        match next {
            Some((k, n)) => (
                if k == "APPROVAL" {
                    "APPROVAL_IN_PROGRESS"
                } else {
                    "RECEIVE_IN_PROGRESS"
                },
                Some(n),
            ),
            None => ("COMPLETED", None),
        }
    };
    sqlx::query("UPDATE hri_request_masters SET status_code=$2,current_step_order=$3,updated_at=$4,completed_at=CASE WHEN $2='COMPLETED' THEN $4 ELSE completed_at END WHERE id=$1")
        .bind(id).bind(status).bind(current).bind(now).execute(&mut *tx).await?;
    history(
        &mut tx,
        id,
        u.id,
        event,
        Some(&r.status_code),
        status,
        json!({"comment":comment}),
    )
    .await?;
    sync_welfare(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({"request_id":id,"status_code":status})))
}
macro_rules! action {
    ($name:ident,$event:literal) => {
        pub(super) async fn $name(
            State(s): State<AppState>,
            Extension(u): Extension<CurrentUser>,
            Path(id): Path<i32>,
            Body(c): Body<Comment>,
        ) -> Reply {
            decide(&s, &u, id, c.comment, $event).await
        }
    };
}
action!(approve, "APPROVE");
action!(reject, "REJECT");
action!(receive_complete, "RECEIVE_COMPLETE");
action!(receive_reject, "RECEIVE_REJECT");
