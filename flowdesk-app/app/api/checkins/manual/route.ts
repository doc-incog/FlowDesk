import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb, findUserById, mapUser } from "@/lib/db"
import { clockTime, localDate, localDateTime } from "@/lib/datetime"

export const runtime = "nodejs"

/**
 * POST /api/checkins/manual
 *
 * Staff/admin manually record a student's attendance for today when the
 * fingerprint scanner is unavailable (or a student missed it). Status can be
 * present / late / absent. Creates or updates the student's single check-in
 * row for today so the daily log, history and overview reflect it.
 *
 * Body: { studentId: string, status: 'present'|'late'|'absent', note?: string }
 */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "staff" && user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: { studentId?: string; status?: string; note?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const studentId = body.studentId?.trim()
  const status = body.status
  if (!studentId) return NextResponse.json({ error: "studentId is required" }, { status: 400 })
  if (status !== "present" && status !== "late" && status !== "absent") {
    return NextResponse.json({ error: "status must be present, late or absent" }, { status: 400 })
  }
  const note = body.note?.trim() ?? ""

  const db = getDb()
  const student = findUserById(studentId)
  if (!student) return NextResponse.json({ error: "Unknown student" }, { status: 404 })
  if (student.role !== "student") {
    return NextResponse.json({ error: "Only students can be marked" }, { status: 400 })
  }

  // Staff may only mark their own mentees.
  if (user.role === "staff") {
    const mentor = (db
      .prepare("SELECT id FROM mentors WHERE name = ?")
      .get(user.name) as { id: string } | undefined)
    const isMentee = db
      .prepare("SELECT id FROM users WHERE id = ? AND mentor_id = ?")
      .get(studentId, mentor?.id ?? "")
    if (!mentor || !isMentee) {
      return NextResponse.json({ error: "You can only mark attendance for your own mentees" }, { status: 403 })
    }
  }

  const today = localDate()
  const time = clockTime()
  const existing = db
    .prepare("SELECT id FROM check_ins WHERE user_id = ? AND substr(created_at, 1, 10) = ?")
    .get(student.id, today) as { id: string } | undefined

  const displayName = mapUser(student).name ?? note

  if (existing) {
    db.prepare(
      "UPDATE check_ins SET name = ?, role = ?, status = ?, time = ?, method = 'manual' WHERE id = ?",
    ).run(displayName, "student", status, time, existing.id)
    return NextResponse.json({
      record: { id: existing.id, userId: student.id, name: displayName, role: "student", time, status, method: "manual", source: "web" },
      created: false,
    })
  }

  const id = `ci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  db.prepare(
    `INSERT INTO check_ins (id, user_id, name, role, time, status, method, device_id, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'manual', NULL, 'web', ?)`,
  ).run(id, student.id, displayName, "student", time, status, localDateTime())

  return NextResponse.json({
    record: { id, userId: student.id, name: displayName, role: "student", time, status, method: "manual", source: "web" },
    created: true,
  }, { status: 201 })
}
