use serde_json::{Value, json};
use sqlx::PgPool;
use std::{error::Error, path::Path};

type Check = Result<(), Box<dyn Error>>;

pub async fn preflight(pool: &PgPool) -> Check {
    if std::env::var("VIBEHR_SCHEMA_OWNER").as_deref() != Ok("flyway") {
        return Err("Migration requires VIBEHR_SCHEMA_OWNER=flyway".into());
    }
    let (legacy,history,tables):(bool,bool,bool)=sqlx::query_as("SELECT to_regclass('public.alembic_version') IS NOT NULL,
        to_regclass('public.flyway_schema_history') IS NOT NULL,
        EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name NOT IN('alembic_version','flyway_schema_history'))")
        .fetch_one(pool).await?;
    if legacy || (tables && !history) {
        return Err("Existing schema requires the explicit adoption procedure".into());
    }
    Ok(())
}

fn remove_exact(table: &mut Value, section: &str, name: &str, expected: Value) -> Check {
    let rows = table[section].as_array_mut().ok_or("invalid catalog")?;
    let i = rows
        .iter()
        .position(|r| r["name"] == name)
        .ok_or_else(|| format!("Missing {section} entry {name}"))?;
    if rows.remove(i) != expected {
        return Err(format!("Schema drift in {name}").into());
    }
    Ok(())
}
fn column(name: &str, kind: &str, udt: &str, nullable: &str) -> Value {
    json!({"name":name,"data_type":kind,"udt_name":udt,"nullable":nullable,"default":null,"character_maximum_length":null,"numeric_precision":null,"numeric_scale":null,"datetime_precision":null})
}

pub async fn verify(pool: &PgPool, path: &Path) -> Check {
    let envelope: Value = serde_json::from_slice(&std::fs::read(path)?)?;
    let expected = envelope
        .get("metadata")
        .ok_or("Expected immutable V1 metadata envelope")?;
    if envelope["metadata_sha256"] != legacy::BASELINE
        || legacy::sha256(&serde_json::to_vec(expected)?) != legacy::BASELINE
    {
        return Err("The supplied metadata manifest differs from the reviewed V1 baseline".into());
    }
    let mut actual: Value = sqlx::query_scalar(include_str!("catalog.sql"))
        .fetch_one(pool)
        .await?;
    for table in actual["tables"]
        .as_array_mut()
        .ok_or("Missing application catalog")?
    {
        match table["name"].as_str() {
            Some("tim_leave_requests") => {
                for name in ["annual_charge_breakdown", "payroll_minutes_snapshot"] {
                    remove_exact(
                        table,
                        "columns",
                        name,
                        column(name, "jsonb", "jsonb", "YES"),
                    )?;
                }
            }
            Some("tim_attendance_daily") => {
                let mut fk = column("approved_leave_request_id", "integer", "int4", "YES");
                fk["numeric_precision"] = json!("32");
                fk["numeric_scale"] = json!("0");
                remove_exact(table, "columns", "approved_leave_request_id", fk)?;
                let mut status = column("leave_base_status", "character varying", "varchar", "YES");
                status["character_maximum_length"] = json!("20");
                remove_exact(table, "columns", "leave_base_status", status)?;
                let mut generated = column("leave_generated", "boolean", "bool", "NO");
                generated["default"] = json!("false");
                remove_exact(table, "columns", "leave_generated", generated)?;
                remove_exact(
                    table,
                    "constraints",
                    "fk_tim_attendance_approved_leave",
                    json!({"name":"fk_tim_attendance_approved_leave","type":"f","definition":"FOREIGN KEY (approved_leave_request_id) REFERENCES tim_leave_requests(id)"}),
                )?;
            }
            Some("tim_month_closes") => {
                let mut count = column("half_day_count", "integer", "int4", "NO");
                count["numeric_precision"] = json!("32");
                count["numeric_scale"] = json!("0");
                count["default"] = json!("0");
                remove_exact(table, "columns", "half_day_count", count)?;
            }
            _ => {}
        }
    }
    if &actual != expected {
        for section in ["tables", "sequences", "extensions"] {
            if actual[section] != expected[section] {
                let delta = actual[section]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .zip(expected[section].as_array().into_iter().flatten())
                    .find(|(a, b)| a != b);
                let name = delta
                    .and_then(|(a, _)| a["name"].as_str())
                    .unwrap_or("count");
                return Err(format!("PostgreSQL catalog differs in {section} at {name}").into());
            }
        }
        return Err("PostgreSQL catalog differs from checked-in manifest".into());
    }
    Ok(())
}
pub mod legacy;
pub mod seed;
