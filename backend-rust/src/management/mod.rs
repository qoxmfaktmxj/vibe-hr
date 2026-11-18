use crate::input::params::{NumericPath as Path, Pagination, query_i32};
mod form;
mod read;
mod write;
use crate::{ApiError, AppState, menu, security::CurrentUser};
use axum::{
    Extension, Json, Router,
    extract::{Query, State},
    http::StatusCode,
    routing::{get, post},
};
use chrono::NaiveDate;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{PgConnection, PgPool};

type Reply = Result<Json<Value>, ApiError>;
#[derive(Copy, Clone, PartialEq, Eq)]
enum Screen {
    Companies,
    Managers,
    Requests,
    Projects,
    Inquiries,
    Contracts,
    Attendances,
    Masters,
    Configs,
    RequestSummary,
    StaffProjects,
    Revenue,
    AttendanceSummary,
}
impl Screen {
    fn is_admin(self) -> bool {
        matches!(self, Self::Masters | Self::Configs)
    }
    fn list_key(self) -> &'static str {
        if self == Self::Companies {
            "companies"
        } else {
            "items"
        }
    }
    fn item_key(self) -> &'static str {
        if self == Self::Companies {
            "company"
        } else {
            "item"
        }
    }
    fn not_found(self) -> ApiError {
        missing(match self {
            Self::Companies => "고객사를 찾을 수 없습니다.",
            Self::Requests => "추가개발 요청을 찾을 수 없습니다.",
            Self::Projects => "프로젝트를 찾을 수 없습니다.",
            Self::Inquiries => "문의를 찾을 수 없습니다.",
            Self::Contracts => "계약을 찾을 수 없습니다.",
            Self::Configs => "인프라 구성을 찾을 수 없습니다.",
            _ => "항목을 찾을 수 없습니다.",
        })
    }
}
fn missing(v: &str) -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, v)
}
fn bad(v: &str) -> ApiError {
    ApiError::new(StatusCode::BAD_REQUEST, v)
}
fn conflict(v: &str) -> ApiError {
    ApiError::new(StatusCode::CONFLICT, v)
}
fn integrity(e: sqlx::Error, msg: &str) -> ApiError {
    if e.as_database_error()
        .and_then(|e| e.code())
        .is_some_and(|s| s.starts_with("23"))
    {
        conflict(msg)
    } else {
        e.into()
    }
}
async fn allow(
    pool: &PgPool,
    user: &CurrentUser,
    screen: Screen,
    company_action: Option<&str>,
) -> Result<(), ApiError> {
    if !(user.has_role("admin") || (!screen.is_admin() && user.has_role("hr_manager"))) {
        return Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "Not enough permissions.",
        ));
    }
    if screen == Screen::Companies
        && let Some(code) = company_action
    {
        menu::require_action(pool, user.id, None, Some("/mng/companies"), code).await?;
    }
    Ok(())
}
fn param_error(name: &str, kind: &str, msg: &str, value: Value) -> ApiError {
    ApiError::with_detail(
        StatusCode::UNPROCESSABLE_ENTITY,
        json!([{"type":kind,"loc":["query",name],"msg":msg,"input":value}]),
    )
}
type Params = std::collections::HashMap<String, String>;
fn optional_int(q: &Params, key: &str) -> Result<Option<i32>, ApiError> {
    q.get(key)
        .filter(|v| !v.is_empty())
        .map(|v| query_i32(key, v))
        .transpose()
}
fn absent(key: &str) -> ApiError {
    param_error(key, "missing", "Field required", Value::Null)
}
#[derive(Default)]
struct Filter {
    company: Option<i32>,
    search: Option<String>,
    status: Option<String>,
    progress: Option<String>,
    id: Option<i32>,
    parent: Option<i32>,
}
impl Filter {
    fn from_query(q: &Params) -> Result<Self, ApiError> {
        Ok(Self {
            company: optional_int(q, "company_id")?.filter(|x| *x != 0),
            search: q
                .get("search")
                .map(|x| x.trim().to_owned())
                .filter(|x| !x.is_empty()),
            status: q
                .get("status_code")
                .filter(|x| !x.trim().is_empty())
                .cloned(),
            progress: q
                .get("progress_code")
                .filter(|x| !x.trim().is_empty())
                .cloned(),
            ..Self::default()
        })
    }
}
fn list(screen: Screen, rows: Vec<Value>, page: i32, limit: i32) -> Value {
    let total = rows.len();
    let offset = (i64::from(page) - 1) * i64::from(limit);
    let slice: Vec<_> = rows
        .into_iter()
        .skip(offset as usize)
        .take(limit as usize)
        .collect();
    json!({(screen.list_key()):slice,"page":page,"limit":limit,"total_count":total})
}
async fn list_route(
    s: AppState,
    u: CurrentUser,
    screen: Screen,
    q: Params,
    parent: Option<i32>,
) -> Reply {
    let method = match screen {
        Screen::Companies => "companies",
        Screen::Managers => "managerCompanies",
        Screen::Requests => "devRequests",
        Screen::Projects => "devProjects",
        Screen::Inquiries => "devInquiries",
        Screen::Contracts => "outsourceContracts",
        Screen::Attendances => "outsourceAttendances",
        Screen::Masters => "infraMasters",
        Screen::Configs => "infraConfigs",
        Screen::RequestSummary => "devRequestMonthlySummary",
        Screen::StaffProjects => "devStaffProjects",
        Screen::Revenue => "devStaffRevenue",
        Screen::AttendanceSummary => "outsourceAttendanceSummary",
    };
    let (p, l) = Pagination {
        page: q.get("page").cloned(),
        limit: q.get("limit").cloned(),
    }
    .parse(method)?;
    let mut filter = Filter::from_query(&q)?;
    filter.parent = parent;
    allow(&s.pool, &u, screen, Some("query")).await?;
    let rows = read::rows(&mut *s.pool.acquire().await?, screen, filter).await?;
    Ok(Json(list(screen, rows, p, l)))
}
async fn detail_route(s: AppState, u: CurrentUser, screen: Screen, id: i32) -> Reply {
    allow(&s.pool, &u, screen, None).await?;
    let value = read::one(&mut *s.pool.acquire().await?, screen, id).await?;
    Ok(Json(json!({(screen.item_key()):value})))
}
fn collection(screen: Screen) -> axum::routing::MethodRouter<AppState> {
    get(move |State(s), Extension(u), Query(q)| list_route(s, u, screen, q, None))
        .post(move |State(s), Extension(u), body| write::create(s, u, screen, body))
        .delete(move |State(s), Extension(u), body| write::remove(s, u, screen, body))
}
fn detail(screen: Screen) -> axum::routing::MethodRouter<AppState> {
    get(move |State(s), Extension(u), Path(id)| detail_route(s, u, screen, id))
        .put(move |State(s), Extension(u), Path(id), body| write::patch(s, u, screen, id, body))
}
fn report(screen: Screen) -> axum::routing::MethodRouter<AppState> {
    get(move |State(s), Extension(u), Query(q)| list_route(s, u, screen, q, None))
}
pub fn routes() -> Router<AppState> {
    use Screen::*;
    Router::new().nest(
        "/api/v1/mng",
        Router::new()
            .route("/companies", collection(Companies))
            .route("/companies/{company_id}", detail(Companies))
            .route("/companies/dropdown", get(read::dropdown))
            .route("/manager-status", collection(Managers))
            .route("/dev-requests", collection(Requests))
            .route("/dev-requests/{request_id}", detail(Requests))
            .route("/dev-requests/monthly-summary", report(RequestSummary))
            .route("/dev-inquiries", collection(Inquiries))
            .route("/dev-inquiries/{inquiry_id}", detail(Inquiries))
            .route("/dev-projects", collection(Projects))
            .route("/dev-projects/{project_id}", detail(Projects))
            .route("/dev-staff/projects", report(StaffProjects))
            .route("/dev-staff/revenue-summary", report(Revenue))
            .route("/outsource-contracts", collection(Contracts))
            .route("/outsource-contracts/{contract_id}", detail(Contracts))
            .route("/outsource-contracts/check-duplicate", get(read::duplicate))
            .route(
                "/outsource-attendances",
                post(|State(s), Extension(u), body| write::create(s, u, Attendances, body))
                    .delete(|State(s), Extension(u), body| write::remove(s, u, Attendances, body)),
            )
            .route(
                "/outsource-attendances/{contract_id}",
                get(|State(s), Extension(u), Path(id), Query(q)| {
                    list_route(s, u, Attendances, q, Some(id))
                }),
            )
            .route("/outsource-attendances/summary", report(AttendanceSummary))
            .route("/infra-masters", collection(Masters))
            .route(
                "/infra-configs/{id}",
                get(|State(s), Extension(u), Path(id), Query(q)| {
                    list_route(s, u, Configs, q, Some(id))
                })
                .post(write::upsert_configs)
                .delete(write::delete_config),
            ),
    )
}
