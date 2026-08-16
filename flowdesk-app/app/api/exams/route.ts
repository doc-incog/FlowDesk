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

  return NextResponse.json({ exams })
}
