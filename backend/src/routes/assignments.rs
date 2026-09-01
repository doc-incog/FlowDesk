use crate::error::ApiError;
use crate::middleware::auth;
use crate::services::storage as s;
use crate::services::util as u;
use crate::state::AppState;
use axum::body::Body;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use futures::TryStreamExt;
use mongodb::bson::{doc, Bson, Document};
use serde_json::{json, Value};
use std::collections::HashMap;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/assignments", get(list_assignments).post(create_assignment))
        .route("/api/assignments/{id}", delete(delete_assignment))
        .route("/api/submissions", post(create_submission))
        .route("/api/submissions/{id}", delete(delete_submission))
        .route("/api/submissions/{id}/file", get(get_submission_file))
}

fn assignment_value(a: &Document) -> Value {
    json!({
        "id": a.get_str("_id").unwrap_or(""),
        "moduleCode": a.get_str("module_code").unwrap_or(""),
        "moduleName": a.get_str("module_name").unwrap_or(""),
        "title": a.get_str("title").unwrap_or(""),
        "description": a.get_str("description").ok(),
        "assignedDate": a.get_str("assigned_date").ok(),
        "dueDate": a.get_str("due_date").unwrap_or(""),
        "maxMarks": a.get_i64("max_marks").unwrap_or(0),
    })
}

fn submission_value(sub: &Document) -> Value {
    json!({
        "id": sub.get_str("_id").unwrap_or(""),
        "assignmentId": sub.get_str("assignment_id").unwrap_or(""),
        "studentId": sub.get_str("student_id").unwrap_or(""),
        "studentName": sub.get_str("student_name").unwrap_or(""),
        "filename": sub.get_str("filename").unwrap_or(""),
        "submittedAt": sub.get_str("submitted_at").unwrap_or(""),
    })
}

async fn list_assignments(State(state): State<AppState>, headers: HeaderMap) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let assignments_c = state.db.collection::<Document>("assignments");
    let submissions_c = state.db.collection::<Document>("submissions");

    let mut assignments = Vec::new();
    let mut ac = assignments_c.find(doc! {}, mongodb::options::FindOptions::builder().sort(doc! { "assigned_date": 1 }).build()).await?;
    while let Some(a) = ac.try_next().await? {
        assignments.push(assignment_value(&a));
    }

    let is_staff = user.role == "staff" || user.role == "admin";
    let filter = if is_staff {
        doc! {}
    } else {
        doc! { "student_id": &user.id }
    };
    let mut submissions = Vec::new();
    let mut sc = submissions_c.find(filter, None).await?;
    while let Some(s) = sc.try_next().await? {
        submissions.push(submission_value(&s));
    }

    Ok(Json(json!({ "assignments": assignments, "submissions": submissions })))
}

async fn create_assignment(State(state): State<AppState>, headers: HeaderMap, Json(body): Json<Value>) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    if user.role != "staff" && user.role != "admin" {
        return Err(ApiError::forbidden("Only staff or admin can create assignments"));
    }
    let module_code = body.get("moduleCode").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let module_name = body.get("moduleName").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let title = body.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if module_code.is_empty() || module_name.is_empty() || title.is_empty() {
        return Err(ApiError::bad_request("Missing required fields"));
    }
    let description = body.get("description").and_then(|v| v.as_str()).map(|s| s.to_string());
    let assigned_date = body.get("assignedDate").and_then(|v| v.as_str()).map(|s| s.to_string());
    let due_date = body.get("dueDate").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let max_marks = body.get("maxMarks").and_then(|v| v.as_i64()).unwrap_or(100);

    let id = u::id_assignment();
    let doc = doc! {
        "_id": &id,
        "module_code": &module_code,
        "module_name": &module_name,
        "title": &title,
        "description": description.map(Bson::String).unwrap_or(Bson::Null),
        "assigned_date": assigned_date.map(Bson::String).unwrap_or(Bson::Null),
        "due_date": &due_date,
        "max_marks": max_marks,
    };
    state.db.collection::<Document>("assignments").insert_one(doc.clone(), None).await?;
    let inserted = state.db.collection::<Document>("assignments").find_one(doc! { "_id": &id }, None).await?.unwrap();
    Ok((StatusCode::CREATED, Json(json!({ "ok": true, "assignment": assignment_value(&inserted) }))))
}

