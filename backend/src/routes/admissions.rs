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
        .route("/api/admissions", get(list).post(apply))
        .route("/api/admissions/programs", post(create_program))
        .route("/api/admissions/programs/{id}", delete(delete_program))
        .route("/api/programs", get(public_list_programs))
}

// ---- GET /api/admissions (admin) ----

async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;

    let programs = state.db.collection::<Document>("programs");
    let mut pc = programs.find(doc! {}, None).await?;
    let mut program_list = Vec::new();
    while let Some(p) = pc.try_next().await? {
        program_list.push(json!({
            "id": p.get_str("_id").unwrap_or(""),
            "name": p.get_str("name").unwrap_or(""),
            "duration": p.get_str("duration").unwrap_or("4 years"),
            "seats": p.get_i64("seats").unwrap_or(0),
            "deadline": p.get_str("deadline").unwrap_or(""),
            "fee": p.get_i64("fee").unwrap_or(0),
        }));
    }

    let apps = state.db.collection::<Document>("admission_applications");
    let mut ac = apps
        .find(
            doc! {},
            mongodb::options::FindOptions::builder()
                .sort(doc! { "submitted_at": -1 })
                .build(),
        )
        .await?;
    let mut app_list = Vec::new();
    while let Some(a) = ac.try_next().await? {
        app_list.push(json!({
            "id": a.get_str("_id").unwrap_or(""),
            "applicantName": a.get_str("applicant_name").unwrap_or(""),
            "email": a.get_str("email").unwrap_or(""),
            "programId": a.get_str("program_id").unwrap_or(""),
            "programName": a.get_str("program_name").unwrap_or(""),
            "score": a.get_i64("score").unwrap_or(0),
            "docs": a.get_array("docs").map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect::<Vec<_>>()).unwrap_or_default(),
            "status": a.get_str("status").unwrap_or("submitted"),
            "submittedAt": a.get_str("submitted_at").unwrap_or(""),
            "notes": a.get_str("notes").unwrap_or(""),
        }));
    }

    Ok(Json(json!({ "programs": program_list, "applications": app_list })))
}

// ---- POST /api/admissions (public) ----

async fn apply(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let applicant_name = body
        .get("applicantName")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if applicant_name.is_empty() {
        return Err(ApiError::bad_request("applicantName is required"));
    }
    let email = body
        .get("email")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if email.is_empty() {
        return Err(ApiError::bad_request("email is required"));
    }
    let program_id = body
        .get("programId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if program_id.is_empty() {
        return Err(ApiError::bad_request("programId is required"));
    }
    let score: i64 = body
        .get("score")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    let programs = state.db.collection::<Document>("programs");
    let program = programs
        .find_one(doc! { "_id": &program_id }, None)
        .await?
        .ok_or_else(|| ApiError::bad_request("Unknown program"))?;
    let program_name = program.get_str("name").unwrap_or("").to_string();

    let id = u::id_admission_app();
    let now = u::iso_now();
    let app_doc = doc! {
        "_id": &id,
        "applicant_name": &applicant_name,
        "email": &email,
        "program_id": &program_id,
        "program_name": &program_name,
        "score": score,
        "docs": Vec::<Bson>::new(),
        "status": "submitted",
        "submitted_at": &now,
        "notes": "",
    };
    state
        .db
        .collection::<Document>("admission_applications")
        .insert_one(app_doc, None)
        .await?;

    Ok(Json(json!({ "ok": true, "application": json!({
        "id": id,
        "applicantName": applicant_name,
        "email": email,
        "programId": program_id,
        "programName": program_name,
        "score": score,
        "docs": Vec::<String>::new(),
        "status": "submitted",
        "submittedAt": now,
        "notes": "",
    }) })))
}

// ---- GET /api/programs (public) ----

async fn public_list_programs(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    let programs = state.db.collection::<Document>("programs");
    let mut pc = programs.find(doc! {}, None).await?;
    let mut list = Vec::new();
    while let Some(p) = pc.try_next().await? {
        list.push(json!({
            "id": p.get_str("_id").unwrap_or(""),
            "name": p.get_str("name").unwrap_or(""),
            "duration": p.get_str("duration").unwrap_or("4 years"),
            "seats": p.get_i64("seats").unwrap_or(0),
            "deadline": p.get_str("deadline").unwrap_or(""),
            "fee": p.get_i64("fee").unwrap_or(0),
        }));
    }
    Ok(Json(json!({ "programs": list })))
}

// ---- POST /api/admissions/programs (admin) ----

async fn create_program(
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
        return Err(ApiError::bad_request("Program name is required"));
    }
    let duration = body
        .get("duration")
        .and_then(|v| v.as_str())
        .unwrap_or("4 years")
        .to_string();
    let seats = body
        .get("seats")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    if seats < 1 {
        return Err(ApiError::bad_request("Seats must be at least 1"));
    }
    let deadline = body
        .get("deadline")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let fee = body.get("fee").and_then(|v| v.as_i64()).unwrap_or(0);

    let programs = state.db.collection::<Document>("programs");
    if programs
        .find_one(
            doc! { "name": { "$regex": format!("^{}$", regex_escape(&name)), "$options": "i" } },
            None,
        )
        .await?
        .is_some()
    {
        return Err(ApiError::conflict("A program with that name already exists"));
    }

    let id = u::id_program();
    let doc = doc! {
        "_id": &id,
        "name": &name,
        "duration": &duration,
        "seats": seats,
        "deadline": &deadline,
        "fee": fee,
    };
    programs.insert_one(doc, None).await?;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({
            "ok": true,
            "program": {
                "id": id,
                "name": name,
                "duration": duration,
                "seats": seats,
                "deadline": deadline,
                "fee": fee,
            }
        })),
    ))
}

// ---- DELETE /api/admissions/programs/{id} (admin) ----

async fn delete_program(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;

    let programs = state.db.collection::<Document>("programs");
    let program = programs
        .find_one(doc! { "_id": &id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Program not found"))?;
    let _ = program;

    let ref_count = state
        .db
        .collection::<Document>("admission_applications")
        .count_documents(doc! { "program_id": &id }, None)
        .await?;
    if ref_count > 0 {
        return Err(ApiError::conflict(
            "Cannot delete program — applications reference it",
        ));
    }

    programs.delete_one(doc! { "_id": &id }, None).await?;
    Ok(Json(json!({ "ok": true })))
}

/// Escape special regex characters for a MongoDB `$regex` filter.
fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 2);
    for c in s.chars() {
        if matches!(c, '\\' | '.' | '*' | '+' | '?' | '(' | ')' | '[' | ']' | '{' | '}' | '^' | '$' | '|') {
            out.push('\\');
        }
        out.push(c);
    }
    out
}
