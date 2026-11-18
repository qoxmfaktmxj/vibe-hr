use super::*;
use sqlx::PgConnection;

pub(super) async fn lock_run(
    connection: &mut PgConnection,
    id: i32,
) -> Result<(String, String), ApiError> {
    let (month, status): (String, String) =
        sqlx::query_as("SELECT year_month,status FROM pay_payroll_runs WHERE id=$1 FOR UPDATE")
            .bind(id)
            .fetch_optional(&mut *connection)
            .await?
            .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Payroll run not found."))?;
    let (year, month_number) = month
        .split_once('-')
        .and_then(|(y, m)| Some((y.parse::<i32>().ok()?, m.parse::<u32>().ok()?)))
        .filter(|(_, m)| (1..=12).contains(m))
        .ok_or_else(|| {
            ApiError::new(
                StatusCode::BAD_REQUEST,
                "year_month must be YYYY-MM format.",
            )
        })?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))")
        .bind(format!("tim:month-close:{year}:{month_number}"))
        .execute(&mut *connection)
        .await?;
    Ok((month, status))
}

pub(super) async fn mark_paid(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    require_role(&user, false)?;
    let mut tx = state.pool.begin().await?;
    let (_, status) = lock_run(&mut tx, id).await?;
    if status != "closed" {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "Only closed run can be marked paid.",
        ));
    }
    sqlx::query(
        "UPDATE pay_payroll_runs SET status='paid',paid_at=timezone('UTC',clock_timestamp()),
            updated_at=timezone('UTC',clock_timestamp()) WHERE id=$1",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO pay_payroll_run_events (run_id,event_type,message,created_at)
            VALUES ($1,'paid','Payroll run marked as paid.',timezone('UTC',clock_timestamp()))",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;
    let run = read::run_item(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({"run":run})))
}

async fn locked_voucher(connection: &mut PgConnection, id: i32) -> Result<String, ApiError> {
    sqlx::query_scalar("SELECT status FROM pay_vouchers WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(connection)
        .await?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Voucher not found."))
}

pub(super) async fn confirm(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    require_role(&user, false)?;
    let mut tx = state.pool.begin().await?;
    if locked_voucher(&mut tx, id).await? != "draft" {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "Only draft voucher can be confirmed.",
        ));
    }
    sqlx::query("UPDATE pay_vouchers SET status='confirmed',confirmed_by=$2,
            confirmed_at=timezone('UTC',clock_timestamp()),updated_at=timezone('UTC',clock_timestamp()) WHERE id=$1")
        .bind(id).bind(user.id).execute(&mut *tx).await?;
    let voucher = read::voucher_item(&mut *tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({"voucher":voucher})))
}

pub(super) async fn cancel(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<i32>,
) -> Reply {
    require_role(&user, false)?;
    let mut tx = state.pool.begin().await?;
    let status = locked_voucher(&mut tx, id).await?;
    if !matches!(status.as_str(), "draft" | "confirmed") {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "Only draft or confirmed voucher can be cancelled.",
        ));
    }
    sqlx::query("UPDATE pay_vouchers SET status='cancelled',updated_at=timezone('UTC',clock_timestamp()) WHERE id=$1")
        .bind(id).execute(&mut *tx).await?;
    let voucher = read::voucher_item(&mut *tx, id).await?;
    tx.commit().await?;
    Ok(Json(json!({"voucher":voucher})))
}
