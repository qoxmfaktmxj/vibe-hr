use crate::{ApiError, AppState};
use axum::{Json, extract::State};
use serde::Serialize;

#[derive(Serialize, sqlx::FromRow)]
pub(crate) struct Summary {
    total_employees: i64,
    total_departments: i64,
    attendance_present_today: i64,
    attendance_late_today: i64,
    attendance_absent_today: i64,
    pending_leave_requests: i64,
}

pub(crate) async fn summary(State(state): State<AppState>) -> Result<Json<Summary>, ApiError> {
    let summary = sqlx::query_as(
        "SELECT (SELECT count(*) FROM hr_employees) AS total_employees,
                (SELECT count(*) FROM org_departments) AS total_departments,
                count(*) FILTER (WHERE attendance_status='present') AS attendance_present_today,
                count(*) FILTER (WHERE attendance_status='late') AS attendance_late_today,
                count(*) FILTER (WHERE attendance_status='absent') AS attendance_absent_today,
                (SELECT count(*) FROM tim_leave_requests WHERE request_status='pending') AS pending_leave_requests
         FROM tim_attendance_daily WHERE work_date=(statement_timestamp() AT TIME ZONE 'Asia/Seoul')::date"
    ).fetch_one(&state.pool).await?;
    Ok(Json(summary))
}
