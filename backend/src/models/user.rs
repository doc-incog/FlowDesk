use serde::{Deserialize, Serialize};

/// Mirrors the web `UserProfile` object. Stored Mongo documents use snake_case
/// field names (the backend reads them that way throughout); this struct wires
/// the stored snake_case keys to idiomatic Rust fields. JSON (camelCase)
/// serialization for the API is handled separately by `UserProfileOut`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    #[serde(rename = "_id")]
    pub id: String,
    pub name: String,
    pub role: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub avatar_initials: String,
    pub department: Option<String>,
    pub batch: Option<String>,
    pub semester: Option<String>,
    pub roll_no: Option<String>,
    pub mentor_id: Option<String>,
    pub designation: Option<String>,
    pub subjects: Option<Vec<String>>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub guardian_name: Option<String>,
    pub guardian_phone: Option<String>,
    pub emergency_contact: Option<String>,
    pub dob: Option<String>,
    pub is_deleted: bool,
    #[serde(default)]
    pub created_at: String,
}

/// The subset of a user sent in list/search responses.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserListEntry {
    pub id: String,
    pub name: String,
    pub role: String,
    pub email: String,
    #[serde(rename = "avatarInitials")]
    pub avatar_initials: String,
    pub department: Option<String>,
}