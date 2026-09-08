import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { localDate } from "@/lib/datetime"
import { buildAttendancePdf } from "@/lib/attendance-pdf"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(request.url)
  const from = url.searchParams.get("from") ?? ""
  const to = url.searchParams.get("to") ?? ""

  const db = getDb()
  const conditions: string[] = ["c.user_id = ?"]
  const params: string[] = [user.id]
  if (from) {
    conditions.push("substr(c.created_at, 1, 10) >= ?")
    params.push(from)
  }
  if (to) {
    conditions.push("substr(c.created_at, 1, 10) <= ?")
    params.push(to)
  }

  const rows = db
    .prepare(
      `SELECT c.time, c.status, c.method, c.created_at
       FROM check_ins c
       WHERE ${conditions.join(" AND ")}
       ORDER BY c.created_at ASC`,
    )
    .all(...params) as { time: string; status: string; method: string; created_at: string }[]

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No attendance records found for the selected date range" },
      { status: 400 },
    )
  }

  const records = rows.map((r) => ({
    date: r.created_at.slice(0, 10),
    time: r.time,
    method: r.method,
    status: r.status as "on-time" | "late" | "absent",
  }))

  const total = records.length
  const present = records.filter((r) => r.status === "on-time").length
  const late = records.filter((r) => r.status === "late").length
  const absent = records.filter((r) => r.status === "absent").length
  const percentage = Math.round(((present + late) / total) * 100)

  const pdf = await buildAttendancePdf({
    studentName: user.name,
    studentId: user.id,
    from: from || records[0].date,
    to: to || records[records.length - 1].date,
    generatedAt: localDate(),
    records,
    summary: { total, present, late, absent, percentage },
  })

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="attendance-history-${user.id}.pdf"`,
    },
  })
}