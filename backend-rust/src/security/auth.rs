use axum::{
    Extension, Json, Router,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{PgConnection, PgPool, Postgres, Transaction};

use super::{BffPrincipal, CurrentUser, SecurityState, epoch_seconds, password_matches};
use crate::{
    ApiError, AppState,
    input::{self, Body, Validate, Violation},
    session_policy,
};
use ring::rand::{SecureRandom, SystemRandom};

pub fn auth_routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/auth/login", post(login))
        .route("/api/v1/auth/me", get(me))
        .route("/api/v1/auth/refresh", post(refresh))
        .route("/api/v1/auth/impersonation/users", get(candidates))
        .route("/api/v1/auth/impersonation/login", post(impersonate))
        .route("/api/v1/auth/social/exchange", post(social))
}

#[derive(Serialize, sqlx::FromRow)]
struct LoginUser {
    id: i32,
    email: String,
    display_name: String,
    roles: Vec<String>,
}

#[derive(Serialize)]
struct LoginResponse {
    access_token: String,
    token_type: &'static str,
    user: LoginUser,
    expires_at: i64,
    expires_in_sec: i64,
    #[serde(flatten)]
    policy: session_policy::Policy,
}

async fn active_user(conn: &mut PgConnection, id: i32) -> Result<Option<LoginUser>, ApiError> {
    Ok(sqlx::query_as(
        "SELECT id, email, display_name,
                ARRAY(SELECT r.code::text FROM auth_roles r JOIN auth_user_roles ur ON ur.role_id = r.id
                      WHERE ur.user_id = u.id ORDER BY r.id) AS roles
         FROM auth_users u WHERE id = $1 AND is_active"
    ).bind(id).fetch_optional(conn).await?)
}

async fn complete_login(
    mut tx: Transaction<'_, Postgres>,
    security: &SecurityState,
    user: LoginUser,
) -> Result<Json<LoginResponse>, ApiError> {
    let policy = session_policy::read(&mut tx).await?;
    sqlx::query(
        "UPDATE auth_users SET last_login_at = statement_timestamp() AT TIME ZONE 'UTC',
                    updated_at = statement_timestamp() AT TIME ZONE 'UTC' WHERE id = $1",
    )
    .bind(user.id)
    .execute(&mut *tx)
    .await?;
    let (access_token, expires_at) = security.issue_token(user.id, policy.access_ttl_min);
    let expires_in_sec = (expires_at - epoch_seconds()).max(0);
    tx.commit().await?;
    Ok(Json(LoginResponse {
        access_token,
        token_type: "bearer",
        user,
        expires_at,
        expires_in_sec,
        policy,
    }))
}

#[derive(Deserialize)]
struct LoginRequest {
    enter_cd: Option<String>,
    login_id: Option<String>,
    password: Option<String>,
}

fn text_violations<const N: usize>(
    fields: [(&str, Option<&str>, usize, usize); N],
) -> Vec<Violation> {
    fields
        .into_iter()
        .flat_map(|(name, value, min, max)| {
            [
                input::not_blank(name, value),
                input::size(name, value, min, max),
            ]
        })
        .flatten()
        .collect()
}

impl Validate for LoginRequest {
    fn validate(&self) -> Vec<Violation> {
        text_violations([
            ("enter_cd", self.enter_cd.as_deref(), 0, 20),
            ("login_id", self.login_id.as_deref(), 2, 50),
            ("password", self.password.as_deref(), 4, 128),
        ])
    }
}

async fn login(
    State(state): State<AppState>,
    Extension(assertion): Extension<BffPrincipal>,
    Body(payload): Body<LoginRequest>,
) -> Response {
    let enter = payload.enter_cd.as_deref().unwrap_or_default();
    let login = payload.login_id.as_deref().unwrap_or_default();
    if let Err(err) = state.security.check_login(&assertion, enter, login) {
        return err.into_response();
    }
    login_account(&state, enter, login, payload.password.unwrap_or_default())
        .await
        .into_response()
}

fn invalid_login() -> ApiError {
    ApiError::new(
        StatusCode::UNAUTHORIZED,
        "아이디 또는 비밀번호가 올바르지 않습니다.",
    )
}

