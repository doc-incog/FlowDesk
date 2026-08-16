# FlowDesk API

All routes are Next.js Route Handlers. JSON in/out. Authentication uses an
HttpOnly session cookie (`flowdesk.session`) set by the login endpoint.

## Authentication

### `POST /api/auth/login`
Body: `{ "email": string, "password": string }`

Verifies the password (scrypt hash) and issues a session cookie.

- `200` → `{ "user": UserProfile }`
- `401` → `{ "error": "Invalid email or password" }`

### `POST /api/auth/logout`
Destroys the session and clears the cookie. → `{ "ok": true }`

### `GET /api/auth/me`
Returns the session user or `{ "user": null }` when signed out.

`UserProfile`: `{ id, name, role, email, avatarInitials, department, batch?, semester?, rollNo?, mentorId?, designation?, subjects? }`

## Attendance (device-ready)

### `GET /api/checkins?date=YYYY-MM-DD`
Requires a session. `date` defaults to today (server local time).
Students see only their own record; staff/admin see everyone.
→ `{ "date": string, "records": CheckIn[] }`

### `POST /api/checkins`
Requires a session. Marks attendance for the day. Idempotent — a user can only
check in once per day (subsequent calls return the existing record with
`alreadyCheckedIn: true`).

Web body: `{ "method": "biometric" | "webauthn" | string, "deviceId"?: string, "source"?: "web" }`
Device body (ESP32, when the project resumes): `{ "source": "device", "studentId": string, "deviceId": string, "method": "device" | string }`

→ `{ "record": CheckIn, "alreadyCheckedIn": boolean }`

`CheckIn`: `{ id, name, role, time, status: "on-time" | "late", method, source: "web" | "device" }`

Status is derived from the check-in time (≤ 09:00 = on-time, later = late).

### Device integration contract (ESP32 — on hold)
When the biometric device resumes, the firmware only needs to `POST
/api/checkins` with `source: "device"` and the student id resolved by the
device. No server changes required beyond issuing credentials to the device
(HTTPS + a device token).

## Files (uploads)

### `GET /api/files/:id` — planned (Phase 3)
Downloads a stored file (admission documents, assignment submissions).

## PDF generation

### `GET /api/download/:id` — planned (Phase 3)
Streams a real PDF (receipts, report cards) via `pdfkit`.
