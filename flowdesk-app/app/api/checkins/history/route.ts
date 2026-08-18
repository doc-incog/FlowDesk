import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { localDate } from "@/lib/datetime"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const roleFilter = searchParams.get("role") // optional: "student" | "staff"

  const db = getDb()

  let query = `SELECT id, user_id, name, role, time, status, method, source, created_at FROM check_ins`
  const conditions: string[] = []
  const params: (string | number)[] = []

  // Role-based filtering
  if (user.role === "student") {
    // Students only see their own records
    conditions.push("user_id = ?")
    params.push(user.id)
  } else if (user.role === "staff") {
    // Staff see only mentees' records
    // Find the mentor record matching this staff member's name
    const mentorRow = db
      .prepare("SELECT id FROM mentors WHERE name = ?")
      .get(user.name) as { id: string } | undefined

    if (mentorRow) {
      const menteeRows = db
        .prepare("SELECT id FROM users WHERE mentor_id = ?")
        .all(mentorRow.id) as { id: string }[]

      if (menteeRows.length === 0) {
        return NextResponse.json({ date: localDate(), records: [], summary: { total: 0, present: 0, late: 0, absent: 0, percentage: 0 } })
      }

      const placeholders = menteeRows.map(() => "?").join(",")
      conditions.push(`user_id IN (${placeholders})`)
      params.push(...menteeRows.map((r) => r.id))
    } else {
      // Staff member has no mentor record — return empty
      return NextResponse.json({ date: localDate(), records: [], summary: { total: 0, present: 0, late: 0, absent: 0, percentage: 0 } })
    }
  }
  // Admin sees all records (no user_id filter)

  // Optional role filter (admin only)
  if (roleFilter && user.role === "admin" && (roleFilter === "student" || roleFilter === "staff")) {
    conditions.push("role = ?")
    params.push(roleFilter)
  }

  // Date range filtering
  if (from) {
    conditions.push("substr(created_at, 1, 10) >= ?")
    params.push(from)
  }
  if (to) {
    conditions.push("substr(created_at, 1, 10) <= ?")
    params.push(to)
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ")
  }

  query += " ORDER BY created_at DESC"

  // Limit to 365 records if no date range specified
  if (!from && !to) {
    query += " LIMIT 365"
  }

  const rows = db.prepare(query).all(...params) as {
    id: string
    user_id: string
    name: string
    role: string
    time: string
    status: string
    method: string
    source: string
    created_at: string
  }[]

  const records = rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    date: r.created_at.substring(0, 10),
    time: r.time,
    status: r.status,
    method: r.method,
    source: r.source,
  }))

  const total = records.length
  const present = records.filter((r) => r.status === "on-time").length
  const late = records.filter((r) => r.status === "late").length
  const absent = records.filter((r) => r.status === "absent").length
  const attended = present + late
  const percentage = total > 0 ? Math.round((attended / total) * 100) : 0

  return NextResponse.json({
    records,
    summary: { total, present, late, absent, percentage },
  })
}
