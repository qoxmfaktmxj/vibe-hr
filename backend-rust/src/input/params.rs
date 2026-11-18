use crate::ApiError;
use axum::{
    extract::{FromRequestParts, Query, RawPathParams},
    http::{StatusCode, request::Parts},
};
use serde_json::json;
use std::collections::HashMap;

fn int_error(key: &str, input: Option<&str>) -> ApiError {
    ApiError::with_detail(
        StatusCode::UNPROCESSABLE_ENTITY,
        json!([{"type":"int_parsing","loc":["query",key],
        "msg":"Input should be a valid integer, unable to parse string as an integer","input":input}]),
    )
}

fn integer(raw: &str) -> Option<i64> {
    // Spring's NumberUtils removes Java whitespace and accepts the Java hex prefixes.
    let compact: String = raw
        .chars()
        .filter(|c| {
            !(c.is_whitespace() && !matches!(*c, '\u{a0}' | '\u{2007}' | '\u{202f}' | '\u{85}'))
                && !matches!(*c, '\u{1c}'..='\u{1f}')
        })
        .collect();
    let magnitude = compact.strip_prefix('-').unwrap_or(&compact);
    let hex = magnitude
        .strip_prefix("0x")
        .or_else(|| magnitude.strip_prefix("0X"))
        .or_else(|| magnitude.strip_prefix('#'));
    if let Some(hex) = hex {
        if hex.starts_with(['+', '-']) {
            return None;
        }
        let n = i128::from_str_radix(hex, 16).ok()?;
        return i64::try_from(if compact.starts_with('-') { -n } else { n }).ok();
    }
    compact.parse().ok()
}

pub fn query_i32(name: &str, value: &str) -> Result<i32, ApiError> {
    integer(value)
        .and_then(|n| i32::try_from(n).ok())
        .ok_or_else(|| int_error(name, Some(value)))
}
pub fn query_i64(name: &str, value: &str) -> Result<i64, ApiError> {
    integer(value).ok_or_else(|| int_error(name, Some(value)))
}
pub fn query_bool(name: &str, value: &str) -> Result<bool, ApiError> {
    match value.trim().to_ascii_lowercase().as_str() {
        "true" | "1" | "yes" | "on" => Ok(true),
        "false" | "0" | "no" | "off" => Ok(false),
        _ => Err(ApiError::with_detail(
            StatusCode::UNPROCESSABLE_ENTITY,
            json!([{"type":"value_error","loc":["query",name],"msg":"Input should be a valid value","input":value}]),
        )),
    }
}
pub fn required_i32(name: &str, value: Option<&str>) -> Result<i32, ApiError> {
    let value = value.ok_or_else(|| {
        ApiError::with_detail(
            StatusCode::UNPROCESSABLE_ENTITY,
            json!([{"type":"missing","loc":["query",name],"msg":"Field required","input":null}]),
        )
    })?;
    query_i32(name, value)
}

/// Signed, integer-only Spring controller paths. Preserve the existing error's
/// query location and query input when a path variable cannot be converted.
pub struct NumericPath<T>(pub T);

async fn path_values<S: Send + Sync>(
    parts: &mut Parts,
    state: &S,
) -> Result<Vec<(String, String)>, ApiError> {
    let params = RawPathParams::from_request_parts(parts, state)
        .await
        .map_err(|_| ApiError::new(StatusCode::BAD_REQUEST, "Invalid request path."))?;
    Ok(params.iter().map(|(k, v)| (k.into(), v.into())).collect())
}

fn parse_parameter<T: TryFrom<i64>>(key: &str, value: &str, parts: &Parts) -> Result<T, ApiError> {
    integer(value)
        .and_then(|n| T::try_from(n).ok())
        .ok_or_else(|| {
            let query = Query::<HashMap<String, String>>::try_from_uri(&parts.uri).ok();
            int_error(
                key,
                query.as_ref().and_then(|q| q.get(key)).map(String::as_str),
            )
        })
}

fn invalid_route() -> ApiError {
    ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
}

macro_rules! single_path {
    ($ty:ty) => {
        impl<S: Send + Sync> FromRequestParts<S> for NumericPath<$ty> {
            type Rejection = ApiError;
            async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, ApiError> {
                let values = path_values(parts, state).await?;
                let [(k, v)] = values.as_slice() else {
                    return Err(invalid_route());
                };
                Ok(Self(parse_parameter(k, v, parts)?))
            }
        }
    };
}
single_path!(i32);
single_path!(i64);
impl<S: Send + Sync, A: TryFrom<i64> + Send, B: TryFrom<i64> + Send> FromRequestParts<S>
    for NumericPath<(A, B)>
{
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, ApiError> {
        let values = path_values(parts, state).await?;
        let [(first, x), (second, y)] = values.as_slice() else {
            return Err(invalid_route());
        };
        Ok(Self((
            parse_parameter(first, x, parts)?,
            parse_parameter(second, y, parts)?,
        )))
    }
}

#[derive(Default, serde::Deserialize)]
pub struct Pagination {
    pub(crate) page: Option<String>,
    pub(crate) limit: Option<String>,
}
impl Pagination {
    pub fn parse(&self, method: &str) -> Result<(i32, i32), ApiError> {
        self.with_limits(method, 50, 200)
    }
    pub fn with_limits(
        &self,
        method: &str,
        default_limit: i32,
        max_limit: i32,
    ) -> Result<(i32, i32), ApiError> {
        let page = self
            .page
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(|v| query_i32("page", v))
            .transpose()?
            .unwrap_or(1);
        let limit = self
            .limit
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(|v| query_i32("limit", v))
            .transpose()?
            .unwrap_or(default_limit);
        let mut errors = Vec::new();
        for (key, value) in [("page", page), ("limit", limit)] {
            let why = if value < 1 {
                "must be greater than or equal to 1".to_string()
            } else if key == "limit" && value > max_limit {
                format!("must be less than or equal to {max_limit}")
            } else {
                continue;
            };
            errors.push(format!("{method}.{key}: {why}"));
        }
        if !errors.is_empty() {
            return Err(ApiError::with_detail(
                StatusCode::UNPROCESSABLE_ENTITY,
                json!([{"type":"validation_error",
            "loc":["request"],"msg":errors.join(", "),"input":null}]),
            ));
        }
        Ok((page, limit))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn spring_boolean_values() {
        assert!(query_bool("all", " YES ").unwrap());
        assert!(!query_bool("all", "0").unwrap());
        assert!(query_bool("all", "y").is_err());
        assert!(query_bool("all", "  ").is_err());
    }
    #[test]
    fn spring_integer_formats_and_width() {
        for (v, n) in [
            ("1 1", 11),
            (" -0x10 ", -16),
            ("0Xf", 15),
            ("#Fa", 250),
            ("012", 12),
            ("+1", 1),
        ] {
            assert_eq!(query_i32("id", v).unwrap(), n);
        }
        for v in ["2147483648", "--1", "", "0x-2"] {
            assert!(query_i32("id", v).is_err());
        }
    }
}
