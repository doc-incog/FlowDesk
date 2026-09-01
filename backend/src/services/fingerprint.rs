use crate::constants;
use crate::services::util as u;
use futures::TryStreamExt;
use mongodb::bson::{doc, Bson, Document};
use mongodb::Database;
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

/// Per-device SSE event bus. Each deviceId has a shared broadcast channel that
/// the `/enroll/stream` handler subscribes to assistant subscribers get events.
pub type EventPayload = serde_json::Value;

#[derive(Clone, Default)]
pub struct SseBus {
    inner: Arc<std::sync::Mutex<HashMap<String, broadcast::Sender<EventPayload>>>>,
}

static BUS_SEQ: AtomicUsize = AtomicUsize::new(0);

impl SseBus {
    pub fn new() -> Self {
        Self::default()
    }

    /// Subscribe to a device's event stream; returns a receiver.
    pub fn subscribe(&self, device_id: &str) -> broadcast::Receiver<EventPayload> {
        let mut map = self.inner.lock().unwrap();
        let sender = map
            .entry(device_id.to_string())
            .or_insert_with(|| broadcast::channel(256).0)
            .clone();
        // Return a fresh receiver (drop the one stored to avoid caching lag).
        let _ = BUS_SEQ.fetch_add(1, Ordering::SeqCst);
        sender.subscribe()
    }

    /// Publish an event to a device's stream (ignore if no subscribers).
    pub fn publish(&self, device_id: &str, data: EventPayload) {
        let map = self.inner.lock().unwrap();
        if let Some(sender) = map.get(device_id) {
            let _ = sender.send(data);
        }
    }

    pub fn remove(&self, device_id: &str) {
        let mut map = self.inner.lock().unwrap();
        if let Some(s) = map.get(device_id) {
            if s.receiver_count() == 0 {
                map.remove(device_id);
            }
        }
    }
}

/// 24 random bytes as hex (48 chars) device secret.
pub fn generate_device_secret() -> String {
    use rand::RngCore;
    let mut buf = [0u8; 24];
    rand::thread_rng().fill_bytes(&mut buf);
    hex::encode(buf)
}

/// Byte-wise template comparison. `matchTemplate` confidence semantics:
/// a byte matches if `|diff| < 20`; confidence = round(matching/len*100).
pub fn compare_templates(a: &[u8], b: &[u8]) -> i64 {
    if a.len() != b.len() || a.is_empty() {
        return 0;
    }
    let mut matching = 0usize;
    for i in 0..a.len() {
        if (a[i] as i16 - b[i] as i16).abs() < 20 {
            matching += 1;
        }
    }
    ((matching as f64 / a.len() as f64) * 100.0).round() as i64
}

/// Find the best template match on a device with confidence >= threshold.
pub async fn match_template(
    db: &Database,
    incoming: &[u8],
    device_id: &str,
    threshold: i64,
) -> mongodb::error::Result<Option<(String, i32, i64)>> {
    let coll = db.collection::<Document>("fingerprint_templates");
    let mut cursor = coll
        .find(
            doc! { "device_id": device_id, "template": { "$type": "binData" } },
            None,
        )
        .await?;
    let mut best: Option<(String, i32, i64)> = None;
    while let Some(d) = cursor.try_next().await? {
        let user_id = d.get_str("user_id").unwrap_or("").to_string();
        let finger_id = d.get_i32("finger_id").unwrap_or(0);
        let tpl = d.get_binary_generic("template").map(|v| v.as_slice()).unwrap_or(&[]);
        let confidence = compare_templates(incoming, tpl);
        if confidence >= threshold {
            let is_better = match &best {
                Some((_, _, b)) => confidence > *b,
                None => true,
            };
            if is_better {
                best = Some((user_id, finger_id, confidence));
            }
        }
    }
    Ok(best)
}

/// Look up a user by (deviceId, fingerId).
pub async fn lookup_by_finger_id(
    db: &Database,
    device_id: &str,
    finger_id: i64,
) -> mongodb::error::Result<Option<(String, String)>> {
    let coll = db.collection::<Document>("fingerprint_templates");
    let mut cursor = coll
        .aggregate(
            [
                doc! {
                    "$match": { "device_id": device_id, "finger_id": finger_id }
                },
                doc! {
                    "$lookup": {
                        "from": "users",
                        "localField": "user_id",
                        "foreignField": "_id",
                        "as": "u"
                    }
                },
                doc! { "$unwind": { "path": "$u", "preserveNullAndEmptyArrays": true } },
            ],
            None,
        )
        .await?;
    if let Some(d) = cursor.try_next().await? {
        let user_id = d.get_str("user_id").unwrap_or("").to_string();
        let name = d
            .get_document("u")
            .ok()
            .and_then(|u| u.get_str("name").ok())
            .unwrap_or("")
            .to_string();
        return Ok(Some((user_id, name)));
    }
    Ok(None)
}

/// Next available 1-indexed finger slot, or -1 if none.
pub async fn next_available_slot(db: &Database, device_id: &str) -> mongodb::error::Result<i64> {
    let devices = db.collection::<Document>("fingerprint_devices");
    let max_slots = devices
        .find_one(doc! { "_id": device_id }, None)
        .await?
        .and_then(|d| d.get_i64("slots_total").ok())
        .unwrap_or(constants::FP_MAX_SLOTS_R307);

    let coll = db.collection::<Document>("fingerprint_templates");
    let mut cursor = coll
        .find(doc! { "device_id": device_id }, None)
        .await?;
    let mut used = std::collections::HashSet::new();
    while let Some(d) = cursor.try_next().await? {
        if let Ok(fid) = d.get_i32("finger_id") {
            used.insert(fid as i64);
        }
    }
    for slot in 1..=max_slots {
        if !used.contains(&slot) {
            return Ok(slot);
        }
    }
    Ok(-1)
}

