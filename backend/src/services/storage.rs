use std::path::{Path, PathBuf};

/// Base `.data` directory: `RENDER_DISK_MOUNT_PATH || cwd()` + `.data`.
pub fn data_dir() -> PathBuf {
    let base = std::env::var("RENDER_DISK_MOUNT_PATH")
        .ok()
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
        });
    base.join(".data")
}

/// `.data/uploads` directory.
pub fn uploads_dir() -> PathBuf {
    data_dir().join("uploads")
}

/// Ensure the uploads directory exists, returning it.
pub fn ensure_uploads_dir() -> std::io::Result<PathBuf> {
    let d = uploads_dir();
    std::fs::create_dir_all(&d)?;
    Ok(d)
}

/// Build the stored path `<uploads>/<id>-<safeName>`.
pub fn stored_path(id: &str, safe_name: &str) -> PathBuf {
    uploads_dir().join(format!("{}-{}", id, safe_name))
}

/// Map a file extension to a MIME type (mirrors the downloads map).
pub fn mime_for(filename: &str) -> &'static str {
    let ext = Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "pdf" => "application/pdf",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "txt" => "text/plain",
        "md" => "text/markdown",
        "csv" => "text/csv",
        "json" => "application/json",
        "html" | "htm" => "text/html",
        "xml" => "application/xml",
        "zip" => "application/zip",
        "doc" => "application/msword",
        "docx" => {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "ppt" => "application/vnd.ms-powerpoint",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        _ => "application/octet-stream",
    }
}

/// RFC 5987 percent-encode a component (for Content-Disposition filename*).
pub fn rfc5987_encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.as_bytes() {
        if b.is_ascii_alphanumeric() || *b == b'-' || *b == b'.' || *b == b'_' || *b == b'~' {
            out.push(*b as char);
        } else {
            out.push_str(&format!("%{:02X}", b));
        }
    }
    out
}