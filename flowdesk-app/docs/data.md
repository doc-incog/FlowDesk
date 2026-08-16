# Data & mock removal

## Where the data lives

- **Database:** SQLite at `.data/flowdesk.db` (created on first run). All
  runtime reads and writes go through this database via the API.
- **Seed data (mock):** `lib/seed-data/` — one directory that holds the entire
  demo dataset (users, schedule, fees, exams, admissions, complaints, etc.).
- **Static copy (not DB data):** the chat assistant's FAQ/suggestions are
  simulated copy and live in `lib/chat-content.ts` (no DB dependency).

## Guarantees

1. **Only one module reads the mocks:** `lib/db/seed.ts` is the sole importer
   of `lib/seed-data`. An ESLint rule (`no-restricted-imports`) blocks any
   other file from importing it, so mock values cannot leak into the app.
2. **The app never reads mocks at runtime:** every view reads via the
   database/API. Mock data exists purely to seed the database.
3. **Seeding is opt-out and idempotent:** controlled by the `SEED` env var
   (see `.env.example`). `SEED=false` skips seeding. Seeding only runs when the
   `users` table is empty, so restarts never duplicate or overwrite rows.

Mock data removal is complete: `lib/mock-data.ts` and `lib/data/` are deleted,
and the chat content moved to `lib/chat-content.ts`.

## Going to production (removing mocks)

1. Set `SEED=false` (or delete `.data/flowdesk.db`).
2. Delete the `lib/seed-data/` directory (it is only read by the seeder).
3. Point users/data provisioning at your real source — the API and DB layer
   are unchanged.

## Demo credentials

Seeded users use password `campus123` (all students & staff); admin uses the
password in `lib/seed-data/core.ts` (`ADMIN_CREDS`).

| Role  | Email                          | Password            |
|-------|--------------------------------|---------------------|
| Admin | `admin@flowdesk.edu`           | `flowdesk-admin@2026` |
| Staff | `rahul.menon@campus.edu`       | `campus123`         |
| Student | `aisha.karim@campus.edu`     | `campus123`         |
