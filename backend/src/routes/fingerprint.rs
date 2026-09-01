use crate::constants;
use crate::error::ApiError;
use crate::middleware::auth;
use crate::middleware::device_auth;
use crate::services::fingerprint as fp;
use crate::services::util as u;
use crate::state::AppState;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::routing::{get, patch, post};
use axum::{Json, Router};
use base64::Engine;
use futures::TryStreamExt;
use mongodb::bson::{doc, Binary, Bson, Document, spec::BinarySubtype};
use serde_json::{json, Value};
use std::collections::HashMap;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/fingerprint/command", get(get_command))
        .route("/api/fingerprint/result", post(post_result))
        .route("/api/fingerprint/devices", get(list_devices).post(device_action))
        .route("/api/fingerprint/devices/{device_id}", get(device_detail).patch(update_device))
        .route(
            "/api/fingerprint/devices/{device_id}/health",
            get(device_health).post(post_device_health),
        )
        .route("/api/fingerprint/enroll", get(list_enrollments).post(enroll))
        .route(
            "/api/fingerprint/enroll/status",
            get(enroll_status_get).post(enroll_status_post),
        )
        .route("/api/fingerprint/enroll/stream", get(enroll_stream))
        .route("/api/fingerprint/lookup", get(lookup))
        .route("/api/fingerprint/verify", post(verify))
}

/// Resolve the authenticated (or query-specified) device id.
async fn require_device(
    state: &AppState,
    headers: &HeaderMap,
    params: &HashMap<String, String>,
) -> Result<String, ApiError> {
    if let Some(id) = device_auth::device_auth_from_headers(state, headers).await? {
        return Ok(id);
    }
    if let Some(id) = params.get("deviceId").filter(|s| !s.is_empty()) {
        return Ok(id.clone());
    }
    Err(ApiError::unauthorized("Device authorization required"))
}

fn b64(s: &str) -> Vec<u8> {
    base64::engine::general_purpose::STANDARD.decode(s).unwrap_or_default()
}

