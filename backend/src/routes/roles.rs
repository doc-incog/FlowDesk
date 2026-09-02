use crate::error::ApiError;
use crate::helpers;
use crate::middleware::auth;
use crate::services::util as u;
use crate::state::AppState;
use crate::constants::SECTION_KEYS;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::routing::{get, patch};
use axum::{Json, Router};
use futures::TryStreamExt;
use mongodb::bson::{doc, Bson, Document};
use serde_json::{json, Value};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/roles", get(list_roles).post(create_role))
        .route("/api/roles/{key}", patch(update_role).delete(delete_role))
        .route("/api/permissions", get(get_permissions).patch(update_permissions))
}

async fn list_roles(State(state): State<AppState>, headers: HeaderMap) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;
    let roles = state.db.collection::<Document>("roles");
    let perms = state.db.collection::<Document>("role_permissions");
    let users = state.db.collection::<Document>("users");

    let mut cursor = roles
        .find(
            doc! {},
            mongodb::options::FindOptions::builder()
                .sort(doc! { "builtin": -1, "key": 1 })
                .build(),
        )
        .await?;
    let mut out = Vec::new();
    while let Some(r) = cursor.try_next().await? {
        let key = r
            .get_str("key")
            .map(|s| s.to_string())
            .unwrap_or_else(|_| r.get_str("_id").map(|s| s.to_string()).unwrap_or_default());
        let builtin = r.get_bool("builtin").unwrap_or(false);
        let mut sections = Vec::new();
        let mut pc = perms
            .find(doc! { "role_key": &key }, None)
            .await?;
        while let Some(p) = pc.try_next().await? {
            if let Some(s) = p.get_str("section").ok() {
                sections.push(s.to_string());
            }
        }
        let count = users.count_documents(doc! { "role": &key, "is_deleted": false }, None).await?;
        out.push(json!({
            "key": key,
            "label": r.get_str("label").unwrap_or(""),
            "blurb": r.get_str("blurb").unwrap_or(""),
            "accent": r.get_str("accent").unwrap_or(""),
            "builtin": builtin,
            "sections": sections,
            "users": count,
        }));
    }

    Ok(Json(json!({ "roles": out })))
}

async fn create_role(State(state): State<AppState>, headers: HeaderMap, Json(body): Json<Value>) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;
    let mut key = match body.get("key").and_then(|v| v.as_str()) {
        Some(k) => k.trim().to_lowercase(),
        None => return Err(ApiError::bad_request("Missing role key")),
    };
    if key.is_empty()
        || key.len() > 32
        || !key.chars().next().map(|c| c.is_ascii_alphanumeric()).unwrap_or(false)
        || !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(ApiError::bad_request("Invalid role key"));
    }
    let label: String = match body.get("label").and_then(|v| v.as_str()) {
        Some(l) => l.to_string(),
        None => return Err(ApiError::bad_request("Missing label")),
    };
    let blurb = body.get("blurb").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let accent = body.get("accent").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let sections: Vec<String> = body
        .get("sections")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|s| s.as_str().map(|x| x.to_string())).collect())
        .unwrap_or_default();

    let roles = state.db.collection::<Document>("roles");
    if roles.find_one(doc! { "key": &key }, None).await?.is_some() {
        return Err(ApiError::conflict("That role key already exists."));
    }

    let role_doc = doc! {
        "key": &key,
        "label": &label,
        "blurb": blurb,
        "accent": accent,
        "builtin": false,
    };
    roles.insert_one(role_doc, None).await.map_err(|_| ApiError::bad_request("Failed to create role"))?;

    // Validate section keys; invalid -> 500 (legacy behavior).
    for s in &sections {
        if !SECTION_KEYS.contains(&s.as_str()) {
            return Err(ApiError::internal("Invalid section key"));
        }
        perms_insert(&state, &key, s).await?;
    }

    Ok((axum::http::StatusCode::CREATED, Json(json!({ "ok": true, "role": json!({ "key": key, "label": label }) }))))
}

