use crate::constants::{MAX_SCHOLARSHIP_DOCS, SCHOLARSHIP_STATUSES};
use crate::error::ApiError;
use crate::middleware::auth;
use crate::services::storage;
use crate::services::util as u;
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, patch, post};
use axum::{Json, Router};
use futures::TryStreamExt;
use mongodb::bson::{doc, Document};
use serde::Deserialize;
use serde_json::{json, Value};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/scholarships", get(list_scholarships))
        .route("/api/scholarships/applications", post(create_application))
        .route("/api/scholarships/applications/{id}", patch(update_application))
        .route("/api/scholarships/applications/{id}/docs", get(application_doc))
}

fn scholarship_to_value(d: &Document) -> Value {
    json!({
        "id": d.get_str("_id").unwrap_or(""),
        "name": d.get_str("name").unwrap_or(""),
        "description": d.get_str("description").unwrap_or(""),
        "amount": d.get_f64("amount").unwrap_or(0.0),
        "eligibility": d.get_str("eligibility").unwrap_or(""),
    })
}

fn application_to_value(d: &Document) -> Value {
    let docs_arr = d
        .get("docs")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| item.as_document())
                .map(|item| {
                    let name = item.get_str("name").unwrap_or("");
                    let path = item.get_str("path").unwrap_or("");
                    json!({ "name": name, "path": path })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    json!({
        "id": d.get_str("_id").unwrap_or(""),
        "scholarshipId": d.get_str("scholarship_id").unwrap_or(""),
        "studentId": d.get_str("student_id").unwrap_or(""),
        "studentName": d.get_str("student_name").unwrap_or(""),
        "status": d.get_str("status").unwrap_or("submitted"),
        "docs": docs_arr,
        "appliedAt": d.get_str("applied_at").unwrap_or(""),
    })
}

async fn list_scholarships(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;

    let scholarships_coll = state.db.collection::<Document>("scholarships");
    let mut sc = scholarships_coll
        .find(
            doc! {},
            mongodb::options::FindOptions::builder()
                .sort(doc! { "name": 1 })
                .build(),
        )
        .await?;
    let mut scholarship_list = Vec::new();
    while let Some(s) = sc.try_next().await? {
        scholarship_list.push(scholarship_to_value(&s));
    }

    let apps_coll = state.db.collection::<Document>("scholarship_applications");
    let app_filter = if user.role == "student" {
        doc! { "student_id": &user.id }
    } else {
        doc! {}
    };
    let mut ac = apps_coll
        .find(
            app_filter,
            mongodb::options::FindOptions::builder()
                .sort(doc! { "applied_at": -1 })
                .build(),
        )
        .await?;
    let mut app_list = Vec::new();
    while let Some(a) = ac.try_next().await? {
        app_list.push(application_to_value(&a));
    }

    Ok(Json(json!({
        "scholarships": scholarship_list,
        "applications": app_list,
    })))
}

async fn create_application(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_role(&state, &headers, &["student"]).await?;

    let scholarship_id = body
        .get("scholarshipId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::bad_request("Missing scholarshipId"))?
        .to_string();

    let scholarship_coll = state.db.collection::<Document>("scholarships");
    scholarship_coll
        .find_one(doc! { "_id": &scholarship_id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Scholarship not found"))?;

    let apps_coll = state.db.collection::<Document>("scholarship_applications");
    if apps_coll
        .find_one(
            doc! { "scholarship_id": &scholarship_id, "student_id": &user.id },
            None,
        )
        .await?
        .is_some()
    {
        return Err(ApiError::conflict("You have already applied for this scholarship"));
    }

    let docs: Vec<mongodb::bson::Bson> = body
        .get("docs")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .take(MAX_SCHOLARSHIP_DOCS)
                .filter_map(|item| {
                    let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let path = item.get("path").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    Some(mongodb::bson::doc! { "name": name, "path": path }.into())
                })
                .collect()
        })
        .unwrap_or_default();

    let id = u::id_scholarship_app();
    let applied_at = u::iso_now();
    let student_name = user.name.clone();

    let app_doc = mongodb::bson::doc! {
        "_id": &id,
        "scholarship_id": &scholarship_id,
        "student_id": &user.id,
        "student_name": &student_name,
        "status": "submitted",
        "docs": docs,
        "applied_at": &applied_at,
    };
    apps_coll.insert_one(app_doc, None).await?;

    let inserted = apps_coll
        .find_one(doc! { "_id": &id }, None)
        .await?
        .unwrap_or_default();

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({ "application": application_to_value(&inserted) })),
    ))
}

