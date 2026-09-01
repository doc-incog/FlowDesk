#[cfg(test)]
mod legacy_interop {
    use crate::services::password::verify_password;

    /// A real hash produced by Node's `crypto.scrypt` (default params N=16384, r=8, p=1,
    /// keylen=64) for password `campus123`, copied from the pre-migration SQLite snapshot
    /// (user aisha.karim@campus.edu). Verifies that the Rust scrypt implementation is
    /// byte-for-byte compatible so existing seed users can log in without a password reset.
    const NODE_CAMPUS123_HASH: &str = "53b9c1e207c7c2615cf0b7834c7cce70:520e8d6a8328fe246c486d55ed06ad7b8d4af8725e3f0fe4bd2d47b1f442f5721750dabebbf55a108c761ecefcfccb496f21997f499fadda3b6ded177470881b";

    #[test]
    fn node_scrypt_hash_verifies_for_legacy_password() {
        assert!(verify_password("campus123", NODE_CAMPUS123_HASH));
    }

    #[test]
    fn node_scrypt_hash_rejects_wrong_password() {
        assert!(!verify_password("not-the-password", NODE_CAMPUS123_HASH));
    }

    /// Admin seed user's real hash (from pre-migration snapshot), demo login documented
    /// in contract-freeze.md: `admin@flowdesk.edu` / `flowdesk-admin@2026`.
    const NODE_ADMIN_HASH: &str = "4b56fdb7d9e31326350d441c236cf490:eb70e4576bb35f15e71226ae2a396134bbc87e0160a72d029a296fe4720eb4a6dcba25b1fbf049b2e02001735d169a76df51c2c78848055c0e53efe919f00d0b";

    #[test]
    fn node_admin_hash_verifies_demo_credentials() {
        assert!(verify_password("flowdesk-admin@2026", NODE_ADMIN_HASH));
    }
}