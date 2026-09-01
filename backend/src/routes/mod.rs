pub mod admissions;
pub mod assignments;
pub mod auth;
pub mod checkins;
pub mod complaints;
pub mod conversations;
pub mod directory;
pub mod exams;
pub mod feedback;
pub mod fees;
pub mod fingerprint;
pub mod notifications;
pub mod overview;
pub mod roles;
pub mod schedule;
pub mod scholarships;
pub mod withdrawals;

use crate::state::AppState;
use axum::routing::get;
use axum::Router;
use serde_json::json;

/// Liveness probe for host health checks (does not require a DB connection).
async fn healthz() -> axum::Json<serde_json::Value> {
    axum::Json(json!({ "status": "ok" }))
}

/// Build the full API router.
pub fn api_router() -> Router<AppState> {
    auth::router()
        .route("/healthz", get(healthz))
        .merge(directory::router())
        .merge(roles::router())
        .merge(checkins::router())
        .merge(schedule::router())
        .merge(overview::router())
        .merge(exams::router())
        .merge(assignments::router())
        .merge(notifications::router())
        .merge(conversations::router())
        .merge(fees::router())
        .merge(scholarships::router())
        .merge(fingerprint::router())
        .merge(admissions::router())
        .merge(complaints::router())
        .merge(feedback::router())
        .merge(withdrawals::router())
}