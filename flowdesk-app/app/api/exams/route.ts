import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()

  const examRows = db
    .prepare("SELECT id, title, module_code, module_name, type, date, start, end, room, max_marks FROM exams ORDER BY date")
    .all() as {
    id: string
    title: string
    module_code: string
    module_name: string
    type: "midterm" | "final" | "practical"
    date: string
    start: string
    end: string
    room: string
    max_marks: number
  }[]

  const resultRows = db
    .prepare("SELECT exam_id, marks, max_marks FROM results WHERE student_id = ?")
    .all(user.id) as { exam_id: string; marks: number; max_marks: number }[]

  const byExam = new Map(resultRows.map((r) => [r.exam_id, r]))

  const exams = examRows.map((e) => {
    const result = byExam.get(e.id)
    return {
      id: e.id,
      title: e.title,
      moduleCode: e.module_code,
      moduleName: e.module_name,
      type: e.type,
      date: e.date,
      start: e.start,
      end: e.end,
      room: e.room,
      maxMarks: e.max_marks,
      result: result ? { marks: result.marks, maxMarks: result.max_marks } : undefined,
    }
  })

  // Staff/admin additionally receive every student's marks so the mark-entry
  // grid can pre-fill saved values.
  const allResults =
    user.role === "admin" || user.role === "staff"
      ? (
          db.prepare("SELECT exam_id, student_id, marks, max_marks FROM results").all() as {
            exam_id: string
            student_id: string
            marks: number
            max_marks: number
          }[]
        ).map((r) => ({
          examId: r.exam_id,
          studentId: r.student_id,
          marks: r.marks,
          maxMarks: r.max_marks,
        }))
      : []

  return NextResponse.json({ exams, results: allResults })
}

/** Creates an exam visible to every workspace (staff/admin). */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin" && user.role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: {
    title?: string
    moduleCode?: string
    moduleName?: string
    type?: string
    date?: string
    start?: string
    end?: string
    room?: string
    maxMarks?: number | string
  } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const title = body.title?.trim()
  const moduleCode = body.moduleCode?.trim()
  const moduleName = body.moduleName?.trim()
  const type = body.type?.trim()
  const date = body.date?.trim()
  const start = body.start?.trim()
  const end = body.end?.trim()
  const room = body.room?.trim()
  if (!title || !moduleCode || !moduleName || !type || !date || !start || !end || !room) {
    return NextResponse.json(
      { error: "Title, course code, course name, type, date, times and room are required" },
      { status: 400 },
    )
  }
  if (!["midterm", "final", "practical"].includes(type)) {
    return NextResponse.json({ error: "Type must be midterm, final or practical" }, { status: 400 })
  }

  const maxMarksRaw = Number(body.maxMarks ?? 100)
  const maxMarks = Number.isFinite(maxMarksRaw) ? Math.floor(maxMarksRaw) : NaN
  if (!Number.isFinite(maxMarks) || maxMarks < 1 || maxMarks > 1000) {
    return NextResponse.json({ error: "Max marks must be between 1 and 1000" }, { status: 400 })
  }

  const db = getDb()
  const id = `EXM-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`
  db.prepare(
    `INSERT INTO exams (id, title, module_code, module_name, type, date, start, end, room, max_marks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, title, moduleCode, moduleName, type, date, start, end, room, maxMarks)

  return NextResponse.json(
    {
      ok: true,
      exam: {
        id,
        title,
        moduleCode,
        moduleName,
        type,
        date,
        start,
        end,
        room,
        maxMarks,
        result: undefined,
      },
    },
    { status: 201 },
  )
}
