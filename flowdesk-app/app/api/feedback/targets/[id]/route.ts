import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

// DELETE /api/feedback/targets/[id] — remove a feedback form (admin only)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const db = getDb()

  const target = db.prepare("SELECT id FROM feedback_targets WHERE id = ?").get(id)
  if (!target) return NextResponse.json({ error: "Form not found" }, { status: 404 })

  // Remove the target and its associated entries (mirrors the UI's local state)
  db.prepare("DELETE FROM feedback_entries WHERE target_id = ?").run(id)
  db.prepare("DELETE FROM feedback_targets WHERE id = ?").run(id)

  return NextResponse.json({ ok: true })
}
