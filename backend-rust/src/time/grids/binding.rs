use super::{ApiError, Batch, Grid, NaiveDate, StatusCode, Validate, Value, json};
use axum::body::Bytes;

#[derive(Clone, Copy)]
enum Kind {
    Text,
    Int,
    RequiredInt,
    Decimal,
    Bool,
    Date,
}

fn kind(grid: Grid, key: &str) -> Option<Kind> {
    use Kind::*;
    Some(match (grid, key) {
        (_, "id") => Int,
        (_, "is_active") => Bool,
        (Grid::Attendance | Grid::Work, "code" | "name" | "description") => Text,
        (Grid::Attendance | Grid::Work, "sort_order") => Int,
        (Grid::Attendance, "unit" | "category") => Text,
        (Grid::Attendance, "is_requestable" | "deduct_annual") => Bool,
        (Grid::Attendance, "min_days" | "max_days") => Decimal,
        (Grid::Work, "work_start" | "work_end") => Text,
        (Grid::Work, "break_minutes") => Int,
        (Grid::Work, "work_hours") => Decimal,
        (Grid::Work, "is_overnight") => Bool,
        (Grid::Holiday, "name" | "holiday_type") => Text,
        (Grid::Holiday, "holiday_date") => Date,
        (Grid::Department, "department_id") | (Grid::Employee, "employee_id") => RequiredInt,
        (Grid::Department | Grid::Employee, "pattern_id") => RequiredInt,
        (Grid::Department | Grid::Employee, "effective_from" | "effective_to") => Date,
        (Grid::Department | Grid::Employee, "priority") => Int,
        (Grid::Employee, "reason") => Text,
        _ => return None,
    })
}
fn bind(ty: Kind, v: &Value) -> Option<Value> {
    if v.is_null() {
        return (!matches!(ty, Kind::RequiredInt)).then_some(Value::Null);
    }
    let text = v.as_str().map(str::trim);
    if text == Some("") && !matches!(ty, Kind::Text) {
        return (!matches!(ty, Kind::RequiredInt)).then_some(Value::Null);
    }
    match ty {
        Kind::Text => match v {
            Value::String(_) => Some(v.clone()),
            Value::Bool(_) | Value::Number(_) => Some(json!(v.to_string())),
            _ => None,
        },
        Kind::Int | Kind::RequiredInt => {
            let n = if let Some(s) = text {
                s.parse::<i32>().ok()?
            } else if let Some(n) = v.as_i64() {
                i32::try_from(n).ok()?
            } else {
                let n = v.as_f64()?.trunc();
                if n < f64::from(i32::MIN) || n > f64::from(i32::MAX) {
                    return None;
                }
                n as i32
            };
            Some(json!(n))
        }
        Kind::Decimal => {
            let n = if let Some(s) = text {
                s.parse::<f64>().ok()?
            } else {
                v.as_f64()?
            };
            n.is_finite().then(|| json!(n))
        }
        Kind::Bool => {
            let b = if let Some(b) = v.as_bool() {
                b
            } else if let Some(n) = v.as_i64() {
                n != 0
            } else {
                match text? {
                    "true" | "True" | "TRUE" => true,
                    "false" | "False" | "FALSE" => false,
                    _ => return None,
                }
            };
            Some(json!(b))
        }
        Kind::Date => text?.parse::<NaiveDate>().ok().map(|date| json!(date)),
    }
}
pub(super) fn batch(grid: Grid, bytes: Bytes) -> Result<Batch, ApiError> {
    let malformed = || {
        ApiError::with_detail(
            StatusCode::UNPROCESSABLE_ENTITY,
            json!([{"type":"json_invalid","loc":["body",String::from_utf8_lossy(&bytes).encode_utf16().count()],"msg":"JSON decode error","input":{}}]),
        )
    };
    let mut payload: Batch = serde_json::from_slice(&bytes).map_err(|_| malformed())?;
    for row in payload.items.iter_mut().flatten() {
        let Some(map) = row.as_object_mut() else {
            return Err(malformed());
        };
        // Match the DTO boundary before jsonb_populate_record sees input. The Java DTO ignores
        // unknown properties, including timestamps and irrelevant fields from another grid.
        map.retain(|key, _| kind(grid, key).is_some());
        for (key, value) in map.iter_mut() {
            *value =
                bind(kind(grid, key).expect("known DTO field"), value).ok_or_else(malformed)?;
        }
        for key in ["department_id", "employee_id", "pattern_id"] {
            if matches!(kind(grid, key), Some(Kind::RequiredInt)) && !map.contains_key(key) {
                return Err(malformed());
            }
        }
    }
    let errors = payload.validate();
    if !errors.is_empty() {
        return Err(ApiError::validation(errors));
    }
    Ok(payload)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn typed_grid_rows_preserve_nullability_and_field_types() {
        let body=Bytes::from_static(br#"{"items":[{"department_id":"1","pattern_id":2,"priority":1.8,"effective_from":"2026-01-01","unknown":{"ignore":true}}]}"#);
        let value = batch(Grid::Department, body)
            .unwrap()
            .items
            .unwrap()
            .remove(0);
        assert_eq!(
            value,
            json!({"department_id":1,"pattern_id":2,"priority":1,"effective_from":"2026-01-01"})
        );
        for body in [
            r#"{"items":[{"pattern_id":2}]}"#,
            r#"{"items":[{"department_id":1,"pattern_id":"x"}]}"#,
            r#"{"items":[{"holiday_date":"20260101"}]}"#,
            r#"{"items":[{"is_active":"yes"}]}"#,
        ] {
            let grid = if body.contains("pattern_id") {
                Grid::Department
            } else {
                Grid::Holiday
            };
            assert!(batch(grid, Bytes::copy_from_slice(body.as_bytes())).is_err());
        }
    }
}
