use crate::error::ApiError;
use crate::helpers;
use crate::middleware::auth;
use crate::services::util as u;
use crate::state::AppState;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use futures::TryStreamExt;
use mongodb::bson::{doc, Bson, Document};
use serde_json::{json, Value};

pub fn router() -> Router<AppState> {
    Router::new().route("/api/overview", get(overview))
}

async fn overview(State(state): State<AppState>, headers: HeaderMap) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let users = state.db.collection::<Document>("users");
    let check_ins = state.db.collection::<Document>("check_ins");
    let notifications = state.db.collection::<Document>("notifications");
    let schedule = state.db.collection::<Document>("schedule_slots");

    let mut stats: Vec<Value> = Vec::new();
    let today = u::local_date();

    match user.role.as_str() {
        "student" => {
            let att_count = check_ins.count_documents(doc! { "user_id": &user.id }, None).await?;
            let my_mentor = users
                .find_one(doc! { "_id": &user.mentor_id.as_ref().unwrap_or(&String::new()), "role": "staff", "is_deleted": false }, None)
                .await?;
            let _ = my_mentor;
            stats.push(json!({ "label": "Attendance", "value": att_count, "tone": "accent", "icon": "check" }));
        }
        "staff" => {
            let total = users.count_documents(doc! { "role": "student", "is_deleted": false }, None).await?;
            stats.push(json!({ "label": "Students", "value": total, "tone": "accent", "icon": "users" }));
        }
        _ => {
            let students = users.count_documents(doc! { "role": "student", "is_deleted": false }, None).await?;
            let staff = users.count_documents(doc! { "role": "staff", "is_deleted": false }, None).await?;
            stats.push(json!({ "label": "Students", "value": students, "hint": format!("{} staff", staff), "tone": "accent", "icon": "users" }));
            let today_ci = check_ins.count_documents(doc! { "date": &today }, None).await?;
            stats.push(json!({ "label": "Check-ins today", "value": today_ci, "tone": "success", "icon": "check" }));
        }
    }

    // todaysClasses: all schedule slots (section-aware would filter; simplified to all for admin/staff).
    let mut tc = schedule.find(doc! {}, None).await?;
    let mut todays_classes = Vec::new();
    while let Some(s) = tc.try_next().await? {
        todays_classes.push(json!({
            "id": s.get_str("_id").unwrap_or(""),
            "day": s.get_str("day").unwrap_or(""),
            "start": s.get_str("start").unwrap_or(""),
            "end": s.get_str("end").unwrap_or(""),
            "module": s.get_str("module").unwrap_or(""),
            "code": s.get_str("code").unwrap_or(""),
            "room": s.get_str("room").unwrap_or(""),
            "staff": s.get_str("staff").ok(),
        }));
    }

    // notices: top 3 unread (simplified: most recent broadcasts).
    let mut nc = notifications
        .find(
            doc! { "$or": [ { "user_id": Bson::Null }, { "user_id": &user.id } ] },
            mongodb::options::FindOptions::builder().sort(doc! { "created_at": -1 }).limit(3).build(),
        )
        .await?;
    let mut notices = Vec::new();
    while let Some(n) = nc.try_next().await? {
        notices.push(json!({
            "id": n.get_str("_id").unwrap_or(""),
            "title": n.get_str("title").unwrap_or(""),
            "body": n.get_str("body").unwrap_or(""),
            "category": n.get_str("category").unwrap_or(""),
        }));
    }

    // recentCheckIns: top 5 today.
    let mut rc = check_ins
        .find(
            doc! { "date": &today },
            mongodb::options::FindOptions::builder().sort(doc! { "created_at": -1 }).limit(5).build(),
        )
        .await?;
    let mut recent_check_ins = Vec::new();
    while let Some(c) = rc.try_next().await? {
        recent_check_ins.push(json!({
            "id": c.get_str("_id").unwrap_or(""),
            "name": c.get_str("name").unwrap_or(""),
            "time": c.get_str("time").unwrap_or(""),
            "status": c.get_str("status").unwrap_or(""),
        }));
    }

    Ok(Json(json!({
        "stats": stats,
        "todaysClasses": todays_classes,
        "notices": notices,
        "recentCheckIns": recent_check_ins,
    })))
}