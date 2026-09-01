use crate::error::ApiError;
use crate::middleware::auth;
use crate::models::role_session::Session;
use crate::models::user::User;
use crate::services::password;
use crate::state::AppState;
use axum::extract::State;
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use mongodb::bson::doc;
use serde::{Deserialize, Serialize};
use serde_json::json;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/auth/login", post(login))
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/me", get(me))
}

#[derive(Deserialize)]
struct LoginReq {
    email: String,
    password: String,
}

#[derive(Serialize)]
struct UserProfileOut {
    id: String,
    name: String,
    role: String,
    email: String,
    #[serde(rename = "avatarInitials")]
    avatar_initials: String,
    department: Option<String>,
    batch: Option<String>,
    semester: Option<String>,
    #[serde(rename = "rollNo")]
    roll_no: Option<String>,
    #[serde(rename = "mentorId")]
    mentor_id: Option<String>,
    designation: Option<String>,
    subjects: Option<Vec<String>>,
    phone: Option<String>,
    address: Option<String>,
    #[serde(rename = "guardianName")]
    guardian_name: Option<String>,
    #[serde(rename = "guardianPhone")]
    guardian_phone: Option<String>,
    #[serde(rename = "emergencyContact")]
    emergency_contact: Option<String>,
    dob: Option<String>,
    #[serde(rename = "isDeleted")]
    is_deleted: bool,
}

impl From<User> for UserProfileOut {
    fn from(u: User) -> Self {
        UserProfileOut {
            id: u.id,
            name: u.name,
            role: u.role,
            email: u.email,
            avatar_initials: u.avatar_initials,
            department: u.department,
            batch: u.batch,
            semester: u.semester,
            roll_no: u.roll_no,
            mentor_id: u.mentor_id,
            designation: u.designation,
            subjects: u.subjects,
            phone: u.phone,
            address: u.address,
            guardian_name: u.guardian_name,
            guardian_phone: u.guardian_phone,
            emergency_contact: u.emergency_contact,
            dob: u.dob,
            is_deleted: u.is_deleted,
        }
    }
}

/// Build the `flowdesk.session` cookie value + Set-Cookie header, matching legacy attributes.
fn session_cookie_header(
    state: &AppState,
    token: &str,
    secure: bool,
) -> HeaderMap {
    let expires = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::seconds(state.cfg.session_ttl_secs as i64))
        .map(|t| t.format("%a, %d %b %Y %H:%M:%S GMT").to_string())
        .unwrap_or_default();
    let cookie = format!(
        "{}={}; HttpOnly; SameSite=Lax; Path=/; Expires={}{}",
        state.cfg.session_cookie, token, expires, if secure { "; Secure" } else { "" }
    );
    let mut headers = HeaderMap::new();
    if let Ok(v) = header::HeaderValue::from_str(&cookie) {
        headers.insert(header::SET_COOKIE, v);
    }
    headers
}

/// POST /api/auth/login
async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginReq>,
) -> Result<impl IntoResponse, ApiError> {
    let users = state.db.collection::<User>("users");
    let email = body.email.trim().to_lowercase();
    let user = users
        .find_one(
            doc! { "email": &email, "is_deleted": false },
            None,
        )
        .await?;

    let Some(user) = user else {
        return Err(ApiError::unauthorized("Invalid email or password"));
    };

    if !password::verify_password(&body.password, &user.password_hash) {
        return Err(ApiError::unauthorized("Invalid email or password"));
    }

    // New session (parity: purge done by TTL index on expires_at).
    let token = auth::new_session_token();
    let now = chrono::Utc::now();
    let expires = now
        .checked_add_signed(chrono::Duration::seconds(state.cfg.session_ttl_secs as i64))
        .ok_or_else(|| ApiError::internal("time overflow"))?;
    let session = Session {
        token: token.clone(),
        user_id: user.id.clone(),
        created_at: now.to_rfc3339(),
        expires_at: expires.to_rfc3339(),
    };
    state
        .db
        .collection::<Session>("sessions")
        .insert_one(session, None)
        .await?;

    let headers = session_cookie_header(&state, &token, false);
    let payload = UserProfileOut::from(user);
    Ok((headers, Json(json!({ "user": payload }))))
}

/// POST /api/auth/logout
async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let cookie_name = &state.cfg.session_cookie;
    let token = headers
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .and_then(|c| {
            c.split(';')
                .filter_map(|part| part.trim().strip_prefix(&format!("{}=", cookie_name)))
                .next()
                .map(|v| v.trim().trim_matches('"').to_string())
        })
        .filter(|t| !t.is_empty());

    if let Some(t) = token {
        state
            .db
            .collection::<Session>("sessions")
            .delete_one(doc! { "_id": &t }, None)
            .await?;
    }

    let clear = format!(
        "{}={}; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        state.cfg.session_cookie, ""
    );
    let mut headers = HeaderMap::new();
    if let Ok(v) = header::HeaderValue::from_str(&clear) {
        headers.insert(header::SET_COOKIE, v);
    }
    Ok((headers, Json(json!({ "ok": true }))))
}

/// GET /api/auth/me
async fn me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    match auth::get_session_user(&state, &headers).await? {
        Some(user) => {
            let payload = UserProfileOut::from(user);
            Ok((StatusCode::OK, Json(json!({ "user": payload }))))
        }
        None => Ok((StatusCode::OK, Json(json!({ "user": serde_json::Value::Null })))),
    }
}