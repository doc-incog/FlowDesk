use crate::state::AppState;
use futures::TryStreamExt;
use mongodb::bson::{doc, Document};
use mongodb::options::FindOptions;
use serde_json::Value;

/// Convert a raw user `Document` to the camelCase `UserProfile` JSON value.
pub fn doc_to_user_value(d: &Document) -> Value {
    let subjects = d
        .get("subjects")
        .and_then(|s| s.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(|x| x.to_string()))
                .collect::<Vec<_>>()
        });
    serde_json::json!({
        "id": d.get_str("_id").unwrap_or(""),
        "name": d.get_str("name").unwrap_or(""),
        "role": d.get_str("role").unwrap_or(""),
        "email": d.get_str("email").unwrap_or(""),
        "avatarInitials": d.get_str("avatar_initials").unwrap_or(""),
        "department": d.get_str("department").ok().map(|s| s.to_string()),
        "batch": d.get_str("batch").ok().map(|s| s.to_string()),
        "semester": d.get_str("semester").ok().map(|s| s.to_string()),
        "rollNo": d.get_str("roll_no").ok().map(|s| s.to_string()),
        "mentorId": d.get_str("mentor_id").ok().map(|s| s.to_string()),
        "designation": d.get_str("designation").ok().map(|s| s.to_string()),
        "subjects": subjects,
        "phone": d.get_str("phone").ok().map(|s| s.to_string()),
        "address": d.get_str("address").ok().map(|s| s.to_string()),
        "guardianName": d.get_str("guardian_name").ok().map(|s| s.to_string()),
        "guardianPhone": d.get_str("guardian_phone").ok().map(|s| s.to_string()),
        "emergencyContact": d.get_str("emergency_contact").ok().map(|s| s.to_string()),
        "dob": d.get_str("dob").ok().map(|s| s.to_string()),
        "isDeleted": d.get_bool("is_deleted").unwrap_or(false),
    })
}

/// Sort options for "ORDER BY name" (case-insensitive-ish).
pub fn sort_by_name() -> FindOptions {
    FindOptions::builder().sort(doc! { "name": 1 }).build()
}

/// `roleSections`: sorted section list for a role.
pub async fn role_sections(state: &AppState, role: &str) -> Vec<String> {
    let coll = state.db.collection::<Document>("role_permissions");
    let filter = doc! { "role_key": role };
    let cursor = coll
        .find(filter, FindOptions::builder().sort(doc! { "section": 1 }).build())
        .await
        .ok();
    let mut out = Vec::new();
    if let Some(mut c) = cursor {
        while let Some(d) = c.try_next().await.ok().flatten() {
            if let Ok(s) = d.get_str("section") {
                out.push(s.to_string());
            }
        }
    }
    out
}

/// `userOverrideSections`: per-user override section list, or None if none set.
pub async fn user_override_sections(state: &AppState, user_id: &str) -> Option<Vec<String>> {
    let coll = state.db.collection::<Document>("user_permissions");
    let cursor = coll
        .find(doc! { "user_id": user_id }, FindOptions::builder().sort(doc! { "section": 1 }).build())
        .await
        .ok();
    let mut out = Vec::new();
    if let Some(mut c) = cursor {
        while let Some(d) = c.try_next().await.ok().flatten() {
            if let Ok(s) = d.get_str("section") {
                out.push(s.to_string());
            }
        }
    }
    if out.is_empty() {
        None
    } else {
        Some(out)
    }
}

/// Effective sections: override or role defaults.
pub async fn effective_sections(state: &AppState, user_id: &str, role: &str) -> Vec<String> {
    match user_override_sections(state, user_id).await {
        Some(o) => o,
        None => role_sections(state, role).await,
    }
}

/// Role label; falls back to the role key.
pub async fn role_label(state: &AppState, role: &str) -> String {
    state
        .db
        .collection::<Document>("roles")
        .find_one(doc! { "$or": [ { "key": role }, { "_id": role } ] }, None)
        .await
        .ok()
        .flatten()
        .and_then(|d| d.get_str("label").ok().map(|s| s.to_string()))
        .unwrap_or_else(|| role.to_string())
}

/// Append `sections` + `roleLabel` to a user JSON object (used by profile).
pub async fn with_permissions(state: &AppState, user: &crate::models::user::User) -> Value {
    let sections = effective_sections(state, &user.id, &user.role).await;
    let label = role_label(state, &user.role).await;
    let mut base = serde_json::json!({
        "id": user.id,
        "name": user.name,
        "role": user.role,
        "email": user.email,
        "avatarInitials": user.avatar_initials,
        "department": user.department,
        "batch": user.batch,
        "semester": user.semester,
        "rollNo": user.roll_no,
        "mentorId": user.mentor_id,
        "designation": user.designation,
        "subjects": user.subjects,
        "phone": user.phone,
        "address": user.address,
        "guardianName": user.guardian_name,
        "guardianPhone": user.guardian_phone,
        "emergencyContact": user.emergency_contact,
        "dob": user.dob,
        "isDeleted": user.is_deleted,
    });
    if let Value::Object(ref mut map) = base {
        map.insert("sections".to_string(), serde_json::json!(sections));
        map.insert("roleLabel".to_string(), serde_json::json!(label));
    }
    base
}

/// Append `sections` + `roleLabel` given a raw user document.
pub async fn with_permissions_doc(state: &AppState, user_doc: &Document) -> Value {
    let id = user_doc.get_str("_id").unwrap_or("").to_string();
    let role = user_doc.get_str("role").unwrap_or("").to_string();
    let sections = effective_sections(state, &id, &role).await;
    let label = role_label(state, &role).await;
    let mut base = doc_to_user_value(user_doc);
    if let Value::Object(ref mut map) = base {
        map.insert("sections".to_string(), serde_json::json!(sections));
        map.insert("roleLabel".to_string(), serde_json::json!(label));
    }
    base
}

/// IDs of all students whose mentor is the given staff member, matched either by
/// the roster `mentors.name` equal to the teacher's name, or by `users.mentor_id`.
pub async fn mentee_ids(state: &AppState, staff_id: &str) -> Result<Vec<String>, mongodb::error::Error> {
    let users = state.db.collection::<Document>("users");
    let mentor = users.find_one(doc! { "_id": staff_id }, None).await?;
    let name = mentor.and_then(|m| m.get_str("name").ok().map(|s| s.to_string())).unwrap_or_default();

    let filter = if name.is_empty() {
        doc! { "role": "student", "is_deleted": false, "mentor_id": staff_id }
    } else {
        doc! {
            "role": "student", "is_deleted": false,
            "$or": [
                { "mentor_id": staff_id },
                { "mentor": &name },
                { "mentor_id": &name },
            ]
        }
    };
    let mut cursor = users.find(filter, None).await?;
    let mut out = Vec::new();
    while let Some(u) = cursor.try_next().await? {
        if let Some(id) = u.get_str("_id").ok() {
            out.push(id.to_string());
        }
    }
    Ok(out)
}