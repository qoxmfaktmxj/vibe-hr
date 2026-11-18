use super::*;
use chrono::NaiveTime;
use std::collections::HashMap;

pub(super) struct Policies(pub HashMap<String, String>);
impl Policies {
    pub async fn load(
        conn: &mut PgConnection,
        form: i32,
        date: NaiveDate,
    ) -> Result<Self, ApiError> {
        let rows:Vec<(String,String)>=sqlx::query_as("SELECT DISTINCT ON (policy_key) policy_key,policy_value FROM hri_form_type_policies
            WHERE form_type_id=$1 AND effective_from<=$2 AND (effective_to IS NULL OR effective_to>=$2)
            ORDER BY policy_key,effective_from DESC,id DESC").bind(form).bind(date).fetch_all(conn).await?;
        Ok(Self(rows.into_iter().collect()))
    }
    fn boolean(&self, key: &str, default: bool) -> Result<bool, ApiError> {
        match self.0.get(key) {
            None => Ok(default),
            Some(v) if v.eq_ignore_ascii_case("true") => Ok(true),
            Some(v) if v.eq_ignore_ascii_case("false") => Ok(false),
            _ => Err(bad(format!("Invalid boolean policy '{key}'."))),
        }
    }
    fn positive(&self, key: &str) -> Result<Option<i32>, ApiError> {
        self.0
            .get(key)
            .filter(|v| !v.trim().is_empty())
            .map(|v| {
                v.parse()
                    .ok()
                    .filter(|n| *n > 0)
                    .ok_or_else(|| bad(format!("Invalid positive integer policy '{key}'.")))
            })
            .transpose()
    }
    pub async fn attachments(&self, conn: &mut PgConnection, id: i32) -> Result<(), ApiError> {
        let count: i64 =
            sqlx::query_scalar("SELECT count(*) FROM hri_request_attachments WHERE request_id=$1")
                .bind(id)
                .fetch_one(conn)
                .await?;
        let issue = if self.boolean("attachment_required", false)? && count == 0 {
            Some((
                "At least one attachment is required for this form type.",
                json!([]),
            ))
        } else if self.0.contains_key("max_attachment_count") {
            let max = self
                .positive("max_attachment_count")?
                .ok_or_else(|| bad("Invalid positive integer policy 'max_attachment_count'."))?;
            (count > i64::from(max)).then_some((
                "Attachment count exceeds max_attachment_count policy.",
                json!(count),
            ))
        } else {
            None
        };
        if let Some((msg, input)) = issue {
            Err(ApiError::with_detail(
                StatusCode::UNPROCESSABLE_ENTITY,
                json!([{"type":"value_error","loc":["body","attachments"],"msg":msg,"input":input}]),
            ))
        } else {
            Ok(())
        }
    }
}

struct Fields<'a> {
    content: &'a mut Value,
    errors: Vec<Value>,
}
impl Fields<'_> {
    fn error(&mut self, key: &str, kind: &str, msg: &str) {
        self.errors.push(json!({"type":kind,"loc":["body","content_json",key],"msg":msg,"input":self.content[key]}));
    }
    fn absent(&mut self, key: &str, required: bool) -> bool {
        let value = &self.content[key];
        let missing = value.is_null() || value.as_str().is_some_and(|s| s.trim().is_empty());
        if missing && required {
            self.error(key, "missing", "Field required");
        }
        missing
    }
    fn text(&mut self, key: &str, max: usize, required: bool) -> bool {
        if self.absent(key, required) {
            if self.content[key].is_string() {
                self.content[key] = json!("");
            }
            return false;
        }
        let Some(text) = self.content[key].as_str() else {
            self.error(key, "string_type", "Input should be a valid string");
            return false;
        };
        if text.encode_utf16().count() > max {
            self.error(
                key,
                "string_too_long",
                &format!("String should have at most {max} characters"),
            );
            return false;
        }
        true
    }
    fn date(&mut self, key: &str, required: bool) -> Option<NaiveDate> {
        if self.absent(key, required) {
            return None;
        }
        let date = self.content[key].as_str().and_then(|s| {
            NaiveDate::parse_from_str(s, "%Y-%m-%d")
                .ok()
                .filter(|d| d.to_string() == s)
        });
        if date.is_none() {
            self.error(
                key,
                "date_from_datetime_parsing",
                "Input should be a valid date in YYYY-MM-DD format",
            );
        }
        date
    }
    fn time(&mut self, key: &str) {
        if self.absent(key, false) {
            if self.content[key].is_string() {
                self.content[key] = json!("");
            }
            return;
        }
        if !self.content[key]
            .as_str()
            .is_some_and(|s| s.len() == 5 && NaiveTime::parse_from_str(s, "%H:%M").is_ok())
        {
            self.error(key, "string_pattern_mismatch", "Input should match HH:mm");
        }
    }
    fn integer(&mut self, key: &str, required: bool) -> bool {
        if self.absent(key, required) {
            return false;
        }
        let raw = &self.content[key];
        let parsed = raw
            .as_i64()
            .and_then(|v| i32::try_from(v).ok())
            .or_else(|| {
                raw.as_str()
                    .filter(|v| !v.starts_with('+'))
                    .and_then(|v| v.parse::<i32>().ok())
            });
        match parsed {
            Some(n) if n >= 1 => {
                self.content[key] = json!(n);
                true
            }
            Some(_) => {
                self.error(
                    key,
                    "greater_than_equal",
                    "Input should be greater than or equal to 1",
                );
                false
            }
            None => {
                self.error(key, "int_parsing", "Input should be a valid integer");
                false
            }
        }
    }
}

