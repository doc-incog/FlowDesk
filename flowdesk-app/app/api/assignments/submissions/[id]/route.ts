import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin" && user.role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  let body: { marks?: number | string | null; feedback?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const db = getDb()
  const sub = db
    .prepare("SELECT id FROM submissions WHERE id = ?")
    .get(id) as { id: string } | undefined
  if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 })

  const updates: string[] = []
  const values: (number | string | null)[] = []

  if (body.marks !== undefined) {
    updates.push("marks = ?")
    values.push(body.marks === null || body.marks === "" ? null : Math.floor(Number(body.marks)))
  }
  if (body.feedback !== undefined) {
    updates.push("feedback = ?")
    values.push(body.feedback)
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  values.push(id)
  db.prepare(`UPDATE submissions SET ${updates.join(", ")} WHERE id = ?`).run(...values)

  const updated = db
    .prepare("SELECT id, assignment_id, student_id, student_name, submitted_at, file_name, marks, feedback FROM submissions WHERE id = ?")
    .get(id) as {
    id: string
    assignment_id: string
    student_id: string
    student_name: string
    submitted_at: string
    file_name: string
    marks: number | null
    feedback: string
  }

  return NextResponse.json({
    submission: {
      id: updated.id,
      assignmentId: updated.assignment_id,
      studentId: updated.student_id,
      studentName: updated.student_name,
      submittedAt: updated.submitted_at,
      fileName: updated.file_name,
      marks: updated.marks ?? undefined,
      feedback: updated.feedback,
    },
  })
}