// ---- GET /api/fingerprint/command ----
async fn get_command(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, ApiError> {
    let device_id = require_device(&state, &headers, &params).await?;
    let _ = fp::heartbeat_device(&state.db, &device_id, None, None).await?;
    if let Some(c) = fp::get_next_command(&state.db, &device_id).await? {
        let params: Value =
            serde_json::from_str(c.get_str("params").unwrap_or("{}")).unwrap_or(Value::Null);
        return Ok(Json(json!({
            "id": c.get_str("_id").unwrap_or(""),
            "command": c.get_str("command").unwrap_or(""),
            "params": params,
        })));
    }
    Ok(Json(json!({ "command": Value::Null })))
}

// ---- POST /api/fingerprint/result ----
async fn post_result(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    require_device(&state, &headers, &HashMap::new()).await?;
    let command_id = body.get("commandId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let status = body.get("status").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if command_id.is_empty() {
        return Err(ApiError::bad_request("Missing commandId"));
    }
    let result = body.get("result").cloned();
    fp::complete_command(&state.db, &state.sse, &command_id, &status, result).await?;
    Ok(Json(json!({ "ok": true })))
}

// ---- POST /api/fingerprint/devices ----
async fn device_action(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let devices = state.db.collection::<Document>("fingerprint_devices");

    // Behavior 1: admin approve/disable.
    if let Some(action) = body.get("action").and_then(|v| v.as_str()) {
        auth::require_admin(&state, &headers).await?;
        let device_id = body.get("deviceId").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let status = match action {
            "approve" => "approved",
            "disable" => "disabled",
            _ => return Err(ApiError::bad_request("Invalid action")),
        };
        let res = devices
            .update_one(doc! { "_id": &device_id }, doc! { "$set": { "status": status } }, None)
            .await?;
        if res.matched_count == 0 {
            return Err(ApiError::not_found("Device not found"));
        }
        return Ok((axum::http::StatusCode::OK, Json(json!({ "ok": true }))));
    }

    // Behavior 2: device auto-register (no admin session).
    let is_admin = match auth::session_user_opt(&state, &headers).await {
        Ok(Some(u)) => u.role == "admin",
        _ => false,
    };
    let device_id = body.get("deviceId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if !device_id.is_empty() && !is_admin {
        let sensor_type = body.get("sensorType").and_then(|v| v.as_str()).unwrap_or("R307").to_string();
        let slots = constants::get_max_slots(&sensor_type);
        if let Some(existing) = devices.find_one(doc! { "_id": &device_id }, None).await? {
            let status = existing.get_str("status").unwrap_or("pending").to_string();
            let secret = existing.get_str("device_secret").ok().map(|s| s.to_string());
            return Ok((axum::http::StatusCode::OK, Json(json!({ "ok": true, "deviceSecret": secret, "status": status }))));
        }
        let secret = fp::generate_device_secret();
        devices
            .insert_one(
                doc! {
                    "_id": &device_id,
                    "label": "",
                    "location": "",
                    "device_secret": &secret,
                    "sensor_type": sensor_type,
                    "status": "pending",
                    "last_seen": u::iso_now(),
                    "enrolled_count": 0,
                    "slots_total": slots,
                    "created_at": u::iso_now(),
                },
                None,
            )
            .await?;
        return Ok((axum::http::StatusCode::OK, Json(json!({ "ok": true, "deviceSecret": secret, "status": "pending" }))));
    }

    // Behavior 3: admin create/update.
    auth::require_admin(&state, &headers).await?;
    if device_id.is_empty() {
        return Err(ApiError::bad_request("Missing deviceId"));
    }
    if let Some(mut ex) = devices.find_one(doc! { "_id": &device_id }, None).await? {
        let label = body.get("label").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_else(|| ex.get_str("label").unwrap_or("").to_string());
        let location = body.get("location").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_else(|| ex.get_str("location").unwrap_or("").to_string());
        let sensor_type = body.get("sensorType").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_else(|| ex.get_str("sensor_type").unwrap_or("R307").to_string());
        devices
            .update_one(
                doc! { "_id": &device_id },
                doc! { "$set": { "label": &label, "location": &location, "sensor_type": &sensor_type } },
                None,
            )
            .await?;
        return Ok((axum::http::StatusCode::OK, Json(json!({ "ok": true, "status": ex.get_str("status").unwrap_or("pending") }))));
    }

    // New device via admin (secret only returned on create).
    let secret = fp::generate_device_secret();
    let label = body.get("label").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let location = body.get("location").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let sensor_type = body.get("sensorType").and_then(|v| v.as_str()).unwrap_or("R307").to_string();
    let slots = constants::get_max_slots(&sensor_type);
    devices
        .insert_one(
            doc! {
                "_id": &device_id,
                "label": label,
                "location": location,
                "device_secret": &secret,
                "sensor_type": sensor_type,
                "status": "pending",
                "last_seen": u::iso_now(),
                "enrolled_count": 0,
                "slots_total": slots,
                "created_at": u::iso_now(),
            },
            None,
        )
        .await?;
    Ok((axum::http::StatusCode::CREATED, Json(json!({ "ok": true, "deviceSecret": secret, "status": "pending", "created": true }))))
}

// ---- GET /api/fingerprint/devices ----
async fn list_devices(State(state): State<AppState>, headers: HeaderMap) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;
    let devices = state.db.collection::<Document>("fingerprint_devices");
    let prio = doc! {
        "$cond": {
            "if": { "$eq": ["$status", "pending"] }, "then": 0,
            "else": { "$cond": { "if": { "$eq": ["$status", "approved"] }, "then": 1, "else": 2 } }
        }
    };
    let mut cursor = devices
        .aggregate([doc! { "$addFields": { "_prio": prio } }, doc! { "$sort": { "_prio": 1, "last_seen": -1 } }], None)
        .await?;
    let mut out = Vec::new();
    while let Some(d) = cursor.try_next().await? {
        out.push(snake_device(&d));
    }
    Ok(Json(json!({ "devices": out })))
}

fn snake_device(d: &Document) -> Value {
    json!({
        "device_id": d.get_str("_id").unwrap_or(""),
        "label": d.get_str("label").unwrap_or(""),
        "location": d.get_str("location").unwrap_or(""),
        "sensor_type": d.get_str("sensor_type").unwrap_or(""),
        "status": d.get_str("status").unwrap_or(""),
        "last_seen": d.get_str("last_seen").ok(),
        "enrolled_count": d.get_i64("enrolled_count").unwrap_or(0),
        "slots_total": d.get_i64("slots_total").unwrap_or(0),
        "created_at": d.get_str("created_at").unwrap_or(""),
    })
}

