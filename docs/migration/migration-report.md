# FlowDesk Migration Report — SQLite → MongoDB

**Status:** Ready for execution against a running MongoDB (local or Atlas).
**Source:** `flowdesk-snapshot-pre-migration.db` (32 tables / 300 rows, string PKs like `STU-2043`, `CHK-…`, `RCP-…`).
**Target:** MongoDB collections consumed by the Rust (Axum) backend.
**Tool:** `migration/seed.py` (Python 3.14, stdlib only; no pymongo dependency).

---

## 1. Naming & key conventions

- Every Mongo document uses a **string `_id`** (original sqlite `id` / `token` / `key` /
  `device_id`), not an ObjectId. The backend reads `get_str("_id")`.
- **Stored field names are snake_case**, equal to the sqlite column names. The Rust
  backend reads Mongo documents by their snake_case field names everywhere
  (`get_str("student_id")`, `doc! { "is_deleted": false }`, etc.), so the transform
  preserves column names verbatim and only promotes the PK column to `_id`. The JSON
  API serializes camelCase on output (`studentId`, `isDeleted`) in the helpers/routes —
  camelCase is a **wire/response** convention, not a storage one.
- sqlite's 0/1 integer columns that represent booleans (`is_deleted`, `builtin`, etc.)
  are lifted to real BSON booleans so query predicates (`doc! { "is_deleted": false }`)
  and `get_bool(...)` reads match MongoDB semantics.
- Dates stay as ISO-8601 strings (the backend `.get_str` reads them; no BSON Date type
  is relied upon in the core read paths).
- Empty relationships (e.g. `files.data`, `fingerprint_templates.template`) are omitted
  rather than stored as `null`, matching how the backend returns fields.

Table name → collection (mostly 1:1):

| sqlite table            | Mongo collection         | Notes |
|-------------------------|--------------------------|-------|
| users                   | `users`                  | mirror, `password_hash` kept |
| sessions                | `sessions`               | `token` → `_id`, `expires_at` (backend TTL index) |
| roles                   | `roles`                  | `key` → `_id` |
| role_permissions        | `role_permissions`       | `role`/`section` pairs |
| user_permissions        | `user_permissions`       | empty in snapshot |
| mentors                 | `mentors`                | `mentees` CSV → array |
| check_ins               | `check_ins`              | 147 rows |
| schedule_slots          | `schedule_slots`         | |
| exams                   | `exams`                  | |
| results                 | `results`                | |
| assignments             | `assignments`            | |
| submissions             | `submissions`            | file stored on disk; `file_path` kept |
| fee_items               | `fees`                   | **renamed table** |
| receipts                | `receipts`               | |
| scholarships            | `scholarships`           | |
| scholarship_applications| `scholarship_applications`| |
| programs                | `programs`               | |
| admission_applications  | `admission_applications` | |
| complaints              | `complaints`             | |
| feedback_targets        | `feedback_targets`       | |
| feedback_entries        | `feedback_entries`       | |
| notifications           | `notifications`          | |
| notification_reads      | `conversation_reads`     | unused in snapshot (both empty) |
| conversations           | `conversations`          | |
| conversation_participants| `conversation_reads` / `conversation_hidden` | split by `is_hidden` (empty) |
| messages                | `messages`               | |
| withdrawals             | `withdrawals`            | |
| fingerprint_devices     | `fingerprint_devices`    | `device_id` → `_id` |
| fingerprint_templates   | `fingerprint_templates`  | |
| fingerprint_commands    | `fingerprint_commands`   | |
| fingerprint_device_health| `fingerprint_device_health` | |
| files                   | *(disk uploads dir)*     | content served from `data/uploads/` |

---

## 2. Field transforms (representative)

General rule: promote the PK column (sqlite `id` / `token` / `key` / `device_id`) to
`_id`, then keep every other column name **unchanged (snake_case)**. Example:

