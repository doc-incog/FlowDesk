import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = getDb()
    .prepare(
      `SELECT id, title, body, time, category, unread
       FROM notifications WHERE user_id IS NULL OR user_id = ?
       ORDER BY CASE category WHEN 'alert' THEN 0 WHEN 'academic' THEN 1 WHEN 'event' THEN 2 ELSE 3 END, time`,
    )
    .all(user.id) as { id: string; title: string; body: string; time: string; category: string; unread: number }[]

  return NextResponse.json({
    notifications: rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      time: n.time,
      category: n.category,
      unread: n.unread === 1,
    })),
  })
}

export async function POST() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  getDb()
    .prepare("UPDATE notifications SET unread = 0 WHERE user_id IS NULL OR user_id = ?")
    .run(user.id)

  return NextResponse.json({ ok: true })
}
