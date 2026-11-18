use sqlx::postgres::PgConnectOptions;
use sqlx::postgres::PgPoolOptions;
use std::{env, error::Error};
use vibehr_backend::{AppState, platform::HttpConfig, router_with_http_config, security};

fn database_options() -> Result<PgConnectOptions, Box<dyn Error>> {
    let Ok(jdbc) = env::var("SPRING_DATASOURCE_URL") else {
        return Ok(env::var("DATABASE_URL")?.parse()?);
    };
    let url = jdbc
        .strip_prefix("jdbc:postgresql://")
        .ok_or("Expected a PostgreSQL JDBC URL")?;
    let options: PgConnectOptions = format!("postgresql://{url}").parse()?;
    Ok(options
        .username(&env::var("SPRING_DATASOURCE_USERNAME")?)
        .password(&env::var("SPRING_DATASOURCE_PASSWORD")?))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let database = database_options()?;
    let pool = PgPoolOptions::new().connect_with(database.clone()).await?;
    let arguments: Vec<_> = env::args().skip(1).collect();
    match arguments.as_slice() {
        [] => {}
        [op, confirmation, migrations] if op == "adopt-legacy" => {
            return vibehr_backend::db::legacy::adopt(
                &pool,
                confirmation,
                std::path::Path::new(migrations),
            )
            .await;
        }
        [op, confirmation, expected, script] if op == "reconcile-legacy" => {
            return vibehr_backend::db::legacy::reconcile(
                &pool,
                confirmation,
                expected,
                std::path::Path::new(script),
            )
            .await;
        }
        [op, mode, confirmation] if op == "seed" => {
            return vibehr_backend::db::seed::run(&pool, &database, mode, confirmation, 6000).await;
        }
        [op, mode, confirmation, count] if op == "seed" && mode == "demo" => {
            return vibehr_backend::db::seed::run(
                &pool,
                &database,
                mode,
                confirmation,
                count.parse()?,
            )
            .await;
        }
        [op] if op == "schema-preflight" => return vibehr_backend::db::preflight(&pool).await,
        [op, manifest] if op == "schema-verify" => {
            return vibehr_backend::db::verify(&pool, std::path::Path::new(manifest)).await;
        }
        _ => {
            return Err(
                "Expected server mode, schema-preflight, or schema-verify <manifest>".into(),
            );
        }
    }
    let algorithm = env::var("AUTH_TOKEN_ALGORITHM").unwrap_or_else(|_| "HS256".into());
    let expiry: i32 = env::var("AUTH_TOKEN_EXPIRES_MIN")
        .unwrap_or_else(|_| "480".into())
        .parse()?;
    if algorithm != "HS256" || expiry < 1 {
        return Err("Invalid access token configuration".into());
    }
    let security = security::SecurityState::new(
        pool.clone(),
        env::var("AUTH_TOKEN_SECRET")?,
        env::var("VIBEHR_BFF_ASSERTION_SECRET")?,
        env::var("AUTH_TOKEN_ISSUER").unwrap_or_else(|_| "vibe-hr".into()),
        env::var("VIBEHR_BFF_ASSERTION_MAX_TTL_SECONDS")
            .unwrap_or_else(|_| "60".into())
            .parse()?,
    )?;
    let cleanup_ms: u64 = env::var("VIBEHR_BFF_ASSERTION_REPLAY_CLEANUP_DELAY_MS")
        .unwrap_or_else(|_| "5000".into())
        .parse()?;
    if cleanup_ms == 0 {
        return Err("Invalid replay cleanup delay".into());
    }
    let _cleanup =
        security::start_replay_cleanup(pool.clone(), std::time::Duration::from_millis(cleanup_ms));
    let state = AppState {
        pool,
        security,
        app_name: env::var("APP_NAME").unwrap_or_else(|_| "Vibe-HR API".into()),
        environment: env::var("ENVIRONMENT").unwrap_or_else(|_| "local".into()),
    };
    let address = env::var("BIND_ADDRESS").unwrap_or_else(|_| "127.0.0.1:8080".into());
    let listener = tokio::net::TcpListener::bind(address).await?;
    let config = HttpConfig::new(
        &env::var("CORS_ORIGINS").unwrap_or_else(|_| "http://localhost:3000".into()),
    )?;
    axum::serve(listener, router_with_http_config(state, config.clone()))
        .with_graceful_shutdown(async move {
            #[cfg(unix)]
            {
                use tokio::signal::unix::{SignalKind, signal};
                let mut terminate = signal(SignalKind::terminate()).expect("SIGTERM registration");
                tokio::select! { _=terminate.recv()=>(), _=tokio::signal::ctrl_c()=>() }
            }
            #[cfg(not(unix))]
            let _ = tokio::signal::ctrl_c().await;
            config.drain();
        })
        .await?;
    Ok(())
}