#[allow(dead_code)]
fn bson_bool_or_default(d: &Document, key: &str, default: bool) -> bool {
    d.get_bool(key).unwrap_or(default)
}

/// Emit an enrollment event to a device's SSE stream.
pub fn notify_enrollment_event(bus: &SseBus, device_id: &str, payload: EventPayload) {
    bus.publish(device_id, payload);
}

/// Heartbeat: update last_seen / enrolled_count; insert device if missing.
pub async fn heartbeat_device(
    db: &Database,
    device_id: &str,
    sensor_type: Option<&str>,
    sensor_capacity: Option<i64>,
) -> mongodb::error::Result<bool> {
    let devices = db.collection::<Document>("fingerprint_devices");
    if let Some(_d) = devices.find_one(doc! { "_id": device_id }, None).await? {
        // Count enrolled templates.
        let n = db
            .collection::<Document>("fingerprint_templates")
            .count_documents(doc! { "device_id": device_id }, None)
            .await?;
        let mut set = doc! { "last_seen": u::iso_now(), "enrolled_count": n as i64 };
        if let Some(cap) = sensor_capacity {
            set.insert("slots_total", cap);
        }
        devices
            .update_one(doc! { "_id": device_id }, doc! { "$set": set }, None)
            .await?;
        Ok(false)
    } else {
        let st = sensor_type.unwrap_or("R307").to_string();
        let slots = sensor_capacity.unwrap_or_else(|| constants::get_max_slots(&st));
        devices
            .insert_one(
                doc! {
                    "_id": device_id,
                    "label": "",
                    "location": "",
                    "sensor_type": st,
                    "status": "pending",
                    "last_seen": u::iso_now(),
                    "enrolled_count": 0,
                    "slots_total": slots,
                    "created_at": u::iso_now(),
                },
                None,
            )
            .await?;
        Ok(true)
    }
}

/// Insert a health row (log; not idempotent).
pub async fn record_device_health(
    db: &Database,
    device_id: &str,
    data: &Document,
) -> mongodb::error::Result<()> {
    let coll = db.collection::<Document>("fingerprint_device_health");
    let sensor_connected = data.get_bool("sensorConnected").unwrap_or(false);
    coll.insert_one(
        doc! {
            "_id": u::id_fp_health(),
            "device_id": device_id,
            "sensor_connected": if sensor_connected { 1 } else { 0 },
            "sensor_capacity": data.get("sensorCapacity").unwrap_or(&Bson::Null).clone(),
            "free_memory": data.get("freeMemory").unwrap_or(&Bson::Null).clone(),
            "wifi_rssi": data.get("wifiRssi").unwrap_or(&Bson::Null).clone(),
            "uptime_seconds": data.get("uptimeSeconds").unwrap_or(&Bson::Null).clone(),
            "recorded_at": u::iso_now(),
        },
        None,
    )
    .await?;
    Ok(())
}

/// Enqueue a pending command for a device; publishes `command-queued` on the SSE bus.
pub async fn enqueue_command(
    db: &Database,
    bus: &SseBus,
    device_id: &str,
    command: &str,
    params: serde_json::Value,
) -> mongodb::error::Result<String> {
    let coll = db.collection::<Document>("fingerprint_commands");
    let id = u::id_fp_command();
    coll.insert_one(
        doc! {
            "_id": &id,
            "device_id": device_id,
            "command": command,
            "params": params.to_string(),
            "status": "pending",
            "created_at": u::iso_now(),
            "completed_at": Bson::Null,
        },
        None,
    )
    .await?;
    let _ = params;
    bus.publish(
        device_id,
        serde_json::json!({ "type": "command-queued", "commandId": id, "command": command }),
    );
    Ok(id)
}

/// Pop the oldest pending command (oldest first) atomically -> status `sent`.
pub async fn get_next_command(db: &Database, device_id: &str) -> mongodb::error::Result<Option<Document>> {
    let coll = db.collection::<Document>("fingerprint_commands");
    let mut cursor = coll
        .find(
            doc! { "device_id": device_id, "status": "pending" },
            mongodb::options::FindOptions::builder()
                .sort(doc! { "created_at": 1 })
                .limit(1)
                .build(),
        )
        .await?;
    if let Some(cmd) = cursor.try_next().await? {
        let id = cmd.get_str("_id").unwrap_or("").to_string();
        coll.update_one(
            doc! { "_id": &id, "status": "pending" },
            doc! { "$set": { "status": "sent" } },
            None,
        )
        .await?;
        return Ok(Some(cmd));
    }
    Ok(None)
}

/// Mark a command completed/failed; publishes `command-result` on the SSE bus.
pub async fn complete_command(
    db: &Database,
    bus: &SseBus,
    command_id: &str,
    status: &str,
    result: Option<serde_json::Value>,
) -> mongodb::error::Result<()> {
    let coll = db.collection::<Document>("fingerprint_commands");
    let cmd = coll.find_one(doc! { "_id": command_id }, None).await?;
    let device_id = cmd
        .as_ref()
        .and_then(|c| c.get_str("device_id").ok())
        .unwrap_or("")
        .to_string();
    coll.update_one(
        doc! { "_id": command_id },
        doc! { "$set": { "status": status, "completed_at": u::iso_now() } },
        None,
    )
    .await?;
    bus.publish(
        &device_id,
        serde_json::json!({
            "type": "command-result",
            "commandId": command_id,
            "status": status,
            "result": result.unwrap_or(serde_json::Value::Null),
        }),
    );
    Ok(())
}