use crate::input::Violation;
use axum::http::{HeaderMap, header};
use std::{collections::HashMap, sync::LazyLock};

type Catalog = HashMap<String, HashMap<String, String>>;
static MESSAGES: LazyLock<Catalog> = LazyLock::new(|| {
    serde_json::from_str(include_str!("messages.json"))
        .expect("bundled Hibernate Validator messages")
});
tokio::task_local! { pub(crate) static LANGUAGE: String; }

pub(crate) fn request_language(headers: &HeaderMap) -> String {
    let preferred = headers
        .get(header::ACCEPT_LANGUAGE)
        .and_then(|v| v.to_str().ok())
        .into_iter()
        .flat_map(|s| s.split(','))
        .filter_map(|s| {
            let mut parts = s.trim().split(';');
            let tag = parts.next()?.trim();
            let q = parts
                .next()
                .map(|p| p.trim().strip_prefix("q=")?.parse::<f32>().ok())
                .unwrap_or(Some(1.0))?;
            ((0.0..=1.0).contains(&q) && q > 0.0 && tag != "*")
                .then_some(((q * 1000.0) as u16, tag))
        })
        .reduce(|a, b| if b.0 > a.0 { b } else { a });
    preferred
        .map(|(_, s)| s.to_ascii_lowercase())
        .unwrap_or_else(|| {
            let locale = ["LC_ALL", "LC_MESSAGES", "LANG"]
                .into_iter()
                .filter_map(|k| std::env::var(k).ok())
                .find(|s| !s.is_empty())
                .unwrap_or_else(|| "en".into());
            locale
                .split('.')
                .next()
                .unwrap_or("en")
                .replace('_', "-")
                .to_ascii_lowercase()
        })
}

pub(crate) fn localize(violations: &mut [Violation]) {
    let _ = LANGUAGE.try_with(|language| {
        let Some(catalog) = MESSAGES
            .get(language)
            .or_else(|| MESSAGES.get(language.split('-').next()?))
        else {
            return;
        };
        for issue in violations {
            let (prefix, msg) = issue
                .msg
                .split_once(": ")
                .map_or(("", issue.msg.as_str()), |(p, m)| (p, m));
            let translated = if let Some(n) = msg.strip_prefix("must be greater than or equal to ")
            {
                catalog.get("min").map(|s| s.replace("{value}", n))
            } else if let Some(n) = msg.strip_prefix("must be less than or equal to ") {
                catalog.get("max").map(|s| s.replace("{value}", n))
            } else if let Some((min, max)) = msg
                .strip_prefix("size must be between ")
                .and_then(|s| s.split_once(" and "))
            {
                catalog
                    .get("size")
                    .map(|s| s.replace("{min}", min).replace("{max}", max))
            } else if msg == "must not be blank" {
                catalog.get("notblank").cloned()
            } else {
                None
            };
            if let Some(text) = translated {
                issue.msg = if prefix.is_empty() {
                    text
                } else {
                    format!("{prefix}: {text}")
                };
            }
        }
    });
}
