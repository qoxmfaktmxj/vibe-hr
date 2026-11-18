use super::{BffPrincipal, SecurityError, token};
use sqlx::PgPool;
use std::time::Duration;
use tokio::task::JoinHandle;

const CLEAN_UP: &str = "
    WITH candidates AS (
        SELECT ctid FROM bff_assertion_replays WHERE expires_at <= now()
        ORDER BY expires_at LIMIT 256 FOR UPDATE SKIP LOCKED
    )
    DELETE FROM bff_assertion_replays b USING candidates c WHERE b.ctid = c.ctid";

pub fn start_replay_cleanup(pool: PgPool, delay: Duration) -> JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            if sqlx::query(CLEAN_UP).execute(&pool).await.is_err() {
                eprintln!("BFF replay cleanup failed");
            }
            tokio::time::sleep(delay).await;
        }
    })
}

pub(super) async fn consume(
    pool: &PgPool,
    assertion: &BffPrincipal,
    now: i64,
) -> Result<(), SecurityError> {
    let scope =
        token::sha256(format!("{}\0{}", assertion.client_id, assertion.source_hash).as_bytes());
    let mut tx = pool.begin().await.map_err(|_| SecurityError::Unavailable)?;
    // A second statement takes a fresh READ COMMITTED snapshot after the prior
    // bucket owner commits, so capacity checks include concurrently consumed nonces.
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended('vibehr-bff-replay-bucket:' || $1::smallint::text,0))")
        .bind(assertion.bucket).execute(&mut *tx).await.map_err(|_| SecurityError::Unavailable)?;
    let sql = "
        WITH expired_candidates AS (
            SELECT ctid FROM bff_assertion_replays WHERE expires_at <= to_timestamp($1::bigint)
            ORDER BY expires_at LIMIT 256 FOR UPDATE SKIP LOCKED
        ), expired AS (
            DELETE FROM bff_assertion_replays b USING expired_candidates c WHERE b.ctid = c.ctid
        ), inserted AS (
            INSERT INTO bff_assertion_replays(nonce, scope_hash, source_hash, replay_bucket, expires_at)
            SELECT $3, $4, $5, $2, to_timestamp($6::bigint)
            WHERE (SELECT count(*) FROM bff_assertion_replays WHERE replay_bucket = $2 AND expires_at > to_timestamp($1::bigint)) < 256
              AND (SELECT count(*) FROM bff_assertion_replays WHERE source_hash = $5 AND expires_at > to_timestamp($1::bigint)) < 32
              AND (SELECT count(*) FROM bff_assertion_replays WHERE scope_hash = $4 AND expires_at > to_timestamp($1::bigint)) < 128
            ON CONFLICT (nonce) DO NOTHING RETURNING 1
        )
        SELECT count(*) FROM inserted";
    let count: i64 = sqlx::query_scalar(sql)
        .bind(now)
        .bind(assertion.bucket)
        .bind(&assertion.nonce)
        .bind(scope)
        .bind(&assertion.source_hash)
        .bind(assertion.expires_at)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| SecurityError::Unavailable)?;
    tx.commit().await.map_err(|_| SecurityError::Unavailable)?;
    if count == 1 {
        Ok(())
    } else {
        Err(SecurityError::InvalidAssertion)
    }
}
