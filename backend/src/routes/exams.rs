use crate::error::ApiError;
use crate::middleware::auth;
use crate::services::pdf;
use crate::services::util as u;
use crate::state::AppState;
use axum::extract::Path;
use axum::extract::State;
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use futures::TryStreamExt;
use mongodb::bson::{doc, Bson, Document};
use serde::Deserialize;
use serde_json::{json, Value};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/exams", get(list_exams).post(create_exam))
        .route("/api/exams/{id}", delete(delete_exam))
        .route("/api/exams/results", post(upsert_result))
        .route("/api/exams/report-card", post(report_card))
}

#[derive(Deserialize)]
struct ReportCardReq {
    #[serde(rename = "studentName")]
    student_name: String,
    #[serde(rename = "studentId")]
    student_id: String,
    #[serde(rename = "rollNo")]
    roll_no: Option<String>,
    department: Option<String>,
    semester: Option<String>,
    rows: Vec<ReportCardRowReq>,
    #[serde(rename = "totalMax")]
    total_max: f64,
    #[serde(rename = "totalMarks")]
    total_marks: f64,
    overall: f64,
    grade: String,
}

#[derive(Deserialize)]
struct ReportCardRowReq {
    #[serde(rename = "moduleCode")]
    module_code: String,
    max: f64,
    marks: f64,
    grade: String,
}

/// POST /api/exams/report-card — generate a report-card PDF (primary in Rust).
async fn report_card(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ReportCardReq>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let _ = user;

    let rows: Vec<(String, f64, f64, String)> = body
        .rows
        .iter()
        .map(|r| (r.module_code.clone(), r.max, r.marks, r.grade.clone()))
        .collect();

    let spec = pdf::ReportCardSpec {
        student_name: body.student_name,
        student_id: body.student_id,
        semester: body.semester.unwrap_or_default(),
        department: body.department.unwrap_or_default(),
        rows,
        total_max: body.total_max,
        total_marks: body.total_marks,
        overall: body.overall,
        grade: body.grade,
    };
    let bytes = pdf::report_card_pdf(&spec)?;

    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_static("application/pdf"),
    );
    headers.insert(
        axum::http::header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"report-card-{}.pdf\"", spec.student_id))
            .map_err(|_| ApiError::bad_request("bad filename"))?,
    );

    Ok((StatusCode::OK, headers, bytes))
}

fn exam_value(e: &Document, result: Option<Value>) -> Value {
    let mut v = json!({
        "id": e.get_str("_id").unwrap_or(""),
        "title": e.get_str("title").unwrap_or(""),
        "moduleCode": e.get_str("module_code").unwrap_or(""),
        "moduleName": e.get_str("module_name").unwrap_or(""),
        "type": e.get_str("type").unwrap_or(""),
        "date": e.get_str("date").unwrap_or(""),
        "start": e.get_str("start").unwrap_or(""),
        "end": e.get_str("end").unwrap_or(""),
        "room": e.get_str("room").unwrap_or(""),
        "maxMarks": e.get_i64("max_marks").unwrap_or(0),
    });
    if let Some(r) = result {
        if let Value::Object(ref mut map) = v {
            map.insert("result".to_string(), r);
        }
    }
    v
}

fn result_value(r: &Document) -> Value {
    json!({
        "examId": r.get_str("exam_id").unwrap_or(""),
        "studentId": r.get_str("student_id").unwrap_or(""),
        "marks": r.get_i64("marks").unwrap_or(0),
        "maxMarks": r.get_i64("max_marks").unwrap_or(0),
    })
}

async fn list_exams(State(state): State<AppState>, headers: HeaderMap) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let exams_c = state.db.collection::<Document>("exams");
    let results_c = state.db.collection::<Document>("results");

    let mut exam_docs = Vec::new();
    let mut ec = exams_c.find(doc! {}, mongodb::options::FindOptions::builder().sort(doc! { "date": 1 }).build()).await?;
    while let Some(e) = ec.try_next().await? {
        exam_docs.push(e);
    }

    let is_staff = user.role == "staff" || user.role == "admin";
    let mut results_out: Vec<Value> = Vec::new();

    let mut exams_out = Vec::new();
    for e in &exam_docs {
        let exam_id = e.get_str("_id").unwrap_or("").to_string();
        if is_staff {
            exams_out.push(exam_value(e, None));
        } else {
            let mut rc = results_c.find(doc! { "exam_id": &exam_id, "student_id": &user.id }, None).await?;
            let mut emb: Option<Value> = None;
            while let Some(r) = rc.try_next().await? {
                emb = Some(result_value(&r));
            }
            exams_out.push(exam_value(e, emb));
        }
    }

    if is_staff {
        let mut rc = results_c.find(doc! {}, None).await?;
        while let Some(r) = rc.try_next().await? {
            results_out.push(result_value(&r));
        }
    }

    Ok(Json(json!({ "exams": exams_out, "results": results_out })))
}

