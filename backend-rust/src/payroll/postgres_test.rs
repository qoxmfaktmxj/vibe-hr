use super::*;
use crate::security::SecurityState;
use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Method, Request},
};
use tower::ServiceExt;

#[tokio::test]
#[ignore = "requires separately seeded and disposable payroll_test PostgreSQL database"]
async fn payroll_role_overrides_apply_to_an_undeclared_standard_action() {
    let pool = PgPool::connect(&std::env::var("VIBEHR_PAYROLL_TEST_URL").unwrap())
        .await
        .unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT current_database()")
            .fetch_one(&pool)
            .await
            .unwrap(),
        "payroll_test"
    );
    let (id, role): (i32, i32) = sqlx::query_as(
        "SELECT ur.user_id,ur.role_id FROM auth_user_roles ur JOIN auth_roles r ON r.id=ur.role_id
        WHERE r.code='admin' ORDER BY ur.user_id LIMIT 1",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    // Isolate permission tests in a new synthetic menu copied from the real payroll menu shape.
    let mut tx = pool.begin().await.unwrap();
    let menu:i32=sqlx::query_scalar("INSERT INTO app_menus(code,name,path,is_active,sort_order,created_at,updated_at)
        SELECT 'pay-test-'||txid_current(),name,'/test/payroll/'||txid_current(),is_active,sort_order,now(),now() FROM app_menus
        WHERE code='payroll.codes' RETURNING id").fetch_one(&mut *tx).await.unwrap();
    let code: String = sqlx::query_scalar("SELECT code FROM app_menus WHERE id=$1")
        .bind(menu)
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    sqlx::query("INSERT INTO app_menu_roles(menu_id,role_id) VALUES($1,$2)")
        .bind(menu)
        .bind(role)
        .execute(&mut *tx)
        .await
        .unwrap();
    sqlx::query("INSERT INTO app_menu_actions(menu_id,action_code,enabled_default,created_at,updated_at) VALUES($1,'query',true,now(),now())")
        .bind(menu).execute(&mut *tx).await.unwrap();
    tx.commit().await.unwrap();
    let user = CurrentUser {
        id,
        roles: vec!["admin".into()],
    };
    use axum::response::IntoResponse;
    let denial = require_menu(&pool, &user, &code, "save")
        .await
        .unwrap_err()
        .into_response();
    assert_eq!(denial.status(), StatusCode::FORBIDDEN);
    let body = to_bytes(denial.into_body(), 8192).await.unwrap();
    assert_eq!(
        serde_json::from_slice::<Value>(&body).unwrap(),
        json!({"detail":"Action not allowed."})
    );
    sqlx::query("INSERT INTO app_role_menu_actions(role_id,menu_id,action_code,allowed,created_at,updated_at) VALUES($1,$2,'save',true,now(),now())")
        .bind(role).bind(menu).execute(&pool).await.unwrap();
    require_menu(&pool, &user, &code, "save").await.unwrap();
}

async fn call(
    app: &Router,
    method: Method,
    path: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(path)
                .header("content-type", "application/json")
                .body(body.map_or_else(Body::empty, |v| Body::from(v.to_string())))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), 1 << 20).await.unwrap();
    (status, serde_json::from_slice(&bytes).unwrap())
}

