use serde::{Deserialize, Serialize};

/// A notification. Broadcasts have `user_id = None` and optionally `target_role`.
/// In the legacy schema, notification_reads track individual read state; here we
/// keep a per-user "read" array for personal targeting, and `is_read` for simplicity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    #[serde(rename = "_id")]
    pub id: String,
    #[serde(rename = "userId")]
    pub user_id: Option<String>, // None => broadcast
    #[serde(rename = "targetRole")]
    pub target_role: Option<String>, // "all" | "staff" | "students" | None => personal
    pub title: String,
    pub body: Option<String>,
    pub category: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

/// Read-state for a personal notification copy.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationRead {
    #[serde(rename = "_id")]
    pub id: String,
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "notificationId")]
    pub notification_id: String,
    pub read: bool,
}