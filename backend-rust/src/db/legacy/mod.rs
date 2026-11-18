mod adoption;
mod reconcile;
pub use adoption::adopt;
pub use reconcile::reconcile;

use ring::digest::{SHA256, digest};
use serde_json::Value;
use sqlx::PgConnection;
use std::{error::Error, path::Path};

type Result<T> = std::result::Result<T, Box<dyn Error>>;
const ALEMBIC_HEAD: &str = "org_mapping_foundation_20260722";
// metadata_sha256 in the immutable V1 schema-metadata-manifest.json.
pub(super) const BASELINE: &str =
    "fd4fb016274fc2ae5bb637c2e958a968ae625de229f0bbc9cf7b3677a6db613e";
const DRIFT: &str = "e9cf20a655e8f4a06b4e93db40661843ab94d363a906be19e8450397a7a12ec1";

pub(super) fn sha256(data: &[u8]) -> String {
    hex::encode(digest(&SHA256, data).as_ref())
}
fn checked_sql(path: &Path, sha: &str) -> Result<String> {
    let sql = std::fs::read_to_string(path)?.replace("\r\n", "\n");
    if sha256(sql.as_bytes()) != sha {
        return Err(format!(
            "SQL checksum differs from the reviewed asset at {}",
            path.display()
        )
        .into());
    }
    Ok(sql)
}
async fn fingerprint(conn: &mut PgConnection) -> Result<String> {
    // catalog.sql emits JSON (not JSONB) in the canonical Jackson insertion order.
    // serde_json removes whitespace while retaining that order through preserve_order.
    let metadata: Value = sqlx::query_scalar(include_str!("../catalog.sql"))
        .fetch_one(conn)
        .await?;
    Ok(sha256(&serde_json::to_vec(&metadata)?))
}
async fn verify_fingerprint(conn: &mut PgConnection, expected: &str) -> Result<()> {
    let actual = fingerprint(conn).await?;
    if actual != expected {
        return Err(format!(
            "PostgreSQL schema metadata drift detected; expected {expected} but found {actual}."
        )
        .into());
    }
    Ok(())
}
async fn exists(conn: &mut PgConnection, qualified: &str) -> Result<bool> {
    Ok(
        sqlx::query_scalar("SELECT to_regclass($1::text) IS NOT NULL")
            .bind(qualified)
            .fetch_one(conn)
            .await?,
    )
}
async fn require_head(conn: &mut PgConnection) -> Result<()> {
    if !exists(conn, "public.alembic_version").await? {
        return Err("Refusing adoption: alembic_version is missing.".into());
    }
    let heads: Vec<String> =
        sqlx::query_scalar("SELECT version_num FROM public.alembic_version ORDER BY version_num")
            .fetch_all(conn)
            .await?;
    if heads.as_slice() != [ALEMBIC_HEAD] {
        return Err(format!(
            "Refusing adoption: expected exactly one Alembic head {ALEMBIC_HEAD}."
        )
        .into());
    }
    Ok(())
}
