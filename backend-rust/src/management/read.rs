use super::*;

macro_rules! select_rows {
    ($body:literal) => {concat!("WITH f AS (SELECT $1::int company,$2::text search,$3::text status,$4::text progress,$5::int parent,$6::int id) SELECT to_jsonb(data) FROM (",$body,") data")};
}

pub(super) async fn rows(
    conn: &mut PgConnection,
    screen: Screen,
    f: Filter,
) -> Result<Vec<Value>, ApiError> {
    let sql=match screen{
        Screen::Companies=>select_rows!("SELECT c.id,c.company_code,c.company_name,c.company_group_code,c.company_type,c.management_type,c.representative_company,c.start_date,c.is_active,c.created_at,c.updated_at
          FROM mng_companies c,f WHERE (f.id IS NOT NULL OR c.is_active) AND (f.id IS NULL OR c.id=f.id) AND (f.search IS NULL OR c.company_code ILIKE '%'||f.search||'%' OR c.company_name ILIKE '%'||f.search||'%') ORDER BY c.company_code"),
        Screen::Managers=>select_rows!("SELECT m.id,m.employee_id,u.display_name employee_name,m.company_id,c.company_name,m.start_date,m.end_date,m.note,m.is_active,m.created_at,m.updated_at
          FROM mng_manager_companies m LEFT JOIN mng_companies c ON c.id=m.company_id LEFT JOIN hr_employees e ON e.id=m.employee_id LEFT JOIN auth_users u ON e.user_id=u.id
          WHERE m.is_active ORDER BY u.display_name COLLATE \"C\" NULLS FIRST,m.id"),
        Screen::Requests=>select_rows!("SELECT r.id,r.company_id,c.company_name,r.request_ym,r.request_seq,r.status_code,null::text status_name,r.part_code,null::text part_name,r.requester_name,r.request_content,
          r.manager_employee_id,m.display_name manager_name,r.developer_employee_id,d.display_name developer_name,r.is_paid,r.paid_content,r.has_tax_bill,r.start_ym,r.end_ym,r.dev_start_date,r.dev_end_date,
          r.paid_man_months,r.actual_man_months,r.note,r.created_at,r.updated_at FROM mng_dev_requests r LEFT JOIN mng_companies c ON c.id=r.company_id LEFT JOIN hr_employees em ON em.id=r.manager_employee_id
          LEFT JOIN auth_users m ON m.id=em.user_id LEFT JOIN hr_employees ed ON ed.id=r.developer_employee_id LEFT JOIN auth_users d ON d.id=ed.user_id CROSS JOIN f
          WHERE (f.company IS NULL OR r.company_id=f.company) AND (f.status IS NULL OR r.status_code=f.status) AND (f.id IS NULL OR r.id=f.id) ORDER BY r.id DESC"),
        Screen::Projects=>select_rows!("SELECT p.id,p.project_name,p.company_id,c.company_name,p.part_code,null::text part_name,p.assigned_staff,p.contract_start_date,p.contract_end_date,p.dev_start_date,p.dev_end_date,
          p.inspection_status,null::text inspection_name,p.has_tax_bill,p.actual_man_months,p.contract_amount,p.note,p.created_at,p.updated_at FROM mng_dev_projects p LEFT JOIN mng_companies c ON c.id=p.company_id CROSS JOIN f
          WHERE (f.company IS NULL OR p.company_id=f.company) AND (f.id IS NULL OR p.id=f.id) ORDER BY p.id DESC"),
        Screen::Inquiries=>select_rows!("SELECT i.id,i.company_id,c.company_name,i.inquiry_content,i.hoped_start_date,i.estimated_man_months,i.sales_rep_name,i.client_contact_name,i.progress_code,null::text progress_name,
          i.is_confirmed,i.project_name,i.note,i.created_at,i.updated_at FROM mng_dev_inquiries i LEFT JOIN mng_companies c ON c.id=i.company_id CROSS JOIN f
          WHERE (f.company IS NULL OR i.company_id=f.company) AND (f.progress IS NULL OR i.progress_code=f.progress) AND (f.id IS NULL OR i.id=f.id) ORDER BY i.id DESC"),
        Screen::Contracts=>select_rows!("SELECT c.id,c.employee_id,u.display_name employee_name,e.employee_no,c.start_date,c.end_date,c.total_leave_count,c.extra_leave_count,c.note,c.is_active,c.created_at,c.updated_at
          FROM mng_outsource_contracts c LEFT JOIN hr_employees e ON e.id=c.employee_id LEFT JOIN auth_users u ON u.id=e.user_id CROSS JOIN f WHERE (f.id IS NOT NULL OR c.is_active) AND (f.id IS NULL OR c.id=f.id)
          AND (f.search IS NULL OR strpos(lower(e.employee_no),lower(f.search))>0 OR strpos(lower(u.display_name),lower(f.search))>0) ORDER BY c.id DESC"),
        Screen::Attendances=>select_rows!("SELECT a.id,a.contract_id,a.employee_id,a.attendance_code,null::text attendance_name,a.apply_date,a.status_code,null::text status_name,a.start_date,a.end_date,a.apply_count,a.note,a.created_at,a.updated_at
          FROM mng_outsource_attendances a,f WHERE a.contract_id=f.parent ORDER BY a.start_date DESC"),
        Screen::Masters=>select_rows!("SELECT m.id,m.company_id,c.company_name,m.service_type,null::text service_type_name,m.env_type,m.is_active,m.created_at,m.updated_at FROM mng_infra_masters m LEFT JOIN mng_companies c ON c.id=m.company_id CROSS JOIN f
           WHERE m.is_active AND (f.company IS NULL OR m.company_id=f.company) ORDER BY m.id DESC"),
        Screen::Configs=>select_rows!("SELECT c.id,c.master_id,c.section,c.config_key,c.config_value,c.sort_order,c.created_at,c.updated_at FROM mng_infra_configs c,f WHERE c.master_id=f.parent ORDER BY c.section,c.sort_order"),
        Screen::RequestSummary=>select_rows!("SELECT date_trunc('month',r.request_ym)::date request_ym,count(*) total_count,count(*) FILTER(WHERE r.is_paid) paid_count,
          coalesce(sum(r.paid_man_months),0) paid_man_months_total,coalesce(sum(r.actual_man_months),0) actual_man_months_total FROM mng_dev_requests r,f
          WHERE (f.company IS NULL OR f.company=r.company_id) AND (f.status IS NULL OR f.status=r.status_code) GROUP BY 1 ORDER BY 1 DESC"),
        Screen::StaffProjects=>select_rows!("SELECT p.id project_id,p.project_name,p.company_id,c.company_name,p.assigned_staff,p.contract_start_date,p.contract_end_date,p.dev_start_date,p.dev_end_date,p.actual_man_months,p.contract_amount
          FROM mng_dev_projects p LEFT JOIN mng_companies c ON c.id=p.company_id CROSS JOIN f WHERE (f.company IS NULL OR p.company_id=f.company) ORDER BY p.id DESC"),
        Screen::Revenue=>select_rows!("SELECT date_trunc('month',coalesce(p.contract_end_date,p.dev_end_date,p.contract_start_date,p.dev_start_date,(now() AT TIME ZONE 'UTC')::date))::date AS month,
          count(*) project_count,coalesce(sum(p.contract_amount),0) contract_amount_total,coalesce(sum(p.actual_man_months),0) actual_man_months_total FROM mng_dev_projects p,f WHERE (f.company IS NULL OR p.company_id=f.company) GROUP BY 1 ORDER BY 1 DESC"),
        Screen::AttendanceSummary=>select_rows!("SELECT c.id contract_id,c.employee_id,u.display_name employee_name,e.employee_no,c.start_date,c.end_date,c.total_leave_count+c.extra_leave_count total_count,
          a.used used_count,greatest(c.total_leave_count+c.extra_leave_count-a.used,0) remain_count,c.note FROM mng_outsource_contracts c LEFT JOIN hr_employees e ON e.id=c.employee_id LEFT JOIN auth_users u ON u.id=e.user_id
          LEFT JOIN LATERAL(SELECT coalesce(sum(a.apply_count),0) used FROM mng_outsource_attendances a WHERE a.contract_id=c.id) a ON true WHERE c.is_active ORDER BY c.id DESC"),
    };
    Ok(sqlx::query_scalar(sql)
        .bind(f.company)
        .bind(f.search)
        .bind(f.status)
        .bind(f.progress)
        .bind(f.parent)
        .bind(f.id)
        .fetch_all(conn)
        .await?)
}

pub(super) async fn one(
    conn: &mut PgConnection,
    screen: Screen,
    id: i32,
) -> Result<Value, ApiError> {
    rows(
        conn,
        screen,
        Filter {
            id: Some(id),
            ..Filter::default()
        },
    )
    .await?
    .into_iter()
    .next()
    .ok_or_else(|| screen.not_found())
}
pub(super) async fn dropdown(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
) -> Reply {
    allow(&s.pool, &u, Screen::Companies, None).await?;
    let items:Vec<Value>=sqlx::query_scalar("SELECT jsonb_build_object('id',id,'company_name',company_name) FROM mng_companies WHERE is_active ORDER BY company_name").fetch_all(&s.pool).await?;
    Ok(Json(json!({"companies":items})))
}
pub(super) async fn duplicate(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Params>,
) -> Reply {
    let employee = optional_int(&q, "employee_id")?.ok_or_else(|| absent("employee_id"))?;
    let raw = q.get("start_date").ok_or_else(|| absent("start_date"))?;
    let date: NaiveDate = raw.parse().map_err(|_| {
        param_error(
            "start_date",
            "value_error",
            "Input should be a valid value",
            json!(raw),
        )
    })?;
    let exclude = optional_int(&q, "exclude_contract_id")?.filter(|v| *v != 0);
    allow(&s.pool, &u, Screen::Contracts, None).await?;
    let duplicate:bool=sqlx::query_scalar("SELECT EXISTS (SELECT FROM mng_outsource_contracts WHERE employee_id=$1 AND start_date=$2 AND id IS DISTINCT FROM $3)").bind(employee).bind(date).bind(exclude).fetch_one(&s.pool).await?;
    Ok(Json(json!({"is_duplicate":duplicate})))
}
