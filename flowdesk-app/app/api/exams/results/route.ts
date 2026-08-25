import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

/**
 * Saves one student's marks for one exam (staff/admin). Re-saves overwrite
 * the previous value so marks stay editable.
 */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin" && user.role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: { examId?: string; studentId?: string; marks?: number | string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const examId = body.examId?.trim()
  const studentId = body.studentId?.trim()
  const marks = Number(body.marks)
  if (!examId || !studentId || !Number.isFinite(marks)) {
    return NextResponse.json({ error: "Exam, student and numeric marks are required" }, { status: 400 })
  }
  // Allow clearing a mark by submitting an empty value.
  if (marks < 0) {
    return NextResponse.json({ error: "Marks cannot be negative" }, { status: 400 })
  }

  const db = getDb()
  const exam = db
    .prepare("SELECT id, max_marks FROM exams WHERE id = ?")
    .get(examId) as { id: string; max_marks: number } | undefined
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 })

  const student = db.prepare("SELECT id FROM users WHERE id = ?").get(studentId)
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 })

  if (marks > exam.max_marks) {
    return NextResponse.json(
      { error: `Marks cannot exceed the maximum of ${exam.max_marks}` },
      { status: 400 },
    )
  }

  db.prepare("DELETE FROM results WHERE exam_id = ? AND student_id = ?").run(examId, studentId)
  if (body.marks !== "" && body.marks !== null && body.marks !== undefined) {
    const id = `RES-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    db.prepare(
      "INSERT INTO results (id, exam_id, student_id, marks, max_marks) VALUES (?, ?, ?, ?, ?)",
    ).run(id, examId, studentId, Math.floor(marks), exam.max_marks)
  }

  return NextResponse.json({
    ok: true,
    result:
      body.marks === "" || body.marks === null || body.marks === undefined
        ? null
        : { examId, studentId, marks: Math.floor(marks), maxMarks: exam.max_marks },
  })
}
