pub mod auth;
pub mod checkins;
pub mod directory;
pub mod overview;
pub mod roles;
pub mod schedule;

use crate::state::AppState;
use axum::Router;

/// Build the full API router.
pub fn api_router() -> Router<AppState> {
    auth::router()
        .merge(directory::router())
        .merge(roles::router())
        .merge(checkins::router())
        .merge(schedule::router())
        .merge(overview::router())
}