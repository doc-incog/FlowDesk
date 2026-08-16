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
