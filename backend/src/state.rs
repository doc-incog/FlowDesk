use crate::config::Config;
use crate::services::fingerprint::SseBus;
use mongodb::{Client, Database};
use std::sync::Arc;

/// Shared application state handed to every handler via axum's extractor.
#[derive(Clone)]
pub struct AppState {
    pub cfg: Arc<Config>,
    pub db: Database,
    /// In-process SSE event bus keyed by fingerprint deviceId.
    pub sse: SseBus,
}

impl AppState {
    /// Connect to MongoDB and return application state.
    pub async fn connect(cfg: Config) -> Result<Self, mongodb::error::Error> {
        let client = Client::with_uri_str(&cfg.mongodb_uri).await?;
        let db = client.database(&cfg.mongodb_db);
        Ok(AppState {
            cfg: Arc::new(cfg),
            db,
            sse: SseBus::new(),
        })
    }
}