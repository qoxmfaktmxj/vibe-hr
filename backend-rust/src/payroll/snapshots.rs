use super::{
    calculation::{Welfare, money},
    *,
};
use chrono::{Months, NaiveDate};
use sqlx::{PgConnection, Row};
use std::collections::HashMap;

#[derive(Clone, Copy)]
pub(super) struct Period {
    pub start: NaiveDate,
    pub end: NaiveDate,
}

impl Period {
    pub fn parse(month: &str) -> Result<Self, ApiError> {
        let error = || {
            ApiError::new(
                StatusCode::BAD_REQUEST,
                "year_month must be YYYY-MM format.",
            )
        };
        let start =
            NaiveDate::parse_from_str(&format!("{month}-01"), "%Y-%m-%d").map_err(|_| error())?;
        if start.format("%Y-%m").to_string() != month {
            return Err(error());
        }
        let end = start
            .checked_add_months(Months::new(1))
            .and_then(|d| d.pred_opt())
            .ok_or_else(error)?;
        Ok(Self { start, end })
    }
}

#[derive(sqlx::FromRow)]
pub(super) struct Target {
    pub employee_id: i32,
    pub profile_id: Option<i32>,
    pub snapshot_json: Value,
}
impl Target {
    pub fn base_salary(&self) -> f64 {
        self.snapshot_json["base_salary"]
            .as_f64()
            .unwrap_or_default()
    }
}
pub(super) async fn targets(conn: &mut PgConnection, id: i32) -> Result<Vec<Target>, ApiError> {
    Ok(sqlx::query_as(
        "SELECT employee_id,profile_id,snapshot_json FROM pay_payroll_run_targets
        WHERE run_id=$1 ORDER BY employee_id,id",
    )
    .bind(id)
    .fetch_all(conn)
    .await?)
}

struct Event<'a> {
    code: &'a str,
    name: &'a str,
    decision: &'a str,
    source: &'a str,
    table: &'a str,
    source_id: i32,
    employee: i32,
    date: NaiveDate,
    payload: &'a Value,
}

async fn save_event(conn: &mut PgConnection, id: i32, e: Event<'_>) -> Result<(), ApiError> {
    sqlx::query("WITH target AS (UPDATE pay_payroll_run_targets SET event_count=event_count+1,
           review_required=review_required OR $7='review',updated_at=timezone('UTC',clock_timestamp())
           WHERE run_id=$1 AND employee_id=$2 RETURNING id)
        INSERT INTO pay_payroll_run_target_events(run_id,employee_id,target_id,event_code,event_name,source_type,
           source_table,decision_code,source_id,effective_date,payload_json,created_at)
        SELECT $1,$2,id,$3,$4,$5,$6,$7,$8,$9,$10,timezone('UTC',clock_timestamp()) FROM target")
        .bind(id).bind(e.employee).bind(e.code).bind(e.name).bind(e.source).bind(e.table)
        .bind(e.decision).bind(e.source_id).bind(e.date).bind(e.payload).execute(conn).await?;
    Ok(())
}

