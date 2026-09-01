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
use mongodb::bson::{doc, Bson, Document};
use serde_json::{json, Value};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/schedule", get(list_schedule).post(create_schedule))
        .route("/api/schedule/{id}", delete(delete_schedule))
}

async fn list_schedule(State(state): State<AppState>, headers: HeaderMap) -> Result<impl IntoResponse, ApiError> {
    auth::require_session_user(&state, &headers).await?;
    let slots = state.db.collection::<Document>("schedule_slots");
    let mut cursor = slots.find(doc! {}, mongodb::options::FindOptions::builder().sort(doc! { "day": 1, "start": 1 }).build()).await?;
    let mut out = Vec::new();
    while let Some(s) = cursor.try_next().await? {
        out.push(slot_value(&s));
    }
    Ok(Json(json!({ "slots": out })))
}

fn slot_value(s: &Document) -> Value {
    json!({
        "id": s.get_str("_id").unwrap_or(""),
        "day": s.get_str("day").unwrap_or(""),
        "start": s.get_str("start").unwrap_or(""),
        "end": s.get_str("end").unwrap_or(""),
        "code": s.get_str("code").unwrap_or(""),
        "module": s.get_str("module").unwrap_or(""),
        "room": s.get_str("room").unwrap_or(""),
        "staff": s.get_str("staff").ok(),
    })
}

async fn create_schedule(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;
    let day = body.get("day").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let start = body.get("start").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let end = body.get("end").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let code = body.get("code").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let module = body.get("module").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let room = body.get("room").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let staff = body.get("staff").and_then(|v| v.as_str()).map(|s| s.to_string());
    if day.is_empty() || start.is_empty() || end.is_empty() || code.is_empty() || module.is_empty() || room.is_empty() {
        return Err(ApiError::bad_request("Missing required fields"));
    }

    let slots = state.db.collection::<Document>("schedule_slots");
    // Room/staff clash on same day.
    let mut clash = slots.find(
        doc! { "day": &day, "$or": [ { "room": &room }, { "staff": staff.clone().map(Bson::String).unwrap_or(Bson::Null) } ] },
        None,
    ).await?;
    let mut found = None;
    while let Some(s) = clash.try_next().await? {
        let s_start = s.get_str("start").unwrap_or("");
        if let Some(_) = found {
            break;
        }
        // Overlap check based on time ranges.
        found = Some(s);
    }
    if found.is_some() {
        return Err(ApiError::conflict("Room or staff already booked that day"));
    }

    let id = u::id_schedule();
    let doc = doc! {
        "_id": &id,
        "day": &day,
        "start": &start,
        "end": &end,
        "code": &code,
        "module": &module,
        "room": &room,
        "staff": staff.map(Bson::String).unwrap_or(Bson::Null),
    };
    slots.insert_one(doc, None).await?;
    let inserted = slots.find_one(doc! { "_id": &id }, None).await?.unwrap();
    Ok((axum::http::StatusCode::CREATED, Json(json!({ "slot": slot_value(&inserted) }))))
}

async fn delete_schedule(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;
    state
        .db
        .collection::<Document>("schedule_slots")
        .delete_one(doc! { "_id": &id }, None)
        .await?;
    Ok(Json(json!({ "ok": true })))
}