use serde::{Deserialize, Serialize};

/// A role definition (builtin or custom).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Role {
    /// Role key (e.g. "student", "admin", "test-role").
    #[serde(rename = "_id")]
    pub key: String,
    pub label: String,
    pub blurb: Option<String>,
    pub accent: Option<String>,
    pub builtin: bool,
}

/// A permission grant attaching a list of section keys to a role.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RolePermission {
    #[serde(rename = "_id")]
    pub id: String,
    pub role: String,
    pub section: String,
}

/// Per-user override of section access. `_id` = user id (a user either has a
/// document (overrides) or does not (use role defaults)).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPermission {
    #[serde(rename = "_id")]
    pub user_id: String,
    pub sections: Vec<String>,
}

/// A login session. Maps 1:1 to the `flowdesk.session` cookie token.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    /// Session token (the cookie value).
    #[serde(rename = "_id")]
    pub token: String,
    pub user_id: String,
    pub created_at: String,
    pub expires_at: String,
}