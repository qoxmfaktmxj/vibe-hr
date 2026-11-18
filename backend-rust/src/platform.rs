use crate::AppState;
use axum::{
    Json, Router,
    extract::{MatchedPath, Request, State},
    http::{HeaderMap, HeaderValue, Method, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
    routing::get,
};
use serde_json::json;
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};

#[derive(Clone)]
pub struct HttpConfig {
    allowed_origins: Vec<String>,
    ready: Arc<AtomicBool>,
}

impl HttpConfig {
    pub fn new(origins: &str) -> Result<Self, &'static str> {
        let allowed_origins: Vec<String> =
            origins.split(',').map(|s| s.trim().to_owned()).collect();
        if allowed_origins.iter().any(|s| s.is_empty() || s == "*") {
            return Err("Credentialed CORS requires explicit origins");
        }
        Ok(Self {
            allowed_origins,
            ready: Arc::new(AtomicBool::new(true)),
        })
    }
    pub fn drain(&self) {
        self.ready.store(false, Ordering::Release);
    }
}

fn actuator(headers: &HeaderMap, status: StatusCode, body: serde_json::Value) -> Response {
    let mut response = (status, Json(body)).into_response();
    if !headers
        .get(header::ACCEPT)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|a| a.trim() == "application/json")
    {
        response.headers_mut().insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/vnd.spring-boot.actuator.v3+json"),
        );
    }
    response
}

pub fn probes(config: HttpConfig) -> Router<AppState> {
    let live = get(|headers: HeaderMap| async move {
        actuator(&headers, StatusCode::OK, json!({"status":"UP"}))
    });
    Router::new()
        .route("/actuator",get(|headers:HeaderMap|async move{
            let authority=headers.get(header::HOST).and_then(|v|v.to_str().ok()).and_then(|s|s.parse::<axum::http::uri::Authority>().ok());
            let root=authority.map_or_else(||"/actuator".into(),|a|format!("http://{a}/actuator"));
            actuator(&headers,StatusCode::OK,json!({"_links":{
                "self":{"href":root,"templated":false},"info":{"href":format!("{root}/info"),"templated":false},
                "health":{"href":format!("{root}/health"),"templated":false},"health-path":{"href":format!("{root}/health/{{*path}}"),"templated":true}
            }}))
        }))
        .route("/actuator/info",get(|headers:HeaderMap|async move{actuator(&headers,StatusCode::OK,json!({}))}))
        .route("/actuator/health/liveness", live)
        .route(
            "/actuator/health/readiness",
            get(move |headers: HeaderMap| async move {
                if config.ready.load(Ordering::Acquire) {
                    actuator(&headers, StatusCode::OK, json!({"status":"UP"}))
                } else {
                    actuator(
                        &headers,
                        StatusCode::SERVICE_UNAVAILABLE,
                        json!({"status":"OUT_OF_SERVICE"}),
                    )
                }
            }),
        )
        .route(
            "/actuator/health",
            get(
                |State(state): State<AppState>, headers: HeaderMap| async move {
                    let db = sqlx::query("SELECT 1").execute(&state.pool).await.is_ok();
                    let disk_ok =
                        fs2::available_space(".").is_ok_and(|bytes| bytes >= 10 * 1024 * 1024);
                    let up = db && disk_ok;
                    actuator(
                        &headers,
                        if up {
                            StatusCode::OK
                        } else {
                            StatusCode::SERVICE_UNAVAILABLE
                        },
                        json!({"groups":["liveness","readiness"],"status":if up{"UP"}else{"DOWN"}}),
                    )
                },
            ),
        )
}

