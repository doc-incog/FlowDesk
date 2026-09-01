use chrono::{Datelike, Local, Timelike, Utc};
use futures::TryStreamExt;
use mongodb::bson::{doc, Document};
use rand::Rng;

fn rand_base36(len: usize) -> String {
    let mut rng = rand::thread_rng();
    let mut s = String::new();
    for _ in 0..len {
        let c = rng.gen_range(0u32..36);
        s.push(char::from_digit(c, 36).unwrap());
    }
    s
}

/// Equivalent of `Math.random().toString(36).slice(2, 8)` — 6 base36 chars.
pub fn rand6() -> String {
    rand_base36(6)
}

/// Equivalent of `Date.now()` — epoch milliseconds.
pub fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

/// base36 of timestamp, uppercased (for EXM-, RES-, ASG-, P-).
pub fn now_ms_base36_upper() -> String {
    let mut n = now_ms();
    if n == 0 {
        return "0".to_string();
    }
    let mut digits = Vec::new();
    while n > 0 {
        let rem = (n % 36) as u32;
        digits.push(char::from_digit(rem, 36).unwrap().to_ascii_uppercase());
        n /= 36;
    }
    digits.into_iter().rev().collect()
}

// === ID generators (match legacy prefixes/formats) ===

pub fn id_ci() -> String {
    format!("ci-{}-{}", now_ms(), rand6())
}
pub fn id_schedule() -> String {
    format!("s{}", now_ms())
}
pub fn id_exam() -> String {
    format!("EXM-{}{}", now_ms_base36_upper(), rand_base36(3).to_uppercase())
}
pub fn id_result() -> String {
    format!("RES-{}{}", now_ms_base36_upper(), rand_base36(4).to_uppercase())
}
pub fn id_assignment() -> String {
    format!("ASG-{}{}", now_ms_base36_upper(), rand_base36(3).to_uppercase())
}
pub fn id_submission() -> String {
    format!("su-{}-{}", now_ms(), rand6())
}
pub fn id_program() -> String {
    format!("P-{}", now_ms_base36_upper())
}
pub fn id_feedback_entry() -> String {
    format!("F{}", now_ms())
}
pub fn id_feedback_target() -> String {
    format!("T{}", now_ms())
}
pub fn id_notification() -> String {
    format!("n-{}-{}", now_ms(), rand6())
}
pub fn id_conversation() -> String {
    format!("conv-{}-{}", now_ms(), rand6())
}
pub fn id_message() -> String {
    format!("msg-{}-{}", now_ms(), rand6())
}
pub fn id_scholarship() -> String {
    format!("sch-{}-{}", now_ms(), rand6())
}
pub fn id_scholarship_app() -> String {
    format!("sa-{}-{}", now_ms(), rand6())
}
pub fn id_scholarship_doc() -> String {
    format!("sd-{}-{}", now_ms(), rand6())
}
pub fn id_admission_app() -> String {
    format!("aa-{}-{}", now_ms(), rand6())
}
pub fn id_complaint() -> String {
    format!("cmp-{}-{}", now_ms(), rand6())
}
pub fn id_withdrawal() -> String {
    format!("wd-{}-{}", now_ms(), rand6())
}
pub fn id_fp_template() -> String {
    format!("fp-{}-{}", now_ms(), rand6())
}
pub fn id_fp_command() -> String {
    format!("cmd-{}-{}", now_ms(), rand6())
}
pub fn id_fp_health() -> String {
    format!("fhp-{}-{}", now_ms(), rand6())
}

// === Date/time helpers (match lib/datetime.ts exactly) ===

/// `YYYY-MM-DD` in server-local time.
pub fn local_date() -> String {
    let t = Local::now();
    format!("{:04}-{:02}-{:02}", t.year(), t.month(), t.day())
}

/// `YYYY-MM-DD HH:MM:SS` in server-local time.
pub fn local_date_time() -> String {
    let t = Local::now();
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
        t.year(),
        t.month(),
        t.day(),
        t.hour(),
        t.minute(),
        t.second()
    )
}

/// `h:mm AM/PM` in en-US locale — matches `toLocaleTimeString("en-US", ...)`.
pub fn clock_time() -> String {
    let t = Local::now();
    let mut h = t.hour();
    let ampm = if h >= 12 { " PM" } else { " AM" };
    if h == 0 {
        h = 12;
    } else if h > 12 {
        h -= 12;
    }
    format!("{}:{:02}{}", h, t.minute(), ampm)
}

/// `new Date().toISOString()` — UTC ISO 8601.
pub fn iso_now() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

/// `new Date().toISOString().slice(0, 10)` — UTC date.
pub fn utc_date() -> String {
    Utc::now().format("%Y-%m-%d").to_string()
}

/// `toLocaleDateString("en-US", { day:"2-digit", month:"short", year:"numeric" })` → `Sep 02, 2026`.
pub fn locale_date() -> String {
    let t = Local::now();
    const MONTHS: [&str; 12] = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    let m = MONTHS[(t.month() - 1) as usize];
    format!("{:02} {}, {}", t.day(), m, t.year())
}

/// `toLocaleDateString("en-US", { day:"2-digit", month:"short", year:"numeric" })` in the
/// `"02 Sep 2026"` ordering used by complaints feedback (matches seed/docs).
pub fn locale_date_dmy() -> String {
    let t = Local::now();
    const MONTHS: [&str; 12] = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    let m = MONTHS[(t.month() - 1) as usize];
    format!("{:02} {} {}", t.day(), m, t.year())
}

/// Avatar initials: split name, first char of first 2 words, uppercased,
/// pad to 2 with first letter or "U". Matches POST /api/directory.
pub fn avatar_initials(name: &str) -> String {
    let mut s: String = name
        .split_whitespace()
        .filter_map(|w| w.chars().next())
        .take(2)
        .collect::<String>()
        .to_uppercase();
    if s.is_empty() {
        s = "U".to_string();
    }
    if s.len() < 2 {
        let first = name.chars().next().unwrap_or('U').to_ascii_uppercase();
        s.push(first);
    }
    s
}

// === nextPrefixId (Mongo) ===

/// Returns the next sequential id for a prefix. Replicates `nextPrefixId` by
/// scanning all ids matching the prefix and taking max numeric suffix + 1.
pub async fn next_prefix_id(
    db: &mongodb::Database,
    coll: &str,
    prefix: &str,
) -> mongodb::error::Result<String> {
    let filter = doc! { "_id": { "$regex": format!("^{}", prefix) } };
    let c = db.collection::<Document>(coll);
    let mut cursor = c.find(filter, None).await?;
    let mut max: i64 = 0;
    while let Some(d) = cursor.try_next().await? {
        if let Some(id) = d.get_str("_id").ok() {
            if let Some(rest) = id.strip_prefix(prefix) {
                let n = rest.parse::<i64>().unwrap_or(0);
                if n > max {
                    max = n;
                }
            }
        }
    }
    Ok(format!("{}{:04}", prefix, max + 1))
}

// === misc ===

/// Sanitize a filename: replace chars not in `[a-zA-Z0-9_. -]` with `_`, truncate to 120.
pub fn safe_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-' | ' ') {
                c
            } else {
                '_'
            }
        })
        .collect();
    cleaned.chars().take(120).collect()
}

/// Percentage helper: round((present+late)/total*100), 0 when total==0.
pub fn attendance_pct(total: usize, attended: usize) -> i64 {
    if total == 0 {
        return 0;
    }
    ((attended as f64 / total as f64) * 100.0).round() as i64
}