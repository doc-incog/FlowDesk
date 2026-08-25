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
  const role = url.searchParams.get("role") ?? ""

  const db = getDb()

  let where = "WHERE 1=1"
  const params: string[] = []

  if (from) {
    where += " AND c.created_at >= ?"
    params.push(from)
  }
  if (to) {
    where += " AND c.created_at <= ?"
    params.push(to + " 23:59:59")
  }
  if (userId) {
    where += " AND c.user_id = ?"
    params.push(userId)
  } else if (role && role !== "all") {
    where += " AND c.role = ?"
    params.push(role)
  } else if (user.role === "student") {
    where += " AND c.user_id = ?"
    params.push(user.id)
  }

  const rows = db
    .prepare(
      `SELECT c.id, c.user_id, c.name, c.role, c.time, c.status, c.method, c.source, c.created_at
       FROM check_ins c ${where}
       ORDER BY c.created_at DESC, c.time DESC`,
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
    time: r.time,
    status: r.status,
    method: r.method,
    source: r.source,
    createdAt: r.created_at,
  }))

  const total = records.length
  const onTime = records.filter((r) => r.status === "on-time").length
  const late = records.filter((r) => r.status === "late").length
  const absent = records.filter((r) => r.status === "absent").length

  return NextResponse.json({
    records,
    summary: { total, onTime, late, absent },
  })
}
