use crate::error::ApiError;
use crate::middleware::auth;
use crate::services::util as u;
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use futures::TryStreamExt;
use mongodb::bson::{doc, Bson, Document};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/conversations",
            get(list_conversations).post(create_conversation),
        )
        .route(
            "/api/conversations/{id}/messages",
            get(list_messages).post(create_message),
        )
        .route("/api/conversations/{id}", axum::routing::delete(remove_conversation))
}

// ---- helpers ----

fn str_or_empty(d: &Document, key: &str) -> String {
    d.get_str(key).unwrap_or("").to_string()
}

/// Per-user hidden state from `conversation_hidden`.
async fn conversation_hidden(state: &AppState, cid: &str, user_id: &str) -> bool {
    state
        .db
        .collection::<Document>("conversation_hidden")
        .find_one(doc! { "conversation_id": cid, "user_id": user_id }, None)
        .await
        .ok()
        .flatten()
        .map(|d| d.get_bool("hidden").unwrap_or(false))
        .unwrap_or(false)
}

/// Number of unread messages in a conversation for a user.
async fn unread_count(state: &AppState, cid: &str, user_id: &str) -> u64 {
    let messages = state.db.collection::<Document>("messages");
    let reads = state.db.collection::<Document>("conversation_reads");
    let last_read = reads
        .find_one(doc! { "conversation_id": cid, "user_id": user_id }, None)
        .await
        .ok()
        .flatten();
    match last_read {
        Some(r) => {
            let at = str_or_empty(&r, "read_at");
            if at.is_empty() {
                count_from(&messages, cid, None).await
            } else {
                count_from(&messages, cid, Some(&at)).await
            }
        }
        None => count_from(&messages, cid, None).await,
    }
}

async fn count_from(
    messages: &mongodb::Collection<Document>,
    cid: &str,
    after: Option<&str>,
) -> u64 {
    let filter = match after {
        Some(at) => doc! { "conversation_id": cid, "created_at": { "$gt": at } },
        None => doc! { "conversation_id": cid },
    };
    messages.count_documents(filter, None).await.unwrap_or(0)
}

/// Build the JSON participant list, resolving user data.
async fn participants_value(
    state: &AppState,
    participant_ids: &[String],
) -> Vec<Value> {
    let users = state.db.collection::<Document>("users");
    let mut out = Vec::new();
    for pid in participant_ids {
        let u = users.find_one(doc! { "_id": pid }, None).await.ok().flatten();
        match u {
            Some(d) => out.push(json!({
                "id": str_or_empty(&d, "_id"),
                "name": str_or_empty(&d, "name"),
                "avatarInitials": str_or_empty(&d, "avatar_initials"),
                "role": str_or_empty(&d, "role"),
                "deleted": d.get_bool("is_deleted").unwrap_or(false),
            })),
            None => out.push(json!({
                "id": pid,
                "name": "Unknown User",
                "avatarInitials": "?",
                "role": "",
                "deleted": true,
            })),
        }
    }
    out
}

/// Build a full conversation item for the current user.
async fn conversation_value(state: &AppState, me: &crate::models::user::User, c: &Document) -> Value {
    let cid = str_or_empty(c, "_id");
    let participant_ids: Vec<String> = c
        .get_array("participant_ids")
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let participants = participants_value(state, &participant_ids).await;

    // title: explicit, else comma-joined names (deleted => "Unknown User").
    let explicit_title = c
        .get_str("title")
        .ok()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let title = explicit_title.unwrap_or_else(|| {
        participant_ids
            .iter()
            .map(|pid| {
                if pid == &me.id {
                    me.name.clone()
                } else if let Some(p) = participants.iter().find(|p| p.get("id").and_then(|x| x.as_str()) == Some(pid.as_str())) {
                    p.get("name")
                        .and_then(|x| x.as_str())
                        .unwrap_or("Unknown User")
                        .to_string()
                } else {
                    "Unknown User".to_string()
                }
            })
            .collect::<Vec<_>>()
            .join(", ")
    });

    let hidden = conversation_hidden(state, &cid, &me.id).await;
    let unread = unread_count(state, &cid, &me.id).await;

    json!({
        "id": cid,
        "type": str_or_empty(c, "type"),
        "title": title,
        "createdAt": str_or_empty(c, "created_at"),
        "updatedAt": str_or_empty(c, "updated_at"),
        "lastMessage": c.get_str("last_message").ok(),
        "lastSenderId": c.get_str("last_sender_id").ok(),
        "lastMessageAt": c.get_str("last_message_at").ok(),
        "unreadCount": unread,
        "hidden": hidden,
        "participants": participants,
    })
}

