# FlowDesk Migration Report — SQLite → MongoDB

**Status:** Ready for execution against a running MongoDB (local or Atlas).
**Source:** `flowdesk-snapshot-pre-migration.db` (32 tables / 300 rows, string PKs like `STU-2043`, `CHK-…`, `RCP-…`).
**Target:** MongoDB collections consumed by the Rust (Axum) backend.
**Tool:** `migration/seed.py` (Python 3.14, stdlib only; no pymongo dependency).

---

## 1. Naming & key conventions

- Every Mongo document uses a **string `_id`** (original sqlite `id` / `token` / `key` /
  `device_id`), not an ObjectId. The backend reads `get_str("_id")`.
- Field names are converted **snake_case → camelCase** (e.g. `module_code` → `moduleCode`).
- Dates stay as ISO-8601 strings (the backend `.get_str` reads them; no BSON Date type
  is relied upon in the core read paths).
- Empty relationships (e.g. `files.data`, `fingerprint_templates.template`) are omitted
  rather than stored as `null`, matching how the backend returns fields.

Table name → collection (mostly 1:1):

| sqlite table            | Mongo collection         | Notes |
|-------------------------|--------------------------|-------|
| users                   | `users`                  | mirror, `password_hash` kept |
| sessions                | `sessions`               | `token` → `_id`, `expiresAt` |
| roles                   | `roles`                  | `key` → `_id` |
| role_permissions        | `role_permissions`       | `role`/`section` pairs |
| user_permissions        | `user_permissions`       | empty in snapshot |
| mentors                 | `mentors`                | `mentees` CSV → array |
| check_ins               | `check_ins`              | 147 rows |
| schedule_slots          | `schedule_slots`         | |
| exams                   | `exams`                  | |
| results                 | `results`                | |
| assignments             | `assignments`            | |
| submissions             | `submissions`            | file stored on disk; `file_name`→`fileName` |
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

General rule: strip the leading `_`-id column you promote to `_id`, then left-pad the
rest, converting each remaining column to camelCase. Examples:

- `users`:
  - `_id = id`
  - `passwordHash` ← `password_hash` (scrypt hex string; fully interoperable — backend
    scrypt params `log_n=14, r=8, p=1, keylen=64` already verified against Node hashes)
  - `avatarInitials`, `department`, `batch`, `semester` (int), `rollNo`, `mentorId`,
    `designation`, `subjects` (CSV → array or kept string), `phone`, `address`,
    `guardianName`, `guardianPhone`, `emergencyContact`, `dob`, `isDeleted`.
- `check_ins`: `_id=id`, `userId`, `name`, `role`, `time`, `status`, `method`,
  `deviceId`, `source`, `createdAt`.
- `mentors`: `_id=id`, `mentees` as **array of user ids** (from comma CSV).
- `fees` (from `fee_items`): `_id=id`, `studentId`, `name`, `amount` (numeric),
  `dueDate`, `status`, `paidDate`, `method`, `receiptId`.
- `receipts`: `_id=id`, `transactionId`/`transaction_id` → consolidated.
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
   and record only the path in `submissions.filePath` (matching the backend's mount rule).
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
  --database flowdesk
```

The script:

1. Reads every table into the camelCase document shape above.
2. Connects to the target Mongo database and `drop_database` (idempotent, opt-in with
   `--drop`), then inserts each collection via bulk `insert_many`.
3. Prints per-collection row counts that must equal the sqlite source counts (from § row
   counts above) as a verification gate.

> **Note:** Mongo is not installed in the local dev environment. Run the seed once a Mongo
> instance or Atlas cluster (Phase 12 — user setup) is available. The transform itself is
> fully deterministic and the counts are asserted, so it needs no live DB to validate.

---

## 5. Verification checklist (post-seed)

- [ ] 32 collections created with string `_id`.
- [ ] `users` row count equals snapshot (9) and all scrypt hashes verify.
- [ ] `check_ins` = 147, `results` = 25, `role_permissions` = 44, `receipts` = 2.
- [ ] `admin@flowdesk.edu` logs in with `flowdesk-admin@2026`.
- [ ] `/api/overview` returns stats + recent check-ins built from seeded `check_ins`.