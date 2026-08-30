import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

// DELETE /api/admissions/programs/[id] — permanently remove a course (admin only)
// Blocked if the course already has admission applications, so historical
// applications keep a valid program reference.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const db = getDb()

  const program = db.prepare("SELECT id FROM programs WHERE id = ?").get(id) as { id: string } | undefined
  if (!program) return NextResponse.json({ error: "Course not found" }, { status: 404 })

  const apps = db
    .prepare("SELECT COUNT(*) AS n FROM admission_applications WHERE program_id = ?")
    .get(id) as { n: number }
  if (apps.n > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${apps.n} admission application${apps.n === 1 ? "" : "s"} reference this course.` },
      { status: 409 },
    )
  }

  db.prepare("DELETE FROM programs WHERE id = ?").run(id)
  return NextResponse.json({ ok: true })
}
