use super::{SecurityError, token};
use ring::hmac;
use serde_json::Value;
use subtle::ConstantTimeEq;

#[derive(Clone)]
enum Identity {
    Login(String),
    Social {
        provider: String,
        provider_user_id: String,
        email: String,
        display_name: String,
    },
}

#[derive(Clone)]
pub struct BffPrincipal {
    pub client_id: String,
    pub source_hash: String,
    pub(super) bucket: i16,
    pub(super) nonce: String,
    pub(super) expires_at: i64,
    body_digest: String,
    identity: Identity,
}

fn matches(left: &str, right: &str) -> bool {
    left.as_bytes().ct_eq(right.as_bytes()).into()
}

impl BffPrincipal {
    pub(super) fn require_login_binding(
        &self,
        enter_cd: &str,
        login_id: &str,
    ) -> Result<&str, SecurityError> {
        if let Identity::Login(binding) = &self.identity {
            let canonical = format!("{}\0{}", enter_cd.trim().to_uppercase(), login_id.trim());
            if matches(binding, &token::sha256(canonical.as_bytes())) {
                return Ok(binding);
            }
        }
        Err(SecurityError::InvalidAssertion)
    }

    pub fn require_social_binding(
        &self,
        provider: &str,
        id: &str,
        email: &str,
        name: &str,
    ) -> Result<(), SecurityError> {
        if let Identity::Social {
            provider: actual_provider,
            provider_user_id,
            email: actual_email,
            display_name,
        } = &self.identity
            && matches(provider, actual_provider)
            && matches(id, provider_user_id)
            && matches(email, actual_email)
            && matches(name, display_name)
        {
            return Ok(());
        }
        Err(SecurityError::InvalidAssertion)
    }

    pub(super) fn matches_body(&self, body: &[u8]) -> bool {
        matches(&self.body_digest, &token::sha256(body))
    }
}

fn text_claim(claims: &Value, name: &str, min: usize, max: usize) -> Option<String> {
    let text = claims[name].as_str()?;
    // Java String.length() counts UTF-16 code units.
    (!text.trim().is_empty() && (min..=max).contains(&text.encode_utf16().count()))
        .then(|| text.to_owned())
}

fn token_claim(claims: &Value, name: &str, min: usize, max: usize) -> Option<String> {
    text_claim(claims, name, min, max).filter(|s| {
        s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
    })
}

pub(super) fn verify(
    encoded: &str,
    key: &hmac::Key,
    expected_method: &str,
    expected_path: &str,
    max_ttl: i64,
    now: i64,
) -> Option<BffPrincipal> {
    let claims = token::signed_payload(encoded, key, Some("VIBEHR-BFF"))?;
    if claims["ver"].as_i64() != Some(1)
        || claims["method"] != expected_method
        || claims["path"] != expected_path
    {
        return None;
    }
    let issued = claims["iat"].as_i64()?;
    let expires = claims["exp"].as_i64()?;
    if !token::valid_epoch(issued)
        || !token::valid_epoch(expires)
        || issued > now + 10
        || expires <= now
        || expires.checked_sub(issued)? > max_ttl
    {
        return None;
    }
    let source_hash = token_claim(&claims, "source_hash", 43, 43)?;
    let bucket = token::replay_bucket(&source_hash)?;
    if claims["replay_bucket"].as_i64() != Some(i64::from(bucket)) {
        return None;
    }
    let identity = match claims["purpose"].as_str()? {
        "login" => Identity::Login(token_claim(&claims, "request_binding", 43, 43)?),
        "social-exchange" => {
            let provider = text_claim(&claims, "provider", 2, 20)?;
            if !matches!(provider.as_str(), "google" | "kakao") || claims["email_verified"] != true
            {
                return None;
            }
            Identity::Social {
                provider,
                provider_user_id: text_claim(&claims, "provider_user_id", 1, 100)?,
                email: text_claim(&claims, "email", 3, 320)?,
                display_name: text_claim(&claims, "display_name", 1, 100)?,
            }
        }
        _ => return None,
    };
    Some(BffPrincipal {
        client_id: token_claim(&claims, "client_id", 22, 128)?,
        source_hash,
        bucket,
        nonce: token_claim(&claims, "nonce", 22, 128)?,
        body_digest: token_claim(&claims, "body_sha256", 43, 43)?,
        expires_at: expires,
        identity,
    })
}
