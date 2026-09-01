# FlowDesk API Contract — Frozen Reference (Rust Rewrite)

> Phase 0 freeze. Authority: the Next.js Route Handlers under `flowdesk-app/app/api/**/route.ts`
> plus shared helpers in `lib/`, at commit `d97a997` (main). This is the contract the Rust/Axum
> backend must reproduce. `docs/api.md` covers a subset; this file covers the rest plus exact
> semantics, and notes corrections to stale docs.

## Global conventions

- JSON in/out. Session auth = HttpOnly cookie `flowdesk.session` (30-day TTL, `httpOnly`,
  `sameSite=lax`, `secure` when `x-forwarded-proto=https` or `cf-visitor` contains `"https"`,
  default `NODE_ENV === "production"`).
- Error shape: `{ "error": string }` unless noted.
- `GET /api/auth/me` returns `{ "user": UserProfile | null }`.
- `UserProfile`: `{ id, name, role, email, avatarInitials, department, batch?, semester?,
  rollNo?, mentorId?, designation?, subjects?, sections?, roleLabel? }` (sections/roleLabel
  added by `withPermissions`, used in profile responses).

## Auth helpers (all in lib)

- `getSessionUser()` → `UserProfile | null`. Reads cookie, verifies `sessions` row not expired,
  then `findUserById` (drops password hash, camelCases row, parses `subjects` JSON).
- Authorization: **inline** `if (user.role !== ...)` per route. No `requireAdmin`/`requireRole`
  helpers exist. `requireFingerprintAuth` in lib/fingerprint.ts is defined but never called.
- Device auth: `requireDeviceAuth(request)` → reads `Authorization: Bearer <token>`, returns
  `device_id` from `fingerprint_devices WHERE device_secret=? AND status='approved'`, else null.
- Password: scrypt `salt:hash` (32-hex salt + 128-hex hash), `timingSafeEqual`.
  **Profile password change uses SHA-256** (weaker path — preserve, note as known limitation).
- **No rate limiting / brute-force protection anywhere.**

## Endpoint contract

### Auth
- `POST /api/auth/login` `{email,password}` → 200 `{user}` | 401 `{error:"Invalid email or password"}`.
  Calls `purgeExpiredSessions()`, computes `secure` from `x-forwarded-proto`/`cf-visitor`, sets cookie.
- `POST /api/auth/logout` → `{ok:true}`, clears cookie.
- `GET /api/auth/me` → `{user}`.

### Directory / people
- `GET /api/directory` (any session) → `{students:[UserProfile...], staff:[...], mentors:[
  {id,name,designation,department,email,phone,office,officeHours,avatarInitials,mentees}...]}`.
  students/staff `WHERE role=? AND is_deleted=0 ORDER BY name`; mentors join active staff by name.
- `POST /api/directory` (admin) `{name,email,kind?,role?,department?,batch?,semester?,rollNo?,
  mentorId?,designation?,phone?,address?,guardianName?,guardianPhone?,emergencyContact?,dob?,
  subjects?[]}` → 201 `{ok,person}`. 400 bad email regex `^[^@\s]+@[^@\s]+\.[^@\s]+$` / unknown
  role / missing fields; 409 duplicate email (stored lowercase); `kind="staff"` → prefix `STF-` +
  `mentors` roster row (`MEN-0001` via nextPrefixId), else `STU-`; password always `campus123`.
- `PATCH /api/directory/[id]` (admin) partial update → `{ok,person}`; email validated+lowered;
  subjects array→JSON; empty mentorId clears; staff rename syncs mentors roster.
- `DELETE /api/directory/[id]` (admin, 403 if target admin, 400 deleting self, 409 already
  deleted) → soft delete: `is_deleted=1`, PII blanked, name `"Unknown User"`, avatar `"?"`,
  email `deleted+<id>@flowdesk.local`, `password_hash=''`. Purges sessions/notifications/
  user_permissions/submissions(+files on disk)/complaints/feedback_entries/scholarship_applications/
  check_ins; unassigns mentors. Keeps conversations/messages, receipts, results (audit).
- `GET /api/mentor` (any session) → `{mentor:{...}|null, mentees:[UserProfile...]}`; staff role also
  lists mentees by roster name or `users.mentor_id`.
