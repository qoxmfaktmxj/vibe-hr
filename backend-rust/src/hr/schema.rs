use super::forms::{Field as F, FieldKind::*};

pub(super) fn fields(name: &str) -> &'static [F] {
    match name {
        "EmployeeCreate" => {
            const {
                &[
                    F::new("employee_no", Text).size(1, 30),
                    F::new("display_name", Text).required().size(2, 100),
                    F::new("department_id", Integer).required(),
                    F::new("position_title", Text).required().size(1, 80),
                    F::new("hire_date", Date),
                    F::new("employment_status", Text)
                        .required()
                        .default_value("\"active\"")
                        .pattern("^(active|leave|resigned)$"),
                    F::new("login_id", Text).size(4, 50),
                    F::new("email", Text).size(0, 255),
                    F::new("password", Text)
                        .required()
                        .size(4, 128)
                        .pattern(".*\\S.*"),
                ]
            }
        }
        "EmployeeUpdate" => {
            const {
                &[
                    F::new("id", Integer),
                    F::new("display_name", Text).size(2, 100),
                    F::new("department_id", Integer),
                    F::new("position_title", Text).size(1, 80),
                    F::new("hire_date", Date),
                    F::new("employment_status", Text).pattern("^(active|leave|resigned)$"),
                    F::new("email", Text).size(0, 255),
                    F::new("is_active", Bool),
                    F::new("password", Text).size(4, 128),
                ]
            }
        }
        "EmployeeBatch" => {
            const {
                &[
                    F::new("mode", Text)
                        .required()
                        .default_value("\"atomic\"")
                        .pattern("^atomic$"),
                    F::new("insert", Objects("EmployeeCreate"))
                        .required()
                        .default_value("[]"),
                    F::new("update", Objects("EmployeeUpdate"))
                        .required()
                        .default_value("[]"),
                    F::new("delete", IntList)
                        .required()
                        .default_value("[]")
                        .items_required(),
                    F::new("request_id", Text).size(0, 100),
                ]
            }
        }
        "BasicProfileUpdate" => {
            const {
                &[
                    F::new("full_name", Text),
                    F::new("hire_date", Date),
                    F::new("position_title", Text),
                    F::new("gender", Text),
                    F::new("resident_no_masked", Text),
                    F::new("birth_date", Date),
                    F::new("retire_date", Date),
                    F::new("blood_type", Text),
                    F::new("marital_status", Text),
                    F::new("mbti", Text),
                    F::new("probation_end_date", Date),
                    F::new("job_family", Text),
                    F::new("job_role", Text),
                    F::new("grade", Text),
                ]
            }
        }
        "BasicRecordUpdate" => {
            const {
                &[
                    F::new("record_date", Date),
                    F::new("title", Text),
                    F::new("type", Text),
                    F::new("organization", Text),
                    F::new("value", Text),
                    F::new("note", Text),
                ]
            }
        }
        "BasicRecordCreate" => {
            const {
                &[
                    F::new("record_date", Date),
                    F::new("title", Text),
                    F::new("type", Text),
                    F::new("organization", Text),
                    F::new("value", Text),
                    F::new("note", Text),
                    F::new("category", Text).required(),
                ]
            }
        }
        "BasicRecordBatchItem" => {
            const {
                &[
                    F::new("record_date", Date),
                    F::new("title", Text),
                    F::new("type", Text),
                    F::new("organization", Text),
                    F::new("value", Text),
                    F::new("note", Text),
                    F::new("id", Integer).positive(),
                ]
            }
        }
        "BasicRecordBatch" => {
            const {
                &[
                    F::new("category", Text).required(),
                    F::new("items", Objects("BasicRecordBatchItem"))
                        .required()
                        .default_value("[]")
                        .size(0, 500)
                        .items_required(),
                    F::new("delete_ids", IntList)
                        .required()
                        .default_value("[]")
                        .size(0, 500)
                        .positive()
                        .items_required(),
                ]
            }
        }
        "FinalistUpdate" => {
            const {
                &[
                    F::new("source_type", Text).pattern("^(if|manual)$"),
                    F::new("external_key", Text).size(0, 100),
                    F::new("full_name", Text).size(1, 100),
                    F::new("resident_no_masked", Text).size(0, 30),
                    F::new("birth_date", Date),
                    F::new("phone_mobile", Text).size(0, 40),
                    F::new("email", Text).size(0, 320),
                    F::new("hire_type", Text).pattern("^(new|experienced)$"),
                    F::new("career_years", Integer).range(0, 60),
                    F::new("login_id", Text).size(0, 50),
                    F::new("employee_no", Text).size(0, 30),
                    F::new("expected_join_date", Date),
                    F::new("status_code", Text).pattern("^(draft|ready|appointed)$"),
                    F::new("note", Text).size(0, 500),
                    F::new("is_active", Bool),
                ]
            }
        }
        "FinalistCreate" => {
            const {
                &[
                    F::new("source_type", Text)
                        .required()
                        .default_value("\"manual\"")
                        .pattern("^(if|manual)$"),
                    F::new("external_key", Text).size(0, 100),
                    F::new("full_name", Text).required().size(1, 100),
                    F::new("resident_no_masked", Text).size(0, 30),
                    F::new("birth_date", Date),
                    F::new("phone_mobile", Text).size(0, 40),
                    F::new("email", Text).size(0, 320),
                    F::new("hire_type", Text)
                        .required()
                        .default_value("\"new\"")
                        .pattern("^(new|experienced)$"),
                    F::new("career_years", Integer).range(0, 60),
                    F::new("login_id", Text).size(0, 50),
                    F::new("employee_no", Text).size(0, 30),
                    F::new("expected_join_date", Date),
                    F::new("status_code", Text)
                        .required()
                        .default_value("\"draft\"")
                        .pattern("^(draft|ready|appointed)$"),
                    F::new("note", Text).size(0, 500),
                    F::new("is_active", Bool).required().default_value("true"),
                ]
            }
        }
        "Ids" => {
            const {
                &[F::new("ids", IntList)
                    .required()
                    .size(1, i32::MAX as usize)
                    .items_required()]
            }
        }
        "IfRow" => {
            const {
                &[
                    F::new("external_key", Text).required().size(1, 100),
                    F::new("full_name", Text).required().size(1, 100),
                    F::new("hire_type", Text)
                        .required()
                        .default_value("\"new\"")
                        .pattern("^(new|experienced)$"),
                    F::new("phone_mobile", Text).size(0, 40),
                    F::new("email", Text).size(0, 320),
                    F::new("expected_join_date", Date),
                    F::new("note", Text).size(0, 500),
                ]
            }
        }
        "IfSync" => {
            const {
                &[F::new("rows", Objects("IfRow"))
                    .required()
                    .default_value("[]")]
            }
        }
        "AppointmentCodeUpdate" => {
            const {
                &[
                    F::new("code", Text).size(1, 30),
                    F::new("name", Text).size(1, 100),
                    F::new("description", Text),
                    F::new("is_active", Bool),
                    F::new("sort_order", Integer),
                    F::new("mapping_key", Text).size(0, 200),
                    F::new("mapping_value", Text).size(0, 200),
                ]
            }
        }
        "AppointmentCodeCreate" => {
            const {
                &[
                    F::new("code", Text).required().size(1, 30),
                    F::new("name", Text).required().size(1, 100),
                    F::new("description", Text),
                    F::new("is_active", Bool).required().default_value("true"),
                    F::new("sort_order", Integer).required().default_value("0"),
                    F::new("mapping_key", Text).size(0, 200),
                    F::new("mapping_value", Text).size(0, 200),
                ]
            }
        }
        "AppointmentRecordUpdate" => {
            const {
                &[
                    F::new("employee_id", Integer).positive(),
                    F::new("appointment_no", Text).size(0, 30),
                    F::new("order_title", Text).size(1, 120),
                    F::new("order_description", Text).size(0, 500),
                    F::new("effective_date", Date),
                    F::new("order_appointment_code_id", Integer).positive(),
                    F::new("item_appointment_code_id", Integer).positive(),
                    F::new("appointment_kind", Text).size(0, 20),
                    F::new("action_type", Text).size(1, 30),
                    F::new("start_date", Date),
                    F::new("end_date", Date),
                    F::new("to_department_id", Integer).positive(),
                    F::new("to_position_title", Text).size(0, 80),
                    F::new("to_employment_status", Text).size(0, 20),
                    F::new("temporary_reason", Text).size(0, 500),
                    F::new("note", Text).size(0, 500),
                ]
            }
        }
        "AppointmentRecordCreate" => {
            const {
                &[
                    F::new("employee_id", Integer).required().positive(),
                    F::new("appointment_no", Text).size(0, 30),
                    F::new("order_title", Text).required().size(1, 120),
                    F::new("order_description", Text).size(0, 500),
                    F::new("effective_date", Date).required(),
                    F::new("order_appointment_code_id", Integer).positive(),
                    F::new("item_appointment_code_id", Integer).positive(),
                    F::new("appointment_kind", Text)
                        .required()
                        .default_value("\"permanent\"")
                        .size(0, 20),
                    F::new("action_type", Text).required().size(1, 30),
                    F::new("start_date", Date).required(),
                    F::new("end_date", Date),
                    F::new("to_department_id", Integer).positive(),
                    F::new("to_position_title", Text).size(0, 80),
                    F::new("to_employment_status", Text).size(0, 20),
                    F::new("temporary_reason", Text).size(0, 500),
                    F::new("note", Text).size(0, 500),
                ]
            }
        }
        "ChecklistUpdate" => {
            const {
                &[
                    F::new("title", Text),
                    F::new("description", Text),
                    F::new("is_required", Bool),
                    F::new("is_active", Bool),
                    F::new("sort_order", Integer),
                ]
            }
        }
        "ChecklistCreate" => {
            const {
                &[
                    F::new("title", Text).required(),
                    F::new("description", Text),
                    F::new("is_required", Bool).required().default_value("true"),
                    F::new("is_active", Bool).required().default_value("true"),
                    F::new("sort_order", Integer).required().default_value("0"),
                    F::new("code", Text).required(),
                ]
            }
        }
        "RetireCaseCreate" => {
            const {
                &[
                    F::new("employee_id", Integer).required(),
                    F::new("retire_date", Date).required(),
                    F::new("reason", Text),
                ]
            }
        }
        "RetireItemUpdate" => {
            const { &[F::new("is_checked", Bool).required(), F::new("note", Text)] }
        }
        "RetireCancel" => const { &[F::new("cancel_reason", Text)] },
        "SeveranceAdjustment" => {
            const {
                &[
                    F::new("adjustment_amount", Decimal).required(),
                    F::new("adjustment_reason", Text).required().size(1, 500),
                ]
            }
        }
        _ => unreachable!("unknown HR request type"),
    }
}