#[tokio::test]
#[ignore = "requires separately seeded and disposable payroll_test PostgreSQL database"]
async fn verifies_payroll_calculation_close_payment_payslip_and_balanced_vouchers() {
    let pool = PgPool::connect(&std::env::var("VIBEHR_PAYROLL_TEST_URL").unwrap())
        .await
        .unwrap();
    let db: String = sqlx::query_scalar("SELECT current_database()")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(db, "payroll_test");
    let (employee, owner): (i32, i32) =
        sqlx::query_as("SELECT id,user_id FROM hr_employees ORDER BY id LIMIT 1")
            .fetch_one(&pool)
            .await
            .unwrap();
    let admin = CurrentUser {
        id: owner,
        roles: vec!["admin".to_owned()],
    };
    let state = AppState {
        app_name: "payroll-parity".into(),
        environment: "test".into(),
        pool: pool.clone(),
        security: SecurityState::new(
            pool.clone(),
            "a1".repeat(32),
            "b2".repeat(32),
            "payroll-test".into(),
            60,
        )
        .unwrap(),
    };
    let app = router().layer(Extension(admin)).with_state(state.clone());
    // Choose a new month on each run, including after an interrupted previous run.
    let month: String = sqlx::query_scalar(
        "SELECT to_char(d,'YYYY-MM') FROM generate_series(date '2080-01-01',
        date '2099-12-01',interval '1 month') d WHERE NOT EXISTS(SELECT 1 FROM pay_payroll_codes
        WHERE code='RTEST-'||to_char(d,'YYYY-MM')) ORDER BY d LIMIT 1",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    let salary_code:i32=sqlx::query_scalar("INSERT INTO pay_payroll_codes(code,name,pay_type,payment_day,tax_deductible,
        social_ins_deductible,is_active,created_at,updated_at) VALUES($1,'Synthetic','regular','25',true,true,true,now(),now()) RETURNING id")
        .bind(format!("RTEST-{month}")).fetch_one(&pool).await.unwrap();
    sqlx::query("INSERT INTO pay_employee_profiles(employee_id,payroll_code_id,base_salary,pay_type_code,payment_day_type,
        holiday_adjustment,effective_from,effective_to,is_active,created_at,updated_at)
        VALUES($1,$2,2090000,'regular','fixed_day','none',($3||'-01')::date,($3||'-28')::date,true,now(),now())")
        .bind(employee).bind(salary_code).bind(&month).execute(&pool).await.unwrap();
    let create =
        json!({"year_month":month,"payroll_code_id":salary_code,"run_name":"Synthetic run"});
    let (first, second) = tokio::join!(
        call(&app, Method::POST, "/api/v1/pay/runs", Some(create.clone())),
        call(&app, Method::POST, "/api/v1/pay/runs", Some(create))
    );
    let (created, duplicate) = if first.0 == StatusCode::OK {
        (first, second)
    } else {
        (second, first)
    };
    assert_eq!(
        created.0,
        StatusCode::OK,
        "creation: {created:?}, competing: {duplicate:?}"
    );
    assert_eq!(duplicate.0, StatusCode::CONFLICT);
    let run = created.1["run"]["id"].as_i64().unwrap();
    let base = format!("/api/v1/pay/runs/{run}");
    let (status, calculated) = call(&app, Method::POST, &format!("{base}/calculate"), None).await;
    assert_eq!(status, StatusCode::OK, "{calculated}");
    assert_eq!(calculated["run"]["total_net"], 2090000.0);
    sqlx::query("INSERT INTO tim_leave_requests(employee_id,leave_type,start_date,end_date,request_status,
        payroll_minutes_snapshot,created_at,updated_at) VALUES($1,'unpaid',($2||'-05')::date,($2||'-05')::date,
        'approved',jsonb_build_object($2::text,480),now(),now())").bind(employee).bind(&month).execute(&pool).await.unwrap();
    let (status, closed) = call(&app, Method::POST, &format!("{base}/close"), None).await;
    assert_eq!(status, StatusCode::OK, "{closed}");
    assert_eq!(closed["run"]["total_deductions"], 80000.0);
    assert_eq!(closed["run"]["total_net"], 2010000.0);
    let accrual:i32=sqlx::query_scalar("SELECT id FROM pay_vouchers WHERE run_id=$1 AND voucher_type='accrual' AND total_debit=total_credit")
        .bind(run as i32).fetch_one(&pool).await.unwrap();
    let (status, confirmed) = call(
        &app,
        Method::POST,
        &format!("/api/v1/pay/vouchers/{accrual}/confirm"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{confirmed}");
    assert_eq!(confirmed["voucher"]["status"], "confirmed");
    let (status, paid) = call(&app, Method::POST, &format!("{base}/mark-paid"), None).await;
    assert_eq!(status, StatusCode::OK, "{paid}");
    let (status, disbursement) = call(
        &app,
        Method::POST,
        "/api/v1/pay/vouchers/generate-disbursement",
        Some(json!({"run_id":run})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{disbursement}");
    assert_eq!(disbursement["voucher"]["total_debit"], 2010000.0);
    assert_eq!(disbursement["voucher"]["total_credit"], 2010000.0);
    let (status, payslip) = call(
        &app,
        Method::GET,
        &format!("/api/v1/pay/my/payslips/{run}"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{payslip}");
    assert_eq!(payslip["summary"]["net_pay"], 2010000.0);
    assert!(
        payslip["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|i| i["item_code"] == "TIM_UNPAID" && i["amount"] == 80000.0)
    );
    assert_eq!(
        call(&app, Method::POST, &format!("{base}/recalculate"), None)
            .await
            .0,
        StatusCode::CONFLICT
    );
    let other: i32 =
        sqlx::query_scalar("SELECT user_id FROM hr_employees WHERE user_id<>$1 LIMIT 1")
            .bind(owner)
            .fetch_one(&pool)
            .await
            .unwrap();
    let employee_app = router()
        .layer(Extension(CurrentUser {
            id: other,
            roles: vec!["employee".into()],
        }))
        .with_state(state);
    assert_eq!(
        call(
            &employee_app,
            Method::GET,
            &format!("/api/v1/pay/my/payslips/{run}"),
            None
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        call(
            &employee_app,
            Method::POST,
            &format!("{base}/mark-paid"),
            None
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
}