async fn update_application(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;

    let status = body
        .get("status")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::bad_request("Missing status"))?
        .to_string();
    if !SCHOLARSHIP_STATUSES
        .iter()
        .any(|s| *s == status.as_str())
    {
        return Err(ApiError::bad_request("Invalid status"));
    }

    let apps_coll = state.db.collection::<Document>("scholarship_applications");
    let existing = apps_coll
        .find_one(doc! { "_id": &id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Application not found"))?;

    apps_coll
        .update_one(
            doc! { "_id": &id },
            doc! { "$set": { "status": &status } },
            None,
        )
        .await?;

    let updated = apps_coll
        .find_one(doc! { "_id": &id }, None)
        .await?
        .unwrap_or(existing);

    Ok(Json(json!({ "ok": true, "application": application_to_value(&updated) })))
}

#[derive(Deserialize)]
struct DocQuery {
    file: Option<String>,
}

/// GET /api/scholarships/applications/{id}/docs?file=<name>
/// Streams one supporting document. Doc entries are matched by name (or string
/// path) against the stored docs array, so a `file` value cannot escape the
/// application's own documents. Only the owning student or an admin may read.
async fn application_doc(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(q): Query<DocQuery>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let file_query = q.file.unwrap_or_default().trim().to_string();

    let apps_coll = state.db.collection::<Document>("scholarship_applications");
    let app = apps_coll
        .find_one(doc! { "_id": &id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Application not found"))?;

    let student_id = app.get_str("student_id").unwrap_or("").to_string();
    if user.role != "admin" && student_id != user.id {
        return Err(ApiError::forbidden("Forbidden"));
    }

    // Resolve the matching doc entry.
    let empty_docs: Vec<mongodb::bson::Bson> = Vec::new();
    let docs = app.get_array("docs").unwrap_or(&empty_docs);
    let mut resolved: Option<String> = None;
    for item in docs {
        if let Some(doc) = item.as_document() {
            let name = doc.get_str("name").unwrap_or("").to_string();
            let path = doc.get_str("path").unwrap_or("").to_string();
            if name == file_query {
                resolved = Some(path);
                break;
            }
        } else if let Some(s) = item.as_str() {
            if s == file_query {
                resolved = Some(s.to_string());
                break;
            }
        }
    }

    let path = resolved.ok_or_else(|| ApiError::not_found("File not found"))?;
    let bytes = std::fs::read(&path).map_err(|_| ApiError::not_found("File not found"))?;

    let name = std::path::Path::new(&path)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| file_query.clone());
    let mime = storage::mime_for(&name).to_string();

    let mut headers_map = HeaderMap::new();
    headers_map.insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_str(&mime).map_err(|_| ApiError::bad_request("bad content type"))?,
    );
    headers_map.insert(
        axum::http::header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("inline; filename=\"{}\"", name.replace('"', "")))
            .map_err(|_| ApiError::bad_request("bad filename"))?,
    );
    headers_map.insert(
        axum::http::header::CONTENT_LENGTH,
        HeaderValue::from_str(&bytes.len().to_string())
            .map_err(|_| ApiError::bad_request("bad length"))?,
    );

    Ok((StatusCode::OK, headers_map, bytes))
}