pub(super) fn validate(
    code: &str,
    content: &mut Value,
    policies: &Policies,
    today: NaiveDate,
    submit: bool,
) -> Result<bool, ApiError> {
    let mut f = Fields {
        content,
        errors: vec![],
    };
    let complete = match code {
        "TIM_CORRECTION" => {
            let d = f.date("work_date", submit);
            let a = f.text("before_status", 30, submit);
            let b = f.text("after_status", 30, submit);
            f.text("reason", 1000, false);
            d.is_some() && a && b
        }
        "CERT_EMPLOYMENT" => {
            let p = f.text("purpose", 200, submit);
            let n = f.integer("copies", submit);
            f.text("recipient", 200, false);
            f.text("reason", 1000, false);
            p && n
        }
        "LEAVE_REQUEST" => {
            let typ = f.text("leave_type_code", 30, submit);
            let start = f.date("start_date", submit);
            let end = f.date("end_date", submit);
            f.time("start_time");
            f.time("end_time");
            let minutes = f.integer("applied_minutes", submit);
            let reason_required = policies.boolean("require_reason", false)?;
            let reason = f.text("reason", 1000, submit && reason_required);
            if let (Some(start), Some(end)) = (start, end)
                && end < start
            {
                f.error(
                    "end_date",
                    "value_error",
                    "end_date must be on or after start_date",
                );
            }
            if submit
                && let Some(start) = start
                && !policies.boolean("allow_past_date", true)?
                && start < today
            {
                f.error(
                    "start_date",
                    "value_error",
                    "Past dates are not allowed for this form type.",
                );
            }
            let max = policies.positive("max_span_days")?;
            if submit
                && let (Some(n), Some(a), Some(b)) = (max, start, end)
                && (b - a).num_days() + 1 > i64::from(n)
            {
                f.error(
                    "end_date",
                    "value_error",
                    "Date span exceeds max_span_days policy.",
                );
            }
            typ && start.is_some() && end.is_some() && minutes && (!reason_required || reason)
        }
        "WEL_BENEFIT_REQUEST" => {
            let benefit_required = policies.boolean("benefit_type_required", true)?;
            let benefit = f.text("benefit_type_code", 40, submit && benefit_required);
            f.text("benefit_type_name", 100, false);
            let amount = f.integer("requested_amount", submit);
            f.text("description", 500, false);
            let reason_required = policies.boolean("require_reason", false)?;
            let reason = f.text("reason", 1000, submit && reason_required);
            (!benefit_required || benefit) && amount && (!reason_required || reason)
        }
        _ => {
            let required = policies.boolean("require_reason", false)?;
            let reason = f.text("reason", 1000, submit && required);
            !required || reason
        }
    };
    if f.errors.is_empty() {
        Ok(complete)
    } else {
        Err(ApiError::with_detail(
            StatusCode::UNPROCESSABLE_ENTITY,
            json!(f.errors),
        ))
    }
}

