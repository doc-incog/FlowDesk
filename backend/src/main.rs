mod config;
mod constants;
mod error;
mod helpers;
mod middleware;
mod models;
mod routes;
mod services;
mod state;

use crate::state::AppState;
use axum::http::HeaderValue;
use axum::Router;
use std::env;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() {
    // Load .env if present (does not override real env vars).
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "flowdesk_backend=info,tower_http=info".into()),
        )
        .init();

    let cfg = config::Config::from_env();
    let state = match AppState::connect(cfg.clone()).await {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("failed to connect to MongoDB at {}: {e}", cfg.mongodb_uri);
            std::process::exit(1);
        }
    };

    // Create core indexes.
    if let Err(e) = middleware::auth::ensure_indexes(&state.db).await {
        tracing::warn!("failed to create indexes: {e}");
    }

    let cors = CorsLayer::new()
        .allow_origin(
            cfg.cors_origins
                .iter()
                .filter_map(|o| HeaderValue::from_str(o).ok())
                .collect::<Vec<_>>(),
        )
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_credentials(true);

    let app: Router = routes::api_router()
        .with_state(state)
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    let listener = tokio::net::TcpListener::bind(&cfg.bind_addr)
        .await
        .unwrap_or_else(|e| {
            tracing::error!("failed to bind {}: {e}", cfg.bind_addr);
            std::process::exit(1);
        });

    tracing::info!("flowdesk-backend listening on {}", cfg.bind_addr);
    if let Err(e) = axum::serve(listener, app).await {
        tracing::error!("server error: {e}");
        std::process::exit(1);
    }
}

#[allow(dead_code)]
fn _unused(_: env::VarError) {}