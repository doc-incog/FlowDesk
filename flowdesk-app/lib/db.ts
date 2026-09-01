import { DatabaseSync } from "node:sqlite"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { createSchema, USERS_TABLE_DDL } from "@/lib/db/schema"
import { seedDatabase } from "@/lib/db/seed"

const DATA_DIR = join(process.cwd(), ".data")
const DB_PATH = join(DATA_DIR, "flowdesk.db")

export type UserRow = {
  id: string
  name: string
  role: string
  email: string
  password_hash: string
  avatar_initials: string
  department: string
  batch: string | null
  semester: string | null
  roll_no: string | null
  mentor_id: string | null
  designation: string | null
  subjects: string | null
  phone: string | null
  address: string | null
  guardian_name: string | null
  guardian_phone: string | null
  emergency_contact: string | null
  dob: string | null
  is_deleted: number
}

declare global {
   
  var __flowdeskDb: DatabaseSync | undefined
}

export function getDb(): DatabaseSync {
  if (!globalThis.__flowdeskDb) {
    mkdirSync(DATA_DIR, { recursive: true })
    const db = new DatabaseSync(DB_PATH)
    db.exec("PRAGMA journal_mode = WAL;")
    db.exec("PRAGMA foreign_keys = ON;")
    createSchema(db)
    migrateDatabase(db)
    seedDatabase(db)
    globalThis.__flowdeskDb = db
  }
  return globalThis.__flowdeskDb
}

/**
 * Brings pre-existing databases in line with the current schema.
 * New tables are handled by createSchema (IF NOT EXISTS); here we add the
 * users columns that older CREATE TABLE statements never created and drop the
 * old `role IN ('student','staff','admin')` CHECK that blocks custom roles.
 * Idempotent and safe on fresh databases.
 */
