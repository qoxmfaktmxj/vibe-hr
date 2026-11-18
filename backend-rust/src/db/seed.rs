use serde_json::json;
use sqlx::{PgPool, postgres::PgConnectOptions};
use std::{env, error::Error};

fn allowed(options: &PgConnectOptions, profiles: &str, opt_in: bool) -> bool {
    let profiles: Vec<_> = profiles
        .split(',')
        .map(|s| s.trim().to_ascii_lowercase())
        .collect();
    let local = profiles
        .iter()
        .any(|p| matches!(p.as_str(), "local" | "dev"));
    let production = profiles.iter().any(|p| {
        matches!(
            p.as_str(),
            "prod" | "production" | "stage" | "staging" | "flyway-cutover" | "flyway-adoption"
        )
    });
    let database = options.get_database().unwrap_or("").to_ascii_lowercase();
    local
        && !production
        && opt_in
        && matches!(
            options.get_host(),
            "localhost" | "127.0.0.1" | "::1" | "[::1]"
        )
        && !database.is_empty()
        && !database.contains("prod")
        && !database.contains("live")
}

pub async fn run(
    pool: &PgPool,
    options: &PgConnectOptions,
    mode: &str,
    confirmation: &str,
    count: usize,
) -> Result<(), Box<dyn Error>> {
    if !matches!(mode, "dev" | "demo") || mode != confirmation || !(1..=6000).contains(&count) {
        return Err("Invalid fixture confirmation or employee count".into());
    }
    let profiles = env::var("SPRING_PROFILES_ACTIVE").unwrap_or_default();
    let opt_in =
        env::var("VIBEHR_ALLOW_FIXTURE_SEEDING").is_ok_and(|s| s.eq_ignore_ascii_case("true"));
    if !allowed(options, &profiles, opt_in) {
        return Err(
            "Fixtures require an explicit loopback local or dev database and seed opt-in".into(),
        );
    }
    let mut tx = pool.begin().await?;
    let (db, legacy): (String, bool) = sqlx::query_as(
        "SELECT current_database(), to_regclass('public.alembic_version') IS NOT NULL",
    )
    .fetch_one(&mut *tx)
    .await?;
    if Some(db.as_str()) != options.get_database() || legacy {
        return Err("Unexpected database or Alembic marker".into());
    }
    let v3: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM flyway_schema_history WHERE success AND version='3'",
    )
    .fetch_one(&mut *tx)
    .await?;
    if v3 != 1 {
        return Err("Fixture seeding requires successful V3 reference-data ownership".into());
    }
    let dept: i32 = sqlx::query_scalar("SELECT id FROM org_departments WHERE code='HQ-HR'")
        .fetch_one(&mut *tx)
        .await?;
    // A fixed, local-only hash preserves the documented development login method.
    let password = "pbkdf2_sha256$100000$b8779fb945e86d8b83bc6bfbbe2f6003$c0704e8b31440aac71f64b0303014b36e060d8236dd898df99808c8431557e01";
    let rows: Vec<(String, String, String, String, String)> = if mode == "dev" {
        [
            (
                "admin-local",
                "admin@vibe-hr.local",
                "Admin",
                "HR-0001",
                "HR Director",
            ),
            (
                "admin",
                "admin2@vibe-hr.local",
                "Admin",
                "HR-0002",
                "HR Manager",
            ),
        ]
        .map(|(a, b, c, d, e)| (a.into(), b.into(), c.into(), d.into(), e.into()))
        .into()
    } else {
        (1..=count)
            .map(|i| {
                (
                    format!("kr-{i:04}"),
                    format!("kr-{i:04}@vibe-hr.local"),
                    format!("Demo Employee {i:04}"),
                    format!("DEMO-{i:04}"),
                    if i % 7 == 0 {
                        "Team Lead".into()
                    } else {
                        "Employee".into()
                    },
                )
            })
            .collect()
    };
    for (login, email, name, no, title) in rows {
        let user:i32=sqlx::query_scalar("INSERT INTO auth_users(login_id,email,password_hash,display_name,is_active,created_at,updated_at) VALUES($1,$2,$3,$4,true,'2026-01-01','2026-01-01')
          ON CONFLICT(login_id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,is_active=true,updated_at=excluded.updated_at RETURNING id")
          .bind(login).bind(email).bind(password).bind(name).fetch_one(&mut *tx).await?;
        let roles = if mode == "dev" {
            vec!["employee", "admin"]
        } else {
            vec!["employee"]
        };
        sqlx::query("INSERT INTO auth_user_roles(user_id,role_id,assigned_at) SELECT $1,id,'2026-01-01' FROM auth_roles WHERE code=ANY($2) ON CONFLICT DO NOTHING").bind(user).bind(roles).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO hr_employees(user_id,employee_no,department_id,position_title,hire_date,employment_status,created_at,updated_at)
          VALUES($1,$2,$3,$4,'2025-01-01','active','2026-01-01','2026-01-01') ON CONFLICT(user_id) DO UPDATE SET employee_no=excluded.employee_no,department_id=excluded.department_id,position_title=excluded.position_title,employment_status='active',updated_at=excluded.updated_at")
          .bind(user).bind(no).bind(dept).bind(title).execute(&mut *tx).await?;
    }
    let (count,signature):(i64,String)=sqlx::query_as("SELECT count(*),coalesce(string_agg(u.login_id||':'||e.employee_no,',' ORDER BY u.login_id),'') FROM auth_users u JOIN hr_employees e ON u.id=e.user_id WHERE u.login_id LIKE $1")
        .bind(if mode=="dev"{"admin%"}else{"kr-%"}).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    let digest = ring::digest::digest(&ring::digest::SHA256, signature.as_bytes());
    println!(
        "{}",
        json!({"row_count":count,"checksum":hex::encode(digest)})
    );
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fixture_boundaries() {
        let local = "postgres://localhost/local_test".parse().unwrap();
        assert!(allowed(&local, "local,dev-seed", true));
        for p in ["dev,prod", "local,flyway-cutover", "default", "dev,staging"] {
            assert!(!allowed(&local, p, true));
        }
        assert!(!allowed(&local, "dev", false));
        for url in [
            "postgres://postgres/fixture",
            "postgres://localhost/live_copy",
            "postgres://127.0.0.1/prod",
        ] {
            assert!(!allowed(&url.parse().unwrap(), "local", true));
        }
    }
}
