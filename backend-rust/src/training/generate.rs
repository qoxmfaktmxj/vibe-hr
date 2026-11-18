use super::resources::{Resource, insert, update};
use super::*;
use crate::input::range;
use serde_json::Map;
#[derive(Deserialize)]
pub(super) struct Year {
    year: i32,
}
#[derive(Deserialize)]
pub(super) struct Targets {
    year: i32,
    rule_code: Option<String>,
}
#[derive(Deserialize)]
pub(super) struct Windows {
    year: i32,
    app_count: Option<i32>,
}
#[derive(Deserialize)]
pub(super) struct Cyber {
    upload_ym: Option<String>,
}
impl Validate for Year {
    fn validate(&self) -> Vec<Violation> {
        range("year", self.year.into(), 2000, 2100)
            .into_iter()
            .collect()
    }
}
impl Validate for Targets {
    fn validate(&self) -> Vec<Violation> {
        [
            range("year", self.year.into(), 2000, 2100),
            size("rule_code", self.rule_code.as_deref(), 0, 30),
        ]
        .into_iter()
        .flatten()
        .collect()
    }
}
impl Validate for Windows {
    fn validate(&self) -> Vec<Violation> {
        [
            range("year", self.year.into(), 2000, 2100),
            self.app_count
                .and_then(|v| range("app_count", v.into(), 0, 31)),
        ]
        .into_iter()
        .flatten()
        .collect()
    }
}
impl Validate for Cyber {
    fn validate(&self) -> Vec<Violation> {
        if let Some(s) = &self.upload_ym
            && (s.len() != 6 || !s.bytes().all(|b| b.is_ascii_digit()))
        {
            return vec![Violation::field(
                "pattern",
                "upload_ym",
                "must match \"^\\d{6}$\"".into(),
                json!(s),
            )];
        }
        vec![]
    }
}
pub(super) async fn events(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(v): Body<Year>,
) -> Reply {
    role(&u, false)?;
    run(&s.pool, Job::Events(v.year)).await
}
pub(super) async fn targets(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(v): Body<Targets>,
) -> Reply {
    role(&u, false)?;
    run(&s.pool, Job::Targets(v.year, v.rule_code)).await
}
pub(super) async fn cyber(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(v): Body<Cyber>,
) -> Reply {
    role(&u, false)?;
    run(&s.pool, Job::Cyber(v.upload_ym)).await
}
enum Job {
    Events(i32),
    Targets(i32, Option<String>),
    Cyber(Option<String>),
}
async fn run(pool: &PgPool, job: Job) -> Reply {
    let message = match job {
        Job::Events(_) => "Required events generated.",
        Job::Targets(_, _) => "Required targets generated.",
        Job::Cyber(_) => "Cyber upload results applied.",
    };
    let mut retry = true;
    loop {
        let mut tx = pool.begin().await?;
        let result = match &job {
            Job::Events(year) => make_events(&mut tx, *year).await,
            Job::Targets(year, rule) => make_targets(&mut tx, *year, rule.as_deref()).await,
            Job::Cyber(month) => apply_uploads(&mut tx, month.as_deref()).await,
        };
        match result {
            Ok(processed) => {
                tx.commit().await?;
                return Ok(Json(json!({"processed":processed,"message":message})));
            }
            Err(e)
                if retry
                    && e.as_database_error().and_then(|e| e.code()).as_deref() == Some("23505") =>
            {
                tx.rollback().await?;
                retry = false;
            }
            Err(e) => return Err(e.into()),
        }
    }
}
fn map(v: Value) -> Map<String, Value> {
    v.as_object().expect("object literal").clone()
}
async fn make_events(conn: &mut PgConnection, year: i32) -> Result<i32, sqlx::Error> {
    let rules:Vec<(i32,i32,i32,Option<String>)>=sqlx::query_as("SELECT r.course_id,r.start_month,r.end_month,c.course_name FROM tra_required_rules r LEFT JOIN tra_courses c ON c.id=r.course_id WHERE year=$1 AND r.is_active ORDER BY r.id").bind(year).fetch_all(&mut *conn).await?;
    let mut created = 0;
    for (course, start, end, name) in rules {
        let start = start.clamp(1, 12);
        let end = end.clamp(start, 12);
        let name = name.unwrap_or_else(|| format!("Course-{course}"));
        for m in start..=end {
            let code = format!("{year:04}{m:02}");
            lock(conn, &format!("tra:event:{course}:{code}")).await?;
            if sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT FROM tra_events WHERE course_id=$1 AND event_code=$2)",
            )
            .bind(course)
            .bind(&code)
            .fetch_one(&mut *conn)
            .await?
            {
                continue;
            }
            let first = NaiveDate::from_ymd_opt(year, m as u32, 1).unwrap();
            let end = first
                .checked_add_months(chrono::Months::new(1))
                .unwrap()
                .pred_opt()
                .unwrap();
            insert(conn,Resource::Events,map(json!({"course_id":course,"event_code":code,"event_name":format!("{name}({year:04}-{m:02})"),"status_code":"open","start_date":first,"end_date":end,
               "appl_start_date":format!("{year:04}-01-01"),"appl_end_date":first.pred_opt(),"result_app_skip_yn":true,"max_person":999}))).await?;
            created += 1;
        }
    }
    Ok(created)
}
async fn make_targets(
    conn: &mut PgConnection,
    year: i32,
    code: Option<&str>,
) -> Result<i32, sqlx::Error> {
    let rules:Vec<(i32,i32,String,i32,Option<String>)>=sqlx::query_as("SELECT id,course_id,rule_code,coalesce(entry_month,start_month),edu_level FROM tra_required_rules WHERE year=$1 AND is_active AND ($2::text IS NULL OR rule_code=$2) ORDER BY id")
       .bind(year).bind(code.filter(|s|!s.trim().is_empty())).fetch_all(&mut *conn).await?;
    if rules.is_empty() {
        return Ok(0);
    }
    let employees: Vec<i32> = sqlx::query_scalar(
        "SELECT id FROM hr_employees WHERE employment_status IN ('active','leave') ORDER BY id",
    )
    .fetch_all(&mut *conn)
    .await?;
    let mut created = 0;
    for (rule, course, code, month, level) in rules {
        let month = format!("{year:04}{:02}", month.clamp(1, 12));
        for &employee in &employees {
            lock(
                conn,
                &format!("tra:required-target:{year}:{employee}:{code}:{course}:{month}"),
            )
            .await?;
            let exists:bool=sqlx::query_scalar("SELECT EXISTS(SELECT FROM tra_required_targets WHERE year=$1 AND employee_id=$2 AND rule_code=$3 AND course_id=$4 AND edu_month=$5)")
           .bind(year).bind(employee).bind(&code).bind(course).bind(&month).fetch_one(&mut *conn).await?;
            if !exists {
                insert(conn,Resource::RequiredTargets,map(json!({"year":year,"employee_id":employee,"rule_code":code,"course_id":course,"edu_month":month,"standard_rule_id":rule,"edu_level":level,"completion_status":"pending"}))).await?;
                created += 1;
            }
        }
    }
    Ok(created)
}
pub(super) async fn windows(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(v): Body<Windows>,
) -> Reply {
    role(&u, false)?;
    let mut tx = s.pool.begin().await?;
    lock(&mut tx, &format!("tra:elearning-windows:{}", v.year)).await?;
    for m in 1..=12 {
        let month = format!("{:04}{m:02}", v.year);
        let date = NaiveDate::from_ymd_opt(v.year, m, 1).unwrap();
        let monday =
            date + chrono::Days::new((7 - date.weekday().num_days_from_monday() as u64) % 7);
        let data = map(
            json!({"year_month":month,"start_date":monday,"end_date":monday+chrono::Days::new(4),"app_count":v.app_count.unwrap_or(2)}),
        );
        let id: Option<i32> =
            sqlx::query_scalar("SELECT id FROM tra_elearning_windows WHERE year_month=$1 LIMIT 1")
                .bind(month)
                .fetch_optional(&mut *tx)
                .await?;
        if let Some(id) = id {
            update(&mut tx, Resource::ElearningWindows, id, data).await?;
        } else {
            insert(&mut tx, Resource::ElearningWindows, data).await?;
        }
    }
    tx.commit().await?;
    Ok(Json(
        json!({"processed":12,"message":"E-learning windows generated."}),
    ))
}

