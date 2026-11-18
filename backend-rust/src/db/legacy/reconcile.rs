use super::*;
use sqlx::{AssertSqlSafe, PgPool};
use std::collections::BTreeMap;

const TABLES: [&str; 5] = [
    "hri_approval_actor_rules",
    "org_departments",
    "tim_attendance_daily",
    "tim_leave_requests",
    "wel_benefit_requests",
];
const SCRIPT_HASH: &str = "9acac9ee76c79486894ff2f420f425e5b77997d34f03b4ee41254f66686e1870";

async fn evidence(
    conn: &mut PgConnection,
    source: bool,
) -> Result<BTreeMap<&'static str, (i64, String)>> {
    let mut values = BTreeMap::new();
    for table in TABLES {
        let payload = if table == "tim_leave_requests" {
            let decided = if source {
                "t.decided_at AT TIME ZONE 'UTC'"
            } else {
                "t.decided_at"
            };
            format!(
                "to_jsonb(t)||jsonb_build_object('decided_at',to_char({decided},'YYYY-MM-DD\"T\"HH24:MI:SS.US'))"
            )
        } else {
            "to_jsonb(t)".into()
        };
        let statement = format!(
            "SELECT count(*),md5(coalesce(string_agg(({payload})::text,E'\\n' ORDER BY t.id),'')) FROM public.{table} t"
        );
        let record = sqlx::query_as(AssertSqlSafe(statement))
            .fetch_one(&mut *conn)
            .await?;
        values.insert(table, record);
    }
    Ok(values)
}
async fn sequences(conn: &mut PgConnection) -> Result<BTreeMap<String, (i64, bool, i64, i64)>> {
    let mut sequences = BTreeMap::new();
    for table in TABLES {
        let sequence = format!("{table}_id_seq");
        let sql=format!("SELECT s.last_value,s.is_called,q.seqincrement,coalesce((SELECT max(id)::bigint FROM public.{table}),0)
            FROM public.{sequence} s JOIN pg_class c ON c.oid='public.{sequence}'::regclass JOIN pg_sequence q ON q.seqrelid=c.oid");
        let (last, called, incr, max): (i64, bool, i64, i64) = sqlx::query_as(AssertSqlSafe(sql))
            .fetch_one(&mut *conn)
            .await?;
        let next = if called {
            last.checked_add(incr).ok_or("Sequence exhausted")?
        } else {
            last
        };
        if next <= max {
            return Err(format!(
                "Sequence {sequence} would generate {next} at or below max id {max}."
            )
            .into());
        }
        sequences.insert(sequence, (last, called, next, max));
    }
    Ok(sequences)
}
pub async fn reconcile(
    pool: &PgPool,
    confirmation: &str,
    expected: &str,
    path: &Path,
) -> Result<()> {
    if confirmation != "reconcile-known-production-drift-20260803" {
        return Err(
            "Pre-adoption reconciliation requires the exact explicit confirmation token.".into(),
        );
    }
    if expected != DRIFT {
        return Err(
            "Pre-adoption reconciliation requires the exact reviewed source fingerprint.".into(),
        );
    }
    let script = checked_sql(path, SCRIPT_HASH)?;
    let mut tx = pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
        .execute(&mut *tx)
        .await?;
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(382_671_113_083i64)
        .execute(&mut *tx)
        .await?;
    sqlx::query("SET LOCAL search_path TO public,pg_catalog")
        .execute(&mut *tx)
        .await?;
    sqlx::query("SET LOCAL time zone 'UTC'")
        .execute(&mut *tx)
        .await?;
    if sqlx::query_scalar::<_, String>("SELECT current_schema()")
        .fetch_one(&mut *tx)
        .await?
        != "public"
    {
        return Err("Pre-adoption reconciliation requires current_schema()=public.".into());
    }
    if exists(&mut tx, "public.flyway_schema_history").await? {
        return Err("Refusing reconciliation after Flyway history exists.".into());
    }
    require_head(&mut tx).await?;
    let archived: bool =
        sqlx::query_scalar("SELECT to_regnamespace('vibehr_pre_adoption_20260803') IS NOT NULL")
            .fetch_one(&mut *tx)
            .await?;
    if archived {
        return Err("Refusing reconciliation because archive schema already exists.".into());
    }
    verify_fingerprint(&mut tx, DRIFT).await?;
    let before = evidence(&mut tx, true).await?;
    sqlx::query("SELECT set_config('vibehr.reconciliation_confirmation',$1,true),set_config('vibehr.reconciliation_expected_source_fingerprint',$2,true)")
        .bind(confirmation).bind(expected).execute(&mut *tx).await?;
    sqlx::raw_sql(AssertSqlSafe(script))
        .execute(&mut *tx)
        .await?;
    verify_fingerprint(&mut tx, BASELINE).await?;
    let after = evidence(&mut tx, false).await?;
    if before != after {
        return Err(
            "Reconciliation changed protected row counts or deterministic checksums.".into(),
        );
    }
    let sequences = sequences(&mut tx).await?;
    tx.commit().await?;
    println!(
        "{}",
        serde_json::json!({"source_fingerprint":DRIFT,"target_fingerprint":BASELINE,"before":before,"after":after,"sequences":sequences})
    );
    Ok(())
}
