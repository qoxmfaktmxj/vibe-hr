use super::*;
#[derive(Deserialize, serde::Serialize)]
struct Row {
    id: Option<i32>,
    appraisal_id: Option<i32>,
    employee_id: Option<i32>,
    score: Option<f64>,
    grade_code: Option<String>,
    evaluator_note: Option<String>,
    status: Option<String>,
    #[serde(rename = "_status")]
    row_status: Option<String>,
    clear_score: Option<bool>,
}
#[derive(Deserialize)]
pub(super) struct TargetBatch {
    items: Option<Vec<Option<Row>>>,
}
impl Validate for TargetBatch {
    fn validate(&self) -> Vec<Violation> {
        let Some(rows) = &self.items else {
            return vec![Violation::field(
                "notnull",
                "items",
                "must not be null".into(),
                Value::Null,
            )];
        };
        let mut errors = Vec::new();
        for (i, row) in rows.iter().enumerate() {
            match row {
                None => errors.push(Violation::field(
                    "notnull",
                    &format!("items[{i}]"),
                    "must not be null".into(),
                    Value::Null,
                )),
                Some(row) => {
                    for (field, v, max) in [
                        ("grade_code", row.grade_code.as_deref(), 30),
                        ("evaluator_note", row.evaluator_note.as_deref(), 2000),
                        ("status", row.status.as_deref(), 20),
                    ] {
                        if let Some(e) = size(&format!("items[{i}].{field}"), v, 0, max) {
                            errors.push(e);
                        }
                    }
                }
            }
        }
        errors
    }
}
pub(super) async fn list(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Query(q): Query<Params>,
) -> Reply {
    let id = q
        .get("appraisal_id")
        .filter(|v| !v.is_empty())
        .map(|v| query_i32("appraisal_id", v))
        .transpose()?;
    role(&u, false)?;
    let rows=sqlx::query_scalar(r#"SELECT to_jsonb(r) FROM(SELECT t.id,t.appraisal_id,a.appraisal_name,t.employee_id,e.employee_no,u.display_name AS employee_name,d.name AS department_name,t.score,t.grade_code,t.evaluator_note,t.status,t.evaluated_at,t.created_at,t.updated_at
      FROM pap_appraisal_targets t LEFT JOIN "PAP_APPRAISAL_MASTERS" a ON a.id=t.appraisal_id LEFT JOIN hr_employees e ON e.id=t.employee_id LEFT JOIN auth_users u ON u.id=e.user_id LEFT JOIN org_departments d ON d.id=e.department_id WHERE ($1::int IS NULL OR t.appraisal_id=$1) ORDER BY t.id) r"#).bind(id).fetch_all(&s.pool).await?;
    let rows: Vec<_> = rows.into_iter().map(projection_dates).collect();
    Ok(Json(json!({"items":rows,"total_count":rows.len()})))
}
pub(super) async fn batch(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(v): Body<TargetBatch>,
) -> Reply {
    role(&u, false)?;
    let rows = v
        .items
        .unwrap_or_default()
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();
    for row in &rows {
        let op = row.row_status.as_deref().unwrap_or("clean");
        if op != "deleted" && (op == "added" || row.id.is_none()) {
            if row.appraisal_id.is_none_or(|n| n <= 0) {
                return Err(ApiError::new(
                    StatusCode::BAD_REQUEST,
                    "신규 평가 대상자의 평가를 선택해주세요.",
                ));
            }
            if row.employee_id.is_none_or(|n| n <= 0) {
                return Err(ApiError::new(
                    StatusCode::BAD_REQUEST,
                    "신규 평가 대상자의 사원을 선택해주세요.",
                ));
            }
        }
    }
    let mut tx = s.pool.begin().await?;
    let mut created = 0;
    let mut updated = 0;
    let mut deleted = 0;
    for row in rows {
        let op = row.row_status.as_deref().unwrap_or("clean");
        if op == "deleted" {
            deleted += sqlx::query("DELETE FROM pap_appraisal_targets WHERE id=$1")
                .bind(row.id)
                .execute(&mut *tx)
                .await?
                .rows_affected();
        } else if op == "added" || row.id.is_none() {
            let status = row.status.as_deref().unwrap_or("pending");
            sqlx::query("INSERT INTO pap_appraisal_targets(appraisal_id,employee_id,score,grade_code,evaluator_note,status,evaluated_at,created_at,updated_at)
                VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $6 IN ('evaluated','finalized') THEN transaction_timestamp() AT TIME ZONE 'UTC' END,transaction_timestamp() AT TIME ZONE 'UTC',transaction_timestamp() AT TIME ZONE 'UTC')")
                .bind(row.appraisal_id).bind(row.employee_id).bind(row.score).bind(row.grade_code).bind(row.evaluator_note).bind(status).execute(&mut *tx).await?;
            created += 1;
        } else if matches!(op, "clean" | "updated") {
            updated+=sqlx::query("UPDATE pap_appraisal_targets SET score=CASE WHEN $2 THEN null ELSE coalesce($3,score) END,grade_code=coalesce($4,grade_code),evaluator_note=coalesce($5,evaluator_note),
                evaluated_at=CASE WHEN $6 IN ('evaluated','finalized') AND status<>$6 THEN transaction_timestamp() AT TIME ZONE 'UTC' ELSE evaluated_at END,status=coalesce($6,status),updated_at=transaction_timestamp() AT TIME ZONE 'UTC' WHERE id=$1")
                .bind(row.id).bind(row.clear_score.unwrap_or(false)).bind(row.score).bind(row.grade_code).bind(row.evaluator_note).bind(row.status).execute(&mut *tx).await?.rows_affected();
        }
    }
    tx.commit().await?;
    Ok(Json(
        json!({"created":created,"updated":updated,"deleted":deleted}),
    ))
}