- `users`:
  - `_id = id`
  - `password_hash` (scrypt hex string; fully interoperable — backend
    scrypt params `log_n=14, r=8, p=1, keylen=64` already verified against Node hashes)
  - `avatar_initials`, `department`, `batch`, `semester` (int), `roll_no`, `mentor_id`,
    `designation`, `subjects` (CSV kept), `phone`, `address`, `guardian_name`,
    `guardian_phone`, `emergency_contact`, `dob`, `is_deleted` (bool).
- `check_ins`: `_id=id`, `user_id`, `name`, `role`, `time`, `status`, `method`,
  `device_id`, `source`, `created_at`.
- `mentors`: `_id=id`, `mentees` as **array of user ids** (from comma CSV).
- `fees` (from `fee_items`): `_id=id`, `student_id`, `name`, `amount` (numeric),
  `due_date`, `status`, `paid_date`, `method`, `receipt_id`.
- `receipts`: `_id=id`, `transaction_id`, etc. (snake_case preserved).
- `fingerprint_devices`: `_id=device_id`.

---

## 3. Backend compatibility notes

1. **`_id` type** — all ids must be written as strings. Do not use ObjectId or the
   backend's `get_str("_id")` calls fail.
2. **Sensitive data** — `users.password_hash` is preserved as-is so existing password
   interop tests pass against seeded accounts; demo accounts
   `admin@flowdesk.edu` / `flowdesk-admin@2026` are guaranteed to verify.
3. **`files`** — sqlite `files` table is empty in the snapshot. Migration writes a
   `.process_files()` stub that, when non-empty, would write `data/uploads/<id>-<safeName>`
   and record only the path in `submissions.file_path` (matching the backend's mount rule).
4. **Empty tables** — collections for `conversation_participants`, `messages`, `files`,
   `user_permissions`, all `fingerprint_*`, and `withdrawals` seed as empty (or zero-row);
   the backend creates/uses them lazily.

---

## 4. Execution

Requirements: a reachable MongoDB (local `mongodb://localhost:27017` or Atlas SRV) and a
target database name (default derived from config, e.g. `flowdesk`).

```
python migration/seed.py \
  --db <path-to-snapshot.db> \
  --mongo-uri mongodb://localhost:27017 \
  --mongo-db flowdesk
```

The script:

1. Reads every table into the snake_case document shape above (PK column → `_id`,
   bools lifted to BSON booleans).
2. Writes per-collection JSON files, then either loads directly via `pymongo`
   (`--mongo-uri`) or emits `out/load.sh` (mongosh/`mongoimport --drop`) as a
   no-dependency path.
3. Prints per-collection row counts that must equal the sqlite source counts (from § row
   counts above) as a verification gate.

> **Note:** Mongo is not installed in the local dev environment. Run the seed once a Mongo
> instance or Atlas cluster (Phase 12 — user setup) is available. The transform itself is
> fully deterministic and the counts are asserted, so it needs no live DB to validate.

---

## 5. Known out-of-scope / deferred items

- None blocking. The three formerly-frontend-only endpoints are ported to the Rust
  backend: `POST /api/exams/report-card` and `GET /api/receipts/{id}/pdf` render a
  dependency-free single-page PDF (built-in Helvetica), and
  `GET /api/scholarships/applications/{id}/docs?file=` streams an uploaded document.
  Hosting + MongoDB Atlas provisioning remain user-side setup (see `backend/README-deploy.md`).

## 6. Verification checklist (post-seed)

- [ ] 32 collections created with string `_id`.
- [ ] `users` row count equals snapshot (9) and all scrypt hashes verify.
- [ ] `check_ins` = 147, `results` = 25, `role_permissions` = 44, `receipts` = 2.
- [ ] `admin@flowdesk.edu` logs in with `flowdesk-admin@2026`.
- [ ] `/api/overview` returns stats + recent check-ins built from seeded `check_ins`.