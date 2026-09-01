use crate::constants::{MAX_SCHOLARSHIP_DOCS, SCHOLARSHIP_STATUSES};
use crate::error::ApiError;
use crate::middleware::auth;
use crate::services::util as u;
use crate::state::AppState;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::routing::{get, patch, post};
use axum::{Json, Router};
use futures::TryStreamExt;
use mongodb::bson::{doc, Document};
use serde_json::{json, Value};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/scholarships", get(list_scholarships))
        .route(
            "/api/scholarships/applications",
            post(create_application),
        )
        .route(
            "/api/scholarships/applications/{id}",
            patch(update_application),
        )
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
