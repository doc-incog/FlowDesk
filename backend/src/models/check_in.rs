use serde::{Deserialize, Serialize};

/// Attendance / check-in record. Matches the web `CheckIn` object.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckIn {
    #[serde(rename = "_id")]
    pub id: String,
    #[serde(rename = "userId")]
    pub user_id: Option<String>,
    pub name: String,
    pub role: String,
    pub date: String,
    pub time: String,
    pub status: String, // "on-time" | "late"
    pub method: String, // "biometric" | "webauthn" | "manual" | "device" | ...
    pub source: String, // "web" | "device"
    #[serde(rename = "deviceId")]
    pub device_id: Option<String>,
    pub created_at: String,
}