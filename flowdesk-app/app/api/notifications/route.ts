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

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()

  // Try to parse body — if empty or no JSON, treat as "mark all read"
  let body: { title?: string; body?: string; category?: string; target?: string } = {}
  try {
    body = await request.json()
  } catch {
    // No JSON body — mark all as read (legacy behavior)
    db.prepare("UPDATE notifications SET unread = 0 WHERE user_id IS NULL OR user_id = ?").run(user.id)
    return NextResponse.json({ ok: true })
  }

  // If title is provided, this is a notification creation request (admin only)
  if (body.title) {
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Only admins can send notifications" }, { status: 403 })
    }

    const title = body.title.trim()
    const notifBody = (body.body ?? "").trim()
    const category = body.category ?? "system"
    const target = body.target ?? "all"

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const time = "Just now"
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    if (target === "all") {
      // Broadcast to everyone
      db.prepare(
        "INSERT INTO notifications (id, title, body, time, category, unread, user_id) VALUES (?, ?, ?, ?, ?, 1, NULL)",
      ).run(id, title, notifBody, time, category)
    } else if (target === "staff" || target === "students") {
      // Send to specific role
      const roleKey = target === "staff" ? "staff" : "student"
      const users = db
        .prepare("SELECT id FROM users WHERE role = ?")
        .all(roleKey) as { id: string }[]

      const insert = db.prepare(
        "INSERT INTO notifications (id, title, body, time, category, unread, user_id) VALUES (?, ?, ?, ?, ?, 1, ?)",
      )
      for (const u of users) {
        insert.run(`${id}-${u.id}`, title, notifBody, time, category, u.id)
      }
    }

    return NextResponse.json({ ok: true, id })
  }

  // Default: mark all as read
  db.prepare("UPDATE notifications SET unread = 0 WHERE user_id IS NULL OR user_id = ?").run(user.id)
  return NextResponse.json({ ok: true })
}
