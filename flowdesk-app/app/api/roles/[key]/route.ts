import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { roleSections } from "@/lib/permissions"
import { SECTION_KEYS } from "@/lib/seed-data/core"

export const runtime = "nodejs"

const ROLE_KEY_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/

function validSections(sections: unknown): string[] | null {
  if (!Array.isArray(sections)) return null
  const cleaned = [...new Set(sections.filter((s): s is string => typeof s === "string"))]
  if (cleaned.some((s) => !SECTION_KEYS.includes(s as (typeof SECTION_KEYS)[number]))) return null
  return cleaned
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { key } = await params
  let body: { label?: string; blurb?: string; accent?: string; sections?: unknown; newKey?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const db = getDb()
  const existing = db.prepare("SELECT * FROM roles WHERE key = ?").get(key) as
    | { key: string; label: string; blurb: string; accent: string; builtin: number }
    | undefined
  if (!existing) return NextResponse.json({ error: "Role not found" }, { status: 404 })

  const sections = validSections(body.sections)
  if (body.sections !== undefined && sections === null) {
    return NextResponse.json({ error: "sections must be an array of known section keys" }, { status: 400 })
  }

  const label = body.label?.trim() ?? existing.label
  const blurb = body.blurb?.trim() ?? existing.blurb
  const accent = body.accent?.trim() ?? existing.accent
  const newKey = body.newKey?.trim().toLowerCase()

  if (newKey && newKey !== key) {
    if (!ROLE_KEY_RE.test(newKey)) {
      return NextResponse.json({ error: "Role key must be 1–32 chars: lowercase letters, digits, - or _." }, { status: 400 })
    }
    const clash = db.prepare("SELECT key FROM roles WHERE key = ?").get(newKey) as { key: string } | undefined
    if (clash) return NextResponse.json({ error: "A role with that key already exists" }, { status: 409 })
  }

  const target = newKey && newKey !== key ? newKey : key

  db.exec("BEGIN")
  try {
    if (newKey && newKey !== key) {
      // Copy the row under the new key, then re-point people and permissions.
      db.prepare("INSERT INTO roles (key, label, blurb, accent, builtin) VALUES (?, ?, ?, ?, ?)").run(
        newKey,
        label,
        blurb,
        accent,
        existing.builtin,
      )
      db.prepare("UPDATE users SET role = ? WHERE role = ?").run(newKey, key)
      db.prepare("UPDATE role_permissions SET role = ? WHERE role = ?").run(newKey, key)
      db.prepare("DELETE FROM roles WHERE key = ?").run(key)
    } else {
      db.prepare("UPDATE roles SET label = ?, blurb = ?, accent = ? WHERE key = ?").run(label, blurb, accent, key)
    }

    if (sections !== null) {
      db.prepare("DELETE FROM role_permissions WHERE role = ?").run(target)
      for (const section of sections ?? []) {
        db.prepare("INSERT INTO role_permissions (role, section) VALUES (?, ?)").run(target, section)
      }
    }
    db.exec("COMMIT")
  } catch (err) {
    db.exec("ROLLBACK")
    return NextResponse.json({ error: "Could not update role" }, { status: 500 })
  }

  const count = (
    db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = ?").get(target) as { n: number }
  ).n
  return NextResponse.json({
    ok: true,
    role: {
      key: target,
      label,
      blurb,
      accent,
      builtin: existing.builtin === 1,
      sections: sections !== null ? sections ?? [] : roleSections(db, target),
      users: count,
    },
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { key } = await params
  const db = getDb()
  const existing = db.prepare("SELECT builtin FROM roles WHERE key = ?").get(key) as { builtin: number } | undefined
  if (!existing) return NextResponse.json({ error: "Role not found" }, { status: 404 })
  if (existing.builtin === 1) {
    return NextResponse.json({ error: "Built-in roles cannot be deleted" }, { status: 400 })
  }

  const assigned = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = ?").get(key) as { n: number }).n
  if (assigned > 0) {
    return NextResponse.json({ error: "Move people out of this role before deleting it" }, { status: 400 })
  }

  db.prepare("DELETE FROM roles WHERE key = ?").run(key) // role_permissions cascade
  return NextResponse.json({ ok: true })
}
