use crate::error::ApiError;
use crate::models::fingerprint::Device;
use crate::state::AppState;
use axum::http::HeaderMap;
use mongodb::bson::doc;

/// Resolve an authenticated device id from the `Authorization: Bearer <secret>` header.
///
/// Mirrors `requireDeviceAuth`: a valid, approved device whose `device_secret`
/// matches and whose `status == "approved"`. Returns `None` when no/expired token.
pub async fn device_auth_from_headers(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<Option<String>, ApiError> {
    let token = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.trim().strip_prefix("Bearer "))
        .map(|v| v.trim().to_string());

    let token = match token {
        Some(t) if !t.is_empty() => t,
        _ => return Ok(None),
    };

    let devices = state.db.collection::<Device>("fingerprint_devices");
    let device = devices
        .find_one(
            doc! { "device_secret": &token, "status": "approved" },
            None,
        )
        .await?;
    Ok(device.map(|d| d.device_id))
}