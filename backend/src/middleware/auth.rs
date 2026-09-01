use crate::error::ApiError;
use crate::models::role_session::Session;
use crate::models::user::User;
use crate::state::AppState;
use axum::http::{header, HeaderMap};
use mongodb::bson::doc;
use mongodb::options::IndexOptions;
use mongodb::IndexModel;
use rand::RngCore;
use std::time::Duration;

/// Create a MongoDB TTL index on sessions.expires_at for automatic expiry cleanup.
pub async fn ensure_indexes(db: &mongodb::Database) -> mongodb::error::Result<()> {
    let coll = db.collection::<Session>("sessions");
    coll.create_index(
        IndexModel::builder()
            .keys(doc! { "expires_at": 1 })
            .options(IndexOptions::builder().expire_after(Some(Duration::from_secs(0))).build())
.build(),
            None,
        )
        .await?;
    Ok(())
}

/// Generate a random 128-bit session token as a 32-char hex string.
pub fn new_session_token() -> String {
    let mut buf = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut buf);
    hex::encode(buf)
}

/// Extract an optional `User` from the request headers via the session cookie.
///
/// `None` => unauthenticated. Callers enforce their own authz/role rules against
/// the returned user, matching the legacy inline `role` checks.
pub async fn get_session_user(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<Option<User>, ApiError> {
    let cookie_name = &state.cfg.session_cookie;
    let token = headers
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .and_then(|c| {
            c.split(';')
                .filter_map(|part| {
                    let part = part.trim();
                    part.strip_prefix(&format!("{}=", cookie_name))
                })
                .next()
                .map(|v| v.trim().trim_matches('"').to_string())
        })
        .filter(|t| !t.is_empty());

    let token = match token {
        Some(t) => t,
        None => return Ok(None),
    };

    let sessions = state.db.collection::<Session>("sessions");
    let session = sessions
        .find_one(doc! { "_id": &token }, None)
        .await?
        .filter(|s| !is_expired(&s.expires_at));

    let session = match session {
        Some(s) => s,
        None => return Ok(None),
    };

    let users = state.db.collection::<User>("users");
    let user = users
        .find_one(doc! { "_id": &session.user_id, "is_deleted": false }, None)
        .await?;
    Ok(user)
}

/// Require a signed-in user; returns 401 when absent.
pub async fn require_session_user(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<User, ApiError> {
    match get_session_user(state, headers).await {
        Ok(Some(user)) => Ok(user),
        Ok(None) => Err(ApiError::unauthorized("Authentication required")),
        Err(e) => Err(e),
    }
}

/// Like `require_session_user` but additionally enforces a role.
pub async fn require_role(
    state: &AppState,
    headers: &HeaderMap,
    roles: &[&str],
) -> Result<User, ApiError> {
    let user = require_session_user(state, headers).await?;
    if roles.iter().any(|r| *r == user.role) {
        Ok(user)
    } else {
        Err(ApiError::forbidden("Forbidden"))
    }
}

/// Enforce admin.
pub async fn require_admin(state: &AppState, headers: &HeaderMap) -> Result<User, ApiError> {
    require_role(state, headers, &["admin"]).await
}

/// Resolve the session user if any (do not error when absent/anonymous).
pub async fn session_user_opt(state: &AppState, headers: &HeaderMap) -> Result<Option<User>, ApiError> {
    get_session_user(state, headers).await
}

/// Parse and check expiry of a stored RFC3339 expiration string.
fn is_expired(expires_at: &str) -> bool {
    match chrono::DateTime::parse_from_rfc3339(expires_at) {
        Ok(exp) => chrono::Utc::now() >= exp.with_timezone(&chrono::Utc),
        // Fallback: best-effort lexicographic compare for ISO-8601 UTC.
        Err(_) => expires_at.to_string() <= chrono::Utc::now().to_rfc3339(),
    }
}