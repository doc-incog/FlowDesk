use crate::constants::DEFAULT_PASSWORD;
use crate::error::ApiError;
use crate::middleware::auth;
use crate::services::password;
use crate::services::util as u;
use crate::services::util::next_prefix_id;
use crate::state::AppState;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use futures::TryStreamExt;
use mongodb::bson::{doc, Bson, Document};
use serde::Deserialize;
use serde_json::json;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/directory", get(list).post(create))
        .route("/api/directory/{id}", axum::routing::patch(update).delete(remove))
        .route("/api/mentor", get(mentor))
        .route("/api/mentees", get(mentees))
        .route("/api/users/search", get(search))
        .route("/api/profile", get(get_profile).post(change_password).patch(update_profile))
}

// ---- helpers ----

fn str_field(v: Option<&serde_json::Value>) -> Option<String> {
    v.and_then(|x| x.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Validate email format (legacy regex).
fn valid_email(email: &str) -> bool {
    let bytes = email.as_bytes();
    // Simple structural check: non-space, @, non-space, dot, non-space.
    let (at, dot) = match (email.find('@'), email.rfind('.')) {
        (Some(a), Some(d)) => (a, d),
        _ => return false,
    };
    at > 0
        && dot > at + 1
        && dot < bytes.len() - 1
        && !email.chars().any(|c| c.is_whitespace())
}

/// GET /api/directory
async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_session_user(&state, &headers).await?;
    let users = state.db.collection::<Document>("users");

    let students = users
        .find(
            doc! { "role": "student", "is_deleted": false },
            crate::helpers::sort_by_name(),
        )
        .await?;
    let mut student_list = Vec::new();
    let mut students = students;
    while let Some(u) = students.try_next().await? {
        student_list.push(crate::helpers::doc_to_user_value(&u));
    }

    let staff_c = users
        .find(
            doc! { "role": "staff", "is_deleted": false },
            crate::helpers::sort_by_name(),
        )
        .await?;
    let mut staff_list = Vec::new();
    let mut staff_c = staff_c;
    while let Some(u) = staff_c.try_next().await? {
        staff_list.push(crate::helpers::doc_to_user_value(&u));
    }

    // Mentors filtered to active staff by name.
    let mentors = state.db.collection::<Document>("mentors");
    let mentors_c = mentors
        .aggregate(
            [
                doc! {
                    "$lookup": {
                        "from": "users",
                        "let": { "mn": "$name" },
                        "pipeline": [
                            doc! {
                                "$match": {
                                    "$expr": {
                                        "$and": [
                                            { "$eq": ["$name", "$$mn"] },
                                            { "$eq": ["$role", "staff"] },
                                            { "$eq": ["$is_deleted", false] },
                                        ]
                                    }
                                }
                            }
                        ],
                        "as": "u"
                    }
                },
                doc! { "$match": { "u.0": { "$exists": true } } },
                doc! { "$sort": { "name": 1 } },
            ],
            None,
        )
        .await?;
    let mut mentor_list = Vec::new();
    let mut mentors_c = mentors_c;
    while let Some(m) = mentors_c.try_next().await? {
        mentor_list.push(bson_to_mentor(&m));
    }

    Ok(Json(json!({
        "students": student_list,
        "staff": staff_list,
        "mentors": mentor_list,
    })))
}

fn bson_to_mentor(d: &Document) -> serde_json::Value {
    serde_json::json!({
        "id": d.get_str("_id").unwrap_or(""),
        "name": d.get_str("name").unwrap_or(""),
        "designation": d.get_str("designation").unwrap_or(""),
        "department": d.get_str("department").unwrap_or(""),
        "email": d.get_str("email").unwrap_or(""),
        "phone": d.get_str("phone").unwrap_or(""),
        "office": d.get_str("office").unwrap_or(""),
        "officeHours": d.get_str("office_hours").unwrap_or(""),
        "avatarInitials": d.get_str("avatar_initials").unwrap_or(""),
        "mentees": d.get_i64("mentees").unwrap_or(0),
    })
}

// ---- POST /api/directory ----

#[derive(Deserialize, Default)]
struct CreateUserJson {
    name: Option<String>,
    email: Option<String>,
    kind: Option<String>,
    role: Option<String>,
    department: Option<String>,
    batch: Option<String>,
    semester: Option<String>,
    #[serde(rename = "rollNo")]
    roll_no: Option<String>,
    #[serde(rename = "mentorId")]
    mentor_id: Option<String>,
    designation: Option<String>,
    subjects: Option<Vec<String>>,
    phone: Option<String>,
    address: Option<String>,
    #[serde(rename = "guardianName")]
    guardian_name: Option<String>,
    #[serde(rename = "guardianPhone")]
    guardian_phone: Option<String>,
    #[serde(rename = "emergencyContact")]
    emergency_contact: Option<String>,
    dob: Option<String>,
}

async fn create(State(state): State<AppState>, headers: HeaderMap, Json(body): Json<serde_json::Value>) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;

    if !body.is_object() {
        return Err(ApiError::bad_request("Invalid request body"));
    }
    let body = body.as_object().unwrap();
    let name = str_field(body.get("name")).ok_or_else(|| ApiError::bad_request("Name is required"))?;
    let email = str_field(body.get("email")).ok_or_else(|| ApiError::bad_request("A valid email is required"))?;
    if !valid_email(&email) {
        return Err(ApiError::bad_request("A valid email is required"));
    }
    let kind = str_field(body.get("kind")).unwrap_or_default();
    let default_role = if kind == "staff" { "staff" } else { "student" };
    let role = str_field(body.get("role")).unwrap_or_else(|| default_role.to_string()).to_lowercase();

    // Role must exist.
    let roles = state.db.collection::<Document>("roles");
    if roles.find_one(doc! { "_id": &role }, None).await?.is_none() {
        return Err(ApiError::bad_request("Unknown role — create it in Roles & permissions first"));
    }

    // Duplicate email (stored lowercase).
    let users = state.db.collection::<Document>("users");
    let lower_email = email.to_lowercase();
    if users
        .find_one(doc! { "email": &lower_email }, None)
        .await?
        .is_some()
    {
        return Err(ApiError::conflict("That email is already in use"));
    }

    // ID + initials.
    let prefix = if role == "staff" { "STF-" } else { "STU-" };
    let id = next_prefix_id(&state.db, "users", prefix).await?;
    let initials = u::avatar_initials(&name);

    let subjects_arr: Vec<String> = body
        .get("subjects")
        .and_then(|s| s.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(|x| x.trim().to_string()))
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();

    let password_hash = password::hash_password(DEFAULT_PASSWORD);

    let user_doc = doc! {
        "_id": &id,
        "name": &name,
        "role": &role,
        "email": &lower_email,
        "password_hash": password_hash,
        "avatar_initials": &initials,
        "department": str_field(body.get("department")).unwrap_or_default(),
        "batch": str_field(body.get("batch")).map(opt_str),
        "semester": str_field(body.get("semester")).map(opt_str),
        "roll_no": str_field(body.get("roll_no")).map(opt_str),
        "mentor_id": str_field(body.get("mentor_id")).map(opt_str),
        "designation": str_field(body.get("designation")).map(opt_str),
        "subjects": subjects_arr,
        "phone": str_field(body.get("phone")).map(opt_str),
        "address": str_field(body.get("address")).map(opt_str),
        "guardian_name": str_field(body.get("guardian_name")).map(opt_str),
        "guardian_phone": str_field(body.get("guardian_phone")).map(opt_str),
        "emergency_contact": str_field(body.get("emergency_contact")).map(opt_str),
        "dob": str_field(body.get("dob")).map(opt_str),
        "is_deleted": false,
    };
    users.insert_one(user_doc.clone(), None).await.map_err(|_| {
        ApiError::conflict("That email is already in use.")
    })?;

    // Staff -> mentor roster sync (silent on failure).
    if role == "staff" {
        let mentors = state.db.collection::<Document>("mentors");
        let m_id = next_prefix_id(&state.db, "mentors", "MEN-").await.unwrap_or_default();
        let _ = mentors
            .insert_one(
                doc! {
                    "_id": m_id,
                    "name": &name,
                    "designation": str_field(body.get("designation")).unwrap_or_default(),
                    "department": str_field(body.get("department")).unwrap_or_default(),
                    "email": lower_email,
                    "phone": str_field(body.get("phone")).unwrap_or_default(),
                    "office": "",
                    "office_hours": "",
                    "avatar_initials": initials,
                    "mentees": 0i64,
                },
                None,
            )
            .await;
    }

    let person = crate::helpers::doc_to_user_value(&user_doc);
    Ok((axum::http::StatusCode::CREATED, Json(json!({ "ok": true, "person": person }))))
}