- `GET /api/mentees` (admin) → `{mentors:[{...(with students:[])}], unassigned:[UserProfile...]}`.
- `GET /api/users/search?q=` (any session) → `{users:[{id,name,avatarInitials,role,department}]}`
  max 20, `LIKE %q%` on name/email/id, excludes self.
- `GET /api/profile` (any session) → `{user: withPermissions(user)}`.
- `PATCH /api/profile` (any session) own row only; 409 dup email.
- `POST /api/profile` (any session) `{currentPassword,newPassword}` → 200 `{success:true}` | 403
  wrong current | 400 len<6. **SHA-256** verify+store.

### Roles & permissions (all admin unless noted)
- `GET /api/roles` → `{roles:[{key,label,blurb,accent,builtin,sections[],users}]}` ordered builtin DESC,key.
- `POST /api/roles` `{key(^[a-z0-9][a-z0-9_-]{0,31}$ lowercased),label,blurb?,accent?,sections?[]}` →
  201 `{ok,role}`; 409 dup key. Invalid section key → 500.
- `PATCH /api/roles/[key]` `{label?,blurb?,accent?,sections?,newKey?}` → rename re-points users.role +
  role_permissions in transaction; sections replaces all role_permissions.
- `DELETE /api/roles/[key]` → 400 if builtin or has users.
- `GET /api/permissions?userId=` (admin) → `{user,defaults[],override|null,allSections[]}`.
- `PATCH /api/permissions` (admin) `{userId,sections:[]|null}` → replaces overrides or clears.

### Check-ins / attendance
- `GET /api/checkins?date=YYYY-MM-DD` (any session, date defaults server-local today). Students own
  only; staff/admin all. → `{date, records:[CheckIn]}`.
- `POST /api/checkins` (any session). Idempotent per day (`alreadyCheckedIn:true` returns existing).
  Web body `{method:"biometric"|"webauthn"|string, deviceId?, source:"web"}`. Device body
  `{source:"device", studentId?, deviceId, method:"device", fingerprintTemplate? base64, fingerId?}`.
  → `{record, alreadyCheckedIn}`. Status: ≤09:00 on-time else late.
- `GET /api/checkins/history?from=&to=&role=&userId=` (any session, scoping per role; staff only own
  mentees for userId, 403 otherwise; role filter admin only; LIMIT 500) →
  `{records:[...], summary:{total,present,late,absent,percentage}}`.
- `POST /api/checkins/manual` (staff|admin; staff only their mentees) `{studentId,status:
  present|late|absent,note?}` → upsert today's row, method `"manual"`, source `"web"`;
  201 created / 200 updated `{record, created}`.

### Overview
- `GET /api/overview` (any session) → `{stats:[{label,value,hint?,tone,icon}],
  todaysClasses:[...], notices:[... top3 unread by category priority], recentCheckIns:[... top5]}`.
  Stats vary by role; fingerprint `online` = `last_seen > now-5min`.

### Schedule
- `GET /api/schedule` → slots (via section). `POST /api/schedule` (admin) `{day,start,end,code,
  module,room,staff?}` → 201 `{slot}` | 409 room/staff clash. `DELETE /api/schedule/[id]` (admin).

### Exams & results
- `GET /api/exams` (any) → `{exams:[{...result?}], results:[{examId,studentId,marks,maxMarks}]}`;
  results only staff/admin (all rows), students get merged personal result.
- `POST /api/exams` (staff|admin) `{title,moduleCode,moduleName,type:midterm|final|practical,
  date,start,end,room,maxMarks?=100}` → 201 `{ok,exam}`; maxMarks in [1,1000].
- `DELETE /api/exams/[id]` (staff|admin) cascade results.
- `POST /api/exams/results` (staff|admin) `{examId,studentId,marks}` (marks numeric|""|null clears)
  → 200 `{ok,result:{examId,studentId,marks,maxMarks}|null}`; 400 > max; 404 unknown.
  **No GET /api/exams/results.** Report card = `POST /api/exams/report-card` (pdf stream).

### Assignments & submissions
- `GET /api/assignments` → `{assignments, submissions}` (students own, staff/admin all).
- `POST /api/assignments` (staff|admin) `{moduleCode,moduleName,title,description?,assignedDate?,
  dueDate,maxMarks?}` → 201. `DELETE /api/assignments/[id]` cascade submissions.
