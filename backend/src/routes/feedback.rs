use crate::error::ApiError;
use crate::middleware::auth;
use crate::services::util as u;
use crate::state::AppState;
use axum::extract::Path;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use futures::TryStreamExt;
use mongodb::bson::{doc, Document};
use serde_json::{json, Value};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/feedback", get(list).post(submit))
        .route("/api/feedback/targets", post(create_target))
        .route("/api/feedback/targets/{id}", delete(delete_target))
}

// ---- GET /api/feedback ----

async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let is_admin = user.role == "admin";

    let targets = state.db.collection::<Document>("feedback_targets");
    let mut tc = targets.find(doc! {}, None).await?;
    let mut target_list = Vec::new();
    while let Some(t) = tc.try_next().await? {
        target_list.push(json!({
            "id": t.get_str("_id").unwrap_or(""),
            "type": t.get_str("type").unwrap_or(""),
            "name": t.get_str("name").unwrap_or(""),
            "subtitle": t.get_str("subtitle").unwrap_or(""),
        }));
    }

    let entries = state.db.collection::<Document>("feedback_entries");
    let mut ec = entries.find(doc! {}, None).await?;
    let mut entry_list = Vec::new();
    while let Some(e) = ec.try_next().await? {
        if is_admin {
            entry_list.push(json!({
                "id": e.get_str("_id").unwrap_or(""),
                "targetId": e.get_str("target_id").unwrap_or(""),
                "userId": e.get_str("user_id").unwrap_or(""),
                "userName": e.get_str("user_name").unwrap_or(""),
                "rating": e.get_i64("rating").unwrap_or(0),
                "comment": e.get_str("comment").unwrap_or(""),
                "anonymous": e.get_bool("anonymous").unwrap_or(false),
                "createdAt": e.get_str("created_at").unwrap_or(""),
            }));
        } else {
            let is_anon = e.get_bool("anonymous").unwrap_or(false);
            entry_list.push(json!({
                "id": e.get_str("_id").unwrap_or(""),
                "targetId": e.get_str("target_id").unwrap_or(""),
                "userId": if is_anon { "" } else { e.get_str("user_id").unwrap_or("") },
                "userName": if is_anon { "Anonymous" } else { e.get_str("user_name").unwrap_or("") },
                "rating": e.get_i64("rating").unwrap_or(0),
                "comment": if is_anon { "" } else { e.get_str("comment").unwrap_or("") },
                "anonymous": is_anon,
                "createdAt": e.get_str("created_at").unwrap_or(""),
            }));
        }
    }

    Ok(Json(json!({ "targets": target_list, "entries": entry_list })))
}

// ---- POST /api/feedback ----

async fn submit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;

    let target_id = body
        .get("targetId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if target_id.is_empty() {
        return Err(ApiError::bad_request("targetId is required"));
    }

    let rating = body
        .get("rating")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    if rating < 1 || rating > 5 {
        return Err(ApiError::bad_request("Rating must be between 1 and 5"));
    }

    let comment = body
        .get("comment")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let entries = state.db.collection::<Document>("feedback_entries");

    // One entry per user per target — update in place if exists.
    if let Some(existing) = entries
        .find_one(doc! { "target_id": &target_id, "user_id": &user.id }, None)
        .await?
    {
        let existing_id = existing.get_str("_id").unwrap_or("").to_string();
        entries
            .update_one(
                doc! { "_id": &existing_id },
                doc! { "$set": { "rating": rating, "comment": &comment, "anonymous": false } },
                None,
            )
            .await?;
        return Ok((axum::http::StatusCode::OK, Json(json!({
            "ok": true,
            "entry": {
                "id": existing_id,
                "targetId": target_id,
                "userId": user.id,
                "userName": user.name,
                "rating": rating,
                "comment": comment,
                "anonymous": false,
            }
        }))));
    }

    let id = u::id_feedback_entry();
    let now = u::iso_now();
    let doc = doc! {
        "_id": &id,
        "target_id": &target_id,
        "user_id": &user.id,
        "user_name": &user.name,
        "rating": rating,
        "comment": &comment,
        "anonymous": false,
        "created_at": &now,
    };
    entries.insert_one(doc, None).await?;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({
            "ok": true,
            "entry": {
                "id": id,
                "targetId": target_id,
                "userId": user.id,
                "userName": user.name,
                "rating": rating,
                "comment": comment,
                "anonymous": false,
            }
        })),
    ))
}

// ---- POST /api/feedback/targets (admin) ----

async fn create_target(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;

    let name = body
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if name.is_empty() {
        return Err(ApiError::bad_request("Target name is required"));
    }
    let fb_type = body
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let subtitle = body
        .get("subtitle")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let targets = state.db.collection::<Document>("feedback_targets");
    if targets
        .find_one(doc! { "name": &name }, None)
        .await?
        .is_some()
    {
        return Err(ApiError::conflict("A target with that name already exists"));
    }

    let id = u::id_feedback_target();
    let doc = doc! {
        "_id": &id,
        "type": &fb_type,
        "name": &name,
        "subtitle": &subtitle,
    };
    targets.insert_one(doc, None).await?;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({
            "ok": true,
            "target": {
                "id": id,
                "type": fb_type,
                "name": name,
                "subtitle": subtitle,
            }
        })),
    ))
}

// ---- DELETE /api/feedback/targets/{id} (admin, cascade) ----

async fn delete_target(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;

    let targets = state.db.collection::<Document>("feedback_targets");
    let target = targets
        .find_one(doc! { "_id": &id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Feedback target not found"))?;
    let _ = target;

    targets.delete_one(doc! { "_id": &id }, None).await?;
    state
        .db
        .collection::<Document>("feedback_entries")
        .delete_many(doc! { "target_id": &id }, None)
        .await?;

    Ok(Json(json!({ "ok": true })))
}
