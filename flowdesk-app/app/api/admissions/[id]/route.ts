import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

// DELETE /api/admissions/[id] — admin removes an admission application.
// The admin UI only exposes Delete for decided (accepted/rejected) applications;
// admission status is not persisted server-side, so deletion is gated by admin
// role here and by the record's status in the UI.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const db = getDb()
  const result = db.prepare("DELETE FROM admission_applications WHERE id = ?").run(id)
  if (result.changes === 0) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}