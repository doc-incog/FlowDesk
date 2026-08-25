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
  if (user.role !== "staff" && user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  let body: { marks?: number | null; feedback?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const db = getDb()
  const submission = db
    .prepare("SELECT id, assignment_id, marks FROM submissions WHERE id = ?")
    .get(id) as { id: string; assignment_id: string; marks: number | null } | undefined
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 })

  const assignment = db
    .prepare("SELECT max_marks FROM assignments WHERE id = ?")
    .get(submission.assignment_id) as { max_marks: number } | undefined
  const maxMarks = assignment?.max_marks ?? 100

  const marks = body.marks === null || body.marks === undefined ? null : Number(body.marks)
  if (marks !== null && (marks < 0 || marks > maxMarks)) {
    return NextResponse.json({ error: `Marks must be between 0 and ${maxMarks}` }, { status: 400 })
  }

  const feedback = body.feedback ?? ""

  db.prepare("UPDATE submissions SET marks = ?, feedback = ? WHERE id = ?").run(
    marks,
    feedback,
    id,
  )

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const db = getDb()
  const submission = db
    .prepare("SELECT id, student_id, marks FROM submissions WHERE id = ?")
    .get(id) as { id: string; student_id: string; marks: number | null } | undefined
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 })

  if (user.role === "student") {
    if (submission.student_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (submission.marks !== null) {
      return NextResponse.json(
        { error: "Cannot withdraw a graded submission" },
        { status: 409 },
      )
    }
  } else if (user.role !== "staff" && user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  db.prepare("DELETE FROM submissions WHERE id = ?").run(id)

  return NextResponse.json({ ok: true })
}
