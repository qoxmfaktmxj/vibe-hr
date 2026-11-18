use super::forms::{BasicRecordBatch, EmployeeBatch, EmployeeCreate, EmployeeUpdate};
use crate::{
    AppState,
    input::Validate,
    security::{CurrentUser, SecurityState},
};
use axum::{
    Extension, Router,
    body::{Body, to_bytes},
    http::Request,
};
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

#[test]
fn hr_validation_retains_field_presence_and_nested_locations() {
    let missing = EmployeeCreate::try_from(
        json!({"position_title":"Staff","department_id":1,"password":"fixture"}),
    )
    .unwrap()
    .validate();
    assert_eq!(missing.len(), 1);
    assert_eq!(missing[0].kind, "missing");
    assert_eq!(missing[0].loc, vec![json!("body"), json!("display_name")]);
    let null=EmployeeCreate::try_from(json!({"display_name":"Tester","position_title":"Staff","department_id":1,"password":"fixture","employment_status":null})).unwrap().validate();
    assert_eq!(null[0].kind, "string_type");
    let nested = EmployeeBatch::try_from(json!({"update":[{"display_name":"x"}]}))
        .unwrap()
        .validate();
    assert_eq!(nested[0].kind, "string_too_short");
    assert_eq!(
        nested[0].loc,
        vec![
            json!("body"),
            json!("update"),
            json!(0),
            json!("display_name")
        ]
    );
    let changed = EmployeeUpdate::try_from(json!({"position_title":null})).unwrap();
    assert!(changed.0.get("position_title").is_some());
    assert!(changed.0.get("employment_status").is_none());
    let batch = BasicRecordBatch::try_from(
        json!({"category":"careers","items":[{"id":3,"title":"title","note":null}]}),
    )
    .unwrap();
    assert_eq!(batch.0["delete_ids"], json!([]));
    assert_eq!(batch.0["items"][0].get("note"), Some(&Value::Null));
}

async fn request(router: &Router, method: &str, route: &str, payload: Value) -> (u16, Value) {
    let req = Request::builder()
        .method(method)
        .uri(format!("/api/v1{route}"))
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .unwrap();
    let response = router.clone().oneshot(req).await.unwrap();
    let status = response.status().as_u16();
    let bytes = to_bytes(response.into_body(), 2 << 20).await.unwrap();
    (
        status,
        if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes).unwrap()
        },
    )
}
async fn ok(app: &Router, method: &str, route: &str, payload: Value) -> Value {
    let (status, json) = request(app, method, route, payload).await;
    assert!(
        (200..300).contains(&status),
        "{method} {route} {status} {json}"
    );
    json
}

