use crate::input::{Validate, Violation};
use chrono::NaiveDate;
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Clone, Copy)]
pub(super) enum FieldKind {
    Text,
    Date,
    Integer,
    Bool,
    Decimal,
    IntList,
    Objects(&'static str),
}
pub(super) struct Field {
    name: &'static str,
    kind: FieldKind,
    required: bool,
    default: Option<&'static str>,
    size: Option<(usize, usize)>,
    range: Option<(i32, i32)>,
    pattern: Option<&'static str>,
    positive: bool,
    items_required: bool,
}
impl Field {
    pub(super) const fn new(name: &'static str, kind: FieldKind) -> Self {
        Self {
            name,
            kind,
            required: false,
            default: None,
            size: None,
            range: None,
            pattern: None,
            positive: false,
            items_required: false,
        }
    }
    pub(super) const fn required(mut self) -> Self {
        self.required = true;
        self
    }
    pub(super) const fn default_value(mut self, v: &'static str) -> Self {
        self.default = Some(v);
        self
    }
    pub(super) const fn size(mut self, min: usize, max: usize) -> Self {
        self.size = Some((min, max));
        self
    }
    pub(super) const fn range(mut self, min: i32, max: i32) -> Self {
        self.range = Some((min, max));
        self
    }
    pub(super) const fn pattern(mut self, pattern: &'static str) -> Self {
        self.pattern = Some(pattern);
        self
    }
    pub(super) const fn positive(mut self) -> Self {
        self.positive = true;
        self
    }
    pub(super) const fn items_required(mut self) -> Self {
        self.items_required = true;
        self
    }
}

// Preserve omitted vs explicit-null properties on update. Jackson coerces simple
// scalar fields before bean validation; malformed types use the shared JSON error.
fn normalize(name: &str, data: &mut Value) -> Result<(), &'static str> {
    let fields = super::schema::fields(name);
    let object = data.as_object_mut().ok_or("expected HR request object")?;
    object.retain(|key, _| fields.iter().any(|f| f.name == key));
    for f in fields {
        if let Some(value) = f.default
            && !object.contains_key(f.name)
        {
            object.insert(
                f.name.into(),
                serde_json::from_str(value).expect("literal default"),
            );
        }
        let Some(v) = object.get_mut(f.name) else {
            continue;
        };
        if v.is_null() {
            continue;
        }
        match f.kind {
            FieldKind::Text if !v.is_string() => {
                if v.is_boolean() || v.is_number() {
                    *v = json!(v.to_string());
                } else {
                    return Err("invalid text");
                }
            }
            FieldKind::Date => {
                if v.as_str().is_some_and(|s| s.trim().is_empty()) {
                    *v = Value::Null;
                } else if !v.as_str().is_some_and(|s| s.parse::<NaiveDate>().is_ok()) {
                    return Err("invalid date");
                }
            }
            FieldKind::Integer => integer(v)?,
            FieldKind::Bool if !v.is_boolean() => {
                *v = match v.as_str().map(str::trim) {
                    Some("") => Value::Null,
                    Some("True" | "true" | "TRUE") => json!(true),
                    Some("False" | "false" | "FALSE") => json!(false),
                    _ if v.is_number() => json!(v.as_i64().ok_or("invalid boolean")? != 0),
                    _ => return Err("invalid boolean"),
                }
            }
            FieldKind::Decimal if !v.is_number() => {
                let s = v.as_str().ok_or("invalid decimal")?.trim();
                *v = if s.is_empty() {
                    Value::Null
                } else {
                    json!(s.parse::<f64>().map_err(|_| "invalid decimal")?)
                };
            }
            FieldKind::IntList | FieldKind::Objects(_) => {
                for item in v.as_array_mut().ok_or("invalid list")? {
                    if item.is_null() {
                        continue;
                    }
                    match f.kind {
                        FieldKind::Objects(child) => normalize(child, item)?,
                        _ => integer(item)?,
                    }
                }
            }
            _ => {}
        }
    }
    Ok(())
}
fn integer(v: &mut Value) -> Result<(), &'static str> {
    if let Some(text) = v.as_str() {
        if text.trim().is_empty() {
            *v = Value::Null;
            return Ok(());
        }
        *v = json!(text.trim().parse::<i32>().map_err(|_| "invalid integer")?);
    } else if let Some(n) = v
        .as_f64()
        .filter(|n| n.trunc() >= f64::from(i32::MIN) && n.trunc() <= f64::from(i32::MAX))
    {
        *v = json!(n as i32);
    } else {
        return Err("invalid integer");
    }
    Ok(())
}
fn check(name: &str, p: &Value, base: &[Value], errors: &mut Vec<Violation>) {
    for f in super::schema::fields(name) {
        let item = &p[f.name];
        let mut loc = base.to_vec();
        loc.push(json!(f.name));
        let mut error = |kind, msg| {
            errors.push(Violation {
                kind,
                loc: loc.clone(),
                msg,
                input: item.clone(),
            })
        };
        if item.is_null() {
            if f.required {
                if p.get(f.name).is_none() {
                    error("missing", "Field required".into());
                } else {
                    let (kind, label) = match f.kind {
                        FieldKind::Text => ("string_type", "string"),
                        FieldKind::Integer => ("int_type", "integer"),
                        FieldKind::Decimal => ("float_type", "number"),
                        FieldKind::Date => ("date_type", "date"),
                        FieldKind::Bool => ("bool_type", "boolean"),
                        _ => ("list_type", "list"),
                    };
                    error(kind, format!("Input should be a valid {label}"));
                }
            }
            continue;
        }
        if let Some((min, max)) = f.size {
            let list = item.is_array();
            let len = item
                .as_array()
                .map(Vec::len)
                .unwrap_or_else(|| item.as_str().map_or(0, |s| s.encode_utf16().count()));
            if len < min {
                if list {
                    error(
                        "too_short",
                        format!("List should have at least {min} item after validation, not {len}"),
                    );
                } else {
                    error(
                        "string_too_short",
                        format!(
                            "String should have at least {min} character{}",
                            if min == 1 { "" } else { "s" }
                        ),
                    );
                }
            } else if len > max {
                if list {
                    error(
                        "too_long",
                        format!("List should have at most {max} items after validation, not {len}"),
                    );
                } else {
                    error(
                        "string_too_long",
                        format!("String should have at most {max} characters"),
                    );
                }
            }
        }
        if let Some(pattern) = f.pattern
            && let Some(text) = item.as_str()
        {
            let pattern_matches = match pattern {
                "^atomic$" => text == "atomic",
                r".*\S.*" => !text.trim().is_empty() && !text.contains(['\n', '\r']),
                other => other
                    .trim_start_matches("^(")
                    .trim_end_matches(")$")
                    .split('|')
                    .any(|s| s == text),
            };
            if !pattern_matches {
                if f.name == "mode" {
                    error("literal_error", "Input should be 'atomic'".into());
                } else {
                    error(
                        "string_pattern_mismatch",
                        format!("String should match pattern '{pattern}'"),
                    );
                }
            }
        }
        if let Some(n) = item.as_i64() {
            if f.positive && n < 1 {
                error("greater_than", "Input should be greater than 0".into());
            }
            if let Some((min, max)) = f.range {
                if n < i64::from(min) {
                    error(
                        "greater_than_equal",
                        format!("Input should be greater than or equal to {min}"),
                    );
                } else if n > i64::from(max) {
                    error(
                        "less_than_equal",
                        format!("Input should be less than or equal to {max}"),
                    );
                }
            }
        }
        if let Some(items) = item.as_array() {
            for (i, v) in items.iter().enumerate() {
                let mut child_loc = loc.clone();
                child_loc.push(json!(i));
                if v.is_null() && f.items_required {
                    errors.push(Violation {
                        kind: "list_type",
                        loc: child_loc,
                        msg: "Input should be a valid list".into(),
                        input: Value::Null,
                    });
                } else if let FieldKind::Objects(child) = f.kind
                    && !v.is_null()
                {
                    check(child, v, &child_loc, errors);
                } else if f.positive && v.as_i64().is_some_and(|n| n <= 0) {
                    errors.push(Violation {
                        kind: "greater_than",
                        loc: child_loc,
                        msg: "Input should be greater than 0".into(),
                        input: v.clone(),
                    });
                }
            }
        }
    }
}

macro_rules! form {
    ($($name:ident),+) => {$(
        #[derive(Deserialize)]
        #[serde(try_from="Value")]
        pub(super) struct $name(pub Value);
        impl TryFrom<Value> for $name {
            type Error=&'static str;
            fn try_from(mut p:Value)->Result<Self,Self::Error>{
                normalize(stringify!($name),&mut p)?;Ok(Self(p))
            }
        }
        impl Validate for $name {
            fn validate(&self)->Vec<Violation>{
                let mut errors=vec![];check(stringify!($name),&self.0,&[json!("body")],&mut errors);errors
            }
        }
    )+};
}

form!(
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeBatch,
    BasicProfileUpdate,
    BasicRecordCreate,
    BasicRecordUpdate,
    BasicRecordBatch,
    FinalistCreate,
    FinalistUpdate,
    Ids,
    IfSync,
    AppointmentCodeCreate,
    AppointmentCodeUpdate,
    AppointmentRecordCreate,
    AppointmentRecordUpdate,
    ChecklistCreate,
    ChecklistUpdate,
    RetireCaseCreate,
    RetireCancel,
    RetireItemUpdate,
    SeveranceAdjustment
);
