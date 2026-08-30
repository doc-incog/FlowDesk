import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const from = url.searchParams.get("from") ?? ""
  const to = url.searchParams.get("to") ?? ""
  const userId = url.searchParams.get("userId") ?? ""
  const roleFilter = url.searchParams.get("role") ?? ""
  const name = url.searchParams.get("name") ?? ""

  const db = getDb()

  // Build dynamic WHERE clauses
  const conditions: string[] = []
  const params: string[] = []

  if (from) {
    conditions.push("substr(c.created_at, 1, 10) >= ?")
    params.push(from)
  }
  if (to) {
    conditions.push("substr(c.created_at, 1, 10) <= ?")
    params.push(to)
  }

  // Role-based access control
  if (user.role === "student") {
    // Students can only see their own records
    conditions.push("c.user_id = ?")
    params.push(user.id)
  } else if (user.role === "staff") {
    // Staff can only ever see their mentees' records
    if (userId) {
      conditions.push("c.user_id = ?")
      params.push(userId)
    } else {
      // Get mentee IDs from the mentor relationship (staff user -> mentors -> students)
      const mentor = db
        .prepare("SELECT id FROM mentors WHERE name = ? OR id = ?")
        .get(user.name, user.mentorId ?? "") as { id: string } | undefined
      if (!mentor) {
        return NextResponse.json({ records: [], summary: { total: 0, present: 0, late: 0, absent: 0, percentage: 0 } })
      }
      const menteeIds = db
        .prepare("SELECT id FROM users WHERE mentor_id = ? AND is_deleted = 0")
        .all(mentor.id) as { id: string }[]
      if (menteeIds.length === 0) {
        return NextResponse.json({ records: [], summary: { total: 0, present: 0, late: 0, absent: 0, percentage: 0 } })
      }
      conditions.push(`c.user_id IN (${menteeIds.map(() => "?").join(",")})`)
      params.push(...menteeIds.map((m) => m.id))
    }
  } else if (user.role === "admin") {
    // Admins can see everyone, optionally filtered
    if (userId) {
      conditions.push("c.user_id = ?")
      params.push(userId)
    } else if (roleFilter && roleFilter !== "all") {
      conditions.push("c.role = ?")
      params.push(roleFilter)
    }
  }

  // Optional name filter (scoped within the role logic above)
  if (name) {
    conditions.push("u.name LIKE ?")
    params.push(`%${name}%`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const rows = db
    .prepare(
      `SELECT c.id, c.user_id, u.name, u.role, c.time, c.status, c.method, c.source, c.created_at
       FROM check_ins c
       JOIN users u ON u.id = c.user_id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT 500`,
    )
    .all(...params) as {
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
    userId: r.user_id,
    name: r.name,
    role: r.role,
    date: r.created_at.slice(0, 10),
    time: r.time,
    status: r.status as "on-time" | "late" | "absent",
    method: r.method,
    source: r.source,
  }))

  const total = records.length
  const present = records.filter((r) => r.status === "on-time").length
  const late = records.filter((r) => r.status === "late").length
  const absent = records.filter((r) => r.status === "absent").length
  const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0

  return NextResponse.json({
    records,
    summary: { total, present, late, absent, percentage },
  })
}
