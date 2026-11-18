use super::*;
use crate::security::SecurityState;
use axum::{body::Body as HttpBody, http::Request};
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

async fn request(router: &Router, year: i32, count: i32) -> StatusCode {
    router
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/tra/generate/elearning-windows")
                .header("content-type", "application/json")
                .body(HttpBody::from(
                    json!({"year":year,"app_count":count}).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap()
        .status()
}
#[tokio::test]
#[ignore = "requires the disposable, Flyway-migrated training_test PostgreSQL database"]
async fn generates_twelve_complete_windows_and_rolls_back_on_blocked_month() {
    let url = std::env::var("VIBEHR_TRAINING_TEST_URL").unwrap();
    let pool = PgPoolOptions::new()
        .max_connections(4)
        .after_connect(|conn, _| {
            Box::pin(async move {
                sqlx::query("SET lock_timeout='500ms'")
                    .execute(conn)
                    .await?;
                Ok(())
            })
        })
        .connect(&url)
        .await
        .unwrap();
    let db: String = sqlx::query_scalar("SELECT current_database()")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(db, "training_test");
    let year:i32=sqlx::query_scalar("SELECT y FROM generate_series(2040,2100) y WHERE NOT EXISTS (SELECT FROM tra_elearning_windows WHERE left(year_month,4)=y::text) ORDER BY y LIMIT 1")
        .fetch_one(&pool).await.unwrap();
    let state = AppState {
        pool: pool.clone(),
        app_name: "training_test".into(),
        environment: "test".into(),
        security: SecurityState::new(
            pool.clone(),
            "a1".repeat(32),
            "b2".repeat(32),
            "test".into(),
            60,
        )
        .unwrap(),
    };
    let app = routes()
        .layer(Extension(CurrentUser {
            id: 1,
            roles: vec!["admin".into()],
        }))
        .with_state(state);
    // Hold a real row lock in month seven. Earlier inserts must disappear on a later failed update.
    let month = format!("{year}07");
    sqlx::query("INSERT INTO tra_elearning_windows(year_month,start_date,end_date,app_count,created_at,updated_at) VALUES($1,make_date($2,7,1),make_date($2,7,5),1,now(),now())")
        .bind(&month).bind(year).execute(&pool).await.unwrap();
    let mut blocking = pool.begin().await.unwrap();
    sqlx::query("SELECT id FROM tra_elearning_windows WHERE year_month=$1 FOR UPDATE")
        .bind(&month)
        .execute(&mut *blocking)
        .await
        .unwrap();
    assert_eq!(
        request(&app, year, 2).await,
        StatusCode::INTERNAL_SERVER_ERROR
    );
    blocking.rollback().await.unwrap();
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM tra_elearning_windows WHERE left(year_month,4)=$1",
    )
    .bind(year.to_string())
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count, 1);
    sqlx::query("DELETE FROM tra_elearning_windows WHERE year_month=$1 AND app_count=1")
        .bind(&month)
        .execute(&pool)
        .await
        .unwrap();
    let (left, right) = tokio::join!(request(&app, year, 2), request(&app, year, 2));
    assert_eq!(left, StatusCode::OK);
    assert_eq!(right, StatusCode::OK);
    assert_eq!(request(&app, year, 3).await, StatusCode::OK);
    let rows:Vec<(String,NaiveDate,NaiveDate,i32)>=sqlx::query_as("SELECT year_month,start_date,end_date,app_count FROM tra_elearning_windows WHERE left(year_month,4)=$1 ORDER BY year_month").bind(year.to_string()).fetch_all(&pool).await.unwrap();
    assert_eq!(rows.len(), 12);
    for (index, (month, start, end, count)) in rows.into_iter().enumerate() {
        assert_eq!(month, format!("{year}{:02}", index + 1));
        assert_eq!(start.weekday(), chrono::Weekday::Mon);
        assert!(start.day() <= 7);
        assert_eq!(start + chrono::Days::new(4), end);
        assert_eq!(count, 3);
    }
}