async fn perms_insert(state: &AppState, key: &str, section: &str) -> Result<(), ApiError> {
    let perms = state.db.collection::<Document>("role_permissions");
    perms.insert_one(doc! { "role_key": key, "section": section }, None)
        .await
        .map_err(|_| ApiError::internal("Failed to save permissions"))?;
    Ok(())
}

async fn update_role(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(key): Path<String>,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;
    let roles = state.db.collection::<Document>("roles");
    let role = roles
        .find_one(doc! { "key": &key }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Role not found"))?;
    let builtin = role.get_bool("builtin").unwrap_or(false);

    let mut set = Document::new();
    if let Some(l) = body.get("label").and_then(|v| v.as_str()) {
        set.insert("label", l);
    }
    if let Some(b) = body.get("blurb").and_then(|v| v.as_str()) {
        set.insert("blurb", b);
    }
    if let Some(a) = body.get("accent").and_then(|v| v.as_str()) {
        set.insert("accent", a);
    }

    // Rename re-points users.role + role_permissions.
    let new_key = body.get("newKey").and_then(|v| v.as_str()).map(|s| s.to_lowercase()).filter(|s| !s.is_empty());

    let mut txn = state.client.start_session(None).await?;
    txn.start_transaction(None).await?;
    {
        let roles_t = state.db.collection::<Document>("roles");
        let perms = state.db.collection::<Document>("role_permissions");
        let users_t = state.db.collection::<Document>("users");

        // Validate section keys upfront (legacy: invalid -> 500).
        if let Some(arr) = body.get("sections").and_then(|v| v.as_array()) {
            let new_sections: Vec<String> = arr
                .iter()
                .filter_map(|s| s.as_str().map(|x| x.to_string()))
                .collect();
            for s in &new_sections {
                if !SECTION_KEYS.contains(&s.as_str()) {
                    return Err(ApiError::internal("Invalid section key"));
                }
            }
            perms.delete_many_with_session(doc! { "role_key": &key }, None, &mut txn).await?;
            for s in &new_sections {
                perms.insert_one_with_session(doc! { "role_key": &key, "section": s }, None, &mut txn).await?;
            }
        }

        if !set.is_empty() {
            roles_t.update_one_with_session(doc! { "key": &key }, doc! { "$set": &set }, None, &mut txn).await?;
        }

        if let Some(ref nk) = new_key {
            // New role doc with `_id` = new key and old values, then drop old.
            let old = roles_t.find_one_with_session(doc! { "key": &key }, None, &mut txn).await?;
            if let Some(old) = old {
                let mut nd = old.clone();
                nd.insert("key", nk.clone());
                nd.insert("_id", Bson::String(nk.clone()));
                roles_t.insert_one_with_session(nd, None, &mut txn).await?;
                roles_t.delete_one_with_session(doc! { "key": &key }, None, &mut txn).await?;
            }
            perms.update_many_with_session(doc! { "role_key": &key }, doc! { "$set": { "role_key": nk } }, None, &mut txn).await?;
            users_t.update_many_with_session(doc! { "role": &key }, doc! { "$set": { "role": nk } }, None, &mut txn).await?;
        }
    }
    txn.commit_transaction().await?;

    Ok(Json(json!({ "ok": true })))
}

async fn delete_role(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(key): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;
    let roles = state.db.collection::<Document>("roles");
    let role = roles
        .find_one(doc! { "key": &key }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Role not found"))?;
    if role.get_bool("builtin").unwrap_or(false) {
        return Err(ApiError::bad_request("Cannot delete built-in role"));
    }
    let count = state
        .db
        .collection::<Document>("users")
        .count_documents(doc! { "role": &key }, None)
        .await?;
    if count > 0 {
        return Err(ApiError::bad_request("Role is assigned to users"));
    }
    roles.delete_one(doc! { "key": &key }, None).await?;
    state
        .db
        .collection::<Document>("role_permissions")
        .delete_many(doc! { "role_key": &key }, None)
        .await?;
    Ok(Json(json!({ "ok": true })))
}

async fn get_permissions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;
    let user_id = params
        .get("userId")
        .map(|s| s.to_string())
        .ok_or_else(|| ApiError::bad_request("Specify userId"))?;

    let users = state.db.collection::<Document>("users");
    let user = users
        .find_one(doc! { "_id": &user_id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("User not found"))?;
    let role = user.get_str("role").unwrap_or("").to_string();

    let roles = state.db.collection::<Document>("roles");
    let role_doc = roles.find_one(doc! { "key": &role }, None).await?;

    // defaults = built-in section set for the role.
    let role_perms = state.db.collection::<Document>("role_permissions");
    let mut defaults = Vec::new();
    let mut dc = role_perms.find(doc! { "role_key": &role }, None).await?;
    while let Some(p) = dc.try_next().await? {
        if let Some(s) = p.get_str("section").ok() {
            defaults.push(s.to_string());
        }
    }

    // override (user_permissions).
    let overrides = state.db.collection::<Document>("user_permissions");
    let mut override_list: Option<Vec<String>> = None;
    let mut oc = overrides.find(doc! { "user_id": &user_id }, None).await?;
    let mut ov = Vec::new();
    while let Some(p) = oc.try_next().await? {
        if let Some(s) = p.get_str("section").ok() {
            ov.push(s.to_string());
        }
    }
    if !ov.is_empty() {
        override_list = Some(ov);
    }

    // allSections = union over all roles' permissions.
    let mut all = std::collections::BTreeSet::new();
    let mut ac = role_perms.find(doc! {}, None).await?;
    while let Some(p) = ac.try_next().await? {
        if let Some(s) = p.get_str("section").ok() {
            all.insert(s.to_string());
        }
    }

    let override_value = match override_list {
        Some(list) => json!(list),
        None => Value::Null,
    };

    Ok(Json(json!({
        "user": helpers::doc_to_user_value(&user),
        "defaults": defaults,
        "override": override_value,
        "allSections": all.into_iter().collect::<Vec<_>>(),
    })))
}

async fn update_permissions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;
    let user_id = match body.get("userId").and_then(|v| v.as_str()) {
        Some(s) => s.to_string(),
        None => return Err(ApiError::bad_request("Missing userId")),
    };
    let users = state.db.collection::<Document>("users");
    let user = users
        .find_one(doc! { "_id": &user_id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("User not found"))?;

    let sections: Option<Vec<String>> = match body.get("sections") {
        Some(Value::Array(arr)) => Some(arr.iter().filter_map(|s| s.as_str().map(|x| x.to_string())).collect()),
        Some(Value::Null) | None => None,
        _ => None,
    };

    let overrides = state.db.collection::<Document>("user_permissions");
    match sections {
        Some(list) => {
            // Replace overrides.
            overrides.delete_many(doc! { "user_id": &user_id }, None).await?;
            for s in &list {
                overrides.insert_one(doc! { "user_id": &user_id, "section": s }, None).await?;
            }
        }
        None => {
            overrides.delete_many(doc! { "user_id": &user_id }, None).await?;
        }
    }

    // Echo back the effective override so the client can keep its toggle state.
    let mut ov = Vec::new();
    let mut oc = overrides.find(doc! { "user_id": &user_id }, None).await?;
    while let Some(p) = oc.try_next().await? {
        if let Some(s) = p.get_str("section").ok() {
            ov.push(s.to_string());
        }
    }
    let override_value = if ov.is_empty() { Value::Null } else { json!(ov) };

    let user_value = helpers::doc_to_user_value(&user);
    Ok(Json(json!({ "ok": true, "user": user_value, "override": override_value })))
}