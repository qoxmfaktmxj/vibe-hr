use axum::{
    Router,
    body::{Body, to_bytes},
    http::Request,
};
use serde_json::{Value, json};
use sqlx::{PgPool, postgres::PgConnectOptions};
use tower::ServiceExt;
use vibehr_backend::{AppState, router, security::SecurityState};

async fn call(
    app: &Router,
    token: &str,
    method: &str,
    path: &str,
    payload: Value,
    expected: u16,
) -> Value {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(path)
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(if payload.is_null() {
                    Body::empty()
                } else {
                    Body::from(payload.to_string())
                })
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status().as_u16(), expected, "{method} {path}");
    let bytes = to_bytes(response.into_body(), 2_000_000).await.unwrap();
    if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap()
    }
}

async fn release_after_waiters(
    pool: &PgPool,
    blocker: sqlx::Transaction<'_, sqlx::Postgres>,
    relation: &str,
) {
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        loop {
            let waiting:i64=sqlx::query_scalar("SELECT count(*) FROM pg_locks WHERE database=(SELECT oid FROM pg_database WHERE datname=current_database()) AND relation=to_regclass($1) AND mode='ShareRowExclusiveLock' AND NOT granted")
                .bind(relation).fetch_one(pool).await.unwrap();
            if waiting>=2 {break}
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
    }).await.expect("both replacement requests must wait before issuing deletes");
    blocker.rollback().await.unwrap();
}