fn message_value(m: &Document) -> Value {
    json!({
        "id": str_or_empty(m, "_id"),
        "senderId": m.get_str("sender_id").ok(),
        "senderName": m.get_str("sender_name").ok(),
        "senderInitials": m.get_str("sentilals").ok(),
        "senderDeleted": m.get_bool("sender_deleted").unwrap_or(false),
        "content": str_or_empty(m, "content"),
        "type": str_or_empty(m, "type"),
        "createdAt": str_or_empty(m, "created_at"),
    })
}

// ---- GET /api/conversations ----

async fn list_conversations(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let include_hidden = params.get("includeHidden").map(|s| s == "true").unwrap_or(false);

    let conversations = state.db.collection::<Document>("conversations");
    let mut cursor = conversations
        .find(
            doc! { "participant_ids": &user.id },
            mongodb::options::FindOptions::builder()
                .sort(doc! { "last_message_at": -1, "created_at": -1 })
                .build(),
        )
        .await?;
    let mut out = Vec::new();
    while let Some(c) = cursor.try_next().await? {
        let cid = str_or_empty(&c, "_id");
        let hidden = conversation_hidden(&state, &cid, &user.id).await;
        if !include_hidden && hidden {
            continue;
        }
        out.push(conversation_value(&state, &user, &c).await);
    }
    Ok(Json(json!({ "conversations": out })))
}

// ---- POST /api/conversations ----

async fn create_conversation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let participant_ids: Vec<String> = body
        .get("participantIds")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|x| x.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    let title = body
        .get("title")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty());
    let conv_type = body
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("direct")
        .to_string();

    let mut combined: Vec<String> = participant_ids.clone();
    let mut set: HashSet<String> = combined.iter().cloned().collect();
    set.insert(user.id.clone());
    combined = set.into_iter().collect();
    combined.sort();

    let conversations = state.db.collection::<Document>("conversations");

    // Direct-chat dedup: existing 2-person conversation with exactly these participants.
    if conv_type == "direct" && combined.len() == 2 {
        if let Some(existing) = conversations
            .find_one(
                doc! {
                    "type": "direct",
                    "participant_ids": { "$all": &combined, "$size": combined.len() as i64 }
                },
                None,
            )
            .await?
        {
            let id = str_or_empty(&existing, "_id");
            return Ok((axum::http::StatusCode::CREATED, Json(json!({ "conversationId": id }))));
        }
    }

    let id = u::id_conversation();
    let now = u::iso_now();
    let doc = doc! {
        "_id": &id,
        "type": &conv_type,
        "title": title.map(Bson::String).unwrap_or(Bson::Null),
        "participant_ids": combined,
        "last_message": Bson::Null,
        "last_sender_id": Bson::Null,
        "last_message_at": Bson::Null,
        "created_at": &now,
        "updated_at": &now,
    };
    conversations.insert_one(doc, None).await?;
    Ok((axum::http::StatusCode::CREATED, Json(json!({ "conversationId": id }))))
}

// ---- GET /api/conversations/{id}/messages ----