async fn delete_assignment(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    if user.role != "staff" && user.role != "admin" {
        return Err(ApiError::forbidden("Only staff or admin can delete assignments"));
    }
    let assignments = state.db.collection::<Document>("assignments");
    if assignments.find_one(doc! { "_id": &id }, None).await?.is_none() {
        return Err(ApiError::not_found("Assignment not found"));
    }
    assignments.delete_one(doc! { "_id": &id }, None).await?;
    state.db.collection::<Document>("submissions").delete_many(doc! { "assignment_id": &id }, None).await?;
    Ok(Json(json!({ "ok": true })))
}

async fn create_submission(State(state): State<AppState>, headers: HeaderMap, Json(body): Json<Value>) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    if user.role != "student" {
        return Err(ApiError::forbidden("Only students can submit assignments"));
    }
    let assignment_id = body.get("assignmentId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if assignment_id.is_empty() {
        return Err(ApiError::bad_request("Missing assignmentId"));
    }
    let assignment = state.db.collection::<Document>("assignments").find_one(doc! { "_id": &assignment_id }, None).await?;
    if assignment.is_none() {
        return Err(ApiError::not_found("Assignment not found"));
    }

    let submissions = state.db.collection::<Document>("submissions");
    if submissions.find_one(doc! { "assignment_id": &assignment_id, "student_id": &user.id }, None).await?.is_some() {
        return Err(ApiError::conflict("Already submitted"));
    }

    let filename = body.get("filename").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let file_path = body.get("filePath").and_then(|v| v.as_str()).map(|s| s.to_string());

    let id = u::id_submission();
    let (filename, file_path) = if filename.is_empty() {
        let derived = format!("{}.txt", id);
        let path = file_path.unwrap_or_else(|| {
            s::stored_path(&id, &u::safe_name(&derived)).to_string_lossy().to_string()
        });
        (derived, path)
    } else {
        let path = file_path.unwrap_or_else(|| {
            s::stored_path(&id, &u::safe_name(&filename)).to_string_lossy().to_string()
        });
        (filename, path)
    };

    let doc = doc! {
        "_id": &id,
        "assignment_id": &assignment_id,
        "student_id": &user.id,
        "student_name": &user.name,
        "filename": &filename,
        "file_path": &file_path,
        "submitted_at": u::iso_now(),
    };
    submissions.insert_one(doc, None).await?;
    let inserted = submissions.find_one(doc! { "_id": &id }, None).await?.unwrap();
    Ok((StatusCode::CREATED, Json(json!({ "submission": submission_value(&inserted) }))))
}

async fn delete_submission(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    if user.role != "student" {
        return Err(ApiError::forbidden("Only students can delete submissions"));
    }
    let submissions = state.db.collection::<Document>("submissions");
    let sub = submissions.find_one(doc! { "_id": &id }, None).await?
        .ok_or_else(|| ApiError::not_found("Submission not found"))?;
    if sub.get_str("student_id").unwrap_or("") != user.id {
        return Err(ApiError::forbidden("You can only delete your own submissions"));
    }
    if let Ok(path) = sub.get_str("file_path") {
        let _ = std::fs::remove_file(path);
    }
    submissions.delete_one(doc! { "_id": &id }, None).await?;
    Ok(Json(json!({ "ok": true })))
}

async fn get_submission_file(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let submissions = state.db.collection::<Document>("submissions");
    let sub = submissions.find_one(doc! { "_id": &id }, None).await?
        .ok_or_else(|| ApiError::not_found("Submission not found"))?;
    if user.role == "student" && sub.get_str("student_id").unwrap_or("") != user.id {
        return Err(ApiError::forbidden("You can only view your own submissions"));
    }

    let file_path = sub.get_str("file_path").ok().map(|s| s.to_string());
    let filename = sub.get_str("filename").ok().map(|s| s.to_string());
    let path = match file_path {
        Some(p) => p,
        None => return Err(ApiError::not_found("File not found")),
    };
    let filename = filename.unwrap_or_else(|| "file".to_string());

    let bytes = std::fs::read(&path).map_err(|_| ApiError::not_found("File not found"))?;
    let mime = s::mime_for(&filename);
    let encoded = s::rfc5987_encode(&filename);
    let download = params.get("download").map(|v| v == "1").unwrap_or(false);
    let cd_value = if download {
        format!("attachment; filename*=UTF-8''{}", encoded)
    } else {
        format!("inline; filename*=UTF-8''{}", encoded)
    };

    Ok((
        [
            (header::CONTENT_TYPE, mime.to_string()),
            (header::CONTENT_DISPOSITION, cd_value),
        ],
        Body::from(bytes),
    ))
}