async fn apply_uploads(conn: &mut PgConnection, month: Option<&str>) -> Result<i32, sqlx::Error> {
    let ids:Vec<i32>=sqlx::query_scalar("SELECT id FROM tra_cyber_uploads WHERE NOT close_yn AND ($1::text IS NULL OR upload_ym=$1) ORDER BY id").bind(month.filter(|m|!m.trim().is_empty())).fetch_all(&mut *conn).await?;
    let mut processed = 0;
    for id in ids {
        lock(conn, &format!("tra:cyber-upload:{id}")).await?;
        let Some(row): Option<Value> = sqlx::query_scalar(
            "SELECT to_jsonb(u) FROM tra_cyber_uploads u WHERE id=$1 AND NOT close_yn FOR UPDATE",
        )
        .bind(id)
        .fetch_optional(&mut *conn)
        .await?
        else {
            continue;
        };
        let organization = organization_for(conn, &row).await?;
        let course = course_for(conn, &row, organization).await?;
        let event = event_for(conn, &row, organization, course).await?;
        let emp: Option<i32> =
            sqlx::query_scalar("SELECT id FROM hr_employees WHERE employee_no=$1 LIMIT 1")
                .bind(row["employee_no"].as_str())
                .fetch_optional(&mut *conn)
                .await?;
        let mut history = None;
        if let Some(employee) = emp {
            lock(conn, &format!("tra:history:{employee}:{course}:{event}")).await?;
            let existing:Option<i32>=sqlx::query_scalar("SELECT id FROM tra_histories WHERE employee_id=$1 AND course_id=$2 AND event_id=$3 LIMIT 1").bind(employee).bind(course).bind(event).fetch_optional(&mut *conn).await?;
            let fields = map(
                json!({"employee_id":employee,"course_id":course,"event_id":event,"confirm_type":row["confirm_type"],"unconfirm_reason":row["unconfirm_reason"],"app_point":row["reward_hour"],"job_code":row["job_code"],"note":row["note"],"completed_at":row["end_date"]}),
            );
            history = Some(if let Some(id) = existing {
                update(conn, Resource::Histories, id, fields).await?;
                id
            } else {
                insert(conn, Resource::Histories, fields).await?
            });
        }
        let mut patch = map(
            json!({"close_yn":true,"applied_course_id":course,"applied_event_id":event,"applied_history_id":history}),
        );
        if let Some(emp) = emp {
            patch.insert("employee_id".into(), json!(emp));
        }
        update(conn, Resource::CyberUploads, id, patch).await?;
        processed += 1;
    }
    Ok(processed)
}
async fn organization_for(
    conn: &mut PgConnection,
    row: &Value,
) -> Result<Option<i32>, sqlx::Error> {
    let Some(name) = row["organization_name"]
        .as_str()
        .filter(|s| !s.trim().is_empty())
    else {
        return Ok(None);
    };
    lock(conn, &format!("tra:organization-name:{}", name.trim())).await?;
    let id = sqlx::query_scalar("SELECT id FROM tra_organizations WHERE name=$1 LIMIT 1")
        .bind(name)
        .fetch_optional(&mut *conn)
        .await?;
    if id.is_some() {
        return Ok(id);
    }
    Ok(Some(
        insert(
            conn,
            Resource::Organizations,
            map(json!({"name":name,"business_no":row["business_no"]})),
        )
        .await?,
    ))
}
async fn course_for(
    conn: &mut PgConnection,
    row: &Value,
    org: Option<i32>,
) -> Result<i32, sqlx::Error> {
    let name = row["course_name"].as_str().unwrap_or_default();
    lock(conn, &format!("tra:course-name:{}", name.trim())).await?;
    if let Some(id) = sqlx::query_scalar("SELECT id FROM tra_courses WHERE course_name=$1 LIMIT 1")
        .bind(name)
        .fetch_optional(&mut *conn)
        .await?
    {
        return Ok(id);
    }
    insert(conn,Resource::Courses,map(json!({"course_name":name,"in_out_type":row["in_out_type"].as_str().unwrap_or("EXTERNAL"),"branch_code":row["edu_branch_code"],"sub_branch_code":row["edu_sub_branch_code"],
      "method_code":row["method_code"],"organization_id":org,"mandatory_yn":row["mandatory_yn"],"job_code":row["job_code"],"edu_level":row["edu_level"]}))).await
}
async fn event_for(
    conn: &mut PgConnection,
    row: &Value,
    org: Option<i32>,
    course: i32,
) -> Result<i32, sqlx::Error> {
    let code = row["start_date"]
        .as_str()
        .map(|s| s.replace('-', ""))
        .unwrap_or_else(|| format!("{}01", row["upload_ym"].as_str().unwrap_or_default()));
    lock(conn, &format!("tra:event:{course}:{code}")).await?;
    if let Some(id) =
        sqlx::query_scalar("SELECT id FROM tra_events WHERE course_id=$1 AND event_code=$2 LIMIT 1")
            .bind(course)
            .bind(&code)
            .fetch_optional(&mut *conn)
            .await?
    {
        return Ok(id);
    }
    let name = row["event_name"]
        .as_str()
        .map(str::to_owned)
        .unwrap_or_else(|| {
            format!(
                "{}({code})",
                row["course_name"].as_str().unwrap_or_default()
            )
        });
    let mut data = map(
        json!({"course_id":course,"event_code":code,"event_name":name,"status_code":"open","organization_id":org}),
    );
    for field in [
        "place",
        "start_date",
        "end_date",
        "edu_hour",
        "per_expense_amount",
        "real_expense_amount",
        "labor_apply_yn",
        "labor_amount",
    ] {
        data.insert(field.into(), row[field].clone());
    }
    insert(conn, Resource::Events, data).await
}
