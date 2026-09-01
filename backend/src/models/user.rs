use serde::{Deserialize, Serialize};

/// Mirrors the web `UserProfile` object. Snake_case field names are serialized
/// as camelCase to match the JSON the frontend/mobile clients expect.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    #[serde(rename = "_id")]
    pub id: String,
    pub name: String,
    pub role: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    #[serde(rename = "avatarInitials")]
    pub avatar_initials: String,
    pub department: Option<String>,
    pub batch: Option<String>,
    pub semester: Option<String>,
    #[serde(rename = "rollNo")]
    pub roll_no: Option<String>,
    #[serde(rename = "mentorId")]
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