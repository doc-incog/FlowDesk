import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { findUserById, getDb, mapUser } from "@/lib/db"
import { roleSections, userOverrideSections } from "@/lib/permissions"
import { SECTION_KEYS } from "@/lib/constants"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

  const target = findUserById(userId)
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const db = getDb()
  return NextResponse.json({
    user: mapUser(target),
    defaults: roleSections(db, target.role),
    override: userOverrideSections(db, target.id),
    allSections: [...SECTION_KEYS],
  })
}

export async function PATCH(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: { userId?: string; sections?: string[] | null } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const userId = body.userId
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

  const db = getDb()
  const target = findUserById(userId)
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

  if (body.sections !== null && body.sections !== undefined) {
    if (!Array.isArray(body.sections)) {
      return NextResponse.json({ error: "sections must be an array or null" }, { status: 400 })
    }
    const cleaned = [...new Set(body.sections.filter((s): s is string => typeof s === "string"))]
    if (cleaned.some((s) => !SECTION_KEYS.includes(s as (typeof SECTION_KEYS)[number]))) {
      return NextResponse.json({ error: "sections contains an unknown section key" }, { status: 400 })
    }

    db.exec("BEGIN")
    try {
      db.prepare("DELETE FROM user_permissions WHERE user_id = ?").run(userId)
      for (const section of cleaned) {
        db.prepare("INSERT INTO user_permissions (user_id, section) VALUES (?, ?)").run(userId, section)
      }
      db.exec("COMMIT")
    } catch {
      db.exec("ROLLBACK")
      return NextResponse.json({ error: "Could not save permissions" }, { status: 500 })
    }
  } else if (body.sections === null) {
    // null → revert to the role's defaults.
    db.prepare("DELETE FROM user_permissions WHERE user_id = ?").run(userId)
  }

  return NextResponse.json({
    ok: true,
    override: userOverrideSections(db, userId),
    defaults: roleSections(db, target.role),
  })
}
