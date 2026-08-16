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
}

declare global {
   
  var __flowdeskDb: DatabaseSync | undefined
}

export function getDb(): DatabaseSync {
  if (!globalThis.__flowdeskDb) {
    mkdirSync(DATA_DIR, { recursive: true })
    const db = new DatabaseSync(DB_PATH)
    db.exec("PRAGMA journal_mode = WAL;")
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
    return
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
  }
}

export function findUserByEmail(email: string): UserRow | undefined {
  const row = getDb().prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email) as UserRow | undefined
  return row
}

export function findUserById(id: string): UserRow | undefined {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined
  return row
}
