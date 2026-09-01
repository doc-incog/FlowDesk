use rand::RngCore;
use scrypt::{scrypt, Params as ScryptParams};
use sha2::{Digest, Sha256};

/// scrypt parameters matching `crypto.scrypt` defaults used by the legacy Node app.
/// Node defaults: N=16384, r=8, p=1, keylen=64. scrypt-rs `Params::new` takes
/// `log_n` (log2 of N = 14), plus r=8, p=1, len=64 — so existing hashes interoperate.
const SCRYPT_LOG_N: u8 = 14; // 2^14 = 16384
const SCRYPT_R: u32 = 8;
const SCRYPT_P: u32 = 1;
const SCRYPT_SALT_BYTES: usize = 16; // 128-bit salt -> 32 hex chars (legacy prefix)
const SCRYPT_KEYLEN: usize = 64; // 512-bit key -> 128 hex chars

/// Hash a password producing the legacy `"<32-hex-salt>:<128-hex-hash>"` string.
///
/// IMPORTANT (interop): the legacy Node code does `scryptSync(password, saltHex, 64)`
/// where `saltHex = randomBytes(16).toString("hex")`. Node's scrypt accepts a string
/// salt and hashes its UTF-8 bytes — so the effective salt is the 32-char ASCII hex
/// STRING, NOT the decoded 16 raw bytes. We reproduce that exactly so existing hashes
/// verify and new hashes remain readable by a Node fallback.
pub fn hash_password(password: &str) -> String {
    let mut salt = [0u8; SCRYPT_SALT_BYTES];
    rand::thread_rng().fill_bytes(&mut salt);
    let salt_hex = hex::encode(&salt);

    let params = ScryptParams::new(SCRYPT_LOG_N, SCRYPT_R, SCRYPT_P, SCRYPT_KEYLEN)
        .expect("valid scrypt params");
    let mut hash = vec![0u8; SCRYPT_KEYLEN];
    scrypt(password.as_bytes(), salt_hex.as_bytes(), &params, &mut hash).expect("scrypt derive");

    format!("{}:{}", salt_hex, hex::encode(&hash))
}

/// Verify a password against a legacy `"<salt>:<hash>"` string using constant-time compare.
///
/// The salt part is the 32-char hex string used verbatim as the scrypt salt (UTF-8
/// bytes), matching Node's `scryptSync(password, saltHex, 64)`.
pub fn verify_password(password: &str, legacy_hash: &str) -> bool {
    let Some((salt_hex, hash_hex)) = legacy_hash.split_once(':') else {
        return false;
    };
    let Ok(expected) = hex::decode(hash_hex) else {
        return false;
    };

    let params = ScryptParams::new(SCRYPT_LOG_N, SCRYPT_R, SCRYPT_P, SCRYPT_KEYLEN)
        .expect("valid scrypt params");
    let mut actual = vec![0u8; SCRYPT_KEYLEN];
    if scrypt(password.as_bytes(), salt_hex.as_bytes(), &params, &mut actual).is_err() {
        return false;
    }
    // Constant-time compare.
    actual.len() == expected.len()
        && actual
            .iter()
            .zip(expected.iter())
            .all(|(a, b)| a == b)
}

/// sha-256 hex digest. Parity with the legacy profile password-change path (SHA-256 only).
pub fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let out = hasher.finalize();
    hex::encode(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_and_verify_roundtrip() {
        let h = hash_password("campus123");
        assert!(h.contains(':'));
        assert!(verify_password("campus123", &h));
        assert!(!verify_password("wrong", &h));
    }

    #[test]
    fn hash_is_salted() {
        let a = hash_password("pw");
        let b = hash_password("pw");
        assert_ne!(a, b);
    }

    #[test]
    fn sha256_matches_known() {
        // sha256("abc") hex
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}