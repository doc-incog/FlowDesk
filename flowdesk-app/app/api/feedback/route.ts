import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()

  const targets = db
    .prepare("SELECT id, type, name, subtitle FROM feedback_targets ORDER BY name")
    .all() as { id: string; type: string; name: string; subtitle: string }[]

  const entries = db
    .prepare("SELECT id, target_id, rating, comment, by_name, created_at FROM feedback_entries ORDER BY created_at DESC")
    .all() as { id: string; target_id: string; rating: number; comment: string; by_name: string; created_at: string }[]

  return NextResponse.json({
    targets: targets.map((t) => ({ id: t.id, type: t.type, name: t.name, subtitle: t.subtitle })),
    entries: entries.map((e) => ({ id: e.id, targetId: e.target_id, rating: e.rating, comment: e.comment, byName: e.by_name, createdAt: e.created_at })),
  })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { targetId?: string; rating?: number; comment?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const targetId = body.targetId?.trim()
  const rating = body.rating
  const comment = body.comment?.trim() ?? ""

  if (!targetId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "targetId and rating (1-5) are required" }, { status: 400 })
  }

  const db = getDb()

  // Check target exists
  const target = db.prepare("SELECT id FROM feedback_targets WHERE id = ?").get(targetId)
  if (!target) return NextResponse.json({ error: "Feedback target not found" }, { status: 404 })

  // Check for existing feedback from this user on this target
  const existing = db
    .prepare("SELECT id FROM feedback_entries WHERE target_id = ? AND by_name = ?")
    .get(targetId, user.name) as { id: string } | undefined

  if (existing) {
    // Update existing feedback
    db.prepare("UPDATE feedback_entries SET rating = ?, comment = ? WHERE id = ?")
      .run(rating, comment, existing.id)
    return NextResponse.json({
      entry: { id: existing.id, targetId, rating, comment, byName: user.name, createdAt: new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) },
    })
  }

  const id = `F${Date.now()}`
  const createdAt = new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })

  db.prepare(
    "INSERT INTO feedback_entries (id, target_id, rating, comment, by_name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, targetId, rating, comment, user.name, createdAt)

  return NextResponse.json({
    entry: { id, targetId, rating, comment, byName: user.name, createdAt },
  }, { status: 201 })
}