fn opt_str(s: String) -> Bson {
    if s.is_empty() {
        Bson::Null
    } else {
        Bson::String(s)
    }
}

// ---- PATCH /api/directory/{id} ----

async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;
    if !body.is_object() {
        return Err(ApiError::bad_request("Invalid request body"));
    }
    let body = body.as_object().unwrap();

    let users = state.db.collection::<Document>("users");
    let existing = users
        .find_one(doc! { "_id": &id, "is_deleted": false }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Person not found"))?;

    let get_str = |key: &str, d: &Document| -> String {
        d.get_str(key).unwrap_or("").to_string()
    };

    let name = str_field(body.get("name"))
        .unwrap_or_else(|| get_str("name", &existing))
        // Patch always lowercases email; name taken verbatim.
        ;
    let mut email = str_field(body.get("email"))
        .unwrap_or_else(|| get_str("email", &existing))
        .to_lowercase();
    if !valid_email(&email) {
        return Err(ApiError::bad_request("A valid email is required"));
    }

    let role = str_field(body.get("role"))
        .unwrap_or_else(|| get_str("role", &existing))
        .to_lowercase();
    let roles = state.db.collection::<Document>("roles");
    if roles.find_one(doc! { "_id": &role }, None).await?.is_none() {
        return Err(ApiError::bad_request("Unknown role — create it in Roles & permissions first"));
    }

    // Duplicate email validation on other users.
    if let Some(dup) = users
        .find_one(doc! { "email": &email, "_id": { "$ne": &id } }, None)
        .await?
    {
        let _ = dup;
        return Err(ApiError::conflict("That email is already in use"));
    }

    let avatar = str_field(body.get("avatarInitials"))
        .unwrap_or_else(|| get_str("avatar_initials", &existing));
    let department = str_field(body.get("department")).unwrap_or_default();
    let prev_name = get_str("name", &existing);
    let prev_role = get_str("role", &existing);

    let subjects_arr: Vec<String> = body
        .get("subjects")
        .and_then(|s| s.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(|x| x.trim().to_string()))
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_else(|| existing.get_array("subjects").map(|a| a.iter().filter_map(|v| v.as_str().map(|x| x.to_string())).collect()).unwrap_or_default());

    users
        .update_one(
            doc! { "_id": &id },
            doc! { "$set": {
                "name": &name,
                "role": &role,
                "email": &email,
                "avatar_initials": &avatar,
                "department": department,
                "batch": str_field(body.get("batch")).or_else(|| existing.get_str("batch").ok().map(|s| s.to_string())).map(opt_str),
                "semester": str_field(body.get("semester")).or_else(|| existing.get_str("semester").ok().map(|s| s.to_string())).map(opt_str),
                "roll_no": str_field(body.get("roll_no")).or_else(|| existing.get_str("roll_no").ok().map(|s| s.to_string())).map(opt_str),
                "mentor_id": if body.contains_key("mentorId") && str_field(body.get("mentorId")).unwrap_or_default().is_empty() {
                    Bson::Null
                } else {
                    str_field(body.get("mentor_id")).map(opt_str).unwrap_or_else(|| Bson::Null)
                },
                "designation": str_field(body.get("designation")).or_else(|| existing.get_str("designation").ok().map(|s| s.to_string())).map(opt_str),
                "subjects": subjects_arr,
                "phone": str_field(body.get("phone")).or_else(|| existing.get_str("phone").ok().map(|s| s.to_string())).map(opt_str),
                "address": str_field(body.get("address")).or_else(|| existing.get_str("address").ok().map(|s| s.to_string())).map(opt_str),
                "guardian_name": str_field(body.get("guardianName")).or_else(|| existing.get_str("guardian_name").ok().map(|s| s.to_string())).map(opt_str),
                "guardian_phone": str_field(body.get("guardianPhone")).or_else(|| existing.get_str("guardian_phone").ok().map(|s| s.to_string())).map(opt_str),
                "emergency_contact": str_field(body.get("emergencyContact")).or_else(|| existing.get_str("emergency_contact").ok().map(|s| s.to_string())).map(opt_str),
                "dob": str_field(body.get("dob")).or_else(|| existing.get_str("dob").ok().map(|s| s.to_string())).map(opt_str),
            } },
            None,
        )
        .await?;

    // Staff rename syncs mentors roster by name.
    if prev_role == "staff" && prev_name != name {
        state
            .db
            .collection::<Document>("mentors")
            .update_many(
                doc! { "name": &prev_name },
                doc! { "$set": { "name": name } },
                None,
            )
            .await?;
    }

    let updated = users
        .find_one(doc! { "_id": &id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Person not found"))?;
    let person = crate::helpers::doc_to_user_value(&updated);
    Ok(Json(json!({ "ok": true, "person": person })))
}

// ---- DELETE /api/directory/{id} ----

async fn remove(
    State(state): State<AppState>,
    headers: HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let admin = auth::require_admin(&state, &headers).await?;
    let users = state.db.collection::<Document>("users");

    let existing = users
        .find_one(doc! { "_id": &id, "is_deleted": false }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("Person not found"))?;

    if id == admin.id {
        return Err(ApiError::bad_request("You cannot delete your own account"));
    }
    if existing.get_str("role") == Ok("admin") {
        return Err(ApiError::forbidden("Admin accounts cannot be deleted"));
    }
    if existing.get_bool("is_deleted").unwrap_or(false) {
        return Err(ApiError::conflict("Person already deleted"));
    }

    // Purge live data.
    let empty_filter = |coll: &str, field: &str| doc! { field: &id };
    state.db.collection::<Document>("sessions").delete_many(doc! { "user_id": &id }, None).await?;
    state.db.collection::<Document>("notifications").delete_many(doc! { "user_id": &id }, None).await?;
    state.db.collection::<Document>("user_permissions").delete_many(doc! { "user_id": &id }, None).await?;

    // Delete submission files + rows.
    let subs = state.db.collection::<Document>("submissions");
    let mut cursor = subs.find(doc! { "student_id": &id }, None).await?;
    while let Some(s) = cursor.try_next().await? {
        if let Ok(path) = s.get_str("file_path") {
            let _ = std::fs::remove_file(path);
        }
    }
    subs.delete_many(doc! { "student_id": &id }, None).await?;

    state.db.collection::<Document>("complaints").delete_many(doc! { "raised_by_id": &id }, None).await?;
    state.db.collection::<Document>("feedback_entries").delete_many(doc! { "by_id": &id }, None).await?;
    state.db.collection::<Document>("scholarship_applications").delete_many(doc! { "student_id": &id }, None).await?;
    state.db.collection::<Document>("check_ins").delete_many(doc! { "user_id": &id }, None).await?;

    // Mentor roster cleanup by name; unassign students.
    let name = existing.get_str("name").unwrap_or("").to_string();
    let mentors = state.db.collection::<Document>("mentors");
    let m_ids: Vec<String> = {
        let mut cursor = mentors.find(doc! { "name": &name }, None).await?;
        let mut out = Vec::new();
        while let Some(m) = cursor.try_next().await? {
            out.push(m.get_str("_id").unwrap_or("").to_string());
        }
        out
    };
    if !m_ids.is_empty() {
        users
            .update_many(
                doc! { "role": "student", "mentor_id": { "$in": &m_ids } },
                doc! { "$set": { "mentor_id": Bson::Null } },
                None,
            )
            .await?;
        mentors.delete_many(doc! { "_id": { "$in": &m_ids } }, None).await?;
    }
    users
        .update_many(doc! { "mentor_id": &id }, doc! { "$set": { "mentor_id": Bson::Null } }, None)
        .await?;

    // Soft delete with PII blanking.
    let deleted_email = format!("deleted+{}@flowdesk.local", id.to_lowercase());
    users
        .update_one(
            doc! { "_id": &id },
            doc! { "$set": {
                "is_deleted": true,
                "name": "Unknown User",
                "email": deleted_email,
                "avatar_initials": "?",
                "department": "",
                "batch": Bson::Null,
                "semester": Bson::Null,
                "roll_no": Bson::Null,
                "mentor_id": Bson::Null,
                "designation": Bson::Null,
                "subjects": vec![Bson::String("".into())], // cleared
                "phone": Bson::Null,
                "address": Bson::Null,
                "guardian_name": Bson::Null,
                "guardian_phone": Bson::Null,
                "emergency_contact": Bson::Null,
                "dob": Bson::Null,
                "password_hash": "",
            } },
            None,
        )
        .await?;

    Ok(Json(json!({ "ok": true })))
}

// ---- GET /api/mentor ----

async fn mentor(State(state): State<AppState>, headers: HeaderMap) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let mentors = state.db.collection::<Document>("mentors");
    let mentor_doc = if let Some(mid) = user.mentor_id.clone().filter(|m| !m.is_empty()) {
        mentors.find_one(doc! { "_id": mid }, None).await?
    } else {
        mentors.find_one(doc! { "name": &user.name }, None).await?
    };

    let (mentor_json, mentees): (serde_json::Value, Vec<serde_json::Value>) = match mentor_doc {
        Some(m) => {
            let mentor_json = bson_to_mentor(&m);
            let mentees = if user.role == "staff" {
                let mid = m.get_str("_id").unwrap_or("").to_string();
                let users = state.db.collection::<Document>("users");
                let mut cursor = users
                    .find(
                        doc! { "mentor_id": mid, "is_deleted": false },
                        crate::helpers::sort_by_name(),
                    )
                    .await?;
                let mut list = Vec::new();
                while let Some(u) = cursor.try_next().await? {
                    list.push(crate::helpers::doc_to_user_value(&u));
                }
                list
            } else {
                Vec::new()
            };
            (mentor_json, mentees)
        }
        None => (serde_json::Value::Null, Vec::new()),
    };

    Ok(Json(json!({ "mentor": mentor_json, "mentees": mentees })))
}

// ---- GET /api/mentees ----

async fn mentees(State(state): State<AppState>, headers: HeaderMap) -> Result<impl IntoResponse, ApiError> {
    auth::require_admin(&state, &headers).await?;
    let users = state.db.collection::<Document>("users");
    let mentors = state.db.collection::<Document>("mentors");

    let mut cursor = mentors
        .aggregate(
            [
                doc! {
                    "$lookup": {
                        "from": "users",
                        "let": { "mn": "$name" },
                        "pipeline": [
                            doc! { "$match": { "$expr": { "$and": [
                                { "$eq": ["$name", "$$mn"] },
                                { "$eq": ["$role", "staff"] },
                                { "$eq": ["$is_deleted", false] },
                            ] } } }
                        ],
                        "as": "u"
                    }
                },
                doc! { "$match": { "u.0": { "$exists": true } } },
                doc! { "$sort": { "name": 1 } },
            ],
            None,
        )
        .await?;
    let mut out = Vec::new();
    while let Some(m) = cursor.try_next().await? {
        let mid = m.get_str("_id").unwrap_or("").to_string();
        let mut students = Vec::new();
        let mut uc = users
            .find(
                doc! { "mentor_id": &mid, "is_deleted": false },
                crate::helpers::sort_by_name(),
            )
            .await?;
        while let Some(s) = uc.try_next().await? {
            students.push(crate::helpers::doc_to_user_value(&s));
        }
        let mut obj = bson_to_mentor(&m);
        if let serde_json::Value::Object(ref mut map) = obj {
            map.insert("students".to_string(), json!(students));
        }
        out.push(obj);
    }

    let unassigned_cursor = users
        .find(
            doc! { "role": "student", "is_deleted": false, "mentor_id": { "$in": [Bson::Null, Bson::String("".into())] } },
            crate::helpers::sort_by_name(),
        )
        .await?;
    let mut unassigned = Vec::new();
    let mut unassigned_cursor = unassigned_cursor;
    while let Some(x) = unassigned_cursor.try_next().await? {
        unassigned.push(crate::helpers::doc_to_user_value(&x));
    }

    Ok(Json(json!({ "mentors": out, "unassigned": unassigned })))
}

// ---- GET /api/users/search ----

async fn search(
    State(state): State<AppState>,
    headers: HeaderMap,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let q = params.get("q").cloned().unwrap_or_default().trim().to_string();
    if q.is_empty() {
        return Ok(Json(json!({ "users": [] })));
    }
    let pattern = format!("{}", q.replace('\\', "\\\\"));
    let filter = doc! {
        "_id": { "$ne": &user.id },
        "is_deleted": false,
        "$or": [
            { "name": { "$regex": &pattern, "$options": "i" } },
            { "email": { "$regex": &pattern, "$options": "i" } },
            { "_id": { "$regex": &pattern, "$options": "i" } },
        ]
    };
    let users = state.db.collection::<Document>("users");
    let cursor = users
        .find(filter, mongodb::options::FindOptions::builder().sort(doc! { "name": 1 }).limit(20).build())
        .await?;
    let mut out = Vec::new();
    let mut cursor = cursor;
    while let Some(u) = cursor.try_next().await? {
        out.push(serde_json::json!({
            "id": u.get_str("_id").unwrap_or(""),
            "name": u.get_str("name").unwrap_or(""),
            "avatarInitials": u.get_str("avatar_initials").unwrap_or(""),
            "role": u.get_str("role").unwrap_or(""),
            "department": u.get_str("department").unwrap_or(""),
        }));
    }
    Ok(Json(json!({ "users": out })))
}

// ---- GET /api/profile ----

async fn get_profile(State(state): State<AppState>, headers: HeaderMap) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let with_perms = crate::helpers::with_permissions(&state, &user).await;
    Ok(Json(json!({ "user": with_perms })))
}

