use super::*;
use axum::{Router, http::HeaderMap};
use ring::rand::{SecureRandom, SystemRandom};
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

fn unique() -> String {
    let mut bytes = [0; 16];
    SystemRandom::new().fill(&mut bytes).unwrap();
    hex::encode(bytes)
}

fn assertion_for(state: &SecurityState, path: &str, body: &Value, source: &str) -> String {
    let now = epoch_seconds();
    let source = token::sha256(source.as_bytes());
    let mut signed = json!({"ver":1,"method":"POST","path":path,"iat":now,"exp":now+30,
        "nonce":unique(),"body_sha256":token::sha256(body.to_string().as_bytes()),
        "source_hash":source,"replay_bucket":token::replay_bucket(&source),"client_id":unique()});
    if path.ends_with("/login") {
        signed["purpose"] = json!("login");
        let binding = format!(
            "{}\0{}",
            body["enter_cd"].as_str().unwrap().trim().to_uppercase(),
            body["login_id"].as_str().unwrap().trim()
        );
        signed["request_binding"] = json!(token::sha256(binding.as_bytes()));
    } else {
        signed["purpose"] = json!("social-exchange");
        signed["email_verified"] = json!(true);
        for key in ["provider", "provider_user_id", "email", "display_name"] {
            signed[key] = body[key].clone();
        }
    }
    token::sign(
        br#"{"alg":"HS256","typ":"VIBEHR-BFF"}"#,
        signed.to_string().as_bytes(),
        &state.assertion_key,
    )
}

async fn call(
    app: &Router,
    method: &str,
    path: &str,
    header: Option<(&str, &str)>,
    body: &Value,
) -> (StatusCode, HeaderMap, Value) {
    let mut request = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/json");
    if let Some((name, value)) = header {
        request = request.header(name, value);
    }
    let response = app
        .clone()
        .oneshot(request.body(Body::from(body.to_string())).unwrap())
        .await
        .unwrap();
    let (parts, body) = response.into_parts();
    let bytes = to_bytes(body, 100_000).await.unwrap();
    (
        parts.status,
        parts.headers,
        serde_json::from_slice(&bytes).unwrap(),
    )
}

async fn test_app() -> (Router, SecurityState, PgPool) {
    let url = std::env::var("VIBEHR_AUTH_TEST_DATABASE_URL")
        .expect("set URL to a disposable auth_test database");
    let options: sqlx::postgres::PgConnectOptions = url.parse().unwrap();
    assert_eq!(options.get_database(), Some("auth_test"));
    let pool = PgPoolOptions::new()
        .max_connections(8)
        .connect_with(options)
        .await
        .unwrap();
    let state = SecurityState::new(
        pool.clone(),
        unique() + &unique(),
        unique() + &unique(),
        "vibe-hr".into(),
        60,
    )
    .unwrap();
    let app = crate::router(crate::AppState {
        pool: pool.clone(),
        security: state.clone(),
        app_name: "auth-test".into(),
        environment: "test".into(),
    });
    (app, state, pool)
}

#[tokio::test]
#[ignore = "requires disposable migrated PostgreSQL with corp, active dept, employee/admin role fixtures"]
async fn auth_http_postgres() {
    let (app, state, pool) = test_app().await;
    let subject = unique();
    let email = format!("social-{subject}@example.invalid");
    let payload = json!({"provider":"google","provider_user_id":subject,"email":email,"display_name":"Rust auth fixture"});
    let path = "/api/v1/auth/social/exchange";
    let bff = "x-vibehr-bff-assertion";
    let first = assertion_for(&state, path, &payload, &subject);
    let second = assertion_for(&state, path, &payload, &subject);
    let (one, two) = tokio::join!(
        call(&app, "POST", path, Some((bff, &first)), &payload),
        call(&app, "POST", path, Some((bff, &second)), &payload),
    );
    assert_eq!((one.0, two.0), (StatusCode::OK, StatusCode::OK));
    assert_eq!(one.2["user"], two.2["user"]);
    let id = one.2["user"]["id"].as_i64().unwrap() as i32;
    assert_eq!(one.2["user"]["roles"], json!(["employee"]));
    let created: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM hr_employees e JOIN hr_employee_basic_profiles p
            ON p.employee_id=e.id WHERE e.user_id=$1",
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(created, 1);
    let (stored, login): (String, String) =
        sqlx::query_as("SELECT password_hash,login_id FROM auth_users WHERE id=$1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(!password_matches(
        &format!("social-google-{subject}"),
        &stored
    ));
    let replay = call(&app, "POST", path, Some((bff, &first)), &payload).await;
    assert_eq!(
        (replay.0, replay.2),
        (
            StatusCode::UNAUTHORIZED,
            json!({"detail":"Invalid BFF assertion."})
        )
    );
    let (access, _) = state.issue_token(id, 60);
    let bearer = format!("Bearer {access}");
    let user = call(
        &app,
        "GET",
        "/api/v1/auth/me",
        Some(("authorization", &bearer)),
        &Value::Null,
    )
    .await;
    assert_eq!((user.0, user.2), (StatusCode::OK, one.2["user"].clone()));
    let refresh = call(
        &app,
        "POST",
        "/api/v1/auth/refresh",
        Some(("authorization", &bearer)),
        &Value::Null,
    )
    .await;
    assert_eq!(refresh.0, StatusCode::OK);
    assert_eq!(refresh.2["user"], one.2["user"]);
    let candidate_path = "/api/v1/auth/impersonation/users";
    assert_eq!(
        call(
            &app,
            "GET",
            candidate_path,
            Some(("authorization", &bearer)),
            &Value::Null
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    sqlx::query("INSERT INTO auth_user_roles(user_id,role_id,assigned_at) SELECT $1,id,now() FROM auth_roles WHERE code='admin'")
        .bind(id).execute(&pool).await.unwrap();
    let candidates = call(
        &app,
        "GET",
        candidate_path,
        Some(("authorization", &bearer)),
        &Value::Null,
    )
    .await;
    assert_eq!(candidates.0, StatusCode::OK);
    let target = candidates.2["users"][0]["id"].as_i64().unwrap();
    let impersonated = call(
        &app,
        "POST",
        "/api/v1/auth/impersonation/login",
        Some(("authorization", &bearer)),
        &json!({"user_id":target}),
    )
    .await;
    assert_eq!(impersonated.0, StatusCode::OK);
    assert_eq!(impersonated.2["user"]["id"], target);
    let corp: String = sqlx::query_scalar(
        "SELECT enter_cd FROM org_corporations WHERE is_active ORDER BY id LIMIT 1",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    let password = unique();
    let mut login_body = json!({"enter_cd":corp,"login_id":login,"password":password});
    let login_path = "/api/v1/auth/login";
    let sign = assertion_for(&state, login_path, &login_body, &subject);
    let failed = call(&app, "POST", login_path, Some((bff, &sign)), &login_body).await;
    assert_eq!(failed.0, StatusCode::UNAUTHORIZED);
    let assigned = hash_password(&password).unwrap();
    sqlx::query("UPDATE auth_users SET password_hash=$1 WHERE id=$2")
        .bind(&assigned)
        .bind(id)
        .execute(&pool)
        .await
        .unwrap();
    let sign = assertion_for(&state, login_path, &login_body, &subject);
    let success = call(&app, "POST", login_path, Some((bff, &sign)), &login_body).await;
    assert_eq!(success.0, StatusCode::OK);
    let other_social = assertion_for(&state, path, &payload, &subject);
    assert_eq!(
        call(&app, "POST", path, Some((bff, &other_social)), &payload)
            .await
            .0,
        StatusCode::OK
    );
    let existing: String = sqlx::query_scalar("SELECT password_hash FROM auth_users WHERE id=$1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(assigned, existing);
    login_body["password"] = json!("different");
    for _ in 2..10 {
        let sign = assertion_for(&state, login_path, &login_body, &subject);
        assert_eq!(
            call(&app, "POST", login_path, Some((bff, &sign)), &login_body)
                .await
                .0,
            StatusCode::UNAUTHORIZED
        );
    }
    let sign = assertion_for(&state, login_path, &login_body, &subject);
    let limited = call(&app, "POST", login_path, Some((bff, &sign)), &login_body).await;
    assert_eq!(limited.0, StatusCode::TOO_MANY_REQUESTS);
    assert!(limited.1.contains_key("retry-after"));
    sqlx::query("UPDATE auth_users SET is_active=false WHERE id=$1")
        .bind(id)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        call(
            &app,
            "GET",
            "/api/v1/auth/me",
            Some(("authorization", &bearer)),
            &Value::Null
        )
        .await
        .0,
        StatusCode::UNAUTHORIZED
    );
}

#[test]
fn assertion_binds_the_raw_body_path_and_identity() {
    let key = hmac::Key::new(hmac::HMAC_SHA256, b"synthetic fixture");
    let source = token::sha256(b"fixture-source");
    let payload = json!({"ver":1,"iat":1000,"exp":1060,"method":"POST","path":"/api/v1/auth/login","nonce":"n".repeat(22),
        "body_sha256":token::sha256(b"body"),"source_hash":source,"replay_bucket":token::replay_bucket(&source),
        "purpose":"login","client_id":"c".repeat(22),"request_binding":token::sha256(b"VIBE\0employee")});
    let signed = token::sign(
        br#"{"alg":"HS256","typ":"VIBEHR-BFF"}"#,
        payload.to_string().as_bytes(),
        &key,
    );
    let verify = |path, now| assertion::verify(&signed, &key, "POST", path, 60, now);
    let assertion = verify("/api/v1/auth/login", 1001).unwrap();
    assert!(assertion.matches_body(b"body"));
    assert!(!assertion.matches_body(b"body "));
    assert!(
        assertion
            .require_login_binding(" vibe ", " employee")
            .is_ok()
    );
    assert!(
        assertion
            .require_login_binding("other", "employee")
            .is_err()
    );
    assert!(verify("/api/v1/auth/social/exchange", 1001).is_none());
    assert!(verify("/api/v1/auth/login", 1060).is_none());
    assert!(verify("/api/v1/auth/login", 989).is_none());
}

#[tokio::test]
#[ignore = "requires disposable migrated auth_test PostgreSQL"]
async fn bff_nonce_quota_and_expiry_cleanup_are_shared_across_requests() {
    let (_, state, pool) = test_app().await;
    let path = "/api/v1/auth/login";
    let source = unique();
    let payload = json!({"enter_cd":"VIBE","login_id":"fixture","password":"fixture-only"});
    let now = epoch_seconds();
    let mut tasks = tokio::task::JoinSet::new();
    for _ in 0..36 {
        let signed = assertion_for(&state, path, &payload, &source);
        let principal =
            assertion::verify(&signed, &state.assertion_key, "POST", path, 60, now).unwrap();
        let pool = pool.clone();
        tasks.spawn(async move { replay::consume(&pool, &principal, now).await });
    }
    let mut accepted = 0;
    while let Some(result) = tasks.join_next().await {
        match result.unwrap() {
            Ok(()) => accepted += 1,
            Err(err) => assert_eq!(err, SecurityError::InvalidAssertion),
        }
    }
    assert_eq!(accepted, 32);
    let expired_nonce = unique();
    sqlx::query(
        "INSERT INTO bff_assertion_replays (nonce,scope_hash,source_hash,replay_bucket,expires_at)
        VALUES ($1,'test-only-expiry','test-only-expiry',0,now() - interval '1 minute')",
    )
    .bind(&expired_nonce)
    .execute(&pool)
    .await
    .unwrap();
    let task = start_replay_cleanup(pool.clone(), std::time::Duration::from_millis(10));
    let mut removed = false;
    for _ in 0..100 {
        if !sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM bff_assertion_replays WHERE nonce=$1)",
        )
        .bind(&expired_nonce)
        .fetch_one(&pool)
        .await
        .unwrap()
        {
            removed = true;
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    task.abort();
    assert!(removed);
}

#[tokio::test]
#[ignore = "requires disposable migrated auth_test PostgreSQL"]
async fn social_user_and_role_are_rolled_back_when_onboarding_fails() {
    let (_, _, original) = test_app().await;
    let options = (*original.connect_options()).clone();
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .unwrap();
    // The connection-local relation simulates no active departments without changing fixture rows.
    sqlx::query("CREATE TEMP TABLE org_departments(id integer, is_active boolean)")
        .execute(&pool)
        .await
        .unwrap();
    let state = SecurityState::new(
        pool.clone(),
        unique() + &unique(),
        unique() + &unique(),
        "vibe-hr".into(),
        60,
    )
    .unwrap();
    let app = crate::router(crate::AppState {
        pool: pool.clone(),
        security: state.clone(),
        app_name: "test".into(),
        environment: "test".into(),
    });
    let source = unique();
    let email = format!("{source}@example.invalid");
    let payload = json!({"provider":"kakao","provider_user_id":source,"email":email,"display_name":"test rollback"});
    let path = "/api/v1/auth/social/exchange";
    let signed = assertion_for(&state, path, &payload, &source);
    let (status, _, body) = call(
        &app,
        "POST",
        path,
        Some(("x-vibehr-bff-assertion", &signed)),
        &payload,
    )
    .await;
    assert_eq!(
        (status, body),
        (
            StatusCode::BAD_REQUEST,
            json!({"detail":"활성 부서를 찾을 수 없습니다."})
        )
    );
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM auth_users WHERE email=$1)")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(!exists);
}