async fn list_messages(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let conversations = state.db.collection::<Document>("conversations");
    conversations
        .find_one(doc! { "_id": &id, "participant_ids": &user.id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Conversation not found"))?;

    // Mark conversation read (insert/update conversation_reads).
    mark_read(&state, &id, &user.id).await;

    let messages = state.db.collection::<Document>("messages");
    let mut cursor = messages
        .find(
            doc! { "conversation_id": &id },
            mongodb::options::FindOptions::builder()
                .sort(doc! { "created_at": 1 })
                .build(),
        )
        .await?;
    let mut out = Vec::new();
    while let Some(m) = cursor.try_next().await? {
        out.push(message_value(&m));
    }
    Ok(Json(json!({ "messages": out })))
}

async fn mark_read(state: &AppState, cid: &str, user_id: &str) {
    let reads = state.db.collection::<Document>("conversation_reads");
    let now = u::iso_now();
    if reads
        .find_one(doc! { "conversation_id": cid, "user_id": user_id }, None)
        .await
        .ok()
        .flatten()
        .is_some()
    {
        let _ = reads
            .update_one(
                doc! { "conversation_id": cid, "user_id": user_id },
                doc! { "$set": { "read_at": &now } },
                None,
            )
            .await;
    } else {
        let _ = reads
            .insert_one(
                doc! {
                    "conversation_id": cid,
                    "user_id": user_id,
                    "read_at": &now,
                },
                None,
            )
            .await;
    }
}

// ---- POST /api/conversations/{id}/messages ----

async fn create_message(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let conversations = state.db.collection::<Document>("conversations");
    conversations
        .find_one(doc! { "_id": &id, "participant_ids": &user.id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Conversation not found"))?;

    let content = body
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let mid = u::id_message();
    let now = u::iso_now();
    let messages = state.db.collection::<Document>("messages");
    let doc = doc! {
        "_id": &mid,
        "conversation_id": &id,
        "sender_id": &user.id,
        "sender_name": &user.name,
        "sentilals": &user.avatar_initials,
        "content": &content,
        "type": "text",
        "created_at": &now,
    };
    messages.insert_one(doc, None).await?;

    conversations
        .update_one(
            doc! { "_id": &id },
            doc! { "$set": {
                "last_message": &content,
                "last_sender_id": &user.id,
                "last_message_at": &now,
                "updated_at": &now,
            } },
            None,
        )
        .await?;

    let inserted = messages.find_one(doc! { "_id": &mid }, None).await?.unwrap();
    Ok((axum::http::StatusCode::CREATED, Json(json!({ "message": message_value(&inserted) }))))
}

// ---- DELETE /api/conversations/{id}?action=... ----

async fn remove_conversation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let action = params.get("action").cloned().unwrap_or_else(|| "hide".to_string());
    let conversations = state.db.collection::<Document>("conversations");
    conversations
        .find_one(doc! { "_id": &id, "participant_ids": &user.id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Conversation not found"))?;

    match action.as_str() {
        "hide" => {
            set_hidden(&state, &id, &user.id, true).await;
        }
        "unhide" => {
            set_hidden(&state, &id, &user.id, false).await;
        }
        "delete" => {
            conversations
                .update_one(
                    doc! { "_id": &id },
                    doc! { "$pull": { "participant_ids": &user.id } },
                    None,
                )
                .await?;
            let updated = conversations
                .find_one(doc! { "_id": &id }, None)
                .await?
                .ok_or_else(|| ApiError::not_found("Conversation not found"))?;
            let remaining: Vec<String> = updated
                .get_array("participant_ids")
                .map(|a| {
                    a.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();
            if remaining.len() <= 1 {
                let messages = state.db.collection::<Document>("messages");
                messages.delete_many(doc! { "conversation_id": &id }, None).await?;
                conversations.delete_many(doc! { "_id": &id }, None).await?;
            }
        }
        _ => {
            return Err(ApiError::bad_request("Invalid action"));
        }
    }

    Ok(Json(json!({ "ok": true })))
}

async fn set_hidden(state: &AppState, cid: &str, user_id: &str, hidden: bool) {
    let coll = state.db.collection::<Document>("conversation_hidden");
    if coll
        .find_one(doc! { "conversation_id": cid, "user_id": user_id }, None)
        .await
        .ok()
        .flatten()
        .is_some()
    {
        let _ = coll
            .update_one(
                doc! { "conversation_id": cid, "user_id": user_id },
                doc! { "$set": { "hidden": hidden } },
                None,
            )
            .await;
    } else {
        let _ = coll
            .insert_one(
                doc! {
                    "conversation_id": cid,
                    "user_id": user_id,
                    "hidden": hidden,
                },
                None,
            )
            .await;
    }
}
