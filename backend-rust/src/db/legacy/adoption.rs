use super::*;
use percent_encoding::percent_decode_str;
use ring::rand::{SecureRandom, SystemRandom};
use sqlx::{ConnectOptions, PgPool, postgres::PgConnectOptions};
use std::{path::PathBuf, process::Command};

const DESCRIPTION: &str = "verified Alembic org_mapping_foundation_20260722";
const V2: &str = "V2__retire_alembic_version_marker.sql";
const V2_CHECKSUM: i32 = -1027260723;
const ASSETS: [(&str, &str); 2] = [
    (
        "V1__alembic_head_baseline.sql",
        "e96d705057fb595d1bfd9ca21a8e97b6fa562a1096083c191468e4bddb59aa36",
    ),
    (
        V2,
        "198202661fca40cfe4036cb4488a6b4b354cafaf35e22b53c08b5dcb75b6f192",
    ),
];

struct FlywayAssets(PathBuf);
impl FlywayAssets {
    fn create(source: &Path) -> Result<Self> {
        let mut random = [0; 16];
        SystemRandom::new()
            .fill(&mut random)
            .map_err(|_| "Cannot allocate a temporary Flyway migration directory")?;
        let path = std::env::temp_dir().join(format!("vibehr-adoption-{}", hex::encode(random)));
        let mut builder = std::fs::DirBuilder::new();
        #[cfg(unix)]
        {
            use std::os::unix::fs::DirBuilderExt;
            builder.mode(0o700);
        }
        builder.create(&path)?;
        let dir = Self(path);
        for (name, hash) in ASSETS {
            std::fs::write(dir.0.join(name), checked_sql(&source.join(name), hash)?)?;
        }
        Ok(dir)
    }
    fn run(&self, action: &str, options: &PgConnectOptions) -> Result<()> {
        let mut url = options.to_url_lossy();
        let user = options.get_username();
        let password = url
            .password()
            .map(|s| percent_decode_str(s).decode_utf8())
            .transpose()?
            .map(|s| s.into_owned());
        url.set_password(None)
            .map_err(|_| "Cannot convert datasource URL")?;
        url.set_username("")
            .map_err(|_| "Cannot convert datasource URL")?;
        url.set_scheme("postgresql")
            .map_err(|_| "Cannot convert datasource URL")?;
        let mut cmd = Command::new(if cfg!(windows) {
            "flyway.cmd"
        } else {
            "flyway"
        });
        // Set the Flyway connection from the same PgConnectOptions as the advisory-lock connection.
        // Keep credentials in the child environment; no JDBC userinfo or command-line secrets.
        cmd.env("FLYWAY_URL", format!("jdbc:{url}"))
            .env("FLYWAY_USER", user);
        if let Some(password) = password {
            cmd.env("FLYWAY_PASSWORD", password);
        } else {
            cmd.env_remove("FLYWAY_PASSWORD");
        }
        let result = cmd
            .arg("-defaultSchema=public")
            .arg("-schemas=public")
            .arg("-table=flyway_schema_history")
            .arg("-baselineOnMigrate=false")
            .arg("-baselineVersion=1")
            .arg(format!("-baselineDescription={DESCRIPTION}"))
            .arg("-cleanDisabled=true")
            .arg("-validateOnMigrate=true")
            .arg("-target=2")
            .arg(format!("-locations=filesystem:{}", self.0.display()))
            .arg(action)
            .status()?;
        if !result.success() {
            return Err(format!("Flyway {action} failed ({result}).").into());
        }
        Ok(())
    }
}
impl Drop for FlywayAssets {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

async fn matches_history(conn: &mut PgConnection) -> Result<()> {
    let valid:bool=sqlx::query_scalar("SELECT count(*)=2 AND count(*) FILTER (WHERE installed_rank=1 AND version='1'
        AND description=$1 AND type='BASELINE' AND script=$1 AND coalesce(checksum,0)=0 AND success)=1
        AND count(*) FILTER (WHERE installed_rank=2 AND version='2' AND description='retire alembic version marker'
        AND type='SQL' AND script=$2 AND checksum=$3 AND success)=1 FROM public.flyway_schema_history")
        .bind(DESCRIPTION).bind(V2).bind(V2_CHECKSUM).fetch_one(conn).await?;
    if !valid {
        return Err(
            "Flyway history does not match the exact expected V1/V2 adoption records.".into(),
        );
    }
    Ok(())
}
pub async fn adopt(pool: &PgPool, confirmation: &str, migrations: &Path) -> Result<()> {
    if confirmation != "adopt-exact-alembic-head" {
        return Err("Adoption requires the exact explicit confirmation token.".into());
    }
    let assets = FlywayAssets::create(migrations)?;
    let options = pool.connect_options();
    // Detach the physical session: every return path (including cancellation) drops
    // it instead of returning a session-level advisory lock to the connection pool.
    let mut conn = pool.acquire().await?.detach();
    sqlx::query("SELECT pg_advisory_lock($1)")
        .bind(382_671_113_071i64)
        .execute(&mut conn)
        .await?;
    let adopted = exists(&mut conn, "public.flyway_schema_history").await?;
    if adopted {
        if exists(&mut conn, "public.alembic_version").await? {
            return Err("Both migration histories exist; manual recovery is required before retrying adoption.".into());
        }
        matches_history(&mut conn).await?;
    } else {
        require_head(&mut conn).await?;
        verify_fingerprint(&mut conn, BASELINE).await?;
        assets.run("baseline", &options)?;
        assets.run("migrate", &options)?;
        if exists(&mut conn, "public.alembic_version").await? {
            return Err("Flyway adoption did not retire alembic_version.".into());
        }
        matches_history(&mut conn).await?;
    }
    assets.run("validate", &options)?;
    verify_fingerprint(&mut conn, BASELINE).await?;
    println!(
        "Flyway adoption result: {}",
        if adopted {
            "ALREADY_ADOPTED"
        } else {
            "ADOPTED"
        }
    );
    Ok(())
}
