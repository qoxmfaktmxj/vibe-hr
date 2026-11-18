use base64::Engine;
use base64::alphabet;
use base64::engine::{DecodePaddingMode, GeneralPurpose, GeneralPurposeConfig};
use ring::{digest, hmac};
use serde_json::Value;

// Java's URL decoder accepts padded and unpadded values. New tokens are unpadded.
const BASE64: GeneralPurpose = GeneralPurpose::new(
    &alphabet::URL_SAFE,
    GeneralPurposeConfig::new()
        .with_encode_padding(false)
        .with_decode_padding_mode(DecodePaddingMode::Indifferent)
        .with_decode_allow_trailing_bits(true),
);

pub(super) fn sha256(bytes: &[u8]) -> String {
    BASE64.encode(digest::digest(&digest::SHA256, bytes))
}

pub(super) fn replay_bucket(source: &str) -> Option<i16> {
    let binary: [u8; 32] = BASE64.decode(source).ok()?.try_into().ok()?;
    Some(i16::from(binary[0]))
}

pub(super) fn signed_payload(
    token: &str,
    key: &hmac::Key,
    required_type: Option<&str>,
) -> Option<Value> {
    let (signed, signature) = token.rsplit_once('.')?;
    let (header, payload) = signed.split_once('.')?;
    hmac::verify(key, signed.as_bytes(), &BASE64.decode(signature).ok()?).ok()?;
    let header: Value = serde_json::from_slice(&BASE64.decode(header).ok()?).ok()?;
    if header["alg"] != "HS256" || required_type.is_some_and(|kind| header["typ"] != kind) {
        return None;
    }
    serde_json::from_slice(&BASE64.decode(payload).ok()?).ok()
}

pub(super) fn sign(header: &[u8], payload: &[u8], key: &hmac::Key) -> String {
    let signed = format!("{}.{}", BASE64.encode(header), BASE64.encode(payload));
    let signature = hmac::sign(key, signed.as_bytes());
    format!("{signed}.{}", BASE64.encode(signature))
}

// Match Instant.ofEpochSecond and Jackson Number.longValue in JwtTokenVerifier.
pub(super) fn valid_epoch(seconds: i64) -> bool {
    (-31_557_014_167_219_200..=31_556_889_864_403_199).contains(&seconds)
}

fn jwt_epoch(value: &Value) -> Option<i64> {
    let seconds = value
        .as_i64()
        .or_else(|| value.as_f64().map(|n| n as i64))?;
    valid_epoch(seconds).then_some(seconds)
}

pub(super) fn access_subject(token: &str, key: &hmac::Key, issuer: &str, now: i64) -> Option<i32> {
    let claims = signed_payload(token, key, None)?;
    if claims["iss"] != issuer
        || jwt_epoch(&claims["iat"])? > now
        || jwt_epoch(&claims["exp"])? <= now
    {
        return None;
    }
    let subject = claims["sub"].as_str()?;
    if !subject.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    subject.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spring_access_token_fixture_and_expiry() {
        let token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsImlhdCI6MTc2NzIyNTYwMCwiZXhwIjoxNzY3MjI5MjAwLCJpc3MiOiJ2aWJlLWhyIn0.4m72mw76dRviTsxSbw1voBEVWI8p-8TEvxLMBua8t4M";
        let key = hmac::Key::new(hmac::HMAC_SHA256, b"compatibility-test-key");
        assert_eq!(access_subject(token, &key, "vibe-hr", 1767227400), Some(42));
        assert_eq!(access_subject(token, &key, "vibe-hr", 1767229200), None);
        assert_eq!(access_subject(token, &key, "vibe-hr", 1767225599), None);
        assert_eq!(access_subject(token, &key, "other", 1767227400), None);
        let different_key = hmac::Key::new(hmac::HMAC_SHA256, b"other");
        assert_eq!(
            access_subject(token, &different_key, "vibe-hr", 1767227400),
            None
        );
    }
}
