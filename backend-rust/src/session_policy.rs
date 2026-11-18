use std::collections::HashMap;

use axum::{Extension, Json, Router, extract::State, http::StatusCode, routing::get};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;

use crate::{
    ApiError, AppState,
    input::{Body, Validate, Violation, range, size},
    security::CurrentUser,
};

const KEYS: [&str; 5] = [
    "auth.session.access_ttl_min",
    "auth.session.refresh_threshold_min",
    "auth.session.remember_enabled",
    "auth.session.remember_ttl_min",
    "auth.session.show_countdown",
];

#[derive(Serialize, PartialEq, Debug)]
pub struct Policy {
    pub access_ttl_min: i32,
    pub refresh_threshold_min: i32,
    pub remember_enabled: bool,
    pub remember_ttl_min: i32,
    pub show_countdown: bool,
}

impl Policy {
    fn from_settings(rows: HashMap<String, String>) -> Self {
        let integer = |key: &str, fallback| {
            rows.get(key)
                .and_then(|v| v.parse().ok())
                .unwrap_or(fallback)
        };
        let boolean = |key: &str| {
            rows.get(key).is_none_or(|v| {
                matches!(
                    v.trim().to_ascii_lowercase().as_str(),
                    "1" | "true" | "y" | "yes" | "on"
                )
            })
        };
        let access = integer(KEYS[0], 120);
        Self {
            access_ttl_min: access,
            refresh_threshold_min: integer(KEYS[1], 60).max(1).min(access),
            remember_enabled: boolean(KEYS[2]),
            remember_ttl_min: integer(KEYS[3], 43200),
            show_countdown: boolean(KEYS[4]),
        }
    }
}

pub async fn read(conn: &mut PgConnection) -> Result<Policy, ApiError> {
    let rows: Vec<(String, String)> =
        sqlx::query_as("SELECT key, value_text FROM app_system_settings WHERE key = ANY($1)")
            .bind(&KEYS[..])
            .fetch_all(conn)
            .await?;
    Ok(Policy::from_settings(rows.into_iter().collect()))
}

#[derive(Deserialize)]
pub struct PolicyUpdate {
    pub access_ttl_min: i32,
    pub refresh_threshold_min: i32,
    pub remember_enabled: Option<bool>,
    pub remember_ttl_min: i32,
    pub show_countdown: Option<bool>,
    pub reason: Option<String>,
}

impl Validate for PolicyUpdate {
    fn validate(&self) -> Vec<Violation> {
        [
            range("access_ttl_min", self.access_ttl_min.into(), 5, 1440),
            range(
                "refresh_threshold_min",
                self.refresh_threshold_min.into(),
                1,
                720,
            ),
            range("remember_ttl_min", self.remember_ttl_min.into(), 60, 43200),
            size("reason", self.reason.as_deref(), 0, 255),
        ]
        .into_iter()
        .flatten()
        .collect()
    }
}

#[derive(Serialize)]
struct PolicyResponse {
    policy: Policy,
}

async fn get_policy(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
) -> Result<Json<PolicyResponse>, ApiError> {
    user.require_admin()?;
    let mut conn = state.pool.acquire().await?;
    Ok(Json(PolicyResponse {
        policy: read(&mut conn).await?,
    }))
}

async fn put_policy(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Body(request): Body<PolicyUpdate>,
) -> Result<Json<PolicyResponse>, ApiError> {
    user.require_admin()?;
    Ok(Json(PolicyResponse {
        policy: update(&state.pool, request, user.id).await?,
    }))
}

pub fn routes() -> Router<AppState> {
    Router::new().route(
        "/api/v1/system-settings/auth-session",
        get(get_policy).put(put_policy),
    )
}

pub async fn update(
    pool: &sqlx::PgPool,
    request: PolicyUpdate,
    actor: i32,
) -> Result<Policy, ApiError> {
    if request.refresh_threshold_min > request.access_ttl_min {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "refresh_threshold_min cannot be greater than access_ttl_min",
        ));
    }
    let entries = [
        (
            KEYS[0],
            "int",
            request.access_ttl_min.to_string(),
            "Access JWT 만료시간(분)",
        ),
        (
            KEYS[1],
            "int",
            request.refresh_threshold_min.to_string(),
            "갱신 임계치(분)",
        ),
        (
            KEYS[2],
            "bool",
            request.remember_enabled.unwrap_or(true).to_string(),
            "Remember me 허용 여부",
        ),
        (
            KEYS[3],
            "int",
            request.remember_ttl_min.to_string(),
            "Remember me 쿠키 만료(분)",
        ),
        (
            KEYS[4],
            "bool",
            request.show_countdown.unwrap_or(true).to_string(),
            "상단 세션 카운트다운 표시",
        ),
    ];
    let mut tx = pool.begin().await?;
    for (key, kind, value, description) in entries {
        let changed_at = chrono::Utc::now().naive_utc();
        let previous: Option<(i32, String)> = sqlx::query_as(
            "SELECT id, value_text FROM app_system_settings WHERE key = $1 FOR UPDATE",
        )
        .bind(key)
        .fetch_optional(&mut *tx)
        .await?;
        let (id, old) = match previous {
            Some((id, old)) => {
                sqlx::query("UPDATE app_system_settings SET category='auth', value_type=$2, value_text=$3, description=$4, updated_by=$5, updated_at=$6 WHERE id=$1")
                    .bind(id).bind(kind).bind(&value).bind(description).bind(actor).bind(changed_at).execute(&mut *tx).await?;
                (id, Some(old))
            }
            None => {
                let id = sqlx::query_scalar("INSERT INTO app_system_settings (key,category,value_type,value_text,description,is_active,updated_by,updated_at) VALUES ($1,'auth',$2,$3,$4,true,$5,$6) RETURNING id")
                    .bind(key).bind(kind).bind(&value).bind(description).bind(actor).bind(changed_at).fetch_one(&mut *tx).await?;
                (id, None)
            }
        };
        sqlx::query("INSERT INTO app_system_setting_history (setting_id,key,old_value_text,new_value_text,changed_by,reason,changed_at) VALUES ($1,$2,$3,$4,$5,$6,$7)")
            .bind(id).bind(key).bind(old).bind(value).bind(actor).bind(request.reason.as_deref()).bind(changed_at).execute(&mut *tx).await?;
    }
    let result = read(&mut tx).await?;
    tx.commit().await?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_and_persisted_text_match_spring() {
        let defaults = Policy::from_settings(HashMap::new());
        assert_eq!(
            (
                defaults.access_ttl_min,
                defaults.refresh_threshold_min,
                defaults.remember_ttl_min
            ),
            (120, 60, 43200)
        );
        assert!(defaults.remember_enabled && defaults.show_countdown);
        let rows = HashMap::from([
            (KEYS[0].into(), "20".into()),
            (KEYS[1].into(), "100".into()),
            (KEYS[2].into(), " off ".into()),
            (KEYS[3].into(), "bad".into()),
            (KEYS[4].into(), " Y ".into()),
        ]);
        let policy = Policy::from_settings(rows);
        assert_eq!(policy.refresh_threshold_min, 20);
        assert_eq!(policy.remember_ttl_min, 43200);
        assert!(!policy.remember_enabled && policy.show_countdown);
    }
}
