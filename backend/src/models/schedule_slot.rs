use serde::{Deserialize, Serialize};

/// A schedule slot (class / routine entry).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleSlot {
    #[serde(rename = "_id")]
    pub id: String,
    pub day: String,     // short weekday, e.g. "Wed"
    pub start: String,
    pub end: String,
    pub code: String,
    pub module: String,
    pub room: String,
    pub staff: Option<String>,
}