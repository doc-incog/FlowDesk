import { DatabaseSync } from "node:sqlite"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { createSchema } from "@/lib/db/schema"
import { seedDatabase } from "@/lib/db/seed"

const DATA_DIR = join(process.cwd(), ".data")
const DB_PATH = join(DATA_DIR, "flowdesk.db")

type UserRow = {
  id: string
  name: string
  role: "student" | "staff" | "admin"
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
    seedDatabase(db)
    globalThis.__flowdeskDb = db
  }
  return globalThis.__flowdeskDb
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
