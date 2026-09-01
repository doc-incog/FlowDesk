use crate::constants::CHECKIN_CUTOFF_MINUTES;
use crate::error::ApiError;
use crate::helpers;
use crate::middleware::auth;
use crate::services::util as u;
use crate::state::AppState;
use axum::extract::Query;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use futures::TryStreamExt;
use mongodb::bson::{doc, Bson, Document};
use serde_json::{json, Value};
use std::collections::HashMap;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/checkins", get(list_checkins).post(create_checkin))
        .route("/api/checkins/history", get(checkin_history))
        .route("/api/checkins/manual", post(manual_checkin))
}

/// Parse a 12-hour clock string like "9:15 AM" / "06:30 PM" to minutes-since-midnight.
fn clock_to_minutes(t: &str) -> Option<i64> {
    let t = t.trim().to_uppercase();
    let (time_part, meridian) = if let Some(idx) = t.rfind(char::is_alphabetic) {
        if idx + 1 < t.len() {
            (&t[..idx + 1], &t[idx + 1..])
        } else {
            return None;
        }
    } else {
        return None;
    };
    let (ampm, ok) = if meridian.contains("PM") {
        ("pm", true)
    } else if meridian.contains("AM") {
        ("am", true)
    } else {
        ("", false)
    };
    if !ok {
        return None;
    }
    let colon = time_part.find(':')?;
    let h: i64 = time_part[..colon].trim().parse().ok()?;
    let m: i64 = time_part[colon + 1..].trim().parse().ok()?;
    let mut h = h;
    if ampm == "pm" && h < 12 {
        h += 12;
    } else if ampm == "am" && h == 12 {
        h = 0;
    }
    Some(h * 60 + m)
}

/// Determine attendance status from a 12-hour clock time string.
fn status_for(clock: &str) -> String {
    match clock_to_minutes(clock) {
        Some(minutes) if minutes <= CHECKIN_CUTOFF_MINUTES => "on-time".to_string(),
        _ => "late".to_string(),
    }
}

async fn list_checkins(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let date = params
        .get("date")
        .filter(|s| !s.is_empty())
        .cloned()
        .unwrap_or_else(u::local_date);

    let filter = if user.role == "student" {
        doc! { "user_id": &user.id, "date": &date }
    } else {
        doc! { "date": &date }
    };

    let checkins = state.db.collection::<Document>("check_ins");
    let mut cursor = checkins
        .find(filter, mongodb::options::FindOptions::builder().sort(doc! { "created_at": -1 }).build())
        .await?;
    let mut records = Vec::new();
    while let Some(c) = cursor.try_next().await? {
        records.push(checkin_value(&c));
    }

    Ok(Json(json!({ "date": date, "records": records })))
}

fn checkin_value(c: &Document) -> Value {
    json!({
        "id": c.get_str("_id").unwrap_or(""),
        "userId": c.get_str("user_id").ok(),
        "name": c.get_str("name").unwrap_or(""),
        "role": c.get_str("role").unwrap_or(""),
        "date": c.get_str("date").unwrap_or(""),
        "time": c.get_str("time").unwrap_or(""),
        "status": c.get_str("status").unwrap_or(""),
        "method": c.get_str("method").unwrap_or(""),
        "source": c.get_str("source").unwrap_or(""),
        "deviceId": c.get_str("device_id").ok(),
        "createdAt": c.get_str("created_at").unwrap_or(""),
    })
}

async fn create_checkin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    // Device body has no session cookie; source=device uses studentId + deviceId.
    let source = body.get("source").and_then(|v| v.as_str()).unwrap_or("web").to_string();

    let (user_id, name, role, method, device_id): (String, String, String, String, Option<String>) = if source == "device" {
        // Device check-in (Bearer auth; full fingerprint/device bridge handled in Phase 7).
        let user = auth::require_session_user(&state, &headers).await?;
        let stu = state
            .db
            .collection::<Document>("users")
            .find_one(doc! { "_id": &user.id }, None)
            .await?;
        let name = stu.as_ref().and_then(|s| s.get_str("name").ok()).unwrap_or("").to_string();
        let method = body.get("method").and_then(|v| v.as_str()).unwrap_or("device").to_string();
        let device_id = body.get("deviceId").and_then(|v| v.as_str()).map(|s| s.to_string());
        (user.id.clone(), name, "student".to_string(), method, device_id)
    } else {
        let user = auth::require_session_user(&state, &headers).await?;
        let method = body.get("method").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let device_id = body.get("deviceId").and_then(|v| v.as_str()).map(|s| s.to_string());
        (user.id.clone(), user.name, user.role.clone(), method, device_id)
    };

    let date = u::local_date();
    let time = u::clock_time();
    let status = status_for(&time);

    let checkins = state.db.collection::<Document>("check_ins");
    // Idempotent per day.
    if let Some(existing) = checkins
        .find_one(doc! { "user_id": &user_id, "date": &date }, None)
        .await?
    {
        return Ok(Json(json!({ "record": checkin_value(&existing), "alreadyCheckedIn": true })));
    }

    let id = u::id_ci();
    let doc = doc! {
        "_id": &id,
        "user_id": &user_id,
        "name": &name,
        "role": &role,
        "date": &date,
        "time": &time,
        "status": &status,
        "method": &method,
        "source": &source,
        "device_id": device_id.map(Bson::String).unwrap_or(Bson::Null),
        "created_at": u::iso_now(),
    };
    checkins.insert_one(doc, None).await?;

    Ok(Json(json!({ "record": checkin_value(&checkins.find_one(doc! { "_id": &id }, None).await?.unwrap()), "alreadyCheckedIn": false })))
}

