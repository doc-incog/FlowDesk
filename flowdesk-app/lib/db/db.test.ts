import { describe, expect, it, beforeAll, afterAll } from "vitest"
import { DatabaseSync } from "node:sqlite"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createSchema } from "@/lib/db/schema"
import { seedDatabase } from "@/lib/db/seed"

describe("database", () => {
  let dir: string
  let db: DatabaseSync

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "flowdesk-test-"))
    db = new DatabaseSync(join(dir, "test.db"))
    createSchema(db)
    seedDatabase(db)
  })

  afterAll(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it("seeds users, students, staff and admin", () => {
    const count = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }
    expect(count.n).toBe(9)
    const roles = db.prepare("SELECT role, COUNT(*) AS n FROM users GROUP BY role").all() as {
      role: string
      n: number
    }[]
    expect(roles.map((r) => [r.role, r.n])).toEqual([
      ["admin", 1],
      ["staff", 3],
      ["student", 5],
    ])
  })

  it("seeds built-in roles and their default permissions", () => {
    const roles = db.prepare("SELECT key, builtin FROM roles ORDER BY key").all() as {
      key: string
      builtin: number
    }[]
    expect(roles).toEqual([
      { key: "admin", builtin: 1 },
      { key: "staff", builtin: 1 },
      { key: "student", builtin: 1 },
    ])

    const adminSections = db
      .prepare("SELECT section FROM role_permissions WHERE role = 'admin' ORDER BY section")
      .all() as { section: string }[]
    expect(adminSections.map((r) => r.section)).toContain("roles")
    expect(adminSections.map((r) => r.section)).toContain("profile")

    const perUser = db.prepare("SELECT COUNT(*) AS n FROM user_permissions").get() as { n: number }
    expect(perUser.n).toBe(0)
  })

  it("users table has the contact columns (nullable) without a role CHECK", () => {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as {
      sql: string
    }
    expect(row.sql).not.toMatch(/CHECK\s*\(\s*role\s+IN/i)
    const info = db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
    const columns = info.map((c) => c.name)
    for (const col of ["phone", "address", "guardian_name", "guardian_phone", "emergency_contact", "dob"]) {
      expect(columns).toContain(col)
    }
  })

  it("seeds a Sunday class slot", () => {
    const sunday = db.prepare("SELECT COUNT(*) AS n FROM schedule_slots WHERE day = 'Sun'").get() as { n: number }
    expect(sunday.n).toBeGreaterThan(0)
  })

  it("admin login uses the documented demo email", () => {
    const admin = db.prepare("SELECT email FROM users WHERE role = 'admin'").get() as { email: string }
    expect(admin.email).toBe("admin@flowdesk.edu")
  })

  it("check_ins only reference real users (foreign keys)", () => {
    const bad = db
      .prepare(
        `SELECT COUNT(*) AS n FROM check_ins c
         LEFT JOIN users u ON u.id = c.user_id WHERE u.id IS NULL`,
      )
      .get() as { n: number }
    expect(bad.n).toBe(0)
  })

  it("re-seeding is idempotent", () => {
    seedDatabase(db)
    const count = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }
    expect(count.n).toBe(9)
  })

  it("seeds students with hashable default passwords", async () => {
    const { verifyPassword } = await import("@/lib/db/password")
    const row = db.prepare("SELECT password_hash FROM users WHERE id = 'STU-2043'").get() as {
      password_hash: string
    }
    expect(verifyPassword("campus123", row.password_hash)).toBe(true)
  })
})
