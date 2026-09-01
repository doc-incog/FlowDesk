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

### `GET /api/checkins/history?from=&to=&role=&userId=`
Requires a session. All params optional. Students always see only their own
records; staff see their mentees; admins see everyone.

- `userId` — per-person history. Admins may query anyone, staff only their own
  mentees (`403` otherwise), ignored for students.
- `role` — admin-only aggregate filter (`student` | `staff`), ignored when
  `userId` is set.

→ `{ "records": [{ id, userId, name, role, date, time, status, method, source }], "summary": { total, present, late, absent, percentage } }`

## Directory management (admin)

### `POST /api/directory`
Adds a student or staff member with the default password. Admin only.

### `PATCH /api/directory/:id`
Updates a person's details. Admin only.

### `DELETE /api/directory/:id`
Permanently removes a student or staff member (admin only). Deletes their
sessions, attendance, notifications, permission overrides and chat data.
Direct conversations involving the deleted person are removed for everyone
(so no "Unknown user" entries linger); group chats keep running without them.
Historical records (fees paid, results, submissions) are preserved for audit.

- `200` → `{ "ok": true }`
- `400` → deleting your own account, `403` → non-admin or admin target,
  `404` → unknown id

## Chat

### `GET/POST /api/conversations`
List the signed-in user's conversations or create a direct conversation with
`{ "participantIds": [userId] }`.

### `DELETE /api/conversations/:id`
Any participant can delete a conversation. Removes it — and all of its
messages — for every participant.

- `200` → `{ "ok": true }`, `403` → not a participant

## Feedback

### `GET /api/feedback`
Requires a session. Returns all feedback targets and entries. Individual
responses (author + comment) are included **for admins only**; other roles get
anonymised entries for aggregate views.

### `POST /api/feedback`
Body: `{ "targetId": string, "rating": 1-5, "comment"?: string }`. One response
per user per target (resubmitting updates it).

### `POST /api/feedback/targets`
Creates a feedback form with any category. Admin only. Body:
`{ "type": string, "name": string, "subtitle"?: string }`

- `201` → `{ "target": FeedbackTarget }`, `409` → duplicate name

### `DELETE /api/feedback/targets/:id`
Deletes a feedback form and all of its entries. Admin only. → `{ "ok": true }`

## Payments

### `POST /api/fees/:id/pay`
Requires a student session. Body: `{ "method": "ewallet" | "card" | "netbanking" | "cash" }`

Marks the fee item paid and creates a receipt. Idempotent — paying an already
paid fee returns the existing receipt with `alreadyPaid: true`.

- `201`/`200` → `{ "receipt": Receipt, "alreadyPaid": boolean }`
- `400` → unknown method, `401` → not signed in, `403` → not a student

`Receipt`: `{ id, studentId, studentName, itemName, amount, date, method, transactionId }`

## Files (uploads)

### `POST /api/submissions`
Requires a student session. `multipart/form-data` with `assignmentId` and `file`.

Stores the file under `.data/uploads/` (5 MB limit) and records the submission.
One submission per assignment per student (`409` on duplicate).

- `201` → `{ "submission": Submission }`
- `400`/`404`/`409`/`413` → `{ "error": string }`

`Submission`: `{ id, assignmentId, studentId, studentName, submittedAt, fileName, marks, feedback }`

## PDF generation

### `GET /api/receipts/:id/pdf`
Requires a session; students may only download their own receipts. Streams a
real A4 PDF receipt (`application/pdf`, `Content-Disposition: attachment`).
Amounts are formatted as NPR (`Rs. 85,000`) — the built-in Helvetica fonts
cannot render the `₹` glyph.

### `POST /api/exams/report-card`
Requires a session. Body: `{ studentName, studentId, rollNo, department, semester, rows: [{ title, moduleCode, max, marks, pct, grade }], totalMax, totalMarks, overall, grade }`

Streams an A4 PDF report card generated by the server.

## Assignments

### `POST /api/assignments`
Creates an assignment visible in every workspace. Staff/admin. Body:
`{ "moduleCode", "moduleName", "title", "description"?, "assignedDate"?, "dueDate", "maxMarks"? }`

- `201` → `{ "assignment": Assignment }`, `400`/`403`

### `DELETE /api/assignments/:id`
Deletes an assignment and its submissions (cascade). Staff/admin. → `{ "ok": true }`

## Exams & results

### `GET /api/exams`
Students receive their own exam list with personal results. Staff/admin
additionally receive `results`: every saved mark row for the entry grid.

### `POST /api/exams`
Schedules an exam. Staff/admin. Body: `{ "title", "moduleCode", "moduleName",
"type": "midterm"|"final"|"practical", "date", "start", "end", "room", "maxMarks"? }`

- `201` → `{ "exam": Exam }`, `400`/`403`

### `DELETE /api/exams/:id`
Deletes an exam and its saved results (cascade). Staff/admin. → `{ "ok": true }`

### `POST /api/exams/results`
Upserts one student's marks for one exam (re-saves overwrite — marks stay
editable). Staff/admin. Body: `{ "examId", "studentId", "marks": number }`

- `200` → `{ "result": { examId, studentId, marks, maxMarks } | null }`
- `400` → non-numeric or above max marks, `404` → unknown exam/student

## Notifications

### `GET /api/notifications`
Broadcasts (`user_id IS NULL`, optionally role-targeted via `target_role`) plus
the user's personal notifications. The section polls this every 5 s.

### `POST /api/notifications`
- No body / empty body → mark all as read.
- `{ "id": string }` → mark that one notification as read (persisted).
- `{ "title", "body"?, "category"?, "target"? }` (admin) → send a notice;
  `target` is `all`, `staff` or `students`. Role-targeted notices are stored
  as a single shared row so admins can delete them in one action.

### `DELETE /api/notifications?id=:id`
Deletes a notification for everyone it targets (broadcast, role group or
personal copy). Admin only.

- `200` → `{ "ok": true }`, `403` → non-admin, `404` → unknown id

## Scholarships

### `GET /api/scholarships`
Scholarship catalogue plus applications; students see their own, admins see all.

### `POST /api/scholarships/applications`
Student application with real document uploads. `multipart/form-data` with
`scholarshipId` and up to 4 `docs` files (5 MB each), stored under `.data/uploads/`.

- `201` → `{ "application": Application }`, `409` → already applied

### `PATCH /api/scholarships/applications/:id`
Moves an application through review. Admin only. Body:
`{ "status": "submitted" | "under-review" | "approved" | "rejected" }`

## Routine

### `POST /api/schedule`
Adds a class slot. Admin only. Body: `{ "day", "start", "end", "code",
"module", "room", "staff"? }` — `staff` may be empty (unassigned); room clashes
are always checked, staff clashes only when a faculty member is selected.

- `201` → `{ "slot": ScheduleSlot }`, `409` → room/staff clash

### `DELETE /api/schedule/:id`
Removes a class slot from the routine. Admin only. → `{ "ok": true }`

