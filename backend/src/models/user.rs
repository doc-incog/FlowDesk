use serde::{Deserialize, Serialize};
use serde::de::{Deserializer, Error as DeError, SeqAccess, Visitor};
use std::fmt;

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
    #[serde(default, deserialize_with = "deserialize_string_vec")]
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

/// Accepts `subjects` stored as a BSON array, a JSON-array string (the sqlite
/// snapshot relic, e.g. `'["Data Structures","Operating Systems"]'`), or a CSV
/// string. Guards `User` deserialization (used by auth + profile reads) against
/// legacy/dirty data that would otherwise 500 on login.
fn deserialize_string_vec<'de, D>(deserializer: D) -> Result<Option<Vec<String>>, D::Error>
where
    D: Deserializer<'de>,
{
    deserializer.deserialize_any(StringVecVisitor)
}

struct StringVecVisitor;

impl<'de> Visitor<'de> for StringVecVisitor {
    type Value = Option<Vec<String>>;

    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("a string, a list of strings, or null")
    }

    fn visit_none<E: DeError>(self) -> Result<Self::Value, E> {
        Ok(None)
    }

    fn visit_unit<E: DeError>(self) -> Result<Self::Value, E> {
        Ok(None)
    }

    fn visit_str<E: DeError>(self, v: &str) -> Result<Self::Value, E> {
        let raw = v.trim();
        if raw.starts_with('[') {
            if let Ok(serde_json::Value::Array(items)) = serde_json::from_str(raw) {
                return Ok(Some(
                    items
                        .iter()
                        .filter_map(|item| item.as_str().map(String::from))
                        .collect(),
                ));
            }
        }
        Ok(Some(
            raw.split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(String::from)
                .collect(),
        ))
    }

    fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Self::Value, A::Error> {
        let mut out = Vec::new();
        while let Some(item) = seq.next_element::<String>()? {
            out.push(item);
        }
        Ok(Some(out))
    }
}