#[tokio::test]
#[ignore = "requires disposable platform_test restored from the migrated dev and demo fixture"]
async fn real_settings_grids_and_permissions() {
    let options: PgConnectOptions = std::env::var("VIBEHR_PLATFORM_TEST_URL")
        .unwrap()
        .parse()
        .unwrap();
    assert_eq!(options.get_database(), Some("platform_test"));
    let pool = PgPool::connect_with(options).await.unwrap();
    let security = SecurityState::new(
        pool.clone(),
        "ab".repeat(32),
        "bc".repeat(32),
        "vibe-hr".into(),
        60,
    )
    .unwrap();
    let user: i32 =
        sqlx::query_scalar("SELECT id FROM auth_users WHERE email='admin@vibe-hr.local'")
            .fetch_one(&pool)
            .await
            .unwrap();
    let employee: i32 =
        sqlx::query_scalar("SELECT id FROM auth_users WHERE email='kr-0001@vibe-hr.local'")
            .fetch_one(&pool)
            .await
            .unwrap();
    let admin = security.issue_token(user, 5).0;
    let staff = security.issue_token(employee, 5).0;
    let app = router(AppState {
        pool: pool.clone(),
        security,
        app_name: "Vibe-HR API".into(),
        environment: "local".into(),
    });
    let groups = "/api/v1/codes/groups";
    let policy = "/api/v1/system-settings/auth-session";
    let roles = "/api/v1/menus/admin/roles";
    let unique = chrono::Utc::now().timestamp_micros().to_string();
    for (method, path, body, error_type) in [
        (
            "GET",
            "/api/v1/codes/groups?page=bad",
            Value::Null,
            "int_parsing",
        ),
        (
            "GET",
            "/api/v1/codes/groups?all=bad",
            Value::Null,
            "value_error",
        ),
        (
            "GET",
            "/api/v1/menus/admin/roles/not-a-number/menus",
            Value::Null,
            "int_parsing",
        ),
        (
            "GET",
            "/api/v1/tim/attendance-daily/today?employeeId=bad",
            Value::Null,
            "int_parsing",
        ),
        (
            "GET",
            "/api/v1/tim/leave-requests?pendingOnly=abc",
            Value::Null,
            "value_error",
        ),
        (
            "GET",
            "/api/v1/tim/annual-leave/my?year=1999",
            Value::Null,
            "validation_error",
        ),
        (
            "POST",
            "/api/v1/menus/admin",
            json!({"code":"org.departments","name":"ignored"}),
            "json_invalid",
        ),
        ("PUT", policy, json!({}), "json_invalid"),
        (
            "POST",
            "/api/v1/tim/schedules/departments/batch",
            json!({"items":[{"pattern_id":"x","department_id":1,"effective_from":"2026-01-01"}]}),
            "json_invalid",
        ),
    ] {
        let error = call(&app, &admin, method, path, body, 422).await;
        assert_eq!(error["detail"][0]["type"], error_type, "{path}");
    }
    let all = call(
        &app,
        &admin,
        "GET",
        "/api/v1/codes/groups?all=yes",
        Value::Null,
        200,
    )
    .await;
    assert!(all["page"].is_null() && all["limit"].is_null());
    call(
        &app,
        &staff,
        "GET",
        "/api/v1/tim/leave-requests/my?pendingOnly=ignored",
        Value::Null,
        200,
    )
    .await;
    call(
        &app,
        &admin,
        "GET",
        "/api/v1/tim/work-schedules?year=ignored",
        Value::Null,
        200,
    )
    .await;
    call(&app, &staff, "GET", groups, Value::Null, 403).await;
    call(&app, &staff, "GET", policy, Value::Null, 403).await;
    let lookup = call(
        &app,
        &admin,
        "GET",
        "/api/v1/menus/actions/current?path=%2Fsettings%2Fcommon-codes",
        Value::Null,
        200,
    )
    .await;
    assert!(
        lookup["allowed_actions"]
            .as_array()
            .unwrap()
            .contains(&json!("save"))
    );
    let before = call(&app, &admin, "GET", policy, Value::Null, 200).await;
    let mut updated = before["policy"].clone();
    updated["access_ttl_min"] = json!(31);
    updated["refresh_threshold_min"] = json!(20);
    let saved = call(&app, &admin, "PUT", policy, updated.clone(), 200).await;
    assert_eq!(saved["policy"], updated);
    let paired:i64=sqlx::query_scalar("SELECT count(*) FROM app_system_settings s JOIN LATERAL (SELECT changed_at,new_value_text,changed_by FROM app_system_setting_history h WHERE h.setting_id=s.id ORDER BY id DESC LIMIT 1) h ON h.changed_at=s.updated_at AND h.changed_by=s.updated_by AND h.new_value_text=s.value_text WHERE s.key IN ('auth.session.access_ttl_min','auth.session.refresh_threshold_min','auth.session.remember_enabled','auth.session.remember_ttl_min','auth.session.show_countdown')")
        .fetch_one(&pool).await.unwrap();
    assert_eq!(paired, 5);
    call(&app, &admin, "PUT", policy, before["policy"].clone(), 200).await;
    let payload = json!({"code":format!("rg{unique}"),"name":"  테스트  "});
    let group = call(&app, &admin, "POST", groups, payload.clone(), 201).await;
    call(&app, &admin, "POST", groups, payload, 409).await;
    assert_eq!(group["group"]["name"], "테스트");
    let gid = group["group"]["id"].as_i64().unwrap();
    let items = format!("{groups}/{gid}/items");
    let item = call(
        &app,
        &admin,
        "POST",
        &items,
        json!({"code":"abc","name":" 항목 "}),
        201,
    )
    .await;
    let listed = call(
        &app,
        &admin,
        "GET",
        &format!("{items}?all=true"),
        Value::Null,
        200,
    )
    .await;
    assert_eq!(listed["codes"][0], item["code"]);
    let options = call(
        &app,
        &staff,
        "GET",
        &format!("{groups}/by-code/rg{unique}/active"),
        Value::Null,
        200,
    )
    .await;
    assert_eq!(options["options"], json!([{"code":"ABC","name":"항목"}]));
    call(
        &app,
        &admin,
        "DELETE",
        &format!("{groups}/{gid}"),
        Value::Null,
        409,
    )
    .await;
    let item_url = format!("{items}/{}", item["code"]["id"]);
    call(
        &app,
        &admin,
        "PUT",
        &item_url,
        json!({"is_active":false}),
        200,
    )
    .await;
    call(&app, &admin, "DELETE", &item_url, Value::Null, 204).await;
    call(
        &app,
        &admin,
        "DELETE",
        &format!("{groups}/{gid}"),
        Value::Null,
        204,
    )
    .await;
    let role = call(
        &app,
        &admin,
        "POST",
        roles,
        json!({"code":format!("r{unique}"),"name":"Test role"}),
        201,
    )
    .await;
    let rid = role["role"]["id"].as_i64().unwrap();
    let menu_id: i32 =
        sqlx::query_scalar("SELECT id FROM app_menus WHERE path='/settings/common-codes'")
            .fetch_one(&pool)
            .await
            .unwrap();
    let links = format!("{roles}/{rid}/menus");
    call(
        &app,
        &admin,
        "PUT",
        &links,
        json!({"menu_ids":[menu_id,menu_id]}),
        200,
    )
    .await;
    let linked = call(&app, &admin, "GET", &links, Value::Null, 200).await;
    assert!(!linked["menus"].as_array().unwrap().is_empty());
    let invalid = json!({"mappings":[{"role_id":rid,"menu_ids":[i32::MAX]}]});
    call(
        &app,
        &admin,
        "PUT",
        &format!("{roles}/permissions"),
        invalid,
        400,
    )
    .await;
    assert_eq!(
        call(&app, &admin, "GET", &links, Value::Null, 200).await,
        linked
    );
    let other: i32 =
        sqlx::query_scalar("SELECT id FROM app_menus WHERE id<>$1 ORDER BY id LIMIT 1")
            .bind(menu_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    call(&app, &admin, "PUT", &links, json!({"menu_ids":[]}), 200).await;
    let mut blocker = pool.begin().await.unwrap();
    sqlx::query("LOCK TABLE app_menu_roles IN SHARE MODE")
        .execute(&mut *blocker)
        .await
        .unwrap();
    tokio::join!(
        call(
            &app,
            &admin,
            "PUT",
            &links,
            json!({"menu_ids":[menu_id]}),
            200
        ),
        call(
            &app,
            &admin,
            "PUT",
            &links,
            json!({"menu_ids":[other]}),
            200
        ),
        release_after_waiters(&pool, blocker, "app_menu_roles")
    );
    let selected: Vec<i32> =
        sqlx::query_scalar("SELECT menu_id FROM app_menu_roles WHERE role_id=$1")
            .bind(rid as i32)
            .fetch_all(&pool)
            .await
            .unwrap();
    assert!(selected == [menu_id] || selected == [other]);
    let mut blocker = pool.begin().await.unwrap();
    sqlx::query("LOCK TABLE app_role_menu_actions IN SHARE MODE")
        .execute(&mut *blocker)
        .await
        .unwrap();
    let url = format!("{roles}/action-permissions");
    let grant = |menu| json!({"mappings":[{"role_id":rid,"menu_id":menu,"action_code":"save","allowed":true}]});
    tokio::join!(
        call(&app, &admin, "PUT", &url, grant(menu_id), 200),
        call(&app, &admin, "PUT", &url, grant(other), 200),
        release_after_waiters(&pool, blocker, "app_role_menu_actions")
    );
    let granted: Vec<i32> =
        sqlx::query_scalar("SELECT menu_id FROM app_role_menu_actions WHERE role_id=$1")
            .bind(rid as i32)
            .fetch_all(&pool)
            .await
            .unwrap();
    assert!(granted == [menu_id] || granted == [other]);
    sqlx::query("DELETE FROM app_role_menu_actions WHERE role_id=$1")
        .bind(rid as i32)
        .execute(&pool)
        .await
        .unwrap();
    call(
        &app,
        &admin,
        "DELETE",
        &format!("{roles}/{rid}"),
        Value::Null,
        204,
    )
    .await;
}