pub(super) async fn write(
    conn: &mut PgConnection,
    code: &str,
    id: i32,
    v: &Value,
) -> Result<(), ApiError> {
    // Update existing details without allocating a sequence number on every resubmission.
    let (table, columns): (&str, &[&str]) = match code {
        "TIM_CORRECTION" => (
            "hri_req_tim_correction",
            &["work_date", "before_status", "after_status", "reason"],
        ),
        "CERT_EMPLOYMENT" => (
            "hri_req_cert_employment",
            &["purpose", "copies", "recipient", "reason"],
        ),
        "LEAVE_REQUEST" => (
            "hri_req_leave",
            &[
                "leave_type_code",
                "start_date",
                "end_date",
                "start_time",
                "end_time",
                "applied_minutes",
                "reason",
            ],
        ),
        _ => return Ok(()),
    };
    let current: Option<Value> = sqlx::query_scalar(sqlx::AssertSqlSafe(format!(
        "SELECT to_jsonb(d) FROM {table} d WHERE request_id=$1"
    )))
    .bind(id)
    .fetch_optional(&mut *conn)
    .await?;
    let update = current.is_some();
    let mut fields = current.unwrap_or_else(|| json!({}));
    for &key in columns {
        if let Some(value) = v.get(key) {
            fields[key] = value.clone();
        } else if key == "reason" && code == "TIM_CORRECTION" {
            fields[key] = Value::Null;
        }
    }
    let sql = if update {
        let assignment = columns
            .iter()
            .map(|k| format!("{k}=s.{k}"))
            .collect::<Vec<_>>()
            .join(",");
        format!(
            "UPDATE {table} SET {assignment},updated_at=timezone('UTC',clock_timestamp()) FROM jsonb_populate_record(NULL::{table},$2) s WHERE {table}.request_id=$1"
        )
    } else {
        let cols = columns.join(",");
        format!("INSERT INTO {table}(request_id,{cols},created_at,updated_at) SELECT $1,{cols},timezone('UTC',clock_timestamp()),timezone('UTC',clock_timestamp())
            FROM jsonb_populate_record(NULL::{table},$2) s")
    };
    sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(id)
        .bind(fields)
        .execute(conn)
        .await?;
    Ok(())
}
pub(super) async fn read(
    conn: &mut PgConnection,
    code: &str,
    id: i32,
) -> Result<Option<Value>, ApiError> {
    let sql = match code {
        "TIM_CORRECTION" => {
            "SELECT to_jsonb(d) FROM (SELECT work_date,before_status,after_status,reason FROM hri_req_tim_correction WHERE request_id=$1) d"
        }
        "CERT_EMPLOYMENT" => {
            "SELECT to_jsonb(d) FROM (SELECT purpose,copies,recipient,reason FROM hri_req_cert_employment WHERE request_id=$1) d"
        }
        "LEAVE_REQUEST" => {
            "SELECT to_jsonb(d) FROM (SELECT leave_type_code,start_date,end_date,start_time,end_time,applied_minutes,reason FROM hri_req_leave WHERE request_id=$1) d"
        }
        _ => return Ok(None),
    };
    Ok(sqlx::query_scalar(sql)
        .bind(id)
        .fetch_optional(conn)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    async fn response_detail(error: ApiError) -> Value {
        use axum::response::IntoResponse;
        let response = error.into_response();
        assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
        let body = axum::body::to_bytes(response.into_body(), 8192)
            .await
            .unwrap();
        serde_json::from_slice::<Value>(&body).unwrap()["detail"].take()
    }

    fn day() -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 1, 2).unwrap()
    }
    #[tokio::test]
    async fn incomplete_drafts_and_precise_submit_validation() {
        let no_policy = Policies(HashMap::new());
        assert!(
            !validate(
                "TIM_CORRECTION",
                &mut json!({"before_status":"present"}),
                &no_policy,
                day(),
                false
            )
            .unwrap()
        );
        let invalid = validate(
            "TIM_CORRECTION",
            &mut json!({"work_date":"not-a-date","before_status":"present","after_status":"late"}),
            &no_policy,
            day(),
            true,
        )
        .unwrap_err();
        let invalid = response_detail(invalid).await;

        assert_eq!(
            invalid,
            json!([{"type":"date_from_datetime_parsing","loc":["body","content_json","work_date"],"msg":"Input should be a valid date in YYYY-MM-DD format","input":"not-a-date"}])
        );
        let mut valid = json!({"purpose":"letter","copies":"02"});
        assert!(validate("CERT_EMPLOYMENT", &mut valid, &no_policy, day(), true).unwrap());
        assert_eq!(valid["copies"], 2);
    }
    #[tokio::test]
    async fn leave_and_welfare_policies_collect_all_violations() {
        let policy = Policies(
            [
                ("allow_past_date", "false"),
                ("max_span_days", "31"),
                ("require_reason", "true"),
            ]
            .into_iter()
            .map(|(k, v)| (k.into(), v.into()))
            .collect(),
        );
        let invalid = validate(
            "LEAVE_REQUEST",
            &mut json!({"leave_type_code":"ANNUAL","start_date":"2026-01-01",
            "end_date":"2026-02-15","applied_minutes":480,"reason":""}),
            &policy,
            day(),
            true,
        )
        .unwrap_err();
        let invalid = response_detail(invalid).await;
        assert_eq!(invalid.as_array().unwrap().len(), 3);
        assert_eq!(invalid[0]["loc"], json!(["body", "content_json", "reason"]));
        assert_eq!(
            invalid[1]["msg"],
            "Past dates are not allowed for this form type."
        );
        assert_eq!(invalid[2]["msg"], "Date span exceeds max_span_days policy.");
        let invalid = validate(
            "WEL_BENEFIT_REQUEST",
            &mut json!({"benefit_type_code":"","requested_amount":"not-an-int","reason":""}),
            &policy,
            day(),
            true,
        )
        .unwrap_err();
        let invalid = response_detail(invalid).await;
        assert_eq!(invalid.as_array().unwrap().len(), 3);
        assert_eq!(invalid[1]["type"], "int_parsing");
    }
}