export function migrateDatabase(db: DatabaseSync) {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get() as { sql: string } | undefined
  if (!row) return

  const hasRoleCheck = /CHECK\s*\(\s*role\s+IN\s*\(/i.test(row.sql)

  if (hasRoleCheck) {
    // Rebuild the table so the old CHECK constraint is dropped. FK references
    // to users(id) are resolved by name, so renaming users_new -> users keeps
    // sessions/check_ins/etc. pointing at the right table.
    db.exec("PRAGMA foreign_keys = OFF")
    db.exec("BEGIN")
    try {
      db.exec(`CREATE TABLE users_new ${USERS_TABLE_DDL}`)
      db.exec(
        `INSERT INTO users_new (id, name, role, email, password_hash, avatar_initials, department, batch, semester, roll_no, mentor_id, designation, subjects)
         SELECT id, name, role, email, password_hash, avatar_initials, department, batch, semester, roll_no, mentor_id, designation, subjects FROM users`,
      )
      db.exec("DROP TABLE users")
      db.exec("ALTER TABLE users_new RENAME TO users")
      db.exec("COMMIT")
    } catch (err) {
      db.exec("ROLLBACK")
      throw err
    } finally {
      db.exec("PRAGMA foreign_keys = ON")
    }
  }

  const addColumn = (ddl: string) => {
    try {
      db.exec(`ALTER TABLE users ADD COLUMN ${ddl}`)
    } catch {
      // column already exists
    }
  }
  addColumn("phone TEXT")
  addColumn("address TEXT")
  addColumn("guardian_name TEXT")
  addColumn("guardian_phone TEXT")
  addColumn("emergency_contact TEXT")
  addColumn("dob TEXT")
  addColumn("is_deleted INTEGER NOT NULL DEFAULT 0")

  // feedback_targets: drop the old CHECK (type IN ('teacher','event')) so
  // admins can create forms with any category.
  const targetRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'feedback_targets'")
    .get() as { sql: string } | undefined
  if (targetRow && /CHECK\s*\(\s*type\s+IN\s*\(/i.test(targetRow.sql)) {
    db.exec(`
      CREATE TABLE feedback_targets_new (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        subtitle TEXT NOT NULL
      );
      INSERT INTO feedback_targets_new (id, type, name, subtitle)
        SELECT id, type, name, subtitle FROM feedback_targets;
      DROP TABLE feedback_targets;
      ALTER TABLE feedback_targets_new RENAME TO feedback_targets;
    `)
  }

  // feedback_entries: attribute entries to a user id (older rows keep NULL and
  // fall back to by_name matching).
  try {
    db.exec("ALTER TABLE feedback_entries ADD COLUMN by_id TEXT")
  } catch {
    // column already exists
  }

  // notifications: role-targeted broadcasts share one row (target_role) so an
  // admin can delete them for the whole group in one action.
  try {
    db.exec("ALTER TABLE notifications ADD COLUMN target_role TEXT")
  } catch {
    // column already exists
  }

  // notifications: created_at for real timestamps (replaces static "Just now")
  try {
    db.exec("ALTER TABLE notifications ADD COLUMN created_at TEXT NOT NULL DEFAULT ''")
  } catch {
    // column already exists
  }

  // notification_reads: per-user read tracking so role switches preserve unread state
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS notification_reads (
        notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        read_at TEXT NOT NULL,
        PRIMARY KEY (notification_id, user_id)
      )
    `)
  } catch {
    // table already exists
  }

  // conversation_participants: per-user soft-hide for conversations
  try {
    db.exec("ALTER TABLE conversation_participants ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0")
  } catch {
    // column already exists
  }

  // Grant the admin role access to the 'mentees' management section. The seed
  // is insert-once, so pre-existing databases will not have this row until it
  // is added here. Idempotent.
  try {
    db.exec("INSERT OR IGNORE INTO role_permissions (role, section) VALUES ('admin', 'mentees')")
  } catch {
    // role_permissions table may not exist on very old databases
  }

  // Data fix: the scholarship section now displays NPR ("Rs.") instead of INR
  // ("₹"). Seeding is insert-once, so patch seeded rows that still use ₹.
  try {
    db.prepare(
      "UPDATE scholarships SET eligibility = REPLACE(eligibility, '₹', 'Rs. ') WHERE eligibility LIKE '%₹%'",
    ).run()
  } catch {
    // scholarships table may not exist on very old databases
  }

  // Same data fix for seeded chat messages (FAQ answers mention tuition fees).
  try {
    db.prepare(
      "UPDATE messages SET content = REPLACE(content, '₹', 'Rs. ') WHERE content LIKE '%₹%'",
    ).run()
  } catch {
    // messages table may not exist on very old databases
  }

  // Withdrawals: students request to withdraw from the programme, admins
  // review. The student's account stays active until (if ever) a separate
  // action is taken. Idempotent create-table migration.
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
        submitted_at TEXT NOT NULL,
        decided_at TEXT,
        decision_note TEXT
      )
    `)
    db.exec("CREATE INDEX IF NOT EXISTS idx_withdrawals_student ON withdrawals(student_id)")
  } catch {
    // withdrawals table may not exist on very old databases
  }

  // Grant role access to the new withdrawal sections (student + admin).
  try {
    db.exec("INSERT OR IGNORE INTO role_permissions (role, section) VALUES ('student', 'withdrawals')")
    db.exec("INSERT OR IGNORE INTO role_permissions (role, section) VALUES ('admin', 'withdrawals')")
  } catch {
    // role_permissions table may not exist on very old databases
  }

  // Clean up orphaned mentor roster rows: any mentor whose staff account has
  // been deleted should be removed, and students pointing at such a mentor are
  // freed so the admin can reassign them. Idempotent — safe to run every boot.
  try {
    db.exec(`
      DELETE FROM mentors
      WHERE name NOT IN (SELECT name FROM users WHERE role = 'staff' AND is_deleted = 0)
    `)
    db.exec(`
      UPDATE users
      SET mentor_id = NULL
      WHERE mentor_id IS NOT NULL
        AND mentor_id NOT IN (SELECT id FROM mentors)
    `)
  } catch {
    // mentors/users tables may not exist on very old databases
  }

  // Backfill mentor roster rows for active staff who lack one. Mentors are
  // linked to staff by name (/api/mentees, /api/directory, /api/mentor), so a
  // staff member without a `mentors` row can never be assigned students. This
  // covers staff created before the roster row was auto-created on insert.
  try {
    const rows = db
      .prepare(
        `SELECT id, name, email, avatar_initials, department, designation, phone
         FROM users
         WHERE role = 'staff' AND is_deleted = 0
           AND name NOT IN (SELECT name FROM mentors)`,
      )
      .all() as {
      id: string
      name: string
      email: string
      avatar_initials: string
      department: string | null
      designation: string | null
      phone: string | null
    }[]
    let next = nextPrefixId(db, "mentors", "MEN-")
    for (const r of rows) {
      db.prepare(
        `INSERT INTO mentors (id, name, designation, department, email, phone, office, office_hours, avatar_initials, mentees)
         VALUES (?, ?, ?, ?, ?, ?, '', '', ?, 0)`,
      ).run(
        next,
        r.name,
        r.designation ?? "",
        r.department ?? "",
        r.email ?? "",
        r.phone ?? "",
        r.avatar_initials || next.slice(-2),
      )
      next = nextPrefixId(db, "mentors", "MEN-")
    }
  } catch {
    // mentors/users tables may not exist on very old databases
  }

  // Scholarship application statuses: add 'withdrawn' so students can retract a
  // pending application. SQLite cannot ALTER a CHECK constraint, so rebuild the
  // table only when the current DDL does not already allow 'withdrawn'.
  try {
    const row = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'scholarship_applications'")
      .get() as { sql: string } | undefined
    if (row && !/withdrawn/i.test(row.sql)) {
      db.exec("PRAGMA foreign_keys = OFF")
      db.exec("BEGIN")
      try {
        db.exec(`
          CREATE TABLE scholarship_applications_v2 (
            id TEXT PRIMARY KEY,
            scholarship_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            student_name TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('submitted','under-review','approved','rejected','withdrawn')),
            submitted_at TEXT NOT NULL,
            docs TEXT NOT NULL
          )
        `)
        db.exec(`
          INSERT INTO scholarship_applications_v2 (id, scholarship_id, student_id, student_name, status, submitted_at, docs)
          SELECT id, scholarship_id, student_id, student_name, status, submitted_at, docs FROM scholarship_applications
        `)
        db.exec("DROP TABLE scholarship_applications")
        db.exec("ALTER TABLE scholarship_applications_v2 RENAME TO scholarship_applications")
        db.exec("CREATE INDEX IF NOT EXISTS idx_scholar_student ON scholarship_applications(student_id)")
        db.exec("COMMIT")
      } catch (err) {
        db.exec("ROLLBACK")
        throw err
      } finally {
        db.exec("PRAGMA foreign_keys = ON")
      }
    }
  } catch {
    // valid databases simply skip the rebuild
  }
}

/** Generates the next sequential id for a prefix inside a table (e.g. "MEN-"). */
export function nextPrefixId(db: ReturnType<typeof getDb>, table: string, prefix: string): string {
  const rows = db
    .prepare(`SELECT id FROM ${table} WHERE id LIKE ?`)
    .all(`${prefix}%`) as { id: string }[]
  let max = 0
  for (const r of rows) {
    const n = Number(r.id.slice(prefix.length))
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`
}

export function closeDb() {
  if (globalThis.__flowdeskDb) {
    globalThis.__flowdeskDb.close()
    globalThis.__flowdeskDb = undefined
  }
}

/** Converts a users row into the public UserProfile shape. */
export function mapUser(row: UserRow) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    avatarInitials: row.avatar_initials,
    department: row.department,
    batch: row.batch ?? undefined,
    semester: row.semester ?? undefined,
    rollNo: row.roll_no ?? undefined,
    mentorId: row.mentor_id ?? undefined,
    designation: row.designation ?? undefined,
    subjects: row.subjects ? (JSON.parse(row.subjects) as string[]) : undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    guardianName: row.guardian_name ?? undefined,
    guardianPhone: row.guardian_phone ?? undefined,
    emergencyContact: row.emergency_contact ?? undefined,
    dob: row.dob ?? undefined,
    isDeleted: row.is_deleted === 1,
  }
}

export function findUserByEmail(email: string): UserRow | undefined {
  const row = getDb().prepare("SELECT * FROM users WHERE lower(email) = lower(?) AND is_deleted = 0").get(email) as UserRow | undefined
  return row
}

export function findUserById(id: string): UserRow | undefined {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ? AND is_deleted = 0").get(id) as UserRow | undefined
  return row
}
