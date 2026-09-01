use crate::constants::COMPLAINT_CATEGORIES;
use crate::constants::COMPLAINT_STATUSES;
use crate::error::ApiError;
use crate::middleware::auth;
use crate::services::util as u;
use crate::state::AppState;
use axum::extract::Path;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::routing::{get, patch};
use axum::{Json, Router};
use futures::TryStreamExt;
use mongodb::bson::{doc, Document};
use serde_json::{json, Value};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/complaints", get(list).post(create))
        .route("/api/complaints/{id}", patch(update).delete(remove))
}

// ---- GET /api/complaints ----

async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;

    let filter = if user.role == "student" {
        doc! { "user_id": &user.id }
    } else {
        doc! {}
    };

    let complaints = state.db.collection::<Document>("complaints");
    let mut cursor = complaints
        .find(
            filter,
            mongodb::options::FindOptions::builder()
                .sort(doc! { "created_at": -1 })
                .build(),
        )
        .await?;
    let mut list = Vec::new();
    while let Some(c) = cursor.try_next().await? {
        list.push(complaint_value(&c));
    }

    Ok(Json(json!({
        "complaints": list,
        "categories": COMPLAINT_CATEGORIES,
    })))
}

fn complaint_value(c: &Document) -> Value {
    let comments: Vec<String> = c
        .get_array("comments")
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    json!({
        "id": c.get_str("_id").unwrap_or(""),
        "userId": c.get_str("user_id").unwrap_or(""),
        "userName": c.get_str("user_name").unwrap_or(""),
        "category": c.get_str("category").unwrap_or(""),
        "subject": c.get_str("subject").unwrap_or(""),
        "description": c.get_str("description").unwrap_or(""),
        "status": c.get_str("status").unwrap_or("open"),
        "comments": comments,
        "createdAt": c.get_str("created_at").unwrap_or(""),
    })
}

// ---- POST /api/complaints ----

async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;

    let category = body
        .get("category")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if category.is_empty() || !COMPLAINT_CATEGORIES.contains(&category.as_str()) {
        return Err(ApiError::bad_request("Invalid category"));
    }
    let subject = body
        .get("subject")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if subject.is_empty() {
        return Err(ApiError::bad_request("Subject is required"));
    }
    let description = body
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let id = u::id_complaint();
    let now = u::iso_now();
    let doc = doc! {
        "_id": &id,
        "user_id": &user.id,
        "user_name": &user.name,
        "category": &category,
        "subject": &subject,
        "description": &description,
        "status": "open",
        "comments": Vec::<mongodb::bson::Bson>::new(),
        "created_at": &now,
    };

    state
        .db
        .collection::<Document>("complaints")
        .insert_one(doc, None)
        .await?;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({
            "complaint": {
                "id": id,
                "userId": user.id,
                "userName": user.name,
                "category": category,
                "subject": subject,
                "description": description,
                "status": "open",
                "comments": Vec::<String>::new(),
                "createdAt": now,
            }
        })),
    ))
}

// ---- PATCH /api/complaints/{id} ----

async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;

    let complaints = state.db.collection::<Document>("complaints");
    let existing = complaints
        .find_one(doc! { "_id": &id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Complaint not found"))?;

    if user.role == "student" && existing.get_str("user_id").unwrap_or("") != user.id {
        return Err(ApiError::forbidden("You can only edit your own complaints"));
    }

    let mut set = Document::new();
    let mut push_comments: Option<String> = None;

    if let Some(comment) = body.get("comment").and_then(|v| v.as_str()) {
        let comment = comment.trim();
        if !comment.is_empty() {
            push_comments = Some(format!("{}: {}", user.name, comment));
        }
    }

    if let Some(status) = body.get("status").and_then(|v| v.as_str()) {
        if !COMPLAINT_STATUSES.contains(&status) {
            return Err(ApiError::bad_request("Invalid status"));
        }
        set.insert("status", status);
    }

    if let Some(c) = push_comments {
        complaints
            .update_one(
                doc! { "_id": &id },
                doc! { "$push": { "comments": c }, "$set": if !set.is_empty() { Some(&set) } else { None } },
                None,
            )
            .await?;
    } else if !set.is_empty() {
        complaints
            .update_one(doc! { "_id": &id }, doc! { "$set": set }, None)
            .await?;
    }

    let updated = complaints
        .find_one(doc! { "_id": &id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Complaint not found"))?;

    Ok(Json(json!({ "complaint": complaint_value(&updated) })))
}

// ---- DELETE /api/complaints/{id} ----

async fn remove(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;

    let complaints = state.db.collection::<Document>("complaints");
    let existing = complaints
        .find_one(doc! { "_id": &id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Complaint not found"))?;

    let is_raiser = existing.get_str("user_id").unwrap_or("") == user.id;
    if user.role != "admin" && !is_raiser {
        return Err(ApiError::forbidden("You can only delete your own complaints"));
    }

    complaints.delete_one(doc! { "_id": &id }, None).await?;
    Ok(Json(json!({ "ok": true })))
}
