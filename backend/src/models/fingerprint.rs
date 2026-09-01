use serde::{Deserialize, Serialize};

/// Fingerprint device. Mirrors the `fingerprint_devices` table (snake_case fields
/// are returned raw to the admin UI, matching the legacy wire shape).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    #[serde(rename = "_id")]
    pub device_id: String, // e.g. "ESP-A3F2B1C9"
    pub label: String,
    pub location: String,
    #[serde(skip_serializing)]
    pub device_secret: Option<String>, // 48-char hex; never serialized
    pub sensor_type: String,           // "R307" | "R309"
    pub status: String,                // "pending" | "approved" | "disabled"
    pub last_seen: Option<String>,
    pub enrolled_count: i64,
    pub slots_total: i64,
    pub created_at: String,
}

/// Physical health snapshot logged for a device.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceHealth {
    #[serde(rename = "_id")]
    pub id: String,
    pub device_id: String,
    pub sensor_connected: i64,
    pub sensor_capacity: Option<i64>,
    pub free_memory: Option<i64>,
    pub wifi_rssi: Option<i64>,
    pub uptime_seconds: Option<i64>,
    pub recorded_at: String,
}

/// An enqueued command in the device pull-queue.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Command {
    #[serde(rename = "_id")]
    pub id: String,
    pub device_id: String,
    pub command: String, // "enroll" | "delete"
    pub params: String,  // JSON-encoded params
    pub status: String,  // "pending" | "sent" | "completed" | "failed"
    pub created_at: String,
    pub completed_at: Option<String>,
}

/// A stored fingerprint template (on-sensor + server copy).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Template {
    #[serde(rename = "_id")]
    pub id: String,
    pub user_id: String,
    pub finger_id: i64,
    pub device_id: String,
    pub template: Option<Vec<u8>>, // 512-byte raw template
    pub enrolled_by: Option<String>,
    pub enrolled_at: String,
}