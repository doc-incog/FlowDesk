pub mod auth;
pub mod directory;

use crate::state::AppState;
use axum::Router;

/// Build the full API router.
pub fn api_router() -> Router<AppState> {
    auth::router()
        .merge(directory::router())
}