use ring::{
    pbkdf2,
    rand::{SecureRandom, SystemRandom},
};
use std::num::NonZeroU32;

pub fn password_matches(password: &str, encoded: &str) -> bool {
    let mut fields = encoded.split('$');
    if password.is_empty() || fields.next() != Some("pbkdf2_sha256") {
        return false;
    }
    let Some(iterations) = fields
        .next()
        .and_then(|text| text.parse::<i32>().ok())
        .and_then(|n| u32::try_from(n).ok())
        .and_then(NonZeroU32::new)
    else {
        return false;
    };
    let Some(salt) = fields.next().and_then(|text| hex::decode(text).ok()) else {
        return false;
    };
    let Some(digest) = fields.next().and_then(|text| hex::decode(text).ok()) else {
        return false;
    };
    digest.len() == 32
        && fields.next().is_none()
        && pbkdf2::verify(
            pbkdf2::PBKDF2_HMAC_SHA256,
            iterations,
            &salt,
            password.as_bytes(),
            &digest,
        )
        .is_ok()
}

pub fn hash_password(password: &str) -> Result<String, ring::error::Unspecified> {
    let mut salt = [0; 16];
    let mut digest = [0; 32];
    SystemRandom::new().fill(&mut salt)?;
    pbkdf2::derive(
        pbkdf2::PBKDF2_HMAC_SHA256,
        NonZeroU32::new(100_000).unwrap(),
        &salt,
        password.as_bytes(),
        &mut digest,
    );
    Ok(format!(
        "pbkdf2_sha256$100000${}${}",
        hex::encode(salt),
        hex::encode(digest)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn existing_password_formats_verify() {
        for (password, encoded) in [
            (
                "correct horse battery staple",
                "pbkdf2_sha256$100000$00112233445566778899aabbccddeeff$2a080fdedce213934a91e8142d2eb7165be949c295612ce4b7d87be90ae208b6",
            ),
            (
                "legacy-compatible",
                "pbkdf2_sha256$2500$deadc0de00112233445566778899aabb$60a222faa2347aa12dd8578680c9a283c740edd379819cd4ef3bc7ec9cf9256b",
            ),
            (
                "password",
                "pbkdf2_sha256$1$$c1232f10f62715fda06ae7c0a2037ca19b33cf103b727ba56d870c11f290a2ab",
            ),
        ] {
            assert!(password_matches(password, encoded));
            assert!(!password_matches("incorrect", encoded));
        }
    }

    #[test]
    fn new_passwords_use_distinct_salts_and_legacy_format() {
        let first = hash_password("test-password").unwrap();
        assert_ne!(first, hash_password("test-password").unwrap());
        assert!(password_matches("test-password", &first));
    }
}