async fn login_account(
    state: &AppState,
    enter: &str,
    login: &str,
    password: String,
) -> Result<Json<LoginResponse>, ApiError> {
    let mut tx = state.pool.begin().await?;
    let row: Option<(i32, String)> = sqlx::query_as(
        "SELECT u.id, u.password_hash FROM auth_users u
         WHERE u.is_active AND u.login_id = $1
           AND EXISTS(SELECT 1 FROM org_corporations WHERE is_active AND enter_cd = $2)",
    )
    .bind(login)
    .bind(enter.trim().to_uppercase())
    .fetch_optional(&mut *tx)
    .await?;
    let (id, hash) = row.ok_or_else(invalid_login)?;
    let matches = tokio::task::spawn_blocking(move || password_matches(&password, &hash))
        .await
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error"))?;
    if !matches {
        return Err(invalid_login());
    }
    let user = active_user(&mut tx, id).await?.ok_or_else(invalid_login)?;
    complete_login(tx, &state.security, user).await
}

fn invalid_access() -> ApiError {
    ApiError::new(StatusCode::UNAUTHORIZED, "Invalid access token.")
}

async fn me(
    State(state): State<AppState>,
    Extension(actor): Extension<CurrentUser>,
) -> Result<Json<LoginUser>, ApiError> {
    let mut conn = state.pool.acquire().await?;
    Ok(Json(
        active_user(&mut conn, actor.id)
            .await?
            .ok_or_else(invalid_access)?,
    ))
}

async fn refresh(
    State(state): State<AppState>,
    Extension(actor): Extension<CurrentUser>,
) -> Result<Json<LoginResponse>, ApiError> {
    let mut tx = state.pool.begin().await?;
    let user = active_user(&mut tx, actor.id)
        .await?
        .ok_or_else(invalid_access)?;
    complete_login(tx, &state.security, user).await
}

#[derive(Deserialize)]
struct ImpersonationRequest {
    user_id: Option<i64>,
}
impl Validate for ImpersonationRequest {
    fn validate(&self) -> Vec<Violation> {
        input::range("user_id", self.user_id.unwrap_or_default(), 1, i64::MAX)
            .into_iter()
            .collect()
    }
}

async fn impersonate(
    State(state): State<AppState>,
    Extension(actor): Extension<CurrentUser>,
    Body(payload): Body<ImpersonationRequest>,
) -> Result<Json<LoginResponse>, ApiError> {
    actor.require_admin()?;
    let id = i32::try_from(payload.user_id.unwrap_or_default()).map_err(|_| {
        ApiError::new(
            StatusCode::BAD_REQUEST,
            "target_user_id is outside the supported INTEGER range.",
        )
    })?;
    let mut tx = state.pool.begin().await?;
    let user = active_user(&mut tx, id).await?.ok_or_else(|| {
        ApiError::new(
            StatusCode::NOT_FOUND,
            "전환 대상 사용자를 찾을 수 없습니다.",
        )
    })?;
    complete_login(tx, &state.security, user).await
}