const METHODS: &str = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
pub async fn http_layer(State(config): State<HttpConfig>, req: Request, next: Next) -> Response {
    let started = std::time::Instant::now();
    let method = req.method().clone();
    let uri = req.uri().clone();
    let route = req
        .extensions()
        .get::<MatchedPath>()
        .map(|p| p.as_str().to_owned());
    let language = crate::validation::request_language(req.headers());
    let origin = req.headers().get(header::ORIGIN).cloned();
    let own_origin = origin
        .as_ref()
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<axum::http::Uri>().ok())
        .is_some_and(|uri| {
            uri.scheme_str() == Some("http")
                && uri.authority().is_some_and(|authority| {
                    req.headers()
                        .get(header::HOST)
                        .is_some_and(|v| v.as_bytes() == authority.as_str().as_bytes())
                })
        });
    let preflight = req.method() == Method::OPTIONS
        && origin.is_some()
        && req
            .headers()
            .contains_key(header::ACCESS_CONTROL_REQUEST_METHOD);
    let mut cors = HeaderMap::new();
    let mut reject = false;
    if let Some(origin) = origin.filter(|_| !own_origin) {
        let method = if preflight {
            req.headers()
                .get(header::ACCESS_CONTROL_REQUEST_METHOD)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
        } else {
            req.method().as_str()
        };
        if !config
            .allowed_origins
            .iter()
            .any(|s| origin.as_bytes() == s.as_bytes())
            || !METHODS.split(',').any(|s| s == method)
        {
            reject = true;
        }
        if preflight {
            cors.insert(
                header::ACCESS_CONTROL_ALLOW_METHODS,
                HeaderValue::from_static(METHODS),
            );
            if let Some(requested) = req
                .headers()
                .get(header::ACCESS_CONTROL_REQUEST_HEADERS)
                .and_then(|v| v.to_str().ok())
            {
                let allowed: Vec<_> = requested
                    .split(',')
                    .map(str::trim)
                    .filter(|s| {
                        ["authorization", "content-type", "accept"]
                            .iter()
                            .any(|h| s.eq_ignore_ascii_case(h))
                    })
                    .collect();
                if allowed.is_empty() && !requested.is_empty() {
                    reject = true;
                }
                if !allowed.is_empty() {
                    cors.insert(
                        header::ACCESS_CONTROL_ALLOW_HEADERS,
                        HeaderValue::from_str(&allowed.join(", "))
                            .expect("validated header tokens"),
                    );
                }
            }
        }
        cors.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin);
        cors.insert(
            header::ACCESS_CONTROL_ALLOW_CREDENTIALS,
            HeaderValue::from_static("true"),
        );
    }
    let mut response = if reject {
        Response::builder()
            .status(403)
            .body("Invalid CORS request".into())
            .expect("static response")
    } else if preflight {
        StatusCode::OK.into_response()
    } else {
        crate::validation::LANGUAGE
            .scope(language, next.run(req))
            .await
    };
    if response.status() == StatusCode::METHOD_NOT_ALLOWED
        && let Some(allow) = response.headers().get(header::ALLOW).cloned()
        && let Ok(raw) = allow.to_str()
    {
        if method == Method::OPTIONS {
            response = StatusCode::OK.into_response();
            let allow = raw
                .split(',')
                .map(str::trim)
                .chain(["OPTIONS"])
                .collect::<Vec<_>>()
                .join(",");
            response.headers_mut().insert(
                header::ALLOW,
                HeaderValue::from_str(&allow).expect("router method names"),
            );
        } else {
            response = http_status(StatusCode::METHOD_NOT_ALLOWED, uri.path());
            let allow = raw
                .split(',')
                .map(str::trim)
                .filter(|m| {
                    *m != "HEAD"
                        || matches!(
                            uri.path(),
                            "/docs" | "/redoc" | "/docs/oauth2-redirect" | "/openapi.json"
                        )
                })
                .collect::<Vec<_>>()
                .join(", ");
            response.headers_mut().insert(
                header::ALLOW,
                HeaderValue::from_str(&allow).expect("router method names"),
            );
        }
    }
    let headers = response.headers_mut();
    if !reject {
        headers.extend(cors);
    }
    headers.append(
        header::VARY,
        HeaderValue::from_static(
            "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
        ),
    );
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert("x-xss-protection", HeaderValue::from_static("0"));
    headers.insert(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
    if !headers.contains_key(header::CACHE_CONTROL) {
        headers.insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("no-cache, no-store, max-age=0, must-revalidate"),
        );
        headers.insert(header::PRAGMA, HeaderValue::from_static("no-cache"));
        headers.insert(header::EXPIRES, HeaderValue::from_static("0"));
    }
    if response.status().is_server_error() {
        eprintln!(
            "{}",
            json!({"@timestamp":chrono::Utc::now(),"log":{"level":"ERROR"},"service":{"name":"vibehr-backend","environment":std::env::var("ENVIRONMENT").unwrap_or_else(|_|"local".into())},"event":{"duration":started.elapsed().as_nanos().min(u64::MAX.into()) as u64},"http":{"request":{"method":method.as_str()},"response":{"status_code":response.status().as_u16()}},"route":route,"message":"Request failed"})
        );
    }
    response
}

pub async fn not_found(req: Request) -> Response {
    let path = req.uri().path();
    if path.starts_with("/actuator/health/") {
        return StatusCode::NOT_FOUND.into_response();
    }
    http_status(StatusCode::NOT_FOUND, path)
}

fn http_status(status: StatusCode, path: &str) -> Response {
    (status,Json(json!({"timestamp":chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis,true),"status":status.as_u16(),"error":status.canonical_reason(),"path":path}))).into_response()
}