- `POST /api/submissions` (student) multipart `assignmentId`+`file`, ≤5MB → 201 `{submission}`;
  409 already submitted; 413 too large. Stored `.data/uploads/<id>-<safeName>` under
  `RENDER_DISK_MOUNT_PATH || cwd()`. **No GET /api/submissions.**
- `DELETE /api/submissions/[id]` (student, own only) → unlinks file, deletes row.
- `GET /api/submissions/[id]/file?download=1` (any session; 403 if student not owner) → raw bytes,
  MIME by extension, `Content-Disposition` attachment|inline (RFC 5987 filename).

### Fees (student scoped)
- `GET /api/fees` → `{feeStructure:[{id,name,amount,dueDate,status,paidDate?,method?,receiptId?}],
  receipts:[...], summary:{total,paid,pending,pendingCount}}` (non-students get empty arrays).
- `POST /api/fees/[id]/pay` (student) `{method}`; **accepted: `ewallet|card|netbanking|cash`**
  (`docs/api.md`'s `"upi"` is stale); default `ewallet`. Idempotent: already paid → existing
  receipt `{receipt, alreadyPaid:true}`. Receipt id `RCP-<epochms>`, txn `TXN-<6ms>-<rand4>`.
  **Use Mongo transaction** for fee-mark + receipt insert.

### Scholarships
- `GET /api/scholarships` (any) → catalogue + applications (own vs all).
- `POST /api/scholarships/applications` (student) multipart `scholarshipId` + up to 4 `docs` (5MB
  each) → 201 `{application}` | 409 already applied. Docs recorded as JSON `[{name,path}]` in
  `docs` column.
- `PATCH /api/scholarships/applications/[id]` (admin) `{status:submitted|under-review|approved|rejected}`.

### Admissions
- `GET /api/admissions` (admin) → `{programs:[{id,name,duration,seats,deadline,fee}],
  applications:[{id,applicantName,email,programId,programName,score,docs,status,submittedAt,notes}]}`
  ORDER BY submitted_at DESC. `status ∈ submitted|reviewing|accepted|rejected`.
- `POST /api/admissions` (**public**, no auth) `{applicantName,email,programId,score?}` → 200
  `{ok,application}`; no duplicate prevention.
- `GET /api/programs` (public) → `{programs:[...]}` (apply form catalog).
- `POST /api/admissions/programs` (admin) `{name,duration?="4 years",seats,deadline,fee}` → 201;
  400 seats<1; 409 same name (case-insensitive); id `P-<base36 upper>`.
- `DELETE /api/admissions/programs/[id]` (admin) → 409 if applications reference course.
  **No PATCH; no GET on `/api/admissions/programs`.**

### Complaints / helpdesk
- `GET /api/complaints` (any) students own, staff/admin all; `categories` = `["Academic",
  "Facilities","IT / Portal","Hostel","Other"]`; `comments` parsed JSON→string[].
- `POST /api/complaints` (any) `{category,subject,description}` → 201 `{complaint}`.
- `PATCH /api/complaints/[id]` (any; student own/403) `{comment?,status?:open|in-progress|resolved}`;
  comment appends `"<name>: <comment>"` → 200 `{complaint}`.
- `DELETE /api/complaints/[id]` (admin or raiser).

### Feedback
- `GET /api/feedback` (any) targets+entries; individual author/comment **admin only**, others anonymised.
- `POST /api/feedback` (any) `{targetId,rating 1-5,comment?}`; one per user per target (update in place).
- `POST /api/feedback/targets` (admin) `{type,name,subtitle?}` → 201 | 409 dup name.
- `DELETE /api/feedback/targets/[id]` (admin) cascade entries.

### Notifications
- `GET /api/notifications` → broadcasts (`user_id IS NULL`, optional `target_role`) + own row;
  client polls ~3-5s.
- `POST /api/notifications` — mark-all-read (empty body) | `{id}` mark-one | admin broadcast
  `{title,body?,category?,target:all|staff|students}` (single shared row per group).
- `DELETE /api/notifications?id=` (admin) → removes for the target group.

### Chat / conversations
- `GET /api/conversations?includeHidden=true` (any) → per-conversation `{id,type,title,createdAt,
  updatedAt,lastMessage,lastSenderId,lastMessageAt,unreadCount,hidden,participants:[{id,name,
  avatarInitials,role,deleted}]}`; title defaults to comma-joined names; deleted → "Unknown User";
  ordered `last_message_at DESC NULLS LAST, created_at DESC`.
- `POST /api/conversations` (any) `{participantIds[],title?,type?="direct"}` → direct-chat dedup
  returns existing id; 201 `{conversationId}`.
- `GET /api/conversations/[id]/messages` (any, participant) → `{messages:[{id,senderId,senderName,
  senderInitials,senderDeleted,content,type,createdAt}]}` ASC; marks read.
- `POST /api/conversations/[id]/messages` (any, participant) `{content}` → 201 `{message}`.
- `DELETE /api/conversations/[id]?action=hide|unhide|delete` → hide (default, per-user is_hidden),
  unhide, or hard delete (removes participant; deletes conversation+messages when empty).

### Withdrawals
- `GET /api/withdrawals` (any) students own, admin all; `status ∈ pending|approved|rejected`.
- `POST /api/withdrawals` (student) `{reason}` → 201 `{ok,withdrawal}`; 409 if a pending exists.
- `PATCH /api/withdrawals/[id]` (admin) `{status,decisionNote?}` → `{ok,status}`.

### Fingerprint / device (ESP contract)
Constants: `FP_TEMPLATE_SIZE=512`, `FP_MAX_SLOTS_R307=162`, `FP_MAX_SLOTS_R309=300`,
`FP_MATCH_THRESHOLD=50`. Template match = byte-wise diff; `diff<20` matches; confidence =
`round(matching/len*100)`; best ≥50 wins. Slots 1-indexed; `nextAvailableSlot` = lowest free or -1.
Templates stored **on-sensor AND in DB** (`fingerprint_templates.template` BLOB) for the two
matching paths. `device_secret` = 24 random bytes hex (`generateDeviceSecret`).

- `GET /api/fingerprint/command` (Bearer; fallback `?deviceId=`) → heartbeats, `{id,command,params}`
  or `{command:null}`; oldest pending atomically → `sent`.
- `POST /api/fingerprint/devices` — 3 behaviors: admin `{action:approve|disable,deviceId}` (session
  admin); device auto-register `{deviceId,sensorType?}` (no session, status pending, returns
  `{ok,deviceSecret,status}`); admin create/update (session admin, label/location/sensorType, but
  no secret returned unless created). device_id PK; duplicate re-registration idempotent.
- `GET /api/fingerprint/devices` (admin) → `{devices:[...snake_case rows...]}` ordered pending,approved,
  disabled then last_seen DESC.
- `DELETE /api/fingerprint/devices?deviceId=` (admin) → 409 if enrolled templates exist.
- `GET /api/fingerprint/devices/[deviceId]` (admin) → `{device, health:[last 10], enrollments:
  [{id,finger_id,user_id,name,enrolled_by,enrolled_at}]}`.
- `PATCH /api/fingerprint/devices/[deviceId]` (admin) `{label?,location?,sensorType?}`.
- `DELETE /api/fingerprint/devices/[deviceId]` (admin) → 409 if enrolled.
- `GET /api/fingerprint/devices/[deviceId]/health` (admin) → last 50.
- `POST /api/fingerprint/devices/[deviceId]/health` (Bearer; falls back to URL deviceId; **no
  admin needed**) `{sensorConnected?,sensorCapacity?,freeMemory?,wifiRssi?,uptimeSeconds?}` → always
  inserts a row (log, not idempotent) `{ok:true}`.
- `POST /api/fingerprint/enroll` — GET lists enrollments (admin, optional `?deviceId=`); POST stores
  template (any session) `{userId,fingerId?,deviceId,template? base64}`; duplicate `(user,device)`
  **updates** existing row (`updated:true`), else insert `fp-<ts>-<rand8>`; 409 no slots; heartbeats
  + SSE `enrollment-complete`; DELETE (admin) `?id=` removes + enqueues delete command.
- `GET /api/fingerprint/enroll/status?userId=` (any session, default self) → `{enrolled,
  enrollments:[{id,fingerId,deviceId,label,location,enrolledAt}]}`.
- `POST /api/fingerprint/enroll/status` (**Bearer required**) `{userId,step:
  first-capture|second-capture|matched|stored|error,message?,fingerId?}` → maps to SSE; `{ok:true}`.
- `GET /api/fingerprint/enroll/stream?deviceId=&userId=` (**SSE, no auth**) → `connected`, 15s
  `heartbeat`, 3min `timeout`, plus `command-queued`, `command-result`, `enrollment-started/progress/
  complete/failed`. In-process emitter keyed by deviceId.
- `GET /api/fingerprint/lookup` (Bearer; fallback `?deviceId=`) `?deviceId=&fingerId=` →
  `{found,userId,name}`.
- `POST /api/fingerprint/verify` (Bearer preferred) `{template base64,deviceId}` → `{matched,userId,
  userName?,fingerId?,confidence}`.
- `POST /api/fingerprint/result` (Bearer; fallback body deviceId) `{deviceId?,commandId,status:
  completed|failed,result?}` → `{ok:true}`; `completeCommand` idempotent.

### Command queue semantics
`fingerprint_commands.status ∈ pending|sent|completed|failed`. `enqueueCommand` inserts pending +
SSE `command-queued`. `getNextCommand` = oldest pending → sent. `completeCommand` sets status +
completed_at + SSE `command-result`.

### Heartbeat
`heartbeatDevice(deviceId, meta?)` — exists: update `last_seen`, `enrolled_count`, and
`slots_total` if `meta.sensorCapacity`; missing: insert `status='pending'`, `slots_total=
getMaxSlots(sensorType??"R307")`. UI considers online `last_seen > 5min ago`. Reported "every 60s".

## ID prefixes
| Entity | Format |
|---|---|
| users/mentors | `STU-0001`/`STF-0001`/`MEN-0001` (nextPrefixId, zero-pad 4) |
| notifications | `n-<ts>-<rand8>` |
| receipts | `RCP-<epochms>` |
| transactions | `TXN-<6ms>-<rand4>` |
| check-ins | `ci-<ts>-<rand8>` |
| results | `RES-<base36ts>-<rand4>` |
| exams | `EXM-<base36ts>-<rand3>` |
| assignments | `ASG-<base36ts>-<rand3>` |
| programs | `P-<base36ts upper>` |
| feedback entries | `F<Date.now()>` |
| schedule slots | `s<Date.now()>` |
| complaints | `cmp-<ts>-<rand8>` |
| conversations | `conv-<ts>-<rand8>` |
| messages | `msg-<ts>-<rand8>` |
| submissions | `su-<ts>-<rand8>` |
| scholarship apps/docs | `sa-` / `sd-` |
| admission apps | `aa-<ts>-<rand8>` |
| withdrawals | `wd-<ts>-<rand8>` |
| scholarships | `sch-<ts>-<rand8>` |
| fp templates | `fp-<ts>-<rand8>` |
| fp commands | `cmd-<ts>-<rand8>` |
| fp health | `fhp-<ts>-<rand8>` |

## Pagination / limits
No general pagination. Only: users/search LIMIT 20; checkins/history LIMIT 500; overview notices 3,
recentCheckIns 5; device health 10/50.

## Env vars
| Var | Use |
|---|---|
| `RENDER_DISK_MOUNT_PATH` | base for `.data/` (DB + uploads) |
| `NODE_ENV` | session cookie secure default |
| `SEED` | `"false"` disables seeding |
| `NEXT_PUBLIC_SITE_URL` | canonical/sitemap |

## Corrections vs docs/api.md (source of truth = code)
1. Fee methods are `ewallet|card|netbanking|cash` (doc says `upi`).
2. `GET /api/exams/results` and `GET /api/submissions` do not exist.
3. `files` BLOB table is dead schema (uploads → filesystem).
4. Notification id prefix `n-`, not `NOT-`.
5. No `PATCH /api/admissions/programs/[id]`; no `GET /api/admissions/programs`.
6. `requireFingerprintAuth` unused; authorization is inline.
7. Profile password change uses SHA-256 (weaker than scrypt) — preserve, flag as limitation.
8. No login rate limiting — add in Rust as a hardening improvement (documented change).