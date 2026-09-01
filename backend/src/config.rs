use std::env;

/// Application configuration loaded from environment variables.
/// Prefix: `FLOWDESK_` (e.g. `FLOWDESK_PORT`). Several vars share their name
/// with the legacy Next.js app for deployment parity (SEED, RENDER_DISK_MOUNT_PATH).
#[derive(Debug, Clone)]
pub struct Config {
    /// Bind address, e.g. "0.0.0.0:8080".
    pub bind_addr: String,

    /// MongoDB connection string.
    pub mongodb_uri: String,

    /// Name of the MongoDB database.
    pub mongodb_db: String,

    /// Comma-separated list of allowed CORS origins (Netlify frontend, local dev).
    pub cors_origins: Vec<String>,

    /// Session cookie name (kept `flowdesk.session` for web parity).
    pub session_cookie: String,

    /// Session TTL seconds (30 days, parity).
    pub session_ttl_secs: u64,

    /// Seed demo data (parity with `SEED`).
    pub seed: bool,

    /// Secret signing JWTs for mobile/device bearer auth. Runtime-required in prod.
    pub jwt_secret: String,

    /// Base directory for uploads (parity with `RENDER_DISK_MOUNT_PATH`).
    pub data_dir: String,
}

impl Config {
    pub fn from_env() -> Self {
        let cors: Vec<String> = env::var("FLOWDESK_CORS_ORIGINS")
            .or_else(|_| env::var("CORS_ORIGINS"))
            .unwrap_or_else(|_| "http://localhost:3000,http://localhost:8080".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Config {
            bind_addr: env::var("FLOWDESK_BIND_ADDR")
                .or_else(|_| env::var("BIND_ADDR"))
                .unwrap_or_else(|_| format!("0.0.0.0:{}" , env::var("PORT").unwrap_or_else(|_| "8080".into()))),
            mongodb_uri: env::var("FLOWDESK_MONGODB_URI")
                .or_else(|_| env::var("MONGODB_URI"))
                .unwrap_or_else(|_| "mongodb://localhost:27017".to_string()),
            mongodb_db: env::var("FLOWDESK_MONGODB_DB")
                .or_else(|_| env::var("MONGODB_DB"))
                .unwrap_or_else(|_| "flowdesk".to_string()),
            cors_origins: cors,
            session_cookie: env::var("FLOWDESK_SESSION_COOKIE")
                .or_else(|_| env::var("SESSION_COOKIE"))
                .unwrap_or_else(|_| "flowdesk.session".to_string()),
            session_ttl_secs: env::var("FLOWDESK_SESSION_TTL_SECS")
                .or_else(|_| env::var("SESSION_TTL_SECS"))
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(30 * 24 * 60 * 60),
            seed: env::var("FLOWDESK_SEED")
                .or_else(|_| env::var("SEED"))
                .map(|v| v != "false")
                .unwrap_or(true),
            jwt_secret: env::var("FLOWDESK_JWT_SECRET")
                .or_else(|_| env::var("JWT_SECRET"))
                .unwrap_or_else(|_| "dev-insecure-change-me".to_string()),
            data_dir: env::var("FLOWDESK_DATA_DIR")
                .or_else(|_| env::var("RENDER_DISK_MOUNT_PATH"))
                .or_else(|_| env::var("DATA_DIR"))
                .unwrap_or_else(|_| ".data".to_string()),
        }
    }
}