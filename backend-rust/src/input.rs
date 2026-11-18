use crate::ApiError;
use axum::{
    body::Bytes,
    extract::{FromRequest, Request},
    http::StatusCode,
};
use serde::{Serialize, de::DeserializeOwned};
use serde_json::{Value, json};

pub struct Body<T>(pub T);
pub trait Validate {
    fn validate(&self) -> Vec<Violation>;
}

#[derive(Serialize)]
pub struct Violation {
    #[serde(rename = "type")]
    pub kind: &'static str,
    pub loc: Vec<Value>,
    pub msg: String,
    pub input: Value,
}

impl Violation {
    pub fn field(kind: &'static str, name: &str, msg: String, input: Value) -> Self {
        Self {
            kind,
            loc: vec![json!("body"), json!(name)],
            msg,
            input,
        }
    }
}

pub fn range(field: &str, value: i64, min: i64, max: i64) -> Option<Violation> {
    if value < min {
        Some(Violation::field(
            "min",
            field,
            format!("must be greater than or equal to {min}"),
            json!(value),
        ))
    } else if value > max {
        Some(Violation::field(
            "max",
            field,
            format!("must be less than or equal to {max}"),
            json!(value),
        ))
    } else {
        None
    }
}

pub fn size(field: &str, value: Option<&str>, min: usize, max: usize) -> Option<Violation> {
    let value = value?;
    (!(min..=max).contains(&value.encode_utf16().count())).then(|| {
        Violation::field(
            "size",
            field,
            format!("size must be between {min} and {max}"),
            json!(value),
        )
    })
}

pub fn not_blank(field: &str, value: Option<&str>) -> Option<Violation> {
    value
        .is_none_or(|s| s.trim().is_empty())
        .then(|| Violation::field("notblank", field, "must not be blank".into(), json!(value)))
}

pub(crate) async fn json_bytes<S: Send + Sync>(
    request: Request,
    state: &S,
) -> Result<Bytes, ApiError> {
    let path = request
        .extensions()
        .get::<axum::extract::OriginalUri>()
        .map(|uri| uri.0.path())
        .unwrap_or(request.uri().path())
        .to_owned();
    let media = request
        .headers()
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|v| {
            v.split(';')
                .next()
                .unwrap_or("")
                .trim()
                .to_ascii_lowercase()
        });
    let bytes = Bytes::from_request(request, state)
        .await
        .map_err(|e| ApiError::new(e.status(), e.body_text()))?;
    if !bytes.is_empty()
        && !media.as_deref().is_some_and(|v| {
            v == "application/json" || v.starts_with("application/") && v.ends_with("+json")
        })
    {
        return Err(ApiError(
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            json!({"timestamp":chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis,true),"status":415,"error":"Unsupported Media Type","path":path}),
        ));
    }
    Ok(bytes)
}

impl<S: Send + Sync, T: DeserializeOwned + Validate> FromRequest<S> for Body<T> {
    type Rejection = ApiError;
    async fn from_request(request: Request, state: &S) -> Result<Self, Self::Rejection> {
        let bytes = json_bytes(request, state).await?;
        let value: T = serde_json::from_slice(&bytes).map_err(|_| {
            let offset = String::from_utf8_lossy(&bytes).encode_utf16().count();
            ApiError::with_detail(StatusCode::UNPROCESSABLE_ENTITY, json!([{"type":"json_invalid","loc":["body",offset],"msg":"JSON decode error","input":{}}]))
        })?;
        let violations = value.validate();
        if violations.is_empty() {
            Ok(Body(value))
        } else {
            Err(ApiError::validation(violations))
        }
    }
}
pub mod params;

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{Json, Router, body::to_bytes, routing::post};
    use serde::Deserialize;
    use tower::ServiceExt;

    #[derive(Deserialize)]
    struct Input {
        count: i32,
    }
    impl Validate for Input {
        fn validate(&self) -> Vec<Violation> {
            vec![]
        }
    }

    #[tokio::test]
    async fn spring_json_media_types_and_error_envelopes() {
        let router = Router::new().route(
            "/test",
            post(|Body(data): Body<Input>| async move { Json(data.count) }),
        );
        for (media, payload, status) in [
            ("text/plain", "{\"count\":3}", 415),
            ("application/json", "{}", 422),
            ("application/json; charset=utf-8", "{\"count\":3}", 200),
            ("application/vnd.company+json", "{\"count\":3}", 200),
        ] {
            let request = axum::http::Request::post("/test")
                .header("content-type", media)
                .body(axum::body::Body::from(payload))
                .unwrap();
            let response = router.clone().oneshot(request).await.unwrap();
            assert_eq!(response.status().as_u16(), status);
            let data: Value =
                serde_json::from_slice(&to_bytes(response.into_body(), 4096).await.unwrap())
                    .unwrap();
            match status {
                415 => {
                    assert_eq!(data["path"], "/test");
                    assert_eq!(data["error"], "Unsupported Media Type");
                }
                422 => assert_eq!(data["detail"][0]["loc"], json!(["body", 2])),
                _ => assert_eq!(data, json!(3)),
            }
        }
    }
}