// ---- PATCH /api/profile ----

async fn update_profile(State(state): State<AppState>, headers: HeaderMap, Json(body): Json<serde_json::Value>) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    if !body.is_object() {
        return Err(ApiError::bad_request("Invalid request body"));
    }
    let body = body.as_object().unwrap();
    let users = state.db.collection::<Document>("users");

    let name = str_field(body.get("name")).ok_or_else(|| ApiError::bad_request("Name is required"))?;
    let mut email = str_field(body.get("email")).ok_or_else(|| ApiError::bad_request("A valid email is required"))?.to_lowercase();
    if !valid_email(&email) {
        return Err(ApiError::bad_request("A valid email is required"));
    }

    // Duplicate email check on other users.
    if users
        .find_one(doc! { "email": &email, "_id": { "$ne": &user.id } }, None)
        .await?
        .is_some()
    {
        return Err(ApiError::conflict("That email is already in use."));
    }

    users
        .update_one(
            doc! { "_id": &user.id },
            doc! { "$set": {
                "name": name,
                "email": email,
                "avatar_initials": str_field(body.get("avatarInitials")).unwrap_or_else(|| user.avatar_initials.clone()),
                "department": str_field(body.get("department")).unwrap_or_default(),
                "phone": str_field(body.get("phone")).map(opt_str).unwrap_or(Bson::Null),
                "address": str_field(body.get("address")).map(opt_str).unwrap_or(Bson::Null),
                "dob": str_field(body.get("dob")).map(opt_str).unwrap_or(Bson::Null),
                "batch": str_field(body.get("batch")).map(opt_str).unwrap_or(Bson::Null),
                "semester": str_field(body.get("semester")).map(opt_str).unwrap_or(Bson::Null),
                "roll_no": str_field(body.get("rollNo")).map(opt_str).unwrap_or(Bson::Null),
                "mentor_id": str_field(body.get("mentorId")).map(opt_str).unwrap_or(Bson::Null),
                "designation": str_field(body.get("designation")).map(opt_str).unwrap_or(Bson::Null),
            } },
            None,
        )
        .await?;

    let updated = users
        .find_one(doc! { "_id": &user.id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("User not found"))?;
    let with_perms = crate::helpers::with_permissions_doc(&state, &updated).await;
    Ok(Json(json!({ "user": with_perms })))
}