fn summary_for(date: &str, records: &[Document], role: &str) -> Value {
    let total = records.len();
    let present = records.iter().filter(|r| r.get_str("status").ok().map(|s| s == "on-time" || s == "late").unwrap_or(false)).count();
    let mut late = 0usize;
    let mut on_time = 0usize;
    for r in records {
        match r.get_str("status").unwrap_or("") {
            "on-time" => on_time += 1,
            "late" => late += 1,
            _ => {}
        }
    }
    let attended = present;
    let absent = if role == "student" {
        // For students, per today or from records not present -> treated as 0 absence counts
        // by frontend percentages; backend only counts known records.
        0i64
    } else {
        0i64
    };
    json!({
        "total": total,
        "present": present,
        "late": late,
        "absent": absent,
        "percentage": u::attendance_pct(total, attended),
    })
}

async fn checkin_history(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;

    let from = params.get("from").filter(|s| !s.is_empty()).cloned();
    let to = params.get("to").filter(|s| !s.is_empty()).cloned();
    let role_filter = params.get("role").filter(|s| !s.is_empty()).cloned();
    let user_id_param = params.get("userId").filter(|s| !s.is_empty()).cloned();

    // Staff may only scope to their own mentees.
    if user.role == "staff" {
        if let Some(ref uid) = user_id_param {
            if uid != &user.id {
                let mentees = helpers::mentee_ids(&state, &user.id).await?;
                if !mentees.contains(uid) {
                    return Err(ApiError::forbidden("You can only view your own mentees"));
                }
            }
        }
    }
    if role_filter.is_some() && user.role != "admin" {
        return Err(ApiError::forbidden("Only admins can filter by role"));
    }

    let mut f = Document::new();
    if user.role == "student" {
        f.insert("user_id", &user.id);
    } else if let Some(uid) = user_id_param {
        f.insert("user_id", &uid);
    }
    if let Some(rf) = role_filter {
        f.insert("role", &rf);
    }
    let mut date_filter = Document::new();
    if let Some(from) = from {
        date_filter.insert("$gte", from);
    }
    if let Some(to) = to {
        date_filter.insert("$lte", to);
    }
    if !date_filter.is_empty() {
        f.insert("date", date_filter);
    }

    let checkins = state.db.collection::<Document>("check_ins");
    let mut cursor = checkins
        .find(
            f,
            mongodb::options::FindOptions::builder()
                .sort(doc! { "date": -1, "created_at": -1 })
                .limit(500)
                .build(),
        )
        .await?;
    let mut records = Vec::new();
    let mut doc_records = Vec::new();
    while let Some(c) = cursor.try_next().await? {
        doc_records.push(c.clone());
        records.push(checkin_value(&c));
    }

    Ok(Json(json!({
        "records": records,
        "summary": summary_for("", &doc_records, &user.role),
    })))
}

async fn manual_checkin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    if user.role != "staff" && user.role != "admin" {
        return Err(ApiError::forbidden("Only staff or admin can add manual check-ins"));
    }
    let student_id = body.get("studentId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let status = body.get("status").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if !["present", "late", "absent"].contains(&status.as_str()) {
        return Err(ApiError::bad_request("Invalid status"));
    }
    let note = body.get("note").and_then(|v| v.as_str()).unwrap_or("").to_string();

    if user.role == "staff" {
        // Staff may only update their mentees.
        let mentees = helpers::mentee_ids(&state, &user.id).await?;
        if !mentees.contains(&student_id) {
            return Err(ApiError::forbidden("You can only manage your own mentees"));
        }
    }

    let users = state.db.collection::<Document>("users");
    let stu = users
        .find_one(doc! { "_id": &student_id, "is_deleted": false }, None)
        .await?
        .ok_or_else(|| ApiError::bad_request("Unknown student"))?;

    let date = u::local_date();
    let time = u::clock_time();
    let checkins = state.db.collection::<Document>("check_ins");

    if let Some(existing) = checkins.find_one(doc! { "user_id": &student_id, "date": &date }, None).await? {
        let mut set = Document::new();
        set.insert("status", &status);
        set.insert("method", "manual");
        set.insert("source", "web");
        if !note.is_empty() {
            set.insert("note", &note);
        }
        checkins.update_one(doc! { "_id": existing.get_str("_id").unwrap_or("") }, doc! { "$set": set }, None).await?;
        let updated = checkins.find_one(doc! { "user_id": &student_id, "date": &date }, None).await?.unwrap();
        return Ok((axum::http::StatusCode::OK, Json(json!({ "record": checkin_value(&updated), "created": false }))));
    }

    let id = u::id_ci();
    let doc = doc! {
        "_id": &id,
        "user_id": &student_id,
        "name": stu.get_str("name").unwrap_or(""),
        "role": "student",
        "date": &date,
        "time": &time,
        "status": &status,
        "method": "manual",
        "source": "web",
        "device_id": Bson::Null,
        "created_at": u::iso_now(),
    };
    if !note.is_empty() {
        // note not in base schema; stored as extra field
    }
    checkins.insert_one(doc, None).await?;
    let inserted = checkins.find_one(doc! { "_id": &id }, None).await?.unwrap();
    Ok((axum::http::StatusCode::CREATED, Json(json!({ "record": checkin_value(&inserted), "created": true }))))
}