use crate::error::ApiError;
use crate::middleware::auth;
use crate::services::util as u;
use crate::state::AppState;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use futures::TryStreamExt;
use mongodb::bson::{doc, Bson, Document};
use serde_json::{json, Value};

pub fn router() -> Router<AppState> {
    Router::new().route(
        "/api/notifications",
        get(list_notifications)
            .post(create_notification)
            .delete(remove_notification),
    )
}

fn notification_value(d: &Document) -> Value {
    json!({
        "id": d.get_str("_id").unwrap_or(""),
        "userId": d.get_str("user_id").ok(),
        "targetRole": d.get_str("target_role").ok(),
        "title": d.get_str("title").unwrap_or(""),
        "body": d.get_str("body").ok(),
        "category": d.get_str("category").ok(),
        "read": d.get_bool("read").unwrap_or(false),
        "unread": !d.get_bool("read").unwrap_or(false),
        "createdAt": d.get_str("created_at").unwrap_or(""),
    })
}

// ---- GET /api/notifications ----

async fn list_notifications(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let notifications = state.db.collection::<Document>("notifications");
    let mut cursor = notifications
        .find(
            doc! { "$or": [ { "user_id": Bson::Null }, { "user_id": &user.id } ] },
            mongodb::options::FindOptions::builder()
                .sort(doc! { "created_at": -1 })
                .build(),
        )
        .await?;
    let mut out = Vec::new();
    while let Some(n) = cursor.try_next().await? {
        out.push(notification_value(&n));
    }
    Ok(Json(json!({ "notifications": out })))
}

// ---- POST /api/notifications ----

async fn create_notification(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let notifications = state.db.collection::<Document>("notifications");

    // Admin broadcast.
    if body.get("target").is_some() {
        let user = auth::require_admin(&state, &headers).await?;
        let _ = user;
        let target = body.get("target").and_then(|v| v.as_str()).unwrap_or("");
        if !["all", "staff", "students"].contains(&target) {
            return Err(ApiError::bad_request("Invalid target"));
        }
        let title = body
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if title.is_empty() {
            return Err(ApiError::bad_request("A title is required"));
        }
        let id = u::id_notification();
        let doc = doc! {
            "_id": &id,
            "user_id": Bson::Null,
            "target_role": target,
            "title": &title,
            "body": body.get("body").and_then(|v| v.as_str()).map(|s| Bson::String(s.to_string())).unwrap_or(Bson::Null),
            "category": body.get("category").and_then(|v| v.as_str()).map(|s| Bson::String(s.to_string())).unwrap_or(Bson::Null),
            "read": false,
            "created_at": u::iso_now(),
        };
        notifications.insert_one(doc, None).await?;
        return Ok(Json(json!({ "ok": true })));
    }

    let user = auth::require_session_user(&state, &headers).await?;

    // Mark one notification read (own row or broadcast).
    if let Some(id) = body.get("id").and_then(|v| v.as_str()) {
        notifications
            .update_one(
                doc! {
                    "_id": id,
                    "$or": [ { "user_id": &user.id }, { "user_id": Bson::Null } ]
                },
                doc! { "$set": { "read": true } },
                None,
            )
            .await?;
        return Ok(Json(json!({ "ok": true })));
    }

    // Empty body => mark all own notifications read.
    notifications
        .update_many(
            doc! { "user_id": &user.id },
            doc! { "$set": { "read": true } },
            None,
        )
        .await?;
    Ok(Json(json!({ "ok": true })))
}

// ---- DELETE /api/notifications?id= ----

async fn remove_notification(
    State(state): State<AppState>,
    headers: HeaderMap,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;
    let id = params.get("id").cloned().unwrap_or_default();
    if id.is_empty() {
        return Err(ApiError::bad_request("id is required"));
    }
    state
        .db
        .collection::<Document>("notifications")
        .delete_many(doc! { "_id": &id }, None)
        .await?;
    Ok(Json(json!({ "ok": true })))
}
