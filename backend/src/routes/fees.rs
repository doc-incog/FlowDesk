use crate::constants::FEE_METHODS;
use crate::error::ApiError;
use crate::middleware::auth;
use crate::services::util as u;
use crate::state::AppState;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use futures::TryStreamExt;
use mongodb::bson::{doc, Document};
use serde_json::{json, Value};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/fees", get(list_fees))
        .route("/api/fees/{id}/pay", post(pay_fee))
}

fn fee_to_value(d: &Document) -> Value {
    json!({
        "id": d.get_str("_id").unwrap_or(""),
        "name": d.get_str("name").unwrap_or(""),
        "amount": d.get_f64("amount").unwrap_or(0.0),
        "dueDate": d.get_str("due_date").unwrap_or(""),
        "status": d.get_str("status").unwrap_or("pending"),
        "paidDate": d.get_str("paid_date").ok(),
        "method": d.get_str("method").ok(),
        "receiptId": d.get_str("receipt_id").ok(),
    })
}

fn receipt_to_value(d: &Document) -> Value {
    json!({
        "id": d.get_str("_id").unwrap_or(""),
        "feeId": d.get_str("fee_id").unwrap_or(""),
        "studentId": d.get_str("student_id").unwrap_or(""),
        "studentName": d.get_str("student_name").unwrap_or(""),
        "amount": d.get_f64("amount").unwrap_or(0.0),
        "method": d.get_str("method").unwrap_or(""),
        "txnId": d.get_str("txn_id").unwrap_or(""),
        "date": d.get_str("date").unwrap_or(""),
    })
}

fn make_txn_id() -> String {
    let ms = u::now_ms();
    let last6 = format!("{}", ms);
    let tail = &last6[last6.len().saturating_sub(6)..];
    format!("TXN-{}-{}", tail, u::rand6())
}

fn make_receipt_id() -> String {
    format!("RCP-{}", u::now_ms())
}

async fn list_fees(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;

    if user.role != "student" {
        return Ok(Json(json!({
            "feeStructure": [],
            "receipts": [],
            "summary": { "total": 0, "paid": 0, "pending": 0, "pendingCount": 0 },
        })));
    }

    let fees = state.db.collection::<Document>("fees");
    let receipts_coll = state.db.collection::<Document>("receipts");

    let filter = doc! { "user_id": &user.id };
    let mut cursor = fees
        .find(
            filter,
            mongodb::options::FindOptions::builder()
                .sort(doc! { "due_date": 1 })
                .build(),
        )
        .await?;

    let mut fee_structure = Vec::new();
    let mut total = 0.0f64;
    let mut paid = 0.0f64;
    let mut pending = 0.0f64;
    let mut pending_count = 0i64;

    while let Some(fee) = cursor.try_next().await? {
        let amount = fee.get_f64("amount").unwrap_or(0.0);
        let status = fee.get_str("status").unwrap_or("pending").to_string();
        total += amount;
        if status == "paid" {
            paid += amount;
        } else {
            pending += amount;
            pending_count += 1;
        }
        fee_structure.push(fee_to_value(&fee));
    }

    let mut rc = receipts_coll
        .find(
            doc! { "student_id": &user.id },
            mongodb::options::FindOptions::builder()
                .sort(doc! { "date": -1 })
                .build(),
        )
        .await?;
    let mut receipt_list = Vec::new();
    while let Some(r) = rc.try_next().await? {
        receipt_list.push(receipt_to_value(&r));
    }

    Ok(Json(json!({
        "feeStructure": fee_structure,
        "receipts": receipt_list,
        "summary": {
            "total": total,
            "paid": paid,
            "pending": pending,
            "pendingCount": pending_count,
        },
    })))
}

async fn pay_fee(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_role(&state, &headers, &["student"]).await?;

    let method = body
        .get("method")
        .and_then(|v| v.as_str())
        .unwrap_or("ewallet")
        .to_string();
    if !FEE_METHODS.contains(&method.as_str()) {
        return Err(ApiError::bad_request("Invalid payment method"));
    }

    let fees = state.db.collection::<Document>("fees");
    let fee = fees
        .find_one(doc! { "_id": &id, "user_id": &user.id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Fee not found"))?;

    if fee.get_str("status").unwrap_or("pending") == "paid" {
        let receipt_id = fee.get_str("receipt_id").unwrap_or("").to_string();
        let receipts_coll = state.db.collection::<Document>("receipts");
        let receipt = receipts_coll
            .find_one(doc! { "_id": &receipt_id }, None)
            .await?
            .unwrap_or_default();
        return Ok(Json(json!({ "receipt": receipt_to_value(&receipt), "alreadyPaid": true })));
    }

    let amount = fee.get_f64("amount").unwrap_or(0.0);
    let student_name = user.name.clone();
    let receipt_id = make_receipt_id();
    let txn_id = make_txn_id();
    let paid_date = u::iso_now();
    let date = u::iso_now();

    let mut session = state.client.start_session(None).await?;
    session.start_transaction(None).await?;

    fees.update_one_with_session(
        doc! { "_id": &id },
        doc! { "$set": {
            "status": "paid",
            "paid_date": &paid_date,
            "method": &method,
            "receipt_id": &receipt_id,
        }},
        None,
        &mut session,
    )
    .await?;

    let receipt_doc = doc! {
        "_id": &receipt_id,
        "fee_id": &id,
        "student_id": &user.id,
        "student_name": &student_name,
        "amount": amount,
        "method": &method,
        "txn_id": &txn_id,
        "date": &date,
    };

    let receipts_coll = state.db.collection::<Document>("receipts");
    receipts_coll
        .insert_one_with_session(receipt_doc, None, &mut session)
        .await?;

    session.commit_transaction().await?;

    let inserted = receipts_coll
        .find_one(doc! { "_id": &receipt_id }, None)
        .await?
        .unwrap_or_default();

    Ok(Json(json!({ "receipt": receipt_to_value(&inserted), "alreadyPaid": false })))
}
