use crate::config::Config;
use crate::error::ApiError;
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

/// JWT claims for mobile + device bearer tokens.
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // user id or device id
    pub kind: String, // "user" | "device"
    pub exp: usize,
    pub iat: usize,
}

pub fn issue_token(cfg: &Config, subject: &str, kind: &str, ttl_secs: u64) -> Result<String, ApiError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as usize;
    let claims = Claims {
        sub: subject.to_string(),
        kind: kind.to_string(),
        exp: now + ttl_secs as usize,
        iat: now,
    };
    jsonwebtoken::encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(cfg.jwt_secret.as_bytes()),
    )
    .map_err(|_| ApiError::internal("failed to issue token"))
}

pub fn verify_token(cfg: &Config, token: &str) -> Result<Claims, ApiError> {
    jsonwebtoken::decode::<Claims>(
        token,
        &DecodingKey::from_secret(cfg.jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map(|d| d.claims)
    .map_err(|_| ApiError::unauthorized("Invalid or expired token"))
}