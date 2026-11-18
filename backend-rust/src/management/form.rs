use super::*;
use crate::input::{Violation, not_blank, size};
use serde::Serialize;
use serde_json::Map;

#[derive(Deserialize, Serialize)]
struct Company {
    company_code: Option<String>,
    company_name: Option<String>,
    company_group_code: Option<String>,
    company_type: Option<String>,
    management_type: Option<String>,
    representative_company: Option<String>,
    start_date: Option<NaiveDate>,
    is_active: Option<bool>,
}
#[derive(Deserialize, Serialize)]
struct ManagerCompany {
    employee_id: Option<i32>,
    company_id: Option<i32>,
    start_date: Option<NaiveDate>,
    end_date: Option<NaiveDate>,
    note: Option<String>,
}
#[derive(Deserialize, Serialize)]
struct DevRequest {
    company_id: Option<i32>,
    request_ym: Option<NaiveDate>,
    request_seq: Option<i32>,
    status_code: Option<String>,
    part_code: Option<String>,
    requester_name: Option<String>,
    request_content: Option<String>,
    manager_employee_id: Option<i32>,
    developer_employee_id: Option<i32>,
    is_paid: Option<bool>,
    paid_content: Option<String>,
    has_tax_bill: Option<bool>,
    start_ym: Option<NaiveDate>,
    end_ym: Option<NaiveDate>,
    dev_start_date: Option<NaiveDate>,
    dev_end_date: Option<NaiveDate>,
    paid_man_months: Option<f64>,
    actual_man_months: Option<f64>,
    note: Option<String>,
}
#[derive(Deserialize, Serialize)]
struct DevProject {
    project_name: Option<String>,
    company_id: Option<i32>,
    part_code: Option<String>,
    assigned_staff: Option<String>,
    contract_start_date: Option<NaiveDate>,
    contract_end_date: Option<NaiveDate>,
    dev_start_date: Option<NaiveDate>,
    dev_end_date: Option<NaiveDate>,
    inspection_status: Option<String>,
    has_tax_bill: Option<bool>,
    actual_man_months: Option<f64>,
    contract_amount: Option<i32>,
    note: Option<String>,
}
#[derive(Deserialize, Serialize)]
struct DevInquiry {
    company_id: Option<i32>,
    inquiry_content: Option<String>,
    hoped_start_date: Option<NaiveDate>,
    estimated_man_months: Option<f64>,
    sales_rep_name: Option<String>,
    client_contact_name: Option<String>,
    progress_code: Option<String>,
    is_confirmed: Option<bool>,
    project_name: Option<String>,
    note: Option<String>,
}
#[derive(Deserialize, Serialize)]
struct OutsourceContract {
    employee_id: Option<i32>,
    start_date: Option<NaiveDate>,
    end_date: Option<NaiveDate>,
    total_leave_count: Option<f64>,
    extra_leave_count: Option<f64>,
    note: Option<String>,
    is_active: Option<bool>,
}
#[derive(Deserialize, Serialize)]
struct OutsourceAttendance {
    contract_id: Option<i32>,
    employee_id: Option<i32>,
    attendance_code: Option<String>,
    apply_date: Option<NaiveDate>,
    status_code: Option<String>,
    start_date: Option<NaiveDate>,
    end_date: Option<NaiveDate>,
    apply_count: Option<f64>,
    note: Option<String>,
}
#[derive(Deserialize, Serialize)]
struct InfraMaster {
    company_id: Option<i32>,
    service_type: Option<String>,
    env_type: Option<String>,
}

