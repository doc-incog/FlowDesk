import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

// POST /api/feedback/targets — create a feedback form/target (admin only)
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: { type?: string; name?: string; subtitle?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const type = body.type?.trim() || "general"
  const name = body.name?.trim()
  const subtitle = body.subtitle?.trim() ?? ""

  if (!name) {
    return NextResponse.json({ error: "A title is required" }, { status: 400 })
  }
  if (type.length > 40) {
    return NextResponse.json({ error: "Category is too long" }, { status: 400 })
  }

  const db = getDb()
  const id = `T${Date.now()}`
  db.prepare("INSERT INTO feedback_targets (id, type, name, subtitle) VALUES (?, ?, ?, ?)").run(
    id,
    type,
    name,
    subtitle,
  )

  return NextResponse.json({ target: { id, type, name, subtitle } }, { status: 201 })
}