#[derive(Deserialize)]
struct CandidateQuery {
    query: Option<String>,
    limit: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
struct Candidate {
    id: i32,
    login_id: String,
    display_name: String,
}

#[derive(Serialize)]
struct Candidates {
    users: Vec<Candidate>,
}

fn query_violation(name: &str, kind: &'static str, msg: &str, value: &str) -> ApiError {
    ApiError::validation(vec![Violation {
        kind,
        loc: vec![json!("query"), json!(name)],
        msg: msg.to_owned(),
        input: json!(value),
    }])
}

async fn candidates(
    State(state): State<AppState>,
    Extension(actor): Extension<CurrentUser>,
    Query(params): Query<CandidateQuery>,
) -> Result<Json<Candidates>, ApiError> {
    let query = params.query.as_deref().unwrap_or("");
    let raw_limit = params
        .limit
        .as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or("20");
    let limit: i32 = raw_limit.trim().parse().map_err(|_| {
        query_violation(
            "limit",
            "int_parsing",
            "Input should be a valid integer, unable to parse string as an integer",
            raw_limit,
        )
    })?;
    let constraint = if query.encode_utf16().count() > 100 {
        Some("impersonationUsers.query: size must be between 0 and 100")
    } else if limit < 1 {
        Some("impersonationUsers.limit: must be greater than or equal to 1")
    } else if limit > 100 {
        Some("impersonationUsers.limit: must be less than or equal to 100")
    } else {
        None
    };
    if let Some(msg) = constraint {
        return Err(ApiError::validation(vec![Violation {
            kind: "validation_error",
            loc: vec![json!("request")],
            msg: msg.to_owned(),
            input: serde_json::Value::Null,
        }]));
    }
    actor.require_admin()?;
    let users = sqlx::query_as("SELECT id, login_id, display_name FROM auth_users WHERE is_active AND id <> $1
        AND (login_id ILIKE $2 OR display_name ILIKE $2 OR email ILIKE $2) ORDER BY login_id LIMIT $3")
        .bind(actor.id).bind(format!("%{}%", query.trim())).bind(limit).fetch_all(&state.pool).await?;
    Ok(Json(Candidates { users }))
}

#[derive(Deserialize)]
struct SocialRequest {
    provider: Option<String>,
    provider_user_id: Option<String>,
    email: Option<String>,
    display_name: Option<String>,
}

impl Validate for SocialRequest {
    fn validate(&self) -> Vec<Violation> {
        text_violations([
            ("provider", self.provider.as_deref(), 2, 20),
            ("provider_user_id", self.provider_user_id.as_deref(), 0, 100),
            ("email", self.email.as_deref(), 3, 320),
            ("display_name", self.display_name.as_deref(), 0, 100),
        ])
    }
}

async fn social(
    State(state): State<AppState>,
    Extension(assertion): Extension<BffPrincipal>,
    Body(payload): Body<SocialRequest>,
) -> Response {
    let provider = payload.provider.as_deref().unwrap_or_default();
    let subject = payload.provider_user_id.as_deref().unwrap_or_default();
    let email = payload.email.as_deref().unwrap_or_default();
    let name = payload.display_name.as_deref().unwrap_or_default();
    if let Err(err) = assertion.require_social_binding(provider, subject, email, name) {
        return err.into_response();
    }
    exchange_account(&state.pool, &state.security, provider, subject, email, name)
        .await
        .into_response()
}

async fn exchange_account(
    pool: &PgPool,
    security: &SecurityState,
    provider: &str,
    subject: &str,
    email: &str,
    name: &str,
) -> Result<Json<LoginResponse>, ApiError> {
    let mut tx = pool.begin().await?;
    let email = email.trim().to_lowercase();
    for key in [
        format!("auth:social:email:{email}"),
        format!(
            "auth:social:provider:{}:{}",
            provider.trim().to_lowercase(),
            subject.trim()
        ),
    ] {
        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
            .bind(key)
            .execute(&mut *tx)
            .await?;
    }
    let existing: Option<(i32, bool)> =
        sqlx::query_as("SELECT id,is_active FROM auth_users WHERE email=$1")
            .bind(&email)
            .fetch_optional(&mut *tx)
            .await?;
    let id = match existing {
        Some((id, true)) => id,
        Some((_, false)) => {
            return Err(ApiError::new(
                StatusCode::BAD_REQUEST,
                "비활성화된 계정입니다.",
            ));
        }
        None => create_social_user(&mut tx, provider, subject, &email, name).await?,
    };
    sqlx::query("INSERT INTO auth_user_roles(user_id,role_id,assigned_at)
        SELECT $1,id,statement_timestamp() AT TIME ZONE 'UTC' FROM auth_roles WHERE code = 'employee'
        ON CONFLICT (user_id,role_id) DO NOTHING").bind(id).execute(&mut *tx).await?;
    ensure_employee(&mut tx, id).await?;
    let user = active_user(&mut tx, id).await?.ok_or_else(invalid_access)?;
    complete_login(tx, security, user).await
}

fn social_password_hash() -> Result<String, ApiError> {
    let mut secret = [0u8; 32];
    SystemRandom::new()
        .fill(&mut secret)
        .and_then(|_| super::hash_password(&hex::encode(secret)))
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error"))
}

fn utf16_prefix(text: &str, max: usize) -> &str {
    let mut units = 0;
    for (offset, ch) in text.char_indices() {
        units += ch.len_utf16();
        if units > max {
            return &text[..offset];
        }
    }
    text
}

async fn create_social_user(
    conn: &mut PgConnection,
    provider: &str,
    subject: &str,
    email: &str,
    name: &str,
) -> Result<i32, ApiError> {
    let hash = tokio::task::spawn_blocking(social_password_hash)
        .await
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error"))??;
    let base = format!("{provider}-{subject}").to_lowercase();
    let base = utf16_prefix(&base, 50);
    let mut id = base.to_string();
    let mut sequence = 1;
    loop {
        // The email and provider locks protect the same identity. A long truncated login
        // can also collide across independent providers/subjects, so allocate it atomically.
        let inserted: Option<i32> = sqlx::query_scalar("INSERT INTO auth_users
            (login_id,email,password_hash,display_name,is_active,created_at,updated_at)
            VALUES ($1,$2,$3,$4,true,statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC')
            ON CONFLICT (login_id) DO NOTHING RETURNING id")
            .bind(&id).bind(email).bind(&hash).bind(name.trim()).fetch_optional(&mut *conn).await?;
        if let Some(id) = inserted {
            return Ok(id);
        }
        let suffix = format!("-{sequence}");
        id = format!("{}{suffix}", utf16_prefix(base, 50 - suffix.len()));
        sequence += 1;
    }
}

async fn ensure_employee(conn: &mut PgConnection, user_id: i32) -> Result<(), ApiError> {
    let department: i32 =
        sqlx::query_scalar("SELECT id FROM org_departments WHERE is_active ORDER BY id LIMIT 1")
            .fetch_optional(&mut *conn)
            .await?
            .ok_or_else(|| {
                ApiError::new(StatusCode::BAD_REQUEST, "활성 부서를 찾을 수 없습니다.")
            })?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext('hr_employee_number_namespace'))")
        .execute(&mut *conn)
        .await?;
    let id: Option<i32> = sqlx::query_scalar("SELECT id FROM hr_employees WHERE user_id=$1")
        .bind(user_id)
        .fetch_optional(&mut *conn)
        .await?;
    let employee_id = match id {
        Some(id) => id,
        None => {
            let employee_no: String = sqlx::query_scalar(
                "WITH candidates(n) AS (
                     SELECT 1 UNION ALL
                     SELECT substring(employee_no from 5)::integer + 1 FROM hr_employees
                     WHERE employee_no ~ '^EMP-[0-9]{6}$'
                 )
                 SELECT 'EMP-' || lpad(n::text,6,'0') FROM candidates
                 WHERE n < 1000000 AND NOT EXISTS (
                     SELECT 1 FROM hr_employees WHERE employee_no = 'EMP-' || lpad(n::text,6,'0'))
                 ORDER BY n LIMIT 1",
            )
            .fetch_optional(&mut *conn)
            .await?
            .ok_or_else(|| {
                ApiError::new(StatusCode::BAD_REQUEST, "No employee number is available.")
            })?;
            sqlx::query_scalar("INSERT INTO hr_employees(user_id, employee_no, department_id, position_title, hire_date, employment_status, created_at, updated_at)
                VALUES($1,$2,$3,'사원',(statement_timestamp() at time zone 'UTC')::date,'active',
                       statement_timestamp() at time zone 'UTC',statement_timestamp() at time zone 'UTC') RETURNING id")
                .bind(user_id).bind(employee_no).bind(department).fetch_one(&mut *conn).await?
        }
    };
    sqlx::query(
        "INSERT INTO hr_employee_basic_profiles(employee_id, created_at, updated_at)
        SELECT $1,statement_timestamp() at time zone 'UTC',statement_timestamp() at time zone 'UTC'
        WHERE NOT EXISTS(SELECT 1 FROM hr_employee_basic_profiles WHERE employee_id=$1)
        ON CONFLICT(employee_id) DO NOTHING",
    )
    .bind(employee_id)
    .execute(&mut *conn)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_social_accounts_have_independent_hashes_and_no_identity_password() {
        let first = social_password_hash().unwrap();
        let second = social_password_hash().unwrap();
        assert_ne!(first, second);
        assert!(!password_matches("social-google-synthetic", &first));
        assert_eq!(utf16_prefix("가🦀나", 2), "가");
        assert_eq!(utf16_prefix("가🦀나", 3), "가🦀");
    }
}