pub(super) async fn materialize(
    conn: &mut PgConnection,
    id: i32,
    month: &str,
    code: i32,
    replace: bool,
) -> Result<(usize, usize), ApiError> {
    let period = Period::parse(month)?;
    if replace {
        sqlx::query("DELETE FROM pay_payroll_run_target_events WHERE run_id=$1")
            .bind(id)
            .execute(&mut *conn)
            .await?;
        sqlx::query("DELETE FROM pay_payroll_run_targets WHERE run_id=$1")
            .bind(id)
            .execute(&mut *conn)
            .await?;
    }
    let rows=sqlx::query("WITH current AS (
        SELECT DISTINCT ON (employee_id) * FROM pay_employee_profiles WHERE payroll_code_id=$1 AND is_active
          AND effective_from<=$3 AND (effective_to IS NULL OR effective_to>=$2)
          ORDER BY employee_id,effective_from DESC,id DESC)
        SELECT to_jsonb(data) AS snapshot FROM (
          SELECT e.id AS employee_id,e.employee_no,u.display_name AS employee_name,e.department_id,d.name AS department_name,
            e.position_title,e.hire_date,e.employment_status,b.retire_date,p.id AS profile_id,p.payroll_code_id,
            p.item_group_id,p.base_salary,p.pay_type_code,p.payment_day_type,p.payment_day_value,p.holiday_adjustment,
            p.effective_from,p.effective_to,$2::date AS period_start,$3::date AS period_end
          FROM current p JOIN hr_employees e ON e.id=p.employee_id LEFT JOIN auth_users u ON u.id=e.user_id
          LEFT JOIN org_departments d ON d.id=e.department_id LEFT JOIN hr_employee_basic_profiles b ON b.employee_id=e.id
          WHERE e.hire_date<=$3 AND (b.retire_date IS NULL OR b.retire_date>=$2) ORDER BY e.id) data")
        .bind(code).bind(period.start).bind(period.end).fetch_all(&mut *conn).await?;
    let mut employees = Vec::with_capacity(rows.len());
    for row in rows {
        let mut snapshot: Value = row.try_get("snapshot")?;
        let employee = snapshot["employee_id"].as_i64().expect("database integer") as i32;
        let profile = snapshot["profile_id"].as_i64().expect("database integer") as i32;
        snapshot["base_salary"] = json!(money(
            snapshot["base_salary"].as_f64().expect("database float")
        ));
        sqlx::query("INSERT INTO pay_payroll_run_targets(run_id,employee_id,profile_id,event_count,review_required,snapshot_json,created_at,updated_at)
            VALUES($1,$2,$3,0,false,$4,timezone('UTC',clock_timestamp()),timezone('UTC',clock_timestamp()))")
            .bind(id).bind(employee).bind(profile).bind(snapshot).execute(&mut *conn).await?;
        employees.push(employee);
    }
    let mut count = appointments(conn, id, &employees, period).await?;
    count += profiles(conn, id, code, &employees, period).await?;
    count += leave_events(conn, id, &employees, period, false).await?;
    let welfare = benefits(conn, &employees, month, false).await?;
    for row in welfare {
        let deduction = row.benefit.deduction;
        let (event, name) = if deduction {
            ("welfare_deduction_approved", "복리후생 공제 승인")
        } else {
            ("welfare_allowance_approved", "복리후생 지급 승인")
        };
        save_event(
            conn,
            id,
            Event {
                code: event,
                name,
                decision: "apply",
                source: "welfare_request",
                table: "wel_benefit_requests",
                source_id: row.id,
                employee: row.employee,
                date: row.effective_date,
                payload: &row.payload,
            },
        )
        .await?;
        count += 1;
    }
    Ok((employees.len(), count))
}

async fn appointments(
    conn: &mut PgConnection,
    id: i32,
    employees: &[i32],
    period: Period,
) -> Result<usize, ApiError> {
    let rows=sqlx::query("SELECT i.id,i.employee_id,i.start_date,to_jsonb(data) payload FROM hr_appointment_order_items i
          JOIN hr_appointment_orders o ON o.id=i.order_id LEFT JOIN org_departments f ON f.id=i.from_department_id
          LEFT JOIN org_departments t ON t.id=i.to_department_id
          CROSS JOIN LATERAL (SELECT o.appointment_no,o.title AS order_title,i.appointment_kind,i.action_type,
            i.from_department_id,f.name AS from_department_name,i.to_department_id,t.name AS to_department_name,
            i.from_position_title,i.to_position_title,i.from_employment_status,i.to_employment_status,i.start_date,i.end_date,
            i.temporary_reason,i.note) data
          WHERE o.status='confirmed' AND i.employee_id=ANY($1) AND i.start_date<=$3 AND (i.end_date IS NULL OR i.end_date>=$2)
          ORDER BY i.employee_id,i.start_date,i.id")
        .bind(employees).bind(period.start).bind(period.end).fetch_all(&mut *conn).await?;
    let mut count = 0;
    for row in rows {
        let payload: Value = row.try_get("payload")?;
        let mut events = vec![("appointment_order_confirmed", "발령 오더 확정", "apply")];
        if !payload["to_department_id"].is_null()
            && payload["to_department_id"] != payload["from_department_id"]
        {
            events.push(("department_changed", "부서 변경", "apply"));
        }
        if !payload["to_position_title"].is_null()
            && payload["to_position_title"] != payload["from_position_title"]
        {
            events.push(("position_changed", "직위 변경", "apply"));
        }
        let action = payload["action_type"]
            .as_str()
            .unwrap_or("")
            .replace(' ', "")
            .trim()
            .to_lowercase();
        let before = payload["from_employment_status"]
            .as_str()
            .unwrap_or("")
            .trim()
            .to_lowercase();
        let after = payload["to_employment_status"]
            .as_str()
            .unwrap_or("")
            .trim()
            .to_lowercase();
        if payload["appointment_kind"] == "temporary" {
            events.push(("temporary_assignment_started", "임시 발령 시작", "review"));
            if !payload["end_date"].is_null() {
                events.push((
                    "temporary_assignment_ended",
                    "임시 발령 종료 예정",
                    "review",
                ));
            }
        }
        if action.contains("입사") {
            events.push(("hire_started", "입사 이벤트", "review"));
        }
        if !after.is_empty() && after != before {
            events.push(if after == "resigned" || action.contains("퇴사") {
                ("resigned", "퇴사 이벤트", "review")
            } else if before == "active" && after == "leave" {
                ("leave_status_started", "휴직 시작", "review")
            } else if before == "leave" && after == "active" {
                ("leave_status_ended", "복직/휴직 종료", "review")
            } else {
                ("employment_status_changed", "고용상태 변경", "apply")
            });
        }
        for (code, name, decision) in events {
            save_event(
                conn,
                id,
                Event {
                    code,
                    name,
                    decision,
                    source: "appointment",
                    table: "hr_appointment_order_items",
                    source_id: row.try_get("id")?,
                    employee: row.try_get("employee_id")?,
                    date: row.try_get("start_date")?,
                    payload: &payload,
                },
            )
            .await?;
            count += 1;
        }
    }
    Ok(count)
}

async fn profiles(
    conn: &mut PgConnection,
    id: i32,
    code: i32,
    employees: &[i32],
    period: Period,
) -> Result<usize, ApiError> {
    let rows=sqlx::query("SELECT p.id,p.employee_id,p.effective_from,to_jsonb(data) props FROM pay_employee_profiles p
        LEFT JOIN pay_item_groups g ON g.id=p.item_group_id CROSS JOIN LATERAL (
          SELECT p.id AS profile_id,p.base_salary,p.item_group_id,g.name AS item_group_name,p.pay_type_code,
                 p.payment_day_type,p.payment_day_value,p.holiday_adjustment,p.effective_to) data
        WHERE p.employee_id=ANY($1) AND p.payroll_code_id=$2 AND p.effective_from<=$3 ORDER BY p.employee_id,p.effective_from,p.id")
        .bind(employees).bind(code).bind(period.end).fetch_all(&mut *conn).await?;
    let mut previous = HashMap::new();
    let mut count = 0;
    for row in rows {
        let employee: i32 = row.try_get("employee_id")?;
        let date: NaiveDate = row.try_get("effective_from")?;
        let mut props: Value = row.try_get("props")?;
        props["base_salary"] = json!(money(
            props["base_salary"].as_f64().expect("database float")
        ));
        let Some(prior) = previous.insert(employee, props.clone()) else {
            continue;
        };
        if date < period.start {
            continue;
        }
        let mut payload =
            json!({"effective_from":date.to_string(),"effective_to":props["effective_to"]});
        for (k, v) in props.as_object().expect("selected row") {
            if k != "effective_to" {
                payload[format!("previous_{k}")] = prior[k].clone();
                payload[format!("current_{k}")] = v.clone();
            }
        }
        for (changed, code, name) in [
            (
                props["base_salary"] != prior["base_salary"],
                "base_salary_changed",
                "기본급 변경",
            ),
            (
                props["item_group_id"] != prior["item_group_id"],
                "pay_item_group_changed",
                "급여항목 그룹 변경",
            ),
            (
                [
                    "payment_day_type",
                    "payment_day_value",
                    "holiday_adjustment",
                ]
                .iter()
                .any(|k| props[k] != prior[k]),
                "payment_schedule_changed",
                "지급기준 변경",
            ),
            (
                props["pay_type_code"] != prior["pay_type_code"],
                "pay_type_changed",
                "급여유형 변경",
            ),
        ] {
            if changed {
                save_event(
                    conn,
                    id,
                    Event {
                        code,
                        name,
                        decision: "review",
                        source: "payroll_profile",
                        table: "pay_employee_profiles",
                        source_id: row.try_get("id")?,
                        employee,
                        date,
                        payload: &payload,
                    },
                )
                .await?;
                count += 1;
            }
        }
    }
    Ok(count)
}

pub(super) async fn leave_events(
    conn: &mut PgConnection,
    id: i32,
    employees: &[i32],
    period: Period,
    sync: bool,
) -> Result<usize, ApiError> {
    if employees.is_empty() {
        return Ok(0);
    }
    let rows=sqlx::query("SELECT l.id,l.employee_id,l.start_date,l.payroll_minutes_snapshot IS NOT NULL AS automatic,
           to_jsonb(data) payload FROM tim_leave_requests l CROSS JOIN LATERAL (
              SELECT l.leave_type,l.start_date,l.end_date,l.reason,l.request_status,l.approved_at,l.decision_comment) data
         WHERE l.employee_id=ANY($1) AND l.start_date<=$3 AND l.end_date>=$2 AND l.request_status='approved'
           AND l.leave_type='unpaid' AND (NOT $4 OR l.payroll_minutes_snapshot IS NOT NULL)
         ORDER BY l.employee_id,l.start_date,l.id")
        .bind(employees).bind(period.start).bind(period.end).bind(sync).fetch_all(&mut *conn).await?;
    let mut existing = HashMap::new();
    if sync {
        let old: Vec<(i32, i32, Option<i32>)> = sqlx::query_as(
            "SELECT id,employee_id,source_id FROM pay_payroll_run_target_events
            WHERE run_id=$1 AND source_type='tim_leave' AND decision_code='apply'",
        )
        .bind(id)
        .fetch_all(&mut *conn)
        .await?;
        for (event_id, employee, source_id) in old {
            existing
                .entry(source_id)
                .or_insert_with(Vec::new)
                .push((event_id, employee));
        }
    }
    let mut count = 0;
    for row in rows {
        let leave_id: i32 = row.try_get("id")?;
        if existing
            .get_mut(&Some(leave_id))
            .and_then(Vec::pop)
            .is_some()
        {
            continue;
        }
        let automatic: bool = row.try_get("automatic")?;
        let mut payload: Value = row.try_get("payload")?;
        if automatic {
            payload["automatic_payroll"] = json!(true);
        }
        save_event(
            conn,
            id,
            Event {
                code: "unpaid_leave_approved",
                name: "무급휴가 승인",
                decision: if automatic { "apply" } else { "review" },
                source: "tim_leave",
                table: "tim_leave_requests",
                source_id: leave_id,
                employee: row.try_get("employee_id")?,
                date: row.try_get("start_date")?,
                payload: &payload,
            },
        )
        .await?;
        count += 1;
    }
    for (event, employee) in existing.into_values().flatten() {
        sqlx::query("DELETE FROM pay_payroll_run_target_events WHERE id=$1")
            .bind(event)
            .execute(&mut *conn)
            .await?;
        sqlx::query("UPDATE pay_payroll_run_targets SET event_count=event_count-1 WHERE run_id=$1 AND employee_id=$2")
            .bind(id).bind(employee).execute(&mut *conn).await?;
    }
    Ok(count)
}

pub(super) struct BenefitEvent {
    id: i32,
    pub employee: i32,
    pub benefit: Welfare,
    effective_date: NaiveDate,
    payload: Value,
}

pub(super) async fn benefits(
    conn: &mut PgConnection,
    employees: &[i32],
    month: &str,
    mark: bool,
) -> Result<Vec<BenefitEvent>, ApiError> {
    let rows=sqlx::query("SELECT r.id,e.id AS employee_id,t.name AS master_name,r.approved_amount::bigint,r.requested_amount::bigint,
         coalesce(r.approved_at,r.requested_at)::date AS effective_date,to_jsonb(data) AS payload
         FROM wel_benefit_requests r JOIN wel_benefit_types t ON t.code=r.benefit_type_code AND t.is_active
         JOIN hr_employees e ON e.employee_no=r.employee_no CROSS JOIN LATERAL (SELECT r.request_no,r.benefit_type_code,
           r.benefit_type_name,t.is_deduction,t.pay_item_code,r.requested_amount,coalesce(nullif(r.approved_amount,0),r.requested_amount) AS approved_amount,
           r.status_code,r.payroll_run_label,r.approved_at,r.description) data
         WHERE e.id=ANY($1) AND length(trim(e.employee_no))>0 AND r.status_code IN ('approved','payroll_reflected')
          AND (r.payroll_run_label LIKE '%'||$2||'%' OR
               (r.payroll_run_label IS NULL AND r.status_code<>'payroll_reflected'
                AND to_char(coalesce(r.approved_at,r.requested_at,r.updated_at,r.created_at),'YYYY-MM')=$2))
         ORDER BY e.employee_no,r.id")
        .bind(employees).bind(month).fetch_all(&mut *conn).await?;
    let mut result = Vec::new();
    for row in rows {
        let id: i32 = row.try_get("id")?;
        let payload: Value = row.try_get("payload")?;
        let string = |k: &str| payload[k].as_str().map(str::to_owned);
        let benefit = Welfare {
            benefit_code: string("benefit_type_code").expect("required benefit code"),
            benefit_name: string("benefit_type_name"),
            master_name: row.try_get("master_name")?,
            pay_item_code: string("pay_item_code"),
            deduction: payload["is_deduction"].as_bool().expect("boolean type"),
            requested: row.try_get("requested_amount")?,
            approved: row.try_get("approved_amount")?,
        };
        result.push(BenefitEvent {
            id,
            employee: row.try_get("employee_id")?,
            benefit,
            effective_date: row.try_get("effective_date")?,
            payload,
        });
        if mark {
            sqlx::query("UPDATE wel_benefit_requests SET payroll_run_label=$2,status_code='payroll_reflected',
                updated_at=timezone('UTC',clock_timestamp()) WHERE id=$1")
                .bind(id).bind(format!("{month} 정기급여")).execute(&mut *conn).await?;
        }
    }
    Ok(result)
}