// ---- GET/PATCH/DELETE /api/fingerprint/devices/{id} ----
async fn device_detail(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(device_id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;
    let devices = state.db.collection::<Document>("fingerprint_devices");
    let device = devices
        .find_one(doc! { "_id": &device_id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Device not found"))?;

    let health = read_health(&state, &device_id, 10).await?;
    let enrollments = read_enrollments(&state, &device_id).await?;

    Ok(Json(json!({ "device": snake_device(&device), "health": health, "enrollments": enrollments })))
}

async fn read_health(state: &AppState, device_id: &str, limit: i64) -> Result<Vec<Value>, ApiError> {
    let coll = state.db.collection::<Document>("fingerprint_device_health");
    let mut hc = coll
        .find(
            doc! { "device_id": device_id },
            mongodb::options::FindOptions::builder().sort(doc! { "recorded_at": -1 }).limit(limit).build(),
        )
        .await?;
    let mut health = Vec::new();
    while let Some(h) = hc.try_next().await? {
        health.push(json!({
            "sensorConnected": h.get_i64("sensor_connected").unwrap_or(0) == 1,
            "sensorCapacity": h.get_i64("sensor_capacity").ok(),
            "freeMemory": h.get_i64("free_memory").ok(),
            "wifiRssi": h.get_i64("wifi_rssi").ok(),
            "uptimeSeconds": h.get_i64("uptime_seconds").ok(),
            "recordedAt": h.get_str("recorded_at").unwrap_or(""),
        }));
    }
    Ok(health)
}

async fn read_enrollments(state: &AppState, device_id: &str) -> Result<Vec<Value>, ApiError> {
    let tpl = state.db.collection::<Document>("fingerprint_templates");
    let mut ec = tpl.find(doc! { "device_id": device_id }, None).await?;
    let mut enrollments = Vec::new();
    while let Some(t) = ec.try_next().await? {
        enrollments.push(json!({
            "id": t.get_str("_id").unwrap_or(""),
            "fingerId": t.get_i64("finger_id").unwrap_or(0),
            "userId": t.get_str("user_id").unwrap_or(""),
            "name": t.get_str("user_name").unwrap_or(""),
            "enrolledBy": t.get_str("enrolled_by").ok(),
            "enrolledAt": t.get_str("enrolled_at").unwrap_or(""),
        }));
    }
    Ok(enrollments)
}

async fn update_device(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(device_id): Path<String>,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;
    let mut set = Document::new();
    if let Some(v) = body.get("label").and_then(|v| v.as_str()) {
        set.insert("label", v);
    }
    if let Some(v) = body.get("location").and_then(|v| v.as_str()) {
        set.insert("location", v);
    }
    if let Some(v) = body.get("sensorType").and_then(|v| v.as_str()) {
        set.insert("sensor_type", v);
    }
    if !set.is_empty() {
        state
            .db
            .collection::<Document>("fingerprint_devices")
            .update_one(doc! { "_id": &device_id }, doc! { "$set": set }, None)
            .await?;
    }
    Ok(Json(json!({ "ok": true })))
}

// ---- GET/POST /api/fingerprint/devices/{id}/health ----
async fn device_health(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(device_id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;
    let health = read_health(&state, &device_id, 50).await?;
    Ok(Json(json!({ "health": health })))
}

async fn post_device_health(
    State(state): State<AppState>,
    _headers: HeaderMap,
    Path(device_id): Path<String>,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    // Bearer auth only (no admin); falls back to URL deviceId.
    let _ = require_device(&state, &_headers, &HashMap::new()).await?;
    fp::record_device_health(&state.db, &device_id, &to_doc(&body)).await?;
    Ok(Json(json!({ "ok": true })))
}

fn to_doc(v: &Value) -> Document {
    let mut d = Document::new();
    if let Value::Object(map) = v {
        // Map camelCase JSON -> snake_case bson fields.
        for (k, val) in map {
            let field = match k.as_str() {
                "sensorConnected" => "sensor_connected",
                "sensorCapacity" => "sensor_capacity",
                "freeMemory" => "free_memory",
                "wifiRssi" => "wifi_rssi",
                "uptimeSeconds" => "uptime_seconds",
                _ => k.as_str(),
            };
            if val.is_null() {
                continue;
            }
            if let Some(n) = val.as_i64() {
                d.insert(field, n);
            } else if let Some(b) = val.as_bool() {
                d.insert(field, if b { 1 } else { 0 });
            } else if let Some(s) = val.as_str() {
                if let Ok(n) = s.parse::<i64>() {
                    d.insert(field, n);
                }
            }
        }
    }
    d
}

// ---- GET/POST /api/fingerprint/enroll ----
async fn list_enrollments(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;
    let mut f = Document::new();
    if let Some(device_id) = params.get("deviceId").filter(|s| !s.is_empty()) {
        f.insert("device_id", device_id);
    }
    let tpl = state.db.collection::<Document>("fingerprint_templates");
    let mut cursor = tpl.find(f, None).await?;
    let mut out = Vec::new();
    while let Some(t) = cursor.try_next().await? {
        out.push(json!({
            "id": t.get_str("_id").unwrap_or(""),
            "userId": t.get_str("user_id").unwrap_or(""),
            "fingerId": t.get_i64("finger_id").unwrap_or(0),
            "deviceId": t.get_str("device_id").unwrap_or(""),
            "enrolledBy": t.get_str("enrolled_by").ok(),
            "enrolledAt": t.get_str("enrolled_at").unwrap_or(""),
        }));
    }
    Ok(Json(json!({ "enrollments": out })))
}

async fn enroll(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let user_id = body
        .get("userId")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or(user.id.clone());
    let device_id = body.get("deviceId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if device_id.is_empty() {
        return Err(ApiError::bad_request("Missing deviceId"));
    }
    let finger_id = body.get("fingerId").and_then(|v| v.as_i64()).unwrap_or(0);

    let tpl = state.db.collection::<Document>("fingerprint_templates");
    let slot = if finger_id < 1 {
        fp::next_available_slot(&state.db, &device_id).await?
    } else {
        finger_id
    };
    if slot < 1 {
        return Err(ApiError::conflict("No fingerprint slots available"));
    }

    let template_b64 = body.get("template").and_then(|v| v.as_str()).unwrap_or("");
    let template_bytes = b64(template_b64);

    // Duplicate (user, device) updates existing row.
    if let Some(existing) = tpl
        .find_one(doc! { "user_id": &user_id, "device_id": &device_id }, None)
        .await?
    {
        let id = existing.get_str("_id").unwrap_or("").to_string();
        tpl.update_one(
            doc! { "_id": &id },
            doc! { "$set": {
                "finger_id": slot,
                "template": Binary { subtype: BinarySubtype::Generic, bytes: template_bytes },
                "user_name": &user.name,
                "enrolled_at": u::iso_now(),
            } },
            None,
        )
        .await?;
        fp::notify_enrollment_event(
            &state.sse,
            &device_id,
            json!({ "type": "enrollment-complete", "userId": user_id }),
        );
        return Ok((axum::http::StatusCode::OK, Json(json!({ "ok": true, "updated": true, "id": id, "userId": user_id, "fingerId": slot, "deviceId": device_id }))));
    }

    let id = u::id_fp_template();
    tpl.insert_one(
        doc! {
            "_id": &id,
            "user_id": &user_id,
            "finger_id": slot,
            "device_id": &device_id,
            "template": Binary { subtype: BinarySubtype::Generic, bytes: template_bytes },
            "enrolled_by": &user.id,
            "user_name": &user.name,
            "enrolled_at": u::iso_now(),
        },
        None,
    )
    .await?;
    fp::notify_enrollment_event(
        &state.sse,
        &device_id,
        json!({ "type": "enrollment-complete", "userId": user_id }),
    );
    Ok((axum::http::StatusCode::CREATED, Json(json!({ "ok": true, "updated": false, "id": id, "userId": user_id, "fingerId": slot, "deviceId": device_id }))))
}

// ---- GET/POST /api/fingerprint/enroll/status ----
async fn enroll_status_get(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let user_id = params
        .get("userId")
        .filter(|s| !s.is_empty())
        .cloned()
        .unwrap_or(user.id);
    let tpl = state.db.collection::<Document>("fingerprint_templates");
    let mut cursor = tpl.find(doc! { "user_id": &user_id }, None).await?;
    let mut enrollments = Vec::new();
    while let Some(t) = cursor.try_next().await? {
        enrollments.push(json!({
            "id": t.get_str("_id").unwrap_or(""),
            "fingerId": t.get_i64("finger_id").unwrap_or(0),
            "deviceId": t.get_str("device_id").unwrap_or(""),
            "label": "",
            "location": "",
            "enrolledAt": t.get_str("enrolled_at").unwrap_or(""),
        }));
    }
    Ok(Json(json!({ "enrolled": !enrollments.is_empty(), "enrollments": enrollments })))
}

async fn enroll_status_post(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let device_id = require_device(&state, &headers, &HashMap::new()).await?;
    let user_id = body.get("userId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let step = body.get("step").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let message = body.get("message").and_then(|v| v.as_str()).map(|s| s.to_string());
    let finger_id = body.get("fingerId").and_then(|v| v.as_i64()).unwrap_or(0);
    let event = match step.as_str() {
        "first-capture" => "enrollment-started",
        "second-capture" => "enrollment-progress",
        "matched" | "stored" => "enrollment-progress",
        "complete" | "completed" => "enrollment-complete",
        "error" => "enrollment-failed",
        _ => "enrollment-progress",
    };
    let mut payload = json!({ "type": event, "userId": user_id, "fingerId": finger_id });
    if let Some(m) = message {
        payload["message"] = json!(m);
    }
    fp::notify_enrollment_event(&state.sse, &device_id, payload);
    Ok(Json(json!({ "ok": true })))
}

// ---- GET /api/fingerprint/enroll/stream (SSE) ----
async fn enroll_stream(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    use axum::response::sse::Event;
    use futures::stream::Stream;
    use futures::StreamExt;

    let device_id = params.get("deviceId").cloned().unwrap_or_default();
    let user_id = params.get("userId").cloned().unwrap_or_default();
    let mut bus_rx = state.sse.subscribe(&device_id);

    let connected_event = {
        let device = device_id.clone();
        let user = user_id.clone();
        futures::stream::once(async move {
            Ok::<Event, axum::Error>(
                Event::default()
                    .event("connected")
                    .data(format!(r#"{{"deviceId":"{}","userId":"{}"}}"#, device, user)),
            )
        })
    };

    let body_stream = futures::stream::unfold(
        (bus_rx, tokio::time::interval(std::time::Duration::from_secs(15))),
        |(mut rx, mut ticker)| async move {
            loop {
                tokio::select! {
                    _ = ticker.tick() => {
                        return Some((Ok::<Event, axum::Error>(Event::default().event("heartbeat").data("{}")), (rx, ticker)));
                    }
                    ev = rx.recv() => {
                        match ev {
                            Ok(payload) => {
                                let kind = payload.get("type").and_then(|v| v.as_str()).unwrap_or("message").to_string();
                                let data = payload.to_string();
                                return Some((Ok::<Event, axum::Error>(Event::default().event(kind).data(data)), (rx, ticker)));
                            }
                            Err(_) => return None,
                        }
                    }
                }
            }
        },
    );

    axum::response::Sse::new(connected_event.chain(body_stream)).into_response()
}

// ---- GET /api/fingerprint/lookup ----
async fn lookup(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, ApiError> {
    let device_id = require_device(&state, &headers, &params).await?;
    let finger_id = params.get("fingerId").and_then(|v| v.parse::<i64>().ok()).unwrap_or(0);
    match fp::lookup_by_finger_id(&state.db, &device_id, finger_id).await? {
        Some((user_id, name)) => Ok(Json(json!({ "found": true, "userId": user_id, "name": name }))),
        None => Ok(Json(json!({ "found": false }))),
    }
}

// ---- POST /api/fingerprint/verify ----
async fn verify(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let device_id = require_device(&state, &headers, &HashMap::new()).await?;
    let template_b64 = body.get("template").and_then(|v| v.as_str()).unwrap_or("");
    let bytes = b64(template_b64);
    let threshold = constants::FP_MATCH_THRESHOLD;
    match fp::match_template(&state.db, &bytes, &device_id, threshold).await? {
        Some((user_id, finger_id, confidence)) => {
            let users = state.db.collection::<Document>("users");
            let name = users
                .find_one(doc! { "_id": &user_id }, None)
                .await?
                .and_then(|d| d.get_str("name").ok().map(|s| s.to_string()));
            Ok(Json(json!({ "matched": true, "userId": user_id, "userName": name, "fingerId": finger_id, "confidence": confidence })))
        }
        None => Ok(Json(json!({ "matched": false, "confidence": 0 }))),
    }
}