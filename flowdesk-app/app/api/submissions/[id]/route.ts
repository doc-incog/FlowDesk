import { NextResponse } from "next/server"
import { unlinkSync } from "node:fs"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const db = getDb()

  const sub = db
    .prepare("SELECT id, student_id, file_path FROM submissions WHERE id = ?")
    .get(id) as { id: string; student_id: string; file_path: string | null } | undefined
  if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 })
  if (sub.student_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Delete the uploaded file from disk
  if (sub.file_path) {
    try {
      unlinkSync(sub.file_path)
    } catch {
      // File may already be gone — continue with DB deletion
    }
  }

  db.prepare("DELETE FROM submissions WHERE id = ?").run(id)

  return NextResponse.json({ ok: true })
}