#[tokio::test]
#[ignore = "requires Flyway-migrated, dev/demo seeded isolated hr_test PostgreSQL"]
async fn retirement_and_appointment_concurrency_with_paid_wages() {
    let pool = PgPool::connect(&std::env::var("VIBEHR_HR_TEST_URL").unwrap())
        .await
        .unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT current_database()")
            .fetch_one(&pool)
            .await
            .unwrap(),
        "hr_test"
    );
    let id = sqlx::query_scalar("SELECT id FROM auth_users WHERE login_id='admin-local'")
        .fetch_one(&pool)
        .await
        .unwrap();
    let state = AppState {
        security: SecurityState::new(
            pool.clone(),
            "a1".repeat(32),
            "b2".repeat(32),
            "fixture".into(),
            60,
        )
        .unwrap(),
        app_name: "hr".into(),
        environment: "test".into(),
        pool: pool.clone(),
    };
    let app = super::routes()
        .layer(Extension(CurrentUser {
            id,
            roles: vec!["admin".into()],
        }))
        .with_state(state.clone());
    let employee_id: i32 = sqlx::query_scalar("SELECT id FROM auth_users WHERE login_id='kr-0001'")
        .fetch_one(&pool)
        .await
        .unwrap();
    let ordinary = super::routes()
        .layer(Extension(CurrentUser {
            id: employee_id,
            roles: vec!["employee".into()],
        }))
        .with_state(state);
    assert_eq!(
        request(&ordinary, "GET", "/employees", Value::Null).await.0,
        403
    );
    let fixture = format!("H{}", chrono::Utc::now().timestamp_nanos_opt().unwrap());
    let dep = sqlx::query_scalar::<_, i32>(
        "SELECT id FROM org_departments WHERE is_active ORDER BY id LIMIT 1",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    let employee=ok(&app,"POST","/employees",json!({"display_name":"Regression fixture","employee_no":fixture,"department_id":dep,"position_title":"Staff","hire_date":"2020-01-01","password":"test fixture"})).await;
    let emp = employee["employee"]["id"].as_i64().unwrap() as i32;
    let appointment = |day: &str| json!({"employee_id":emp,"order_title":"발령","action_type":"transfer","effective_date":day,"start_date":day});
    let path = "/hr/appointments/records";
    let first = ok(&app, "POST", path, appointment("2024-01-01")).await["item"].clone();
    let first_id = first["id"].as_i64().unwrap() as i32;
    ok(
        &app,
        "POST",
        &format!("/hr/appointments/orders/{}/confirm", first["order_id"]),
        Value::Null,
    )
    .await;
    assert_eq!(
        request(&app, "POST", path, appointment("2024-01-01"))
            .await
            .0,
        409
    );
    let second = ok(&app, "POST", path, appointment("2024-03-01")).await["item"].clone();
    let confirm = format!("/hr/appointments/orders/{}/confirm", second["order_id"]);
    let (a, b) = tokio::join!(
        request(&app, "POST", &confirm, Value::Null),
        request(&app, "POST", &confirm, Value::Null)
    );
    let mut statuses = [a.0, b.0];
    statuses.sort_unstable();
    assert_eq!(statuses, [200, 409]);
    let ended: String =
        sqlx::query_scalar("SELECT end_date::text FROM hr_appointment_order_items WHERE id=$1")
            .bind(first_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(ended, "2024-02-29");
    let mut tx = pool.begin().await.unwrap();
    let payroll:i32=sqlx::query_scalar("INSERT INTO pay_payroll_codes(code,name,pay_type,payment_day,tax_deductible,social_ins_deductible,is_active,created_at,updated_at)
        VALUES($1,'HR fixture','regular','25',true,true,true,now(),now()) RETURNING id").bind(&fixture).fetch_one(&mut *tx).await.unwrap();
    for month in ["2026-03", "2026-04", "2026-05"] {
        let run:i32=sqlx::query_scalar("INSERT INTO pay_payroll_runs(year_month,payroll_code_id,status,total_employees,total_gross,total_deductions,total_net,created_at,updated_at)
            VALUES($1,$2,'paid',1,9000000,0,9000000,now(),now()) RETURNING id").bind(month).bind(payroll).fetch_one(&mut *tx).await.unwrap();
        let employee:i32=sqlx::query_scalar("INSERT INTO pay_payroll_run_employees(run_id,employee_id,gross_pay,taxable_income,non_taxable_income,total_deductions,net_pay,status,created_at,updated_at)
            VALUES($1,$2,9000000,9000000,0,0,9000000,'paid',now(),now()) RETURNING id").bind(run).bind(emp).fetch_one(&mut *tx).await.unwrap();
        sqlx::query("INSERT INTO pay_payroll_run_items(run_employee_id,item_code,item_name,direction,amount,tax_type,calculation_type,source_type,created_at)
            VALUES($1,$2,'Included fixture wage','earning',9000000,'taxable','fixed','fixture',now())").bind(employee).bind(&fixture).execute(&mut *tx).await.unwrap();
    }
    tx.commit().await.unwrap();
    let mut drafts = vec![];
    for _ in 0..2 {
        let c = ok(
            &app,
            "POST",
            "/hr/retire/cases",
            json!({"employee_id":emp,"retire_date":"2026-05-31"}),
        )
        .await;
        let case = c["id"].as_i64().unwrap();
        for check in c["checklist_items"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|i| i["is_required"] == true)
        {
            ok(
                &app,
                "PUT",
                &format!("/hr/retire/cases/{case}/items/{}", check["id"]),
                json!({"is_checked":true}),
            )
            .await;
        }
        drafts.push(case);
    }
    let url_a = format!("/hr/retire/cases/{}/confirm", drafts[0]);
    let url_b = format!("/hr/retire/cases/{}/confirm", drafts[1]);
    let (a, b) = tokio::join!(
        request(&app, "POST", &url_a, Value::Null),
        request(&app, "POST", &url_b, Value::Null)
    );
    let mut statuses = [a.0, b.0];
    statuses.sort_unstable();
    assert_eq!(statuses, [200, 409]);
    let confirmed = if a.0 == 200 { drafts[0] } else { drafts[1] };
    let rows: Vec<(i32, f64, i32)> = sqlx::query_as(
        "SELECT id,wage_total_3m,base_days_3m FROM hr_severance_calcs WHERE employee_id=$1",
    )
    .bind(emp)
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!((rows[0].1, rows[0].2), (27_000_000., 91));
    let calc = ok(
        &app,
        "GET",
        &format!("/hr/severance/calcs/{}", rows[0].0),
        Value::Null,
    )
    .await;
    assert!(calc["calc"]["severance_amount"].as_f64().unwrap() > 0.);
    assert!(calc["tax_detail"]["income_tax"].as_f64().unwrap() > 0.);
    assert_eq!(calc["tax_detail"]["tax_table_year"], 2026);
    assert_eq!(calc["wage_details"][0]["raw_amount"], 27_000_000.);
    ok(
        &app,
        "POST",
        &format!("/hr/retire/cases/{confirmed}/cancel"),
        json!({"cancel_reason":"test recovery"}),
    )
    .await;
    let restored: String =
        sqlx::query_scalar("SELECT employment_status FROM hr_employees WHERE id=$1")
            .bind(emp)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(restored, "active");
}
