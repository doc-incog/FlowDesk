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

  // Staff/admin see all submissions; students see only their own.
  const isStaffOrAdmin = user.role === "admin" || user.role === "staff"
  const submissionRows = db
    .prepare(
      isStaffOrAdmin
        ? "SELECT id, assignment_id, student_id, student_name, submitted_at, file_name, marks, feedback FROM submissions"
        : "SELECT id, assignment_id, student_id, student_name, submitted_at, file_name, marks, feedback FROM submissions WHERE student_id = ?",
    )
    .all(...(isStaffOrAdmin ? [] : [user.id])) as {
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

  // For students, map assignment to their single submission; for staff/admin, submissions are separate.
  const mySubmission = new Map(submissions.filter((s) => s.studentId === user.id).map((s) => [s.assignmentId, s]))

  const assignments = assignmentRows.map((a) => ({
    id: a.id,
    moduleCode: a.module_code,
    moduleName: a.module_name,
    title: a.title,
    description: a.description,
    assignedDate: a.assigned_date,
    dueDate: a.due_date,
    maxMarks: a.max_marks,
    submission: mySubmission.get(a.id),
  }))

  return NextResponse.json({ assignments, submissions })
}

/** Creates an assignment visible to every workspace (staff/admin). */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin" && user.role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: {
    moduleCode?: string
    moduleName?: string
    title?: string
    description?: string
    assignedDate?: string
    dueDate?: string
    maxMarks?: number | string
  } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const moduleCode = body.moduleCode?.trim()
  const moduleName = body.moduleName?.trim()
  const title = body.title?.trim()
  const description = body.description?.trim() ?? ""
  const assignedDate = body.assignedDate?.trim()
  const dueDate = body.dueDate?.trim()
  if (!moduleCode || !moduleName || !title || !dueDate) {
    return NextResponse.json(
      { error: "Course code, course name, title and due date are required" },
      { status: 400 },
    )
  }

  const maxMarksRaw = Number(body.maxMarks ?? 100)
  const maxMarks = Number.isFinite(maxMarksRaw) ? Math.floor(maxMarksRaw) : NaN
  if (!Number.isFinite(maxMarks) || maxMarks < 1 || maxMarks > 1000) {
    return NextResponse.json({ error: "Max marks must be between 1 and 1000" }, { status: 400 })
  }

  const db = getDb()
  const id = `ASG-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`
  db.prepare(
    `INSERT INTO assignments (id, module_code, module_name, title, description, assigned_date, due_date, max_marks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    moduleCode,
    moduleName,
    title,
    description,
    assignedDate || new Date().toISOString().slice(0, 10),
    dueDate,
    maxMarks,
  )

  return NextResponse.json(
    {
      ok: true,
      assignment: {
        id,
        moduleCode,
        moduleName,
        title,
        description,
        assignedDate: assignedDate || new Date().toISOString().slice(0, 10),
        dueDate,
        maxMarks,
        submission: null,
      },
    },
    { status: 201 },
  )
}
