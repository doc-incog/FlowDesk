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

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()
  const rows = db
    .prepare("SELECT key, label, blurb, accent, builtin FROM roles ORDER BY builtin DESC, key")
    .all() as {
    key: string
    label: string
    blurb: string
    accent: string
    builtin: number
  }[]

  const roles = rows.map((r) => {
    const count = (
      db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = ?").get(r.key) as { n: number }
    ).n
    return { ...r, builtin: r.builtin === 1, sections: roleSections(db, r.key), users: count }
  })

  return NextResponse.json({ roles })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: { key?: string; label?: string; blurb?: string; accent?: string; sections?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const key = body.key?.trim().toLowerCase() ?? ""
  const label = body.label?.trim()
  if (!ROLE_KEY_RE.test(key)) {
    return NextResponse.json({ error: "Role key must be 1–32 chars: lowercase letters, digits, - or _." }, { status: 400 })
  }
  if (!label) return NextResponse.json({ error: "Role label is required" }, { status: 400 })

  const sections = validSections(body.sections)
  if (body.sections !== undefined && sections === null) {
    return NextResponse.json({ error: "sections must be an array of known section keys" }, { status: 400 })
  }

  const db = getDb()
  const existing = db.prepare("SELECT key FROM roles WHERE key = ?").get(key) as { key: string } | undefined
  if (existing) return NextResponse.json({ error: "A role with that key already exists" }, { status: 409 })

  db.exec("BEGIN")
  try {
    db.prepare("INSERT INTO roles (key, label, blurb, accent, builtin) VALUES (?, ?, ?, ?, 0)").run(
      key,
      label,
      body.blurb?.trim() ?? "",
      body.accent?.trim() ?? "chart-5",
    )
    for (const section of sections ?? []) {
      db.prepare("INSERT INTO role_permissions (role, section) VALUES (?, ?)").run(key, section)
    }
    db.exec("COMMIT")
  } catch (err) {
    db.exec("ROLLBACK")
    return NextResponse.json({ error: "Could not create role" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, role: { key, label, blurb: body.blurb ?? "", accent: body.accent ?? "chart-5", builtin: false, sections: sections ?? [], users: 0 } }, { status: 201 })
}
