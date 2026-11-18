use axum::{
    Router,
    body::{Body, to_bytes},
    http::Request,
};
use serde_json::{Value, json};
use sqlx::{PgPool, postgres::PgConnectOptions};
use tower::ServiceExt;
use vibehr_backend::{AppState, router, security::SecurityState};
async fn post(app: &Router, token: &str, path: &str, body: Value) -> (u16, Value) {
    let req = Request::post(path)
        .header("Authorization", format!("Bearer {token}"))
        .header("Content-Type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap();
    let response = app.clone().oneshot(req).await.unwrap();
    let status = response.status().as_u16();
    let bytes = to_bytes(response.into_body(), 65536).await.unwrap();
    (status, serde_json::from_slice(&bytes).unwrap())
}

#[tokio::test]
#[ignore = "requires a disposable time_concurrency_test database with the migrated dev fixture"]
async fn duplicate_punch_and_concurrent_approval_are_atomic() {
    let options: PgConnectOptions = std::env::var("VIBEHR_TIME_TEST_URL")
        .unwrap()
        .parse()
        .unwrap();
    assert_eq!(options.get_database(), Some("time_concurrency_test"));
    let pool = PgPool::connect_with(options).await.unwrap();
    let tag = format!("TC{}", chrono::Utc::now().timestamp_micros());
    let user:i32=sqlx::query_scalar("INSERT INTO auth_users(login_id,email,display_name,password_hash,is_active,created_at,updated_at) VALUES($1,$2,$1,'fixture',true,now(),now()) RETURNING id")
        .bind(&tag).bind(format!("{tag}@vibe-hr.local")).fetch_one(&pool).await.unwrap();
    sqlx::query("INSERT INTO auth_user_roles(user_id,role_id,assigned_at) SELECT $1,id,now() FROM auth_roles WHERE code='employee'").bind(user).execute(&pool).await.unwrap();
    let employee:i32=sqlx::query_scalar("INSERT INTO hr_employees(user_id,employee_no,department_id,position_title,hire_date,employment_status,created_at,updated_at) SELECT $1,$2,id,'test','2020-01-01','active',now(),now() FROM org_departments WHERE code='HQ-HR' RETURNING id").bind(user).bind(&tag).fetch_one(&pool).await.unwrap();
    let admin: i32 =
        sqlx::query_scalar("SELECT id FROM auth_users WHERE email='admin@vibe-hr.local'")
            .fetch_one(&pool)
            .await
            .unwrap();
    let security = SecurityState::new(
        pool.clone(),
        "ab".repeat(32),
        "bc".repeat(32),
        "vibe-hr".into(),
        60,
    )
    .unwrap();
    let emp_token = security.issue_token(user, 5).0;
    let admin_token = security.issue_token(admin, 5).0;
    let app = router(AppState {
        pool: pool.clone(),
        app_name: "proof".into(),
        environment: "test".into(),
        security,
    });
    let punch = "/api/v1/tim/attendance-daily/check-in";
    let (first, second) = tokio::join!(
        post(&app, &emp_token, punch, json!({})),
        post(&app, &emp_token, punch, json!({}))
    );
    let mut results = [first.0, second.0];
    results.sort();
    assert_eq!(results, [200, 409]);
    let leave = "/api/v1/tim/leave-requests";
    let body = json!({"leave_type":"annual","start_date":"2038-05-03","end_date":"2038-05-04","reason":"local concurrency regression"});
    let (first, second) = tokio::join!(
        post(&app, &emp_token, leave, body.clone()),
        post(&app, &emp_token, leave, body)
    );
    let mut results = [first.0, second.0];
    results.sort();
    assert_eq!(results, [200, 409]);
    let id = if first.0 == 200 {
        first.1["id"].as_i64().unwrap()
    } else {
        second.1["id"].as_i64().unwrap()
    };
    let approve = format!("{leave}/{id}/approve");
    sqlx::query("INSERT INTO tim_attendance_daily(employee_id,work_date,check_in_at,attendance_status,actual_minutes,regular_minutes,overtime_minutes,night_minutes,holiday_work_minutes,holiday_overtime_minutes,holiday_night_minutes,is_holiday_work,created_at,updated_at) VALUES($1,'2038-05-04','2038-05-04 00:00','present',0,0,0,0,0,0,0,false,now(),now())")
        .bind(employee).execute(&pool).await.unwrap();
    assert_eq!(post(&app, &admin_token, &approve, json!({})).await.0, 409);
    let linked_count = || {
        sqlx::query_scalar::<_, i64>(
            "SELECT count(*) FROM tim_attendance_daily WHERE approved_leave_request_id=$1",
        )
        .bind(id as i32)
        .fetch_one(&pool)
    };
    let balance = || {
        sqlx::query_as::<_,(f64,f64)>("SELECT used_days,remaining_days FROM tim_annual_leaves WHERE employee_id=$1 AND year=2038").bind(employee).fetch_one(&pool)
    };
    assert_eq!(linked_count().await.unwrap(), 0);
    assert_eq!(balance().await.unwrap(), (0.0, 15.0));
    sqlx::query("DELETE FROM tim_attendance_daily WHERE employee_id=$1 AND work_date='2038-05-04'")
        .bind(employee)
        .execute(&pool)
        .await
        .unwrap();
    let (a, b) = tokio::join!(
        post(&app, &admin_token, &approve, json!({})),
        post(&app, &admin_token, &approve, json!({}))
    );
    let mut results = [a.0, b.0];
    results.sort();
    assert_eq!(results, [200, 400]);
    assert_eq!(linked_count().await.unwrap(), 2);
    assert_eq!(balance().await.unwrap(), (2.0, 13.0));
    assert_eq!(
        post(&app, &emp_token, &format!("{leave}/{id}/cancel"), json!({}))
            .await
            .0,
        200
    );
    assert_eq!(linked_count().await.unwrap(), 0);
    assert_eq!(balance().await.unwrap(), (0.0, 15.0));
}
