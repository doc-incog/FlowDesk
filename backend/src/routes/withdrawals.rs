use crate::constants::WITHDRAWAL_STATUSES;
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
use mongodb::bson::{doc, Bson, Document};
use serde_json::{json, Value};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/withdrawals", get(list).post(create))
        .route("/api/withdrawals/{id}", patch(update))
}

// ---- GET /api/withdrawals ----

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

    let withdrawals = state.db.collection::<Document>("withdrawals");
    let mut cursor = withdrawals
        .find(
            filter,
            mongodb::options::FindOptions::builder()
                .sort(doc! { "created_at": -1 })
                .build(),
        )
        .await?;
    let mut list = Vec::new();
    while let Some(w) = cursor.try_next().await? {
        list.push(withdrawal_value(&w));
    }

    Ok(Json(json!({ "withdrawals": list })))
}

fn withdrawal_value(w: &Document) -> Value {
    json!({
        "id": w.get_str("_id").unwrap_or(""),
        "userId": w.get_str("user_id").unwrap_or(""),
        "userName": w.get_str("user_name").unwrap_or(""),
        "reason": w.get_str("reason").unwrap_or(""),
        "status": w.get_str("status").unwrap_or("pending"),
        "decisionNote": w.get_str("decision_note").ok(),
        "createdAt": w.get_str("created_at").unwrap_or(""),
        "decidedAt": w.get_str("decided_at").ok(),
    })
}

// ---- POST /api/withdrawals (student) ----

async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;

    let reason = body
        .get("reason")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if reason.is_empty() {
        return Err(ApiError::bad_request("Reason is required"));
    }

    // 409 if a pending withdrawal already exists for this student.
    let withdrawals = state.db.collection::<Document>("withdrawals");
    let existing = withdrawals
        .find_one(doc! { "user_id": &user.id, "status": "pending" }, None)
        .await?;
    if existing.is_some() {
        return Err(ApiError::conflict(
            "You already have a pending withdrawal request",
        ));
    }

    let id = u::id_withdrawal();
    let now = u::iso_now();
    let doc = doc! {
        "_id": &id,
        "user_id": &user.id,
        "user_name": &user.name,
        "reason": &reason,
        "status": "pending",
        "decision_note": Bson::Null,
        "created_at": &now,
        "decided_at": Bson::Null,
    };
    withdrawals.insert_one(doc, None).await?;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({
            "ok": true,
            "withdrawal": {
                "id": id,
                "userId": user.id,
                "userName": user.name,
                "reason": reason,
                "status": "pending",
                "decisionNote": serde_json::Value::Null,
                "createdAt": now,
                "decidedAt": serde_json::Value::Null,
            }
        })),
    ))
}

// ---- PATCH /api/withdrawals/{id} (admin) ----

async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;

    let status = body
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if !WITHDRAWAL_STATUSES.contains(&status.as_str()) {
        return Err(ApiError::bad_request("Invalid status"));
    }

    let decision_note = body
        .get("decisionNote")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let withdrawals = state.db.collection::<Document>("withdrawals");
    let existing = withdrawals
        .find_one(doc! { "_id": &id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Withdrawal not found"))?;
    let _ = existing;

    let now = u::iso_now();
    let mut set = doc! {
        "status": &status,
    };
    if !decision_note.is_empty() {
        set.insert("decision_note", &decision_note);
    }
    set.insert("decided_at", &now);

    withdrawals
        .update_one(doc! { "_id": &id }, doc! { "$set": set }, None)
        .await?;

    Ok(Json(json!({ "ok": true, "status": status })))
}
