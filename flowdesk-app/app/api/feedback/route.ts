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
