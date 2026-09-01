/// Canonical dashboard section keys (mirrors `lib/permissions.ts` SECTION_KEYS).
pub const SECTION_KEYS: &[&str] = &[
    "overview",
    "checkin",
    "notifications",
    "students",
    "staff",
    "mentor",
    "mentees",
    "withdrawals",
    "chat",
    "schedule",
    "exams",
    "assignments",
    "fees",
    "scholarships",
    "admissions",
    "helpdesk",
    "feedback",
    "profile",
    "roles",
    "fingerprint",
];

pub const DEFAULT_PASSWORD: &str = "campus123";

pub const CHECKIN_CUTOFF_MINUTES: i64 = 9 * 60;

/// Complaint categories (static, from the frontend contract).
pub const COMPLAINT_CATEGORIES: &[&str] = &[
    "Academic",
    "Facilities",
    "IT / Portal",
    "Hostel",
    "Other",
];

/// Complaint statuses.
pub const COMPLAINT_STATUSES: &[&str] = &["open", "in-progress", "resolved"];

/// Withdrawal statuses.
pub const WITHDRAWAL_STATUSES: &[&str] = &["pending", "approved", "rejected"];

/// Scholarship application statuses.
pub const SCHOLARSHIP_STATUSES: &[&str] =
    &["submitted", "under-review", "approved", "rejected", "withdrawn"];

/// Admission application statuses.
pub const ADMISSION_STATUSES: &[&str] = &["submitted", "reviewing", "accepted", "rejected"];

/// Accepted fee payment methods (`docs/api.md`'s "upi" is stale).
pub const FEE_METHODS: &[&str] = &["ewallet", "card", "netbanking", "cash"];

/// Max upload size for assignment/scholarship files in bytes (5 MB).
pub const MAX_UPLOAD_SIZE: usize = 5 * 1024 * 1024;

pub const MAX_SCHOLARSHIP_DOCS: usize = 4;

// === Fingerprint constants ===
pub const FP_TEMPLATE_SIZE: usize = 512;
pub const FP_MAX_SLOTS_R307: i64 = 162;
pub const FP_MAX_SLOTS_R309: i64 = 300;
pub const FP_MATCH_THRESHOLD: i64 = 50;

/// Sensor type -> max slots.
pub fn get_max_slots(sensor_type: &str) -> i64 {
    match sensor_type {
        "R309" => FP_MAX_SLOTS_R309,
        _ => FP_MAX_SLOTS_R307,
    }
}

/// Command status lifecycle.
pub const CMD_STATUSES: &[&str] = &["pending", "sent", "completed", "failed"];

/// Fingerprint device statuses.
pub const DEVICE_STATUSES: &[&str] = &["pending", "approved", "disabled"];