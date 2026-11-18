use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;
use vibehr_backend::{AppState, router, security::SecurityState};

#[tokio::test]
async fn http_probes_and_method_discovery_match_the_public_contract() {
    let pool = PgPoolOptions::new()
        .connect_lazy("postgres://localhost/unused")
        .unwrap();
    pool.close().await;
    let security = SecurityState::new(
        pool.clone(),
        "ab".repeat(32),
        "bc".repeat(32),
        "fixture".into(),
        60,
    )
    .unwrap();
    let app = router(AppState {
        pool,
        security,
        app_name: "fixture".into(),
        environment: "test".into(),
    });
    for (method, path, expected) in [
        ("GET", "/health", 200),
        ("GET", "/api/v1/health", 200),
        ("GET", "/actuator/health", 503),
        ("OPTIONS", "/health", 200),
        ("PATCH", "/health", 405),
        ("OPTIONS", "/api/v1/employees", 401),
    ] {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(path)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status().as_u16(), expected, "{method} {path}");
        let headers = response.headers().clone();
        let bytes = to_bytes(response.into_body(), 4096).await.unwrap();
        if method == "OPTIONS" && expected == 200 {
            let methods: Vec<_> = headers["allow"].to_str().unwrap().split(',').collect();
            assert!(
                ["GET", "HEAD", "OPTIONS"]
                    .into_iter()
                    .all(|m| methods.contains(&m))
            );
            assert!(bytes.is_empty());
        } else {
            let json: Value = serde_json::from_slice(&bytes).unwrap();
            if path == "/api/v1/health" {
                assert_eq!(json["status"], "degraded");
                assert_eq!(json["db"], "error");
            }
            if expected == 503 {
                assert_eq!(json["status"], "DOWN");
            }
            if expected == 405 {
                assert_eq!(json["path"], "/health");
                assert_eq!(headers["allow"], "GET");
            }
        }
    }
}