fn typed<T: serde::de::DeserializeOwned + Serialize>(
    raw: &Map<String, Value>,
    allowed: &[&str],
    length: usize,
) -> Result<Map<String, Value>, ApiError> {
    let mut supplied = raw.clone();
    supplied.retain(|key, _| allowed.contains(&key.as_str()));
    let value:T=serde_json::from_value(Value::Object(supplied.clone())).map_err(|_|ApiError::with_detail(StatusCode::UNPROCESSABLE_ENTITY,json!([{"type":"json_invalid","loc":["body",length],"msg":"JSON decode error","input":{}}])))?;
    let Value::Object(mut fields) = json!(value) else {
        unreachable!("typed form is an object")
    };
    fields.retain(|key, _| supplied.contains_key(key));
    Ok(fields)
}
pub(super) fn decode(
    screen: Screen,
    raw: &Map<String, Value>,
    patch: bool,
    length: usize,
) -> Result<Map<String, Value>, ApiError> {
    if screen == Screen::Requests && !patch && raw.get("request_seq").is_none_or(Value::is_null) {
        return Err(ApiError::with_detail(
            StatusCode::UNPROCESSABLE_ENTITY,
            json!([{"type":"json_invalid","loc":["body",length],"msg":"JSON decode error","input":{}}]),
        ));
    }
    let (mut fields, required, bounds): (_, &[&str], &[(&str, usize)]) = match screen {
        Screen::Companies => (
            typed::<Company>(
                raw,
                if patch {
                    &[
                        "company_name",
                        "company_group_code",
                        "company_type",
                        "management_type",
                        "representative_company",
                        "start_date",
                        "is_active",
                    ]
                } else {
                    &[
                        "company_code",
                        "company_name",
                        "company_group_code",
                        "company_type",
                        "management_type",
                        "representative_company",
                        "start_date",
                    ]
                },
                length,
            )?,
            &["company_code", "company_name"],
            &[("company_code", 20), ("company_name", 100)],
        ),
        Screen::Managers => (
            typed::<ManagerCompany>(
                raw,
                &[
                    "employee_id",
                    "company_id",
                    "start_date",
                    "end_date",
                    "note",
                ],
                length,
            )?,
            &["employee_id", "company_id", "start_date"],
            &[],
        ),
        Screen::Requests => (
            typed::<DevRequest>(
                raw,
                if patch {
                    &[
                        "company_id",
                        "request_ym",
                        "status_code",
                        "part_code",
                        "requester_name",
                        "request_content",
                        "manager_employee_id",
                        "developer_employee_id",
                        "is_paid",
                        "paid_content",
                        "has_tax_bill",
                        "start_ym",
                        "end_ym",
                        "dev_start_date",
                        "dev_end_date",
                        "paid_man_months",
                        "actual_man_months",
                        "note",
                    ]
                } else {
                    &[
                        "company_id",
                        "request_ym",
                        "request_seq",
                        "status_code",
                        "part_code",
                        "requester_name",
                        "request_content",
                        "manager_employee_id",
                        "developer_employee_id",
                        "is_paid",
                        "paid_content",
                        "has_tax_bill",
                        "start_ym",
                        "end_ym",
                        "dev_start_date",
                        "dev_end_date",
                        "paid_man_months",
                        "actual_man_months",
                        "note",
                    ]
                },
                length,
            )?,
            &["company_id", "request_ym"],
            &[],
        ),
        Screen::Projects => (
            typed::<DevProject>(
                raw,
                &[
                    "project_name",
                    "company_id",
                    "part_code",
                    "assigned_staff",
                    "contract_start_date",
                    "contract_end_date",
                    "dev_start_date",
                    "dev_end_date",
                    "inspection_status",
                    "has_tax_bill",
                    "actual_man_months",
                    "contract_amount",
                    "note",
                ],
                length,
            )?,
            &["project_name", "company_id"],
            &[("project_name", 200)],
        ),
        Screen::Inquiries => (
            typed::<DevInquiry>(
                raw,
                &[
                    "company_id",
                    "inquiry_content",
                    "hoped_start_date",
                    "estimated_man_months",
                    "sales_rep_name",
                    "client_contact_name",
                    "progress_code",
                    "is_confirmed",
                    "project_name",
                    "note",
                ],
                length,
            )?,
            &["company_id"],
            &[],
        ),
        Screen::Contracts => (
            typed::<OutsourceContract>(
                raw,
                if patch {
                    &[
                        "start_date",
                        "end_date",
                        "total_leave_count",
                        "extra_leave_count",
                        "note",
                        "is_active",
                    ]
                } else {
                    &[
                        "employee_id",
                        "start_date",
                        "end_date",
                        "total_leave_count",
                        "extra_leave_count",
                        "note",
                    ]
                },
                length,
            )?,
            &["employee_id", "start_date", "end_date"],
            &[],
        ),
        Screen::Attendances => (
            typed::<OutsourceAttendance>(
                raw,
                &[
                    "contract_id",
                    "employee_id",
                    "attendance_code",
                    "apply_date",
                    "status_code",
                    "start_date",
                    "end_date",
                    "apply_count",
                    "note",
                ],
                length,
            )?,
            &[
                "contract_id",
                "employee_id",
                "attendance_code",
                "start_date",
                "end_date",
            ],
            &[("attendance_code", 20)],
        ),
        Screen::Masters => (
            typed::<InfraMaster>(raw, &["company_id", "service_type", "env_type"], length)?,
            &["company_id", "service_type", "env_type"],
            &[("service_type", 40), ("env_type", 10)],
        ),
        _ => unreachable!("write screen"),
    };
    let mut errors = Vec::new();
    if !patch {
        for &field in required {
            if bounds.iter().any(|(k, _)| *k == field) {
                if let Some(e) = not_blank(field, fields.get(field).and_then(Value::as_str)) {
                    errors.push(e);
                }
            } else if fields.get(field).is_none_or(Value::is_null) {
                errors.push(Violation::field(
                    "notnull",
                    field,
                    "must not be null".into(),
                    Value::Null,
                ));
            }
        }
    }
    for &(field, max) in bounds {
        if let Some(e) = size(
            field,
            fields.get(field).and_then(Value::as_str),
            usize::from(patch),
            max,
        ) {
            errors.push(e);
        }
    }
    if !errors.is_empty() {
        return Err(ApiError::validation(errors));
    }
    if patch {
        fields.retain(|field, value| {
            !value.is_null()
                || match screen {
                    Screen::Companies => false,
                    Screen::Requests => !["company_id", "request_ym", "is_paid", "has_tax_bill"]
                        .contains(&field.as_str()),
                    Screen::Projects => {
                        !["project_name", "company_id", "has_tax_bill"].contains(&field.as_str())
                    }
                    Screen::Inquiries => !["company_id", "is_confirmed"].contains(&field.as_str()),
                    Screen::Contracts => field == "note",
                    _ => true,
                }
        });
    }
    let trimmed: &[&str] = match screen {
        Screen::Companies => &["company_code", "company_name"],
        Screen::Projects if patch => &[
            "project_name",
            "part_code",
            "assigned_staff",
            "inspection_status",
            "note",
        ],
        Screen::Projects => &["project_name"],
        Screen::Masters => &["service_type", "env_type"],
        _ => &[],
    };
    for key in trimmed {
        if let Some(Value::String(s)) = fields.get_mut(*key) {
            *s = s.trim().to_owned();
        }
    }
    Ok(fields)
}