async fn create_exam(State(state): State<AppState>, headers: HeaderMap, Json(body): Json<Value>) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    if user.role != "staff" && user.role != "admin" {
        return Err(ApiError::forbidden("Only staff or admin can create exams"));
    }

    let title = body.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let module_code = body.get("moduleCode").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let module_name = body.get("moduleName").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let r#type = body.get("type").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let date = body.get("date").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let start = body.get("start").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let end = body.get("end").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let room = body.get("room").and_then(|v| v.as_str()).unwrap_or("").to_string();

    if title.is_empty() || module_code.is_empty() || module_name.is_empty() || r#type.is_empty()
        || date.is_empty() || start.is_empty() || end.is_empty() || room.is_empty() {
        return Err(ApiError::bad_request("Missing required fields"));
    }
    if !["midterm", "final", "practical"].contains(&r#type.as_str()) {
        return Err(ApiError::bad_request("Invalid exam type"));
    }

    let max_marks = body.get("maxMarks")
        .and_then(|v| v.as_i64())
        .unwrap_or(100);
    if !(1..=1000).contains(&max_marks) {
        return Err(ApiError::bad_request("maxMarks must be between 1 and 1000"));
    }

    let id = u::id_exam();
    let doc = doc! {
        "_id": &id,
        "title": &title,
        "module_code": &module_code,
        "module_name": &module_name,
        "type": &r#type,
        "date": &date,
        "start": &start,
        "end": &end,
        "room": &room,
        "max_marks": max_marks,
    };
    state.db.collection::<Document>("exams").insert_one(doc.clone(), None).await?;
    let inserted = state.db.collection::<Document>("exams").find_one(doc! { "_id": &id }, None).await?.unwrap();
    Ok((axum::http::StatusCode::CREATED, Json(json!({ "ok": true, "exam": exam_value(&inserted, None) }))))
}

async fn delete_exam(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    if user.role != "staff" && user.role != "admin" {
        return Err(ApiError::forbidden("Only staff or admin can delete exams"));
    }
    let exams = state.db.collection::<Document>("exams");
    let existing = exams.find_one(doc! { "_id": &id }, None).await?;
    if existing.is_none() {
        return Err(ApiError::not_found("Exam not found"));
    }
    exams.delete_one(doc! { "_id": &id }, None).await?;
    state.db.collection::<Document>("results").delete_many(doc! { "exam_id": &id }, None).await?;
    Ok(Json(json!({ "ok": true })))
}

async fn upsert_result(State(state): State<AppState>, headers: HeaderMap, Json(body): Json<Value>) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    if user.role != "staff" && user.role != "admin" {
        return Err(ApiError::forbidden("Only staff or admin can record results"));
    }
    let exam_id = body.get("examId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let student_id = body.get("studentId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if exam_id.is_empty() || student_id.is_empty() {
        return Err(ApiError::bad_request("Missing required fields"));
    }

    let exams = state.db.collection::<Document>("exams");
    let exam = exams.find_one(doc! { "_id": &exam_id }, None).await?
        .ok_or_else(|| ApiError::not_found("Exam not found"))?;
    let max_marks = exam.get_i64("max_marks").unwrap_or(100);

    let marks_value = body.get("marks");
    let cleared = marks_value.is_none()
        || matches!(marks_value, Some(Value::Null))
        || matches!(marks_value, Some(Value::String(s)) if s.is_empty());

    let results = state.db.collection::<Document>("results");

    if cleared {
        results.delete_many(doc! { "exam_id": &exam_id, "student_id": &student_id }, None).await?;
        return Ok(Json(json!({ "ok": true, "result": Value::Null })));
    }

    let marks = match marks_value {
        Some(Value::Number(n)) => n.as_i64().ok_or_else(|| ApiError::bad_request("Invalid marks"))?,
        Some(Value::String(s)) => s.trim().parse::<i64>().map_err(|_| ApiError::bad_request("Invalid marks"))?,
        _ => return Err(ApiError::bad_request("Invalid marks")),
    };
    if marks > max_marks {
        return Err(ApiError::bad_request("Marks cannot exceed max marks"));
    }

    let result_id = u::id_result();
    results.update_one(
        doc! { "exam_id": &exam_id, "student_id": &student_id },
        doc! { "$set": {
            "exam_id": &exam_id,
            "student_id": &student_id,
            "marks": marks,
            "max_marks": max_marks,
        }, "$setOnInsert": { "_id": &result_id } },
        mongodb::options::UpdateOptions::builder().upsert(true).build(),
    ).await?;

    let saved = results.find_one(doc! { "exam_id": &exam_id, "student_id": &student_id }, None).await?.unwrap();
    Ok(Json(json!({ "ok": true, "result": result_value(&saved) })))
}