// ---- POST /api/profile (password change, SHA-256) ----

#[derive(Deserialize)]
struct ChangePasswordReq {
    #[serde(rename = "currentPassword")]
    current_password: Option<String>,
    #[serde(rename = "newPassword")]
    new_password: Option<String>,
}

async fn change_password(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth::require_session_user(&state, &headers).await?;
    let req: ChangePasswordReq = serde_json::from_value(body.clone())
        .map_err(|_| ApiError::bad_request("Invalid request body"))?;
    let current = req.current_password.unwrap_or_default();
    let new_pw = req.new_password.unwrap_or_default();
    if current.is_empty() || new_pw.is_empty() {
        return Err(ApiError::bad_request("Current and new passwords are required"));
    }
    if new_pw.len() < 6 {
        return Err(ApiError::bad_request("New password must be at least 6 characters"));
    }

    let users = state.db.collection::<Document>("users");
    let row = users
        .find_one(doc! { "_id": &user.id }, None)
        .await?
        .ok_or_else(|| ApiError::not_found("User not found"))?;
    let stored_hash = row.get_str("password_hash").unwrap_or("").to_string();

    // SHA-256 verify + store (legacy parity).
    let current_hash = password::sha256_hex(current.as_bytes());
    if stored_hash != current_hash {
        return Err(ApiError::forbidden("Current password is incorrect"));
    }
    let new_hash = password::sha256_hex(new_pw.as_bytes());
    users
        .update_one(doc! { "_id": &user.id }, doc! { "$set": { "password_hash": new_hash } }, None)
        .await?;

    Ok(Json(json!({ "success": true })))
}