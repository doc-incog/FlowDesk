import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()

  const assignmentRows = db
    .prepare("SELECT id, module_code, module_name, title, description, assigned_date, due_date, max_marks FROM assignments ORDER BY due_date")
    .all() as {
    id: string
    module_code: string
    module_name: string
    title: string
    description: string
    assigned_date: string
    due_date: string
    max_marks: number
  }[]

  const submissionRows = db
    .prepare("SELECT id, assignment_id, student_id, student_name, submitted_at, file_name, marks, feedback FROM submissions WHERE student_id = ?")
    .all(user.id) as {
    id: string
    assignment_id: string
    student_id: string
    student_name: string
    submitted_at: string
    file_name: string
    marks: number | null
    feedback: string
  }[]

  const submissions = submissionRows.map((s) => ({
    id: s.id,
    assignmentId: s.assignment_id,
    studentId: s.student_id,
    studentName: s.student_name,
    submittedAt: s.submitted_at,
    fileName: s.file_name,
    marks: s.marks ?? undefined,
    feedback: s.feedback,
  }))

  const byAssignment = new Map(submissions.map((s) => [s.assignmentId, s]))

  const assignments = assignmentRows.map((a) => ({
    id: a.id,
    moduleCode: a.module_code,
    moduleName: a.module_name,
    title: a.title,
    description: a.description,
    assignedDate: a.assigned_date,
    dueDate: a.due_date,
    maxMarks: a.max_marks,
    submission: byAssignment.get(a.id),
  }))

  return NextResponse.json({ assignments, submissions })
}
