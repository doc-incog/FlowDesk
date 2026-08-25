import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { localDate } from "@/lib/datetime"

export const runtime = "nodejs"

const EMPTY_SUMMARY = { total: 0, present: 0, late: 0, absent: 0, percentage: 0 }

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const roleFilter = searchParams.get("role") // optional: "student" | "staff"
  const personId = searchParams.get("userId") // optional: per-person history

  const db = getDb()

  let query = `SELECT id, user_id, name, role, time, status, method, source, created_at FROM check_ins`
  const conditions: string[] = []
  const params: (string | number)[] = []

  // Staff can only see their own mentees. Resolve them up front so the same
  // set also authorises per-person lookups.
  let menteeIds: string[] | null = null
  if (user.role === "student") {
    // Students only see their own records
    conditions.push("user_id = ?")
    params.push(user.id)
  } else if (user.role === "staff") {
    // Find the mentor record matching this staff member's name
    const mentorRow = db
      .prepare("SELECT id FROM mentors WHERE name = ?")
      .get(user.name) as { id: string } | undefined

    menteeIds = mentorRow
      ? (db.prepare("SELECT id FROM users WHERE mentor_id = ?").all(mentorRow.id) as { id: string }[]).map(
          (r) => r.id,
        )
      : []

    if (menteeIds.length === 0) {
      return NextResponse.json({ date: localDate(), records: [], summary: EMPTY_SUMMARY })
    }
  }
  // Admin sees all records unless a specific person is requested

  // Per-person history: admins may query anyone, staff only their mentees.
  if (personId) {
    if (user.role === "admin") {
      const target = db.prepare("SELECT id FROM users WHERE id = ?").get(personId)
      if (!target) return NextResponse.json({ error: "Person not found" }, { status: 404 })
    } else if (user.role === "staff") {
      if (!menteeIds!.includes(personId)) {
        return NextResponse.json({ error: "You can only view your mentees' attendance" }, { status: 403 })
      }
    } else {
      // Students are always scoped to themselves below
    }
    conditions.push("user_id = ?")
    params.push(personId)
  } else if (menteeIds) {
    const placeholders = menteeIds.map(() => "?").join(",")
    conditions.push(`user_id IN (${placeholders})`)
    params.push(...menteeIds)
  }

  // Optional role filter (admin only, ignored when a specific person is chosen)
  if (!personId && roleFilter && user.role === "admin" && (roleFilter === "student" || roleFilter === "staff")) {
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
    userId: r.user_id,
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
