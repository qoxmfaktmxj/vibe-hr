use super::*;
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};

const UPLOAD_OVERLAP: &str = "Mapping assignment period overlaps another upload row.";
const EXISTING_OVERLAP: &str = "Mapping assignment period overlaps existing record.";

#[derive(Deserialize, Serialize)]
pub(super) struct UploadRow {
    department_code: String,
    type_code: String,
    item_code: String,
    effective_from: NaiveDate,
    effective_to: Option<NaiveDate>,
}
#[derive(Deserialize)]
pub(super) struct Upload {
    mode: Option<String>,
    rows: Option<Vec<UploadRow>>,
}
impl Validate for Upload {
    fn validate(&self) -> Vec<Violation> {
        let mut errors = Vec::new();
        if let Some(error) = not_blank("mode", self.mode.as_deref()) {
            errors.push(error);
        }
        if self.mode.as_ref().is_some_and(|v| v != "atomic") {
            errors.push(Violation::field(
                "pattern",
                "mode",
                "must match \"atomic\"".into(),
                json!(self.mode),
            ));
        }
        if self.rows.as_ref().is_none_or(Vec::is_empty) {
            errors.push(Violation::field(
                "notempty",
                "rows",
                "must not be empty".into(),
                json!(self.rows),
            ));
        }
        if self.rows.as_ref().is_some_and(|r| r.len() > 1000) {
            errors.push(Violation::field(
                "size",
                "rows",
                "size must be between 0 and 1000".into(),
                json!(self.rows),
            ));
        }
        errors
    }
}
struct Prepared {
    idx: usize,
    dept: i32,
    ty: String,
    item: i32,
    from: NaiveDate,
    to: Option<NaiveDate>,
    existing: Option<i32>,
}
struct Checked {
    rows: Vec<Value>,
    invalid: usize,
    prepared: Vec<Prepared>,
}
impl Checked {
    fn summary(&self) -> Value {
        json!({"rows":self.rows,"valid_count":self.rows.len()-self.invalid,"invalid_count":self.invalid})
    }
    fn rejection(&self) -> ApiError {
        let mut value = self.summary();
        value["message"] = json!("upload validation failed");
        ApiError::with_detail(StatusCode::UNPROCESSABLE_ENTITY, value)
    }
}
pub(super) async fn preview(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(body): Body<Upload>,
) -> Reply {
    action(&s.pool, &u, "/org/type-upload", "upload").await?;
    let mut tx = s.pool.begin().await?;
    let result = check(&mut tx, &body.rows.unwrap_or_default()).await?;
    tx.commit().await?;
    Ok(Json(result.summary()))
}
pub(super) async fn confirm(
    State(s): State<AppState>,
    Extension(u): Extension<CurrentUser>,
    Body(body): Body<Upload>,
) -> Reply {
    action(&s.pool, &u, "/org/type-upload", "upload").await?;
    let rows = body.rows.unwrap_or_default();
    let mut tx = s.pool.begin().await?;
    let initial = check(&mut tx, &rows).await?;
    if initial.invalid > 0 {
        return Err(initial.rejection());
    }
    let groups: BTreeSet<_> = initial
        .prepared
        .iter()
        .map(|p| (p.dept, p.ty.as_str()))
        .collect();
    for (dept, ty) in groups {
        lock_group(&mut tx, dept, ty).await?;
    }
    let mut checked = check(&mut tx, &rows).await?;
    if checked.invalid > 0 {
        return Err(checked.rejection());
    }
    let mut inserted = 0;
    let mut updated = 0;
    for p in &checked.prepared {
        let result = if let Some(id) = p.existing {
            updated += 1;
            sqlx::query("UPDATE org_mapping_assignments SET item_id=$1,effective_to=$2,updated_by=$3,updated_at=transaction_timestamp() WHERE id=$4")
                .bind(p.item).bind(p.to).bind(u.id).bind(id).execute(&mut *tx).await
        } else {
            inserted += 1;
            sqlx::query("INSERT INTO org_mapping_assignments(department_id,type_code,item_id,effective_from,effective_to,created_by,updated_by,created_at,updated_at)
               VALUES($1,$2,$3,$4,$5,$6,$6,transaction_timestamp(),transaction_timestamp())").bind(p.dept).bind(&p.ty).bind(p.item).bind(p.from).bind(p.to).bind(u.id).execute(&mut *tx).await
        };
        if let Err(error) = result {
            if !error
                .as_database_error()
                .and_then(|d| d.code())
                .is_some_and(|c| c.starts_with("23"))
            {
                return Err(error.into());
            }
            checked.invalid = checked.rows.len();
            for row in &mut checked.rows {
                row["valid"] = json!(false);
                row["errors"] = json!([EXISTING_OVERLAP]);
            }
            return Err(checked.rejection());
        }
    }
    tx.commit().await?;
    Ok(Json(
        json!({"inserted_count":inserted,"updated_count":updated}),
    ))
}
fn add(errors: &mut Vec<&'static str>, msg: &'static str) {
    if !errors.contains(&msg) {
        errors.push(msg);
    }
}
async fn check(conn: &mut PgConnection, rows: &[UploadRow]) -> Result<Checked, ApiError> {
    let mut groups: BTreeMap<(i32, String), Vec<usize>> = BTreeMap::new();
    let mut errors = vec![Vec::<&'static str>::new(); rows.len()];
    let mut result = Vec::with_capacity(rows.len());
    let mut prepared = Vec::new();
    for (idx, row) in rows.iter().enumerate() {
        let dept_code = code(&row.department_code)?;
        let ty = code(&row.type_code)?;
        let item_code = code(&row.item_code)?;
        let dept: Option<i32> =
            sqlx::query_scalar("SELECT id FROM org_departments WHERE upper(code)=$1 LIMIT 1")
                .bind(&dept_code)
                .fetch_optional(&mut *conn)
                .await?;
        if dept.is_none() {
            errors[idx].push("Department code not found.")
        }
        let versions:Vec<(i32,bool,NaiveDate,Option<NaiveDate>)>=sqlx::query_as("SELECT id,is_active,effective_from,effective_to FROM org_mapping_type_items WHERE type_code=$1 AND item_code=$2").bind(&ty).bind(&item_code).fetch_all(&mut *conn).await?;
        let candidates: Vec<_> = versions
            .iter()
            .filter(|(_, a, f, t)| {
                *a && row.effective_from >= *f
                    && t.is_none_or(|end| row.effective_to.is_some_and(|v| v <= end))
            })
            .collect();
        if versions.is_empty() {
            errors[idx].push("Mapping item code not found.")
        } else if !versions.iter().any(|v| v.1) {
            errors[idx].push("Mapping item is inactive.")
        } else if candidates.is_empty() {
            errors[idx].push("Mapping assignment item period must contain the assignment period.")
        } else if candidates.len() > 1 {
            errors[idx].push("Mapping item period is ambiguous.")
        }
        if row.effective_to.is_some_and(|to| to < row.effective_from) {
            errors[idx].push("effective_to must be on or after effective_from.")
        }
        result.push(json!({"row_number":idx+1,"normalized":{"department_code":dept_code,"type_code":ty,"item_code":item_code,"effective_from":row.effective_from,"effective_to":row.effective_to}}));
        if let Some(dept) = dept
            && errors[idx].is_empty()
        {
            groups
                .entry((dept, ty.clone()))
                .or_default()
                .push(prepared.len());
            prepared.push(Prepared {
                idx,
                dept,
                ty,
                item: candidates[0].0,
                from: row.effective_from,
                to: row.effective_to,
                existing: None,
            });
        }
    }
    for ((dept, ty), indexes) in groups {
        let stored:Vec<(i32,NaiveDate,Option<NaiveDate>)>=sqlx::query_as("SELECT id,effective_from,effective_to FROM org_mapping_assignments WHERE department_id=$1 AND type_code=$2")
           .bind(dept).bind(ty).fetch_all(&mut *conn).await?;
        let mut periods = Vec::new();
        for &i in &indexes {
            let p = &prepared[i];
            if indexes
                .iter()
                .any(|&j| i != j && prepared[j].from == p.from)
            {
                add(&mut errors[p.idx], UPLOAD_OVERLAP);
            }
            let same: Vec<_> = stored.iter().filter(|r| r.1 == p.from).collect();
            if same.len() > 1 {
                add(&mut errors[p.idx], EXISTING_OVERLAP);
            } else if same.len() == 1 && errors[p.idx].is_empty() {
                prepared[i].existing = Some(same[0].0);
            }
        }
        for &(id, from, to) in &stored {
            if let Some(&i) = indexes.iter().find(|&&i| prepared[i].existing == Some(id)) {
                let p = &prepared[i];
                periods.push((p.from, p.to, Some(p.idx)));
            } else {
                periods.push((from, to, None));
            }
        }
        for i in indexes {
            let p = &prepared[i];
            if !stored.iter().any(|r| r.1 == p.from) {
                periods.push((p.from, p.to, Some(p.idx)));
            }
        }
        for (n, &(from, to, idx)) in periods.iter().enumerate() {
            for &(other, end, idx2) in &periods[n + 1..] {
                if !end.is_some_and(|d| from > d) && !to.is_some_and(|d| other > d) {
                    let msg = if idx.is_some() && idx2.is_some() {
                        UPLOAD_OVERLAP
                    } else {
                        EXISTING_OVERLAP
                    };
                    for i in [idx, idx2].into_iter().flatten() {
                        add(&mut errors[i], msg);
                    }
                }
            }
        }
    }
    let invalid = errors.iter().filter(|e| !e.is_empty()).count();
    for (row, errors) in result.iter_mut().zip(errors) {
        row["valid"] = json!(errors.is_empty());
        row["errors"] = json!(errors);
    }
    Ok(Checked {
        rows: result,
        prepared,
        invalid,
    })
}